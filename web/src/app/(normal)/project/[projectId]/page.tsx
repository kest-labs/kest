import { buildWorkspaceDashboardRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from './_legacy/redirect';

interface LegacyProjectRoutePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectRoutePage({ params }: LegacyProjectRoutePageProps) {
  await params;
  redirectLegacyProjectRoute(buildWorkspaceDashboardRoute());
}
