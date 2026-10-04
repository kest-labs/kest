import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { handleError } from './error-handler';
import { getAuthTokens } from '@/store/auth-store';
import { apiBaseUrl } from '@/config/api';

/**
 * Custom Request Configuration
 */
export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  skipErrorHandler?: boolean;
  unwrapData?: boolean;
}

interface ErrorResponseBody {
  code?: string | number;
  message?: string;
  error?: string;
}

/**
 * ApiError Class to encapsulate API-related errors
 */
export class ApiError extends Error {
  code: string | number;
  status?: number;
  isHandled: boolean;
  constructor(message: string, code: string | number, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isHandled = false;
  }
}

/**
 * HttpClient provides a consistent interface for making HTTP requests.
 * It encapsulates axios instance management and interceptor logic.
 */
class HttpClient {
  private instance: AxiosInstance;

  constructor(config: RequestConfig) {
    this.instance = axios.create({
      timeout: 30000,
      ...config,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request Interceptor: Auth Handling
    this.instance.interceptors.request.use(
      (config) => {
        const { skipAuth } = config as RequestConfig;
        if (!skipAuth) {
          const { accessToken } = getAuthTokens();
          if (accessToken) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${accessToken}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor: Data Extraction & Error Handling
    this.instance.interceptors.response.use(
      (response) => {
        const { data } = response;
        const { unwrapData = true } = (response.config || {}) as RequestConfig;

        if (!unwrapData) {
          // 某些接口需要读取完整响应体（例如分页 meta / links），
          // 这种场景下跳过统一 data 解包。
          return data;
        }

        // Standard payload extraction (assuming { code, data, message } format)
        return data && typeof data === 'object' && 'data' in data ? data.data : data;
      },
      async (error: AxiosError) => {
        if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
          return Promise.reject(error);
        }

        const originalRequest = error.config as RequestConfig;
        const body = error.response?.data as ErrorResponseBody | undefined;

        const apiError = new ApiError(
          body?.error || body?.message || error.message,
          body?.code || 'FETCH_ERROR',
          error.response?.status
        );

        if (!originalRequest?.skipErrorHandler) {
          handleError(apiError);
        }

        return Promise.reject(apiError);
      }
    );
  }

  // Pure promise-based methods
  public get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.instance.get(url, config) as Promise<T>;
  }

  public post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.instance.post(url, data, config) as Promise<T>;
  }

  public put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.instance.put(url, data, config) as Promise<T>;
  }

  public patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.instance.patch(url, data, config) as Promise<T>;
  }

  public delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.instance.delete(url, config) as Promise<T>;
  }
}

/**
 * Factory function to create new request instances
 */
export const createRequest = (config: RequestConfig = {}) => {
  return new HttpClient(config);
};

/**
 * Default instance for the primary API
 */
export const request = createRequest({
  // 真实后端由环境变量驱动，默认指向本地 KEST API。
  baseURL: apiBaseUrl,
});

export default request;
