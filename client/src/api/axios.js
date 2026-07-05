import axios from 'axios';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../store/authStore';

const normalizeApiUrl = (value) => value?.replace(/\/+$/, '');

const ensureApiBasePath = (value) => {
  if (!value || typeof window === 'undefined') {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);

    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/api';
    }

    return normalizeApiUrl(url.toString());
  } catch {
    return normalizeApiUrl(value);
  }
};

const resolveBaseUrl = () => {
  const configuredUrl = ensureApiBasePath(import.meta.env.VITE_API_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }

    // In production, prefer same-origin /api so the frontend can work
    // behind a CDN rewrite/proxy without hardcoding a backend hostname.
    return `${origin}/api`;
  }

  return 'http://localhost:5000/api';
};

const baseURL = resolveBaseUrl();
const assetBaseURL = baseURL.replace(/\/api$/, '');

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const publicApi = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const getApiBaseUrl = () => baseURL;

export const buildAssetUrl = (relativePath) => {
  if (!relativePath) {
    return '';
  }

  if (/^https?:\/\//i.test(relativePath)) {
    return relativePath;
  }

  const normalizedPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${assetBaseURL}${normalizedPath}`;
};

let isRefreshing = false;
let refreshSubscribers = [];
let hasForcedRedirect = false;

const onRefreshed = (token) => {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
  refreshSubscribers = [];
};

const onRefreshFailed = (error) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (resolve, reject) => {
  refreshSubscribers.push({ resolve, reject });
};

const isTokenExpired = (token) => {
  if (!token) {
    return false;
  }

  try {
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(window.atob(payload));
    return decodedPayload.exp ? decodedPayload.exp * 1000 <= Date.now() : false;
  } catch {
    return false;
  }
};

const clearClientSession = () => {
  useAuthStore.getState().logout();
  queryClient.clear();
};

const redirectToLoginIfNeeded = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const isAlreadyOnPublicShare = window.location.pathname.startsWith('/shared/');
  if (!isAlreadyOnPublicShare && !hasForcedRedirect) {
    hasForcedRedirect = true;
    window.location.href = '/login';
  }
};

const refreshAccessToken = async () => {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      addRefreshSubscriber(resolve, reject);
    });
  }

  isRefreshing = true;

  try {
    const response = await axios.post(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true }
    );

    const { accessToken } = response.data.data;
    useAuthStore.getState().setToken(accessToken);
    hasForcedRedirect = false;

    onRefreshed(accessToken);
    return accessToken;
  } catch (refreshError) {
    onRefreshFailed(refreshError);
    clearClientSession();
    redirectToLoginIfNeeded();
    throw refreshError;
  } finally {
    isRefreshing = false;
  }
};

// Attach a valid access token to protected requests. If the stored token is
// missing or expired, refresh it before sending the request when possible.
api.interceptors.request.use(
  async (config) => {
    const { token, isAuthenticated } = useAuthStore.getState();
    const requestUrl = config.url || '';
    const isRefreshRequest = requestUrl.includes('/auth/refresh');
    const isAuthRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/verify-email')
      || requestUrl.includes('/auth/resend-verification')
      || requestUrl.includes('/auth/forgot-password')
      || requestUrl.includes('/auth/verify-reset-otp')
      || requestUrl.includes('/auth/reset-password');
    const isPublicSharedRoute = requestUrl.includes('/analysis/shared/');

    if (isRefreshRequest || isAuthRequest || isPublicSharedRoute) {
      return config;
    }

    config.headers = config.headers || {};

    if (token && !isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    }

    delete config.headers.Authorization;

    if (isAuthenticated) {
      const freshToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${freshToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthRoute = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh');
    const isPublicSharedRoute = requestUrl.includes('/analysis/shared/');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute && !isPublicSharedRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber(
            (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject
          );
        });
      }

      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
