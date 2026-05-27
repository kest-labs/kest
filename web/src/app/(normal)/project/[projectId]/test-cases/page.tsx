import { buildWorkspaceDashboardRoute } from '@/constants/routes';
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
  await params;
  redirectLegacyProjectRoute(buildWorkspaceDashboardRoute(), await searchParams);
}
