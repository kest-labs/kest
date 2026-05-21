import { notFound } from 'next/navigation';
import { WorkspaceInvitationPage } from '@/components/features/workspace/workspace-invitation-page';

interface InviteWorkspacePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function InviteWorkspacePage({ params }: InviteWorkspacePageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return <WorkspaceInvitationPage slug={slug} />;
}
