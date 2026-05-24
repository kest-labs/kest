import { redirect } from 'next/navigation';

interface LegacyWorkspaceRedirectPageProps {
  params: Promise<{
    segments?: string[];
  }>;
}

export default async function LegacyWorkspaceRedirectPage({
  params,
}: LegacyWorkspaceRedirectPageProps) {
  const { segments = [] } = await params;
  const suffix = segments.length > 0 ? `/${segments.join('/')}` : '';

  redirect(`/workspace${suffix}`);
}
