import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { buildApiUrl } from '@/config/api';
import { createSelectors } from './utils/selectors';
import type { ApiUser } from '@/types/auth';

interface AuthState {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  isSystemReady: boolean;

  setUser: (user: ApiUser | null) => void;
  updateUser: (user: ApiUser) => void;
  setSession: (user: ApiUser, accessToken: string) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
  initializeAuth: () => Promise<void>;
  reset: () => void;
}

class SessionRestoreError extends Error {
  status?: number;
  shouldLog: boolean;
  endpoint?: string;
  responseBody?: string;

  constructor(
    message: string,
    options?: {
      status?: number;
      shouldLog?: boolean;
      endpoint?: string;
      responseBody?: string;
    }
  ) {
    super(message);
    this.name = 'SessionRestoreError';
    this.status = options?.status;
    this.shouldLog = options?.shouldLog ?? true;
    this.endpoint = options?.endpoint;
    this.responseBody = options?.responseBody;
  }
}

const sessionLooksInvalidFromBody = (body: string) => {
  const normalized = body.toLowerCase();
  return (
    normalized.includes('user not found') ||
    normalized.includes('record not found') ||
    normalized.includes('invalid or expired') ||
    normalized.includes('token expired') ||
    normalized.includes('invalid token')
  );
};

const safeReadResponseBody = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return '';
  }
};

const defaultState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  accessToken: null,
  isSystemReady: false,
};

const useAuthStoreBase = create<AuthState>()(
  persist(
    (set) => ({
      ...defaultState,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user,
      }),

      updateUser: (user) => set((state) => ({
        ...state,
        user,
        isAuthenticated: true,
      })),

      setSession: (user, accessToken) => set({
        user,
        accessToken,
        isAuthenticated: true,
        isSystemReady: true,
      }),

      clearSession: () => set((state) => ({
        ...state,
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        isSystemReady: true,
      })),

      setLoading: (isLoading) => set({ isLoading }),

      initializeAuth: async () => {
        const { accessToken } = useAuthStoreBase.getState();
        const profileEndpoint = buildApiUrl('/users/profile');

        set({ isLoading: true });
        try {
          if (!accessToken) {
            // 没有 token 时直接把系统标记为已初始化，
            // 这样公开页面不会一直卡在 loading 状态。
            set({ user: null, isAuthenticated: false, isSystemReady: true });
            return;
          }

          // 应用刷新后尝试用本地 token 恢复会话，
          // 以后端 profile 结果作为当前登录态的唯一可信来源。
          const response = await fetch(profileEndpoint, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            const responseBody = await safeReadResponseBody(response);
            const looksLikeInvalidSession =
              response.status === 401 ||
              response.status === 403 ||
              sessionLooksInvalidFromBody(responseBody);

            throw new SessionRestoreError('Failed to restore session', {
              status: response.status,
              shouldLog: !looksLikeInvalidSession,
              endpoint: profileEndpoint,
              responseBody,
            });
          }

          const payload = await response.json();
          const user = payload?.data as ApiUser | undefined;

          if (!user) {
            throw new Error('Invalid session response');
          }

          set({
            user,
            isAuthenticated: true,
            isSystemReady: true,
          });
        } catch (error) {
          if (!(error instanceof SessionRestoreError) || error.shouldLog) {
            if (error instanceof SessionRestoreError) {
              console.error('Auth initialization failed:', {
                message: error.message,
                status: error.status,
                endpoint: error.endpoint,
                responseBody: error.responseBody,
              });
            } else {
              console.error('Auth initialization failed:', error);
            }
          }
          // token 失效或后端不可用时，主动清空本地会话，避免进入假登录状态。
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isSystemReady: true,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      reset: () => set(defaultState),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    }
  )
);

export const getAuthTokens = () => {
  const state = useAuthStoreBase.getState();
  return {
    accessToken: state.accessToken,
  };
};

export const setAuthTokens = (accessToken: string | null) => {
  useAuthStoreBase.setState({ accessToken });
};

export const useAuthStore = createSelectors(useAuthStoreBase);
export const useCurrentUser = () => useAuthStore.use.user();
export const useIsAuthenticated = () => useAuthStore.use.isAuthenticated();
export const useAuthLoading = () => useAuthStore.use.isLoading();
