export const NOTICE_CATEGORY_VALUES = ['campus_life', 'business', 'education', 'general'] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORY_VALUES)[number];

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  campus_life: 'Campus Life',
  business: 'Business',
  education: 'Education',
  general: 'General',
};

export const getNoticeCategoryLabel = (value?: string | null) => {
  if (!value) return '';
  return NOTICE_CATEGORY_LABELS[value as NoticeCategory] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const labelToValueLookup = Object.entries(NOTICE_CATEGORY_LABELS).reduce<Record<string, NoticeCategory>>(
  (acc, [value, label]) => {
    acc[label] = value as NoticeCategory;
    return acc;
  },
  {},
);

export const getNoticeCategoryValueFromLabel = (label: string): NoticeCategory | null => {
  return labelToValueLookup[label] ?? null;
};

export const getAllowedCategoryLabels = (allowedValues: NoticeCategory[]) =>
  allowedValues.map((value) => NOTICE_CATEGORY_LABELS[value]);
