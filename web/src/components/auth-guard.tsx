'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { authConfig } from '@/config/auth';
import { useT } from '@/i18n/client';

interface AuthGuardProps {
  children: React.ReactNode;
  /**
   * URL to redirect to if not authenticated
   * @default '/login'
   */
  redirectTo?: string;
  /**
   * Show loading indicator while checking auth
   * @default true
   */
  showLoading?: boolean;
}

/**
 * AuthGuard - Client component that protects routes
 * 
 * Checks if user is authenticated and redirects to login if not.
 * Use this in layouts to protect entire route groups.
 * 
 * @example
 * ```tsx
 * // app/(normal)/layout.tsx
 * export default function NormalLayout({ children }) {
 *   return <AuthGuard>{children}</AuthGuard>;
 * }
 * ```
 */
export function AuthGuard({ 
  children, 
  redirectTo = authConfig.routes.login,
  showLoading = true,
}: AuthGuardProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  
  const isAuthenticated = useAuthStore.use.isAuthenticated();
  const isLoading = useAuthStore.use.isLoading();
  const isSystemReady = useAuthStore.use.isSystemReady();

  useEffect(() => {
    // Wait for system to be ready before checking auth
    if (!isSystemReady) return;
    
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      // Encode current path for redirect after login
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`${redirectTo}?returnUrl=${returnUrl}`);
    }
  }, [isAuthenticated, isLoading, isSystemReady, pathname, redirectTo, router]);

  // Show loading while system is initializing or checking auth
  if (!isSystemReady || isLoading) {
    if (showLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            <p className="text-sm text-muted-foreground">{t.common('appLoading')}</p>
          </div>
        </div>
      );
    }
    return null;
  }

  // If not authenticated, don't render children (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGuard;
