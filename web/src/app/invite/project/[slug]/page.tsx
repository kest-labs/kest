import { redirect } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

interface InviteProjectPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function InviteProjectPage({ params }: InviteProjectPageProps) {
  const { slug } = await params;

  if (!slug) {
    redirect(ROUTES.CONSOLE.WORKSPACES);
  }

  redirect(ROUTES.CONSOLE.WORKSPACES);
}
