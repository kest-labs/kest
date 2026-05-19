import { buildProjectApiSpecsRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectApiSpecsPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectApiSpecsPage({
  params,
  searchParams,
}: LegacyProjectApiSpecsPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectApiSpecsRoute(projectId), await searchParams);
}
