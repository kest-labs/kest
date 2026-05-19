import { buildProjectCollectionsRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from '../_legacy/redirect';

interface LegacyProjectCollectionsPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectCollectionsPage({
  params,
}: LegacyProjectCollectionsPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectCollectionsRoute(projectId));
}
