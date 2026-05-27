import { redirect } from 'next/navigation';
import { buildWorkspaceApiSpecsRoute } from '@/constants/routes';

interface WorkspaceDetailRoutePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function WorkspaceDetailRoutePage({ params }: WorkspaceDetailRoutePageProps) {
  const { workspaceId } = await params;
  redirect(buildWorkspaceApiSpecsRoute(workspaceId));
}
