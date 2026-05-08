/**
 * @component SiteHeaderNav
 * @category Feature
 * @status Stable
 * @description The main navigation component for the public site header, supporting localized links and active state detection.
 * @usage Place in the site header for global navigation.
 * @example
 * <SiteHeaderNav />
 */
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { useT } from '@/i18n/client';
import { useAuthStore } from '@/store/auth-store';
export function SiteHeaderNav() {
  const t = useT('project');
  const isAuthenticated = useAuthStore.use.isAuthenticated();
  const user = useAuthStore.use.user();
  const isSystemReady = useAuthStore.use.isSystemReady();
  const displayName = user?.nickname || user?.username || user?.email || t('siteHeader.profile');

  if (!isSystemReady) {
    return (
      <div className="flex items-center gap-4">
        <Link href={ROUTES.AUTH.LOGIN}>
          <Button variant="ghost" size="sm">{t('siteHeader.signIn')}</Button>
        </Link>
        <Link href={ROUTES.AUTH.REGISTER}>
          <Button size="sm">{t('siteHeader.getStarted')}</Button>
        </Link>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <Link href={ROUTES.CONSOLE.PROJECTS}>
          <Button variant="ghost" size="sm">{t('siteHeader.projects')}</Button>
        </Link>
        <Link href={ROUTES.CONSOLE.PROFILE}>
          <Button size="sm" variant="outline">{displayName}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href={ROUTES.AUTH.LOGIN}>
        <Button variant="ghost" size="sm">{t('siteHeader.signIn')}</Button>
      </Link>
      <Link href={ROUTES.AUTH.REGISTER}>
        <Button size="sm">{t('siteHeader.getStarted')}</Button>
      </Link>
    </div>
  );
}
