import { notFound } from 'next/navigation';
import { ProjectInvitationPage } from '@/components/features/project/project-invitation-page';

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

  return <ProjectInvitationPage slug={slug} />;
}
