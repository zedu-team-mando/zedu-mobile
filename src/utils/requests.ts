import axios, {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { BASE_URL } from '@env';
import { clearAllData, retrieveToken } from './helper';
import { notifySessionExpired } from './session-expiry';

const apiClient = axios.create({
  baseURL: `${BASE_URL}`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await retrieveToken('token');

    if (token && config.headers)
      config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
);

export const request = async <T = any>(
  config: AxiosRequestConfig,
): Promise<{ data: T | null; error: string | null }> => {
  try {
    const response: AxiosResponse<T> = await apiClient(config);
    return { data: response.data, error: null };
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || 'An error occurred';

    if (
      error.response?.status === 401 ||
      error.response?.data?.status_code === 401
    ) {
      const requestWasAuthenticated = Boolean(
        error.config?.headers?.Authorization || config.headers?.Authorization,
      );

      await clearAllData();

      // A failed sign-in also returns 401, but it has no bearer token to
      // invalidate. Only authenticated requests should force a sign-out.
      if (requestWasAuthenticated) {
        notifySessionExpired();
      }
    }

    return { data: null, error: message };
  }
};

export const GetRequest = <T = any>(url: string) =>
  request<T>({ method: 'GET', url });

export const PostRequest = <T = any>(url: string, data?: any) =>
  request<T>({ method: 'POST', url, data });

export const PatchRequest = <T = any>(url: string, data?: any) =>
  request<T>({ method: 'PATCH', url, data });

export const PutRequest = <T = any>(url: string, data?: any) =>
  request<T>({ method: 'PUT', url, data });

export const DeleteRequest = <T = any>(url: string) =>
  request<T>({ method: 'DELETE', url });

export const buildQueryString = (
  params: Record<string, string | number | boolean | undefined | null>,
): string => {
  const parts: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  });

  return parts.join('&');
};

export const UploadRequest = <T = any>(url: string, data: FormData) =>
  request<T>({
    method: 'POST',
    url,
    data,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });

export const PatchRequest2 = <T = any>(url: string, data: FormData) =>
  request<T>({
    method: 'PATCH',
    url,
    data,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 60000,
  });
