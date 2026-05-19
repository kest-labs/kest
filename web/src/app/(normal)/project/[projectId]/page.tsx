import { buildProjectDetailRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from './_legacy/redirect';

interface LegacyProjectRoutePageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectRoutePage({ params }: LegacyProjectRoutePageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectDetailRoute(projectId));
}
