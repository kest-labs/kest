import { buildWorkspaceDashboardRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectCategoriesPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectCategoriesPage({
  params,
  searchParams,
}: LegacyProjectCategoriesPageProps) {
  await params;
  redirectLegacyProjectRoute(buildWorkspaceDashboardRoute(), await searchParams);
}
