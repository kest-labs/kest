// Authentication service layer
// Functional API pattern - stateless, pure functions

import request from '@/http';
import type {
    User,
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest,
    SetupRequest,
    AuthResponse,
    SystemFeatures,
    SetupStatus,
} from '@/types/auth';

// API endpoints (Real Backend)
// All endpoints point to kest-api backend /v1 routes
const ENDPOINTS = {
    LOGIN: "/v1/login",
    LOGOUT: "/v1/logout",
    ME: "/v1/users/profile",
    CHANGE_PASSWORD: "/v1/users/password",
    RESET_PASSWORD: "/v1/password/reset",
    REGISTER: "/v1/register",
    SETUP_STATUS: "/v1/setup-status",
    SETUP: "/v1/setup",
    SYSTEM_FEATURES: "/v1/system-features",
} as const;

/**
 * Authentication API
 * All methods are stateless pure functions
 * 
 * Connects to kest-api backend at http://localhost:8080/v1
 */
export const authApi = {
    // System setup
    getSetupStatus: () =>
        request.get<SetupStatus>(ENDPOINTS.SETUP_STATUS),

    setup: (data: SetupRequest) =>
        request.post<AuthResponse>(ENDPOINTS.SETUP, data),

    getSystemFeatures: () =>
        request.get<SystemFeatures>(ENDPOINTS.SYSTEM_FEATURES),

    // Authentication
    login: async (credentials: LoginRequest) => {
        const result = await request.post<{ access_token: string; user: User }>(ENDPOINTS.LOGIN, credentials);
        return { user: result.user, token: result.access_token };
    },

    register: (data: RegisterRequest) =>
        request.post<AuthResponse>(ENDPOINTS.REGISTER, data),

    changePassword: (data: ChangePasswordRequest) =>
        request.put<AuthResponse>(ENDPOINTS.CHANGE_PASSWORD, data),

    resetPassword: (email: string) =>
        request.post<{ message: string }>(ENDPOINTS.RESET_PASSWORD, { email }),

    logout: async () => {
        try {
            await request.post(ENDPOINTS.LOGOUT, {});
        } catch (error) {
            console.warn('Logout request failed:', error);
        }
    },

    // Profile
    getProfile: async () => {
        return request.get<User>(ENDPOINTS.ME);
    },

    /**
     * Silent profile check - used during auth initialization.
     * Does not show error toasts on failure (e.g., 401 when not logged in).
     */
    getProfileSilent: async () => {
        return request.get<User>(ENDPOINTS.ME, { skipErrorHandler: true });
    },

} as const;

// Type exports for external use
export type AuthApi = typeof authApi;
