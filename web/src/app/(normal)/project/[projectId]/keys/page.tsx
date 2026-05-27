import { buildWorkspaceDashboardRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from '../_legacy/redirect';

interface LegacyProjectKeysPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectKeysPage({ params }: LegacyProjectKeysPageProps) {
  await params;
  redirectLegacyProjectRoute(buildWorkspaceDashboardRoute());
}
