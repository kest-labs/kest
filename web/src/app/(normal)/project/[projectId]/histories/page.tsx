import { buildProjectHistoriesRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectHistoriesPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectHistoriesPage({
  params,
  searchParams,
}: LegacyProjectHistoriesPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectHistoriesRoute(projectId), await searchParams);
}
