import { redirect } from 'next/navigation';
import { buildWorkspaceInviteRoute } from '@/constants/routes';

interface LegacyWorkspaceInvitePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function LegacyWorkspaceInvitePage({
  params,
}: LegacyWorkspaceInvitePageProps) {
  const { slug } = await params;

  redirect(buildWorkspaceInviteRoute(slug));
}
