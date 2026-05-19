import { buildProjectTestCasesRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectTestCasesPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectTestCasesPage({
  params,
  searchParams,
}: LegacyProjectTestCasesPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectTestCasesRoute(projectId), await searchParams);
}
