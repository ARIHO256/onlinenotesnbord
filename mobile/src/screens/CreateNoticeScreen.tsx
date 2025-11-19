import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import HeaderBar from '../components/HeaderBar';
import PrimaryButton from '../components/PrimaryButton';
import FormTextInput from '../components/FormTextInput';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import OptionPicker from '../components/OptionPicker';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import {
  getAllowedCategoryLabels,
  getNoticeCategoryLabel,
  getNoticeCategoryValueFromLabel,
  NOTICE_PRIORITY_VALUES,
  NOTICE_PRIORITY_LABELS,
  getNoticePriorityColor,
} from '../constants/notices';
import type { NoticeCategory, NoticePriority } from '../constants/notices';
import DateTimePicker from '@react-native-community/datetimepicker';
import SectionHeading from '../components/SectionHeading';

const FALLBACK_AVATAR = require('../../assets/bu-logo.png');

const FORM_CATEGORY_VALUES = ['campus_life', 'business', 'education'] as const;
const formSchema = z.object({
  title: z.string().trim().min(3, 'Title is required'),
  description: z.string().trim().min(10, 'Description is required'),
  department: z.string().optional(),
  category: z.enum(FORM_CATEGORY_VALUES),
  priority: z.enum(['urgent', 'important', 'normal']).optional(),
  expires_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PendingAttachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'video' | 'audio' | 'document';
  size?: number | null;
};

type UserMeta = {
  isFaculty: boolean;
  isStaff: boolean;
  designation: string;
};

const LEADERSHIP_KEYWORDS = ['registrar', 'administrator', 'admin', 'hod', 'head of department'];

const makeId = () => `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ensureMimeType = (attachment: PendingAttachment) => {
  if (attachment.mimeType) return attachment.mimeType;
  switch (attachment.kind) {
    case 'image':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
};

function CreateNoticeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [userMeta, setUserMeta] = useState<UserMeta>({ isFaculty: false, isStaff: false, designation: '' });
  const [ready, setReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [priority, setPriority] = useState<NoticePriority>('normal');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const initialDepartmentRef = useRef<string>('');

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      department: '',
      category: 'campus_life',
    },
  });

  const categoryValue = watch('category');

  const canPostEducation = useMemo(() => {
    if (userMeta.isStaff) return true;
    if (!userMeta.isFaculty) return false;
    const normalized = userMeta.designation.toLowerCase();
    return LEADERSHIP_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }, [userMeta.designation, userMeta.isFaculty, userMeta.isStaff]);

  const isHod = useMemo(() => {
    if (!userMeta.designation) return false;
    const normalized = userMeta.designation.toLowerCase();
    return LEADERSHIP_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }, [userMeta.designation]);

  const isStudent = useMemo(
    () => !userMeta.isStaff && !userMeta.isFaculty,
    [userMeta.isFaculty, userMeta.isStaff],
  );
  const isCasualUser = isStudent;
  const creationNoun = isCasualUser ? 'post' : 'notice';

  const canEditDepartment = useMemo(
    () => userMeta.isStaff || isHod,
    [isHod, userMeta.isStaff],
  );

  const allowedCategoryValues = useMemo<NoticeCategory[]>(() => {
    const base: NoticeCategory[] = ['campus_life', 'business'];
    if (canPostEducation) {
      base.push('education');
    }
    return base;
  }, [canPostEducation]);

  const ensureStudentTitle = useCallback(
    (body: string) => {
      const trimmed = body.trim();
      if (!trimmed) {
        return 'Student Post';
      }
      const firstLine = trimmed.split(/\r?\n/)[0] ?? trimmed;
      const normalized = firstLine.replace(/\s+/g, ' ').trim();
      const title = normalized.slice(0, 80);
      return title.length >= 3 ? title : `${title}...`.slice(0, 10) || 'Student Post';
    },
    [],
  );

  useEffect(() => {
    if (!allowedCategoryValues.includes(categoryValue as NoticeCategory)) {
      const fallback = allowedCategoryValues[0] ?? 'campus_life';
      setValue('category', fallback as FormValues['category'], { shouldValidate: true });
    }
  }, [allowedCategoryValues, categoryValue, setValue]);

  useEffect(() => {
    if (isCasualUser) {
      const preferred = allowedCategoryValues.includes('campus_life')
        ? 'campus_life'
        : allowedCategoryValues[0] ?? 'campus_life';
      setValue('category', preferred as FormValues['category'], { shouldValidate: true });
    }
  }, [allowedCategoryValues, isCasualUser, setValue]);

  const categoryLabel = useMemo(() => getNoticeCategoryLabel(categoryValue), [categoryValue]);
  const categoryOptionLabels = useMemo(
    () => getAllowedCategoryLabels(allowedCategoryValues),
    [allowedCategoryValues],
  );

  const handleCategoryChange = useCallback(
    (label: string) => {
      const slug = getNoticeCategoryValueFromLabel(label);
      const fallback = allowedCategoryValues[0] ?? 'campus_life';
      const nextValue = slug && allowedCategoryValues.includes(slug) ? slug : fallback;
      setValue('category', nextValue as FormValues['category'], { shouldValidate: true });
    },
    [allowedCategoryValues, setValue],
  );

  useEffect(() => {
    // Load templates
    api.get('/notices/templates/')
      .then((response) => {
        if (Array.isArray(response.data)) {
          setTemplates(response.data);
        }
      })
      .catch(() => {
        // Silently fail - templates are optional
      });
  }, []);

  useEffect(() => {
    // Apply template if selected
    if (selectedTemplate && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplate);
      if (template) {
        setValue('title', template.title_template || '');
        setValue('description', template.description_template || '');
        setValue('category', template.category || 'campus_life');
        setPriority(template.priority || 'normal');
      }
    }
  }, [selectedTemplate, templates, setValue]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.get('/users/profiles/me/');
        if (!mounted) return;
        const meta = {
          isFaculty: Boolean(response.data.is_faculty),
          isStaff: Boolean(response.data.is_staff),
          designation: response.data.designation || '',
        };
        setUserMeta(meta);
        setProfileAvatar(response.data.avatar_url || null);
        const userDepartment = response.data.department || '';
        initialDepartmentRef.current = userDepartment;
        setValue('department', userDepartment);
        if (!meta.isStaff && !meta.isFaculty) {
          const defaultTitle = ensureStudentTitle('');
          setValue('title', defaultTitle as FormValues['title'], { shouldValidate: true });
        }
        setReady(true);
      } catch {
        if (!mounted) return;
        setProfileError('We could not load your profile. Please retry.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ensureStudentTitle, navigation, setValue]);

  const requestMediaPermission = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to attach images or videos.');
      return false;
    }
    return true;
  }, []);

  const handleAddMedia = useCallback(async () => {
    if (!(await requestMediaPermission())) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 0,
    });
    if (result.canceled) return;
    const assets = result.assets ?? [];
    if (!assets.length) return;
    setAttachments((prev) => [
      ...prev,
      ...assets
        .map((asset) => {
          if (!asset.uri) return null;
          const id = makeId();
          const kind: PendingAttachment['kind'] =
            asset.type === 'video'
              ? 'video'
              : asset.type === 'image'
              ? 'image'
              : 'document';
          const fallbackMime =
            kind === 'video'
              ? 'video/mp4'
              : kind === 'image'
              ? 'image/jpeg'
              : 'application/octet-stream';
          const mimeType = asset.mimeType ?? fallbackMime;
          const inferredExt =
            kind === 'video' ? '.mp4' : kind === 'image' ? '.jpg' : '';
          const name =
            asset.fileName ??
            `media-${id}${inferredExt}`;
          return {
            id,
            uri: asset.uri,
            name,
            mimeType,
            kind,
            size: asset.fileSize ?? null,
          } as PendingAttachment;
        })
        .filter(Boolean) as PendingAttachment[],
    ]);
  }, [requestMediaPermission]);

  const handleAddDocuments = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    const canceled = 'canceled' in result ? result.canceled : (result as any).type === 'cancel';
    if (canceled) return;
    const rawAssets: DocumentPicker.DocumentPickerAsset[] =
      'assets' in result && Array.isArray(result.assets)
        ? result.assets
        : 'type' in result && result.type === 'success'
        ? [result as any]
        : [];
    if (!rawAssets.length) return;
    setAttachments((prev) => [
      ...prev,
      ...rawAssets
        .map((asset) => {
          const uri =
            'fileCopyUri' in asset && typeof (asset as any).fileCopyUri === 'string'
              ? (asset as any).fileCopyUri
              : asset.uri;
          if (!uri) return null;
          const id = makeId();
          const mimeType = asset.mimeType ?? 'application/octet-stream';
          let kind: PendingAttachment['kind'] = 'document';
          if (mimeType.startsWith('image/')) kind = 'image';
          else if (mimeType.startsWith('video/')) kind = 'video';
          else if (mimeType.startsWith('audio/')) kind = 'audio';
          return {
            id,
            uri,
            name: asset.name ?? `attachment-${id}`,
            mimeType,
            size: asset.size ?? null,
            kind,
          } as PendingAttachment;
        })
        .filter(Boolean) as PendingAttachment[],
    ]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleUnavailableFeature = useCallback((feature: string) => {
    Alert.alert('Coming soon', `${feature} support will be available soon.`);
  }, []);

  const casualToolbarActions = useMemo(
    () => [
      { key: 'media', icon: 'image-multiple-outline', label: 'Media', onPress: handleAddMedia },
      { key: 'gif', icon: 'file-gif-box', label: 'GIF', onPress: () => handleUnavailableFeature('GIF') },
      { key: 'poll', icon: 'poll', label: 'Poll', onPress: () => handleUnavailableFeature('Polls') },
      { key: 'emoji', icon: 'emoticon-outline', label: 'Emoji', onPress: () => handleUnavailableFeature('Emojis') },
      {
        key: 'schedule',
        icon: 'calendar-clock',
        label: 'Schedule',
        onPress: () => handleUnavailableFeature('Scheduling'),
      },
      { key: 'location', icon: 'map-marker-outline', label: 'Location', onPress: () => handleUnavailableFeature('Location') },
    ],
    [handleAddMedia, handleUnavailableFeature],
  );

  const mediaAttachments = useMemo(
    () => attachments.filter((file) => file.kind !== 'document'),
    [attachments],
  );

  const documentAttachments = useMemo(
    () => attachments.filter((file) => file.kind === 'document'),
    [attachments],
  );

  const uploadAttachments = useCallback(async (noticeId: number) => {
    if (!attachments.length) {
      return { failed: 0, total: 0 };
    }
    let failed = 0;
    for (const file of attachments) {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: ensureMimeType(file),
      } as any);
      try {
        await api.post(`/notices/${noticeId}/attachments/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch {
        failed += 1;
      }
    }
    return { failed, total: attachments.length };
  }, [attachments]);

  const onCreate = useCallback(
    async (values: FormValues) => {
      setStatusMessage(null);
      try {
        const computedTitle = isStudent
          ? ensureStudentTitle(values.description)
          : values.title.trim();
        const payload: any = {
          title: computedTitle,
          description: values.description.trim(),
          is_active: true,
          department: canEditDepartment
            ? (values.department || '').trim()
            : initialDepartmentRef.current,
          category: values.category,
          is_pinned: isPinned,
          priority: priority,
        };
        if (expiresAt) {
          payload.expires_at = expiresAt.toISOString();
        }
        const response = await api.post('/notices/', payload);
        const noticeId = response.data.id;
        const { failed, total } = await uploadAttachments(noticeId);
        await queryClient.invalidateQueries({ queryKey: ['notices'] });
        await queryClient.invalidateQueries({ queryKey: ['trending-top'] });
        const currentDepartment = userMeta.isStaff ? (values.department || '') : initialDepartmentRef.current;
        const nextCategory =
          allowedCategoryValues.includes(values.category as NoticeCategory) && values.category
            ? values.category
            : (allowedCategoryValues[0] ?? 'campus_life');
        reset({
          title: (isStudent ? ensureStudentTitle('') : '') as FormValues['title'],
          description: '',
          department: canEditDepartment ? currentDepartment : initialDepartmentRef.current,
          category: nextCategory as FormValues['category'],
        });
        setAttachments([]);
        setIsPinned(false);
        setPriority('normal');
        setExpiresAt(null);
        setSelectedTemplate(null);
        const successLabel = isCasualUser ? 'Post' : 'Notice';
        const baseMessage =
          failed === 0
            ? `${successLabel} created successfully.`
            : failed === total
            ? `${successLabel} created, but attachments failed to upload.`
            : `${successLabel} created, but some attachments failed to upload.`;
        setStatusMessage(baseMessage);
        Alert.alert('Success', baseMessage, [
          { text: isCasualUser ? 'Create another' : 'Add another', style: 'default' },
          { text: 'Go to home', onPress: () => navigation.navigate('Home') },
        ]);
      } catch (error: any) {
        const errorMessage = error?.userMessage || error?.response?.data?.detail || `Failed to create ${creationNoun}. Please try again.`;
        setStatusMessage(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    },
    [
      allowedCategoryValues,
      canEditDepartment,
      creationNoun,
      ensureStudentTitle,
      isCasualUser,
      isPinned,
      isStudent,
      navigation,
      queryClient,
      reset,
      uploadAttachments,
    ],
  );

  if (!ready && !profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Create Notice" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (profileError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <HeaderBar title="Create Notice" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: '#dc2626', textAlign: 'center' }}>{profileError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const submitLabel = isCasualUser ? (isSubmitting ? 'Posting...' : 'Post') : (isSubmitting ? 'Creating...' : 'Create notice');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <HeaderBar title="Create Notice" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 20,
              gap: 20,
            }}
          >
            <View style={{ gap: 12 }}>
              <SectionHeading title={isCasualUser ? 'Compose' : 'Notice details'} />
              {!isStudent ? (
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <FormTextInput
                      label="Title"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.title?.message}
                      trailing={
                        <MaterialCommunityIcons name="text" size={18} color={theme.colors.muted} />
                      }
                    />
                  )}
                />
              ) : null}
              {canEditDepartment ? (
                <Controller
                  control={control}
                  name="department"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <FormTextInput
                      label="Department"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      trailing={
                        <MaterialCommunityIcons
                          name="office-building"
                          size={18}
                          color={theme.colors.muted}
                        />
                      }
                    />
                  )}
                />
              ) : null}
              {!isCasualUser ? (
                <Controller
                  control={control}
                  name="category"
                  render={() => (
                    <OptionPicker
                      label="Category"
                      value={categoryLabel}
                      options={categoryOptionLabels}
                      onChange={handleCategoryChange}
                      placeholder="Select category"
                      disabled={categoryOptionLabels.length === 0}
                      error={errors.category?.message}
                    />
                  )}
                />
              ) : null}
              <Controller
                control={control}
                name="description"
                render={({ field: { value, onChange, onBlur } }) =>
                  isCasualUser ? (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 24,
                        padding: 16,
                        gap: 16,
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Image
                          source={profileAvatar ? { uri: profileAvatar } : FALLBACK_AVATAR}
                          style={{ width: 46, height: 46, borderRadius: 23 }}
                        />
                        <TextInput
                          style={{
                            flex: 1,
                            minHeight: 100,
                            color: theme.colors.text,
                            fontSize: 16,
                            textAlignVertical: 'top',
                          }}
                          placeholder="What's happening?"
                          placeholderTextColor={theme.colors.muted}
                          multiline
                          value={value}
                          onChangeText={(text) => {
                            onChange(text);
                            const auto = ensureStudentTitle(text);
                            setValue('title', auto as FormValues['title'], { shouldValidate: true });
                          }}
                          onBlur={onBlur}
                        />
                      </View>
                  <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                    Attach media, polls, or locations to enrich your post.
                  </Text>
                  {errors.description?.message ? (
                    <Text style={{ color: '#dc2626', fontSize: 13 }}>{errors.description?.message}</Text>
                  ) : null}
                </View>
              ) : (
                    <FormTextInput
                      label="Description"
                      value={value}
                      onChangeText={(text) => {
                        onChange(text);
                        if (isStudent) {
                          const auto = ensureStudentTitle(text);
                          setValue('title', auto as FormValues['title'], { shouldValidate: true });
                        }
                      }}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      error={errors.description?.message}
                      trailing={
                        <MaterialCommunityIcons
                          name="note-text-outline"
                          size={18}
                          color={theme.colors.muted}
                        />
                      }
                      inputStyle={{ minHeight: 140 }}
                    />
                  )
                }
              />
            </View>

            {templates.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <OptionPicker
                  label="Use Template (Optional)"
                  value={selectedTemplate?.toString() || ''}
                  options={[
                    { label: 'None', value: '' },
                    ...templates.map((t) => ({ label: t.name, value: t.id.toString() })),
                  ]}
                  onChange={(val) => setSelectedTemplate(val ? parseInt(val, 10) : null)}
                />
              </View>
            )}

            {!isCasualUser ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 18,
                  padding: 16,
                  gap: 12,
                  backgroundColor: theme.colors.background,
                  marginTop: 16,
                }}
              >
                <Text style={{ fontWeight: '600', color: theme.colors.text }}>Notice Settings</Text>
                
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: theme.colors.text }}>Pin this notice</Text>
                    <Switch
                      value={isPinned}
                      onValueChange={setIsPinned}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                      thumbColor={isPinned ? theme.colors.primaryContrast : theme.colors.muted}
                    />
                  </View>

                  <View>
                    <Text style={{ color: theme.colors.text, marginBottom: 8 }}>Priority</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {NOTICE_PRIORITY_VALUES.map((p) => (
                        <TouchableOpacity
                          key={p}
                          onPress={() => setPriority(p)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: priority === p ? getNoticePriorityColor(p) : theme.colors.border,
                            backgroundColor: priority === p ? getNoticePriorityColor(p) + '15' : theme.colors.surface,
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: priority === p ? getNoticePriorityColor(p) : theme.colors.text,
                              fontWeight: priority === p ? '700' : '500',
                              fontSize: 12,
                            }}
                          >
                            {NOTICE_PRIORITY_LABELS[p]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={{ color: theme.colors.text, marginBottom: 8 }}>Expiration Date (Optional)</Text>
                    <TouchableOpacity
                      onPress={() => setShowExpiryPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.surface,
                      }}
                    >
                      <Text style={{ color: expiresAt ? theme.colors.text : theme.colors.muted }}>
                        {expiresAt ? expiresAt.toLocaleDateString() : 'No expiration'}
                      </Text>
                      {expiresAt && (
                        <TouchableOpacity
                          onPress={() => {
                            setExpiresAt(null);
                            setShowExpiryPicker(false);
                          }}
                          style={{ padding: 4 }}
                        >
                          <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.muted} />
                        </TouchableOpacity>
                      )}
                      <MaterialCommunityIcons name="calendar" size={20} color={theme.colors.muted} />
                    </TouchableOpacity>
                    {showExpiryPicker && (
                      <DateTimePicker
                        value={expiresAt || new Date()}
                        mode="datetime"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowExpiryPicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setExpiresAt(selectedDate);
                          }
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ gap: 12 }}>
              {isCasualUser ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {casualToolbarActions.map((action) => (
                    <TouchableOpacity
                      key={`outside-${action.key}`}
                      onPress={action.onPress}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      }}
                    >
                      <MaterialCommunityIcons name={action.icon as any} size={16} color={theme.colors.primary} />
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <SectionHeading title="Attachments" />
              <Text style={{ color: theme.colors.muted }}>
                Add media or documents to provide additional context for your {creationNoun}.
              </Text>
              {!isCasualUser ? (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={handleAddMedia}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialCommunityIcons
                        name="image-plus"
                        size={22}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                        Choose photos or videos
                      </Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                        Pick multiple items from your gallery.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.muted}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddDocuments}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialCommunityIcons
                        name="file-upload-outline"
                        size={22}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                        Attach documents
                      </Text>
                      <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                        Upload PDFs, slides, or other files.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                    Use the icons above to include photos or videos. Need to attach handouts? Use the shortcut below.
                  </Text>
                  <TouchableOpacity
                    onPress={handleAddDocuments}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surfaceMuted,
                      gap: 10,
                    }}
                  >
                    <MaterialCommunityIcons name="file-upload-outline" size={18} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Attach documents</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {mediaAttachments.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {mediaAttachments.map((file) => {
                    const isImage = file.kind === 'image';
                    const isVideo = file.kind === 'video';
                    const isAudio = file.kind === 'audio';
                    return (
                      <View
                        key={file.id}
                        style={{
                          width: 180,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                          borderRadius: 16,
                          overflow: 'hidden',
                          backgroundColor: theme.colors.background,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            height: isAudio ? 120 : 170,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          {isImage ? (
                            <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <AttachmentMediaPlayer
                              uri={file.uri}
                              style={{ width: '100%', height: '100%' }}
                              showControls
                              contentFit="cover"
                            />
                          )}
                          {isAudio ? (
                            <MaterialCommunityIcons
                              name="music"
                              size={28}
                              color={theme.colors.primary}
                              style={{ position: 'absolute' }}
                            />
                          ) : null}
                        </View>
                        <View style={{ padding: 12, gap: 6 }}>
                          <Text
                            numberOfLines={1}
                            style={{ color: theme.colors.text, fontWeight: '600' }}
                          >
                            {file.name}
                          </Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                              {file.kind.toUpperCase()}
                            </Text>
                            <TouchableOpacity onPress={() => removeAttachment(file.id)}>
                              <MaterialCommunityIcons
                                name="close"
                                size={18}
                                color={theme.colors.muted}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            {mediaAttachments.length === 0 && (
              <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                Attach up to 10 images or videos to enrich your {creationNoun}.
              </Text>
            )}

            {documentAttachments.length ? (
              <View style={{ gap: 12 }}>
                {documentAttachments.map((file) => (
                  <View
                    key={file.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={22}
                        color={theme.colors.primary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: theme.colors.text, fontWeight: '600' }}>
                          {file.name}
                        </Text>
                        <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                          {file.mimeType || 'Unknown file'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeAttachment(file.id)}>
                      <MaterialCommunityIcons name="close" size={18} color={theme.colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              {statusMessage ? (
                <Text style={{ color: theme.colors.muted }}>{statusMessage}</Text>
              ) : null}
              <PrimaryButton
                title={submitLabel}
                onPress={handleSubmit(onCreate)}
                disabled={isSubmitting}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default CreateNoticeScreen;
