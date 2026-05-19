import { buildProjectFlowsRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectFlowsPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectFlowsPage({
  params,
  searchParams,
}: LegacyProjectFlowsPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectFlowsRoute(projectId), await searchParams);
}
