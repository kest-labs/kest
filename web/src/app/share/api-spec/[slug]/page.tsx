import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiExternalBaseUrl } from '@/config/api';
import { getT } from '@/i18n/server';
import type { PublicApiSpecShare } from '@/types/api-spec';
import { formatDate } from '@/utils';

interface ApiSpecSharePageProps {
  params: Promise<{
    slug: string;
  }>;
}

const getPublicShareUrl = (slug: string) =>
  `${apiExternalBaseUrl}/public/api-spec-shares/${encodeURIComponent(slug)}`;

async function fetchPublicShare(slug: string): Promise<PublicApiSpecShare> {
  const response = await fetch(getPublicShareUrl(slug), {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Failed to load public API spec share: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: PublicApiSpecShare };
  if (!payload?.data) {
    throw new Error('Public API spec share response is missing data');
  }

  return {
    ...payload.data,
    tags: Array.isArray(payload.data.tags) ? payload.data.tags : [],
    parameters: Array.isArray(payload.data.parameters) ? payload.data.parameters : [],
    responses:
      payload.data.responses &&
      typeof payload.data.responses === 'object' &&
      !Array.isArray(payload.data.responses)
        ? payload.data.responses
        : {},
  };
}

export async function generateMetadata({
  params,
}: ApiSpecSharePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const t = await getT('project');
    const share = await fetchPublicShare(slug);
    return {
      title: `${share.method} ${share.path}`,
      description:
        share.summary || share.description || t('share.publicDescription', {
          method: share.method,
          path: share.path,
        }),
    };
  } catch {
    const t = await getT('project');
    return {
      title: t('share.sharedApiSpec'),
      description: t('share.sharedApiSpecDescription'),
    };
  }
}

function CodePanel({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value?: string;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium tracking-normal text-text-main">{title}</h3>
      </div>
      {value?.trim() ? (
        <pre className="overflow-x-auto rounded-xl border border-border-main bg-bg-subtle p-5 text-xs leading-6 text-text-muted">
          <code>{value}</code>
        </pre>
      ) : (
        <div className="rounded-xl border border-dashed border-border-main bg-bg-subtle p-5 text-sm text-text-muted">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function JsonPanel({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
}) {
  return (
    <CodePanel
      title={title}
      value={value === undefined || value === null ? '' : JSON.stringify(value, null, 2)}
      emptyLabel={emptyLabel}
    />
  );
}

export default async function ApiSpecSharePage({
  params,
}: ApiSpecSharePageProps) {
  const t = await getT('project');
  const { slug } = await params;
  const share = await fetchPublicShare(slug);
  const hasDocSections = Boolean(
    share.doc_markdown || share.doc_markdown_zh || share.doc_markdown_en
  );

  return (
    <main className="min-h-screen bg-bg-canvas px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-bg-canvas">
          <div className="border-b border-border-subtle bg-bg-surface px-6 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground hover:bg-primary">{share.method}</Badge>
                  <Badge variant="outline" className="border-border-strong bg-bg-canvas text-text-main">
                    v{share.version}
                  </Badge>
                  <Badge variant="outline" className="border-border-strong bg-bg-canvas text-text-main">
                    {t('share.shared')}
                  </Badge>
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-medium tracking-normal text-text-main md:text-3xl">
                    {share.path}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-text-muted">
                    {share.summary || share.description || t('share.noSummary')}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border-subtle bg-bg-canvas px-4 py-3">
                  <p className="figma-caption text-text-muted">{t('share.published')}</p>
                  <p className="mt-2 text-sm font-medium text-text-main">
                    {formatDate(share.shared_at, 'YYYY-MM-DD HH:mm')}
                  </p>
                </div>
                <div className="rounded-xl border border-border-subtle bg-bg-canvas px-4 py-3">
                  <p className="figma-caption text-text-muted">{t('share.updated')}</p>
                  <p className="mt-2 text-sm font-medium text-text-main">
                    {formatDate(share.updated_at, 'YYYY-MM-DD HH:mm')}
                  </p>
                </div>
              </div>
            </div>

            {share.tags.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {share.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="rounded-full border-border-strong bg-bg-canvas text-text-main"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 px-6 py-6 md:grid-cols-3 md:px-8">
            <div className="rounded-xl border border-border-subtle bg-bg-subtle p-4">
              <p className="figma-caption text-text-muted">{t('share.docSource')}</p>
              <p className="mt-2 text-sm font-medium text-text-main">{share.doc_source || 'manual'}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-subtle p-4">
              <p className="figma-caption text-text-muted">{t('common.path')}</p>
              <p className="mt-2 font-mono text-sm text-text-main">{share.path}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-bg-subtle p-4">
              <p className="figma-caption text-text-muted">{t('common.method')}</p>
              <p className="mt-2 text-sm font-medium text-text-main">{share.method}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="border-border-subtle bg-bg-canvas">
              <CardHeader>
                <CardTitle>{t('share.descriptionTitle')}</CardTitle>
                <CardDescription>{t('share.descriptionDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-text-muted">
                {share.description || t('share.noDetailedDescription')}
              </CardContent>
            </Card>

            {hasDocSections ? (
              <Card className="border-border-subtle bg-bg-canvas">
                <CardHeader>
                  <CardTitle>{t('share.publishedDocs')}</CardTitle>
                  <CardDescription>{t('share.publishedDocsDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <CodePanel
                    title={t('share.defaultMarkdown')}
                    value={share.doc_markdown}
                    emptyLabel={t('share.noDefaultMarkdown')}
                  />
                  <CodePanel
                    title={t('share.chineseMarkdown')}
                    value={share.doc_markdown_zh}
                    emptyLabel={t('share.noChineseMarkdown')}
                  />
                  <CodePanel
                    title={t('share.englishMarkdown')}
                    value={share.doc_markdown_en}
                    emptyLabel={t('share.noEnglishMarkdown')}
                  />
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className="border-border-subtle bg-bg-canvas">
              <CardHeader>
                <CardTitle>{t('share.requestSchema')}</CardTitle>
                <CardDescription>{t('share.requestSchemaDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <JsonPanel
                  title={t('common.requestBody')}
                  value={share.request_body}
                  emptyLabel={t('share.noRequestBody')}
                />
              </CardContent>
            </Card>

            <Card className="border-border-subtle bg-bg-canvas">
              <CardHeader>
                <CardTitle>{t('common.parameters')}</CardTitle>
                <CardDescription>{t('share.parametersDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <JsonPanel
                  title={t('common.parameters')}
                  value={share.parameters}
                  emptyLabel={t('share.noParameterSchema')}
                />
              </CardContent>
            </Card>

            <Card className="border-border-subtle bg-bg-canvas">
              <CardHeader>
                <CardTitle>{t('common.responses')}</CardTitle>
                <CardDescription>{t('share.responsesDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <JsonPanel
                  title={t('common.responses')}
                  value={share.responses}
                  emptyLabel={t('share.noResponseSchema')}
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
