import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';

const DEFAULT_PORT = process.env.EXPO_PUBLIC_API_PORT || '8000';

type ExpoConfigWithDebugger = (typeof Constants.expoConfig) & { debuggerHost?: string } | undefined;

const resolveBaseURL = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  const extraUrl = extra?.apiUrl || extra?.api_url || extra?.API_URL;
  if (typeof extraUrl === 'string' && extraUrl.length > 0) {
    return extraUrl.replace(/\/$/, '');
  }

  const expoConfig = Constants.expoConfig as ExpoConfigWithDebugger;
  const hostUri =
    expoConfig?.hostUri ||
    expoConfig?.debuggerHost ||
    Constants.manifest2?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const [host] = hostUri.split(':');
    if (host) {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }

  return `http://198.168.0.18:${DEFAULT_PORT}`;
};

export const API_BASE_URL = resolveBaseURL();

type UnauthorizedHandler = () => Promise<void> | void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let handlingUnauthorized = false;

const notifyUnauthorized = () => {
  if (!unauthorizedHandler || handlingUnauthorized) return;
  handlingUnauthorized = true;
  Promise.resolve(unauthorizedHandler())
    .catch(() => {})
    .finally(() => {
      handlingUnauthorized = false;
    });
};

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    Accept: 'application/json',
  },
});

export const setAuthToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setUnauthorizedHandler = (handler?: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler ?? null;
};

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    if (status === 401) {
      notifyUnauthorized();
    }
    
    // Enhance error with user-friendly message
    if (error.response) {
      const data = error.response.data as any;
      const message = data?.detail || data?.message || data?.error || 'An error occurred';
      (error as any).userMessage = message;
    } else if (error.request) {
      (error as any).userMessage = 'Network error. Please check your connection and try again.';
    } else {
      (error as any).userMessage = 'An unexpected error occurred. Please try again.';
    }
    
    return Promise.reject(error);
  },
);
