import { buildProjectEnvironmentsRoute } from '@/constants/routes';
import {
  redirectLegacyProjectRoute,
  type LegacySearchParams,
} from '../_legacy/redirect';

interface LegacyProjectEnvironmentsPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<LegacySearchParams>;
}

export default async function LegacyProjectEnvironmentsPage({
  params,
  searchParams,
}: LegacyProjectEnvironmentsPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectEnvironmentsRoute(projectId), await searchParams);
}
