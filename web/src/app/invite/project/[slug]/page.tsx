import { notFound } from 'next/navigation';
import { ProjectInvitationPage } from '@/components/features/project/project-invitation-page';

interface InviteProjectPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function InviteProjectPage({ params }: InviteProjectPageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  return <ProjectInvitationPage slug={slug} />;
}
