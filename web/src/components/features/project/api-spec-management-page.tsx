'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Boxes,
  Braces,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileCode2,
  FileJson2,
  FlaskConical,
  FolderKanban,
  Globe,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import { ApiSpecAICreateDialog } from '@/components/features/project/api-spec-ai-create-dialog';
import { buildApiPath } from '@/config/api';
import {
  buildApiSpecShareRoute,
  buildProjectCategoriesRoute,
  buildProjectDetailRoute,
  buildProjectEnvironmentsRoute,
  buildProjectTestCasesRoute,
  ROUTES,
} from '@/constants/routes';
import {
  buildCategoryOptions,
  type CategoryOption,
} from '@/components/features/project/category-helpers';
import {
  useApiSpec,
  useApiSpecExamples,
  useApiSpecFull,
  useApiSpecShare,
  useApiSpecs,
  useAcceptApiSpecAIDraft,
  useBatchGenApiDocs,
  useCreateApiSpecAIDraft,
  useCreateApiExample,
  useCreateApiSpec,
  useDeleteApiSpecShare,
  useDeleteApiSpec,
  useExportApiSpecs,
  useGenApiDoc,
  useGenApiTest,
  useGeneratedApiTest,
  useImportApiSpecs,
  usePublishApiSpecShare,
  useProjectApiCategories,
  useProjectMemberRole,
  useRefineApiSpecAIDraft,
  useUpdateApiSpec,
} from '@/hooks/use-api-specs';
import { useProject, useProjectStats } from '@/hooks/use-projects';
import type {
  ApiSpec,
  ApiSpecDocSource,
  ApiSpecExample,
  ApiSpecExportFormat,
  ApiSpecExportPayload,
  ApiSpecLanguage,
  BatchGenDocRequest,
  CreateApiExampleRequest,
  CreateApiSpecRequest,
  HttpMethod,
  ParameterSpec,
  ProjectMemberRole,
  RequestBodySpec,
  ResponseSpec,
  UpdateApiSpecRequest,
} from '@/types/api-spec';
import { cn, formatDate } from '@/utils';

const PAGE_SIZE = 10;
const EMPTY_SPECS: ApiSpec[] = [];
// 具备写权限的角色集合。
// 作用：统一控制页面上的创建、编辑、删除、导入和 AI 动作入口。
const WRITE_ROLES: ProjectMemberRole[] = ['write', 'admin', 'owner'];

// API 规格表单与筛选栏使用的静态选项。
// 作用：集中维护 method、文档来源、语言和导出格式等枚举文案。
const METHOD_OPTIONS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const DOC_SOURCE_OPTIONS: Array<{ value: ApiSpecDocSource; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'ai', label: 'AI' },
];
const LANGUAGE_OPTIONS: Array<{ value: ApiSpecLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
];
const EXPORT_FORMAT_OPTIONS: Array<{ value: ApiSpecExportFormat; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'swagger', label: 'Swagger' },
  { value: 'markdown', label: 'Markdown' },
];
const PLATFORM_LABELS: Record<string, string> = {
  go: 'Go',
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  ruby: 'Ruby',
  php: 'PHP',
  csharp: 'C#',
};

type SpecFormMode = 'create' | 'edit';
type DetailTab = 'overview' | 'docs' | 'examples' | 'generated-test';
type AiActionMode = 'doc' | 'test';

interface SpecFormDraft {
  categoryId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  version: string;
  isPublic: boolean;
  docSource: ApiSpecDocSource;
  tags: string;
  docMarkdown: string;
  docMarkdownZh: string;
  docMarkdownEn: string;
  requestBody: string;
  parameters: string;
  responses: string;
}

interface ExampleDraft {
  name: string;
  requestHeaders: string;
  requestBody: string;
  responseStatus: string;
  responseBody: string;
  durationMs: string;
}

interface ImportDraft {
  payload: string;
}

interface ExportDraft {
  format: ApiSpecExportFormat;
}

interface BatchGenDraft {
  categoryId: string;
  lang: ApiSpecLanguage;
  force: boolean;
}

interface AiActionDraft {
  lang: ApiSpecLanguage;
}

// 项目平台显示文案解析器。
// 作用：把 project.platform 转换成适合页面展示的文本。
const getPlatformLabel = (platform: string) => PLATFORM_LABELS[platform] || 'Not set';

// 成员角色显示文案解析器。
// 作用：统一把 owner/admin/write/read 映射成首字母大写标签。
const getRoleLabel = (role?: ProjectMemberRole) => {
  if (!role) {
    return 'Unknown';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
};

// HTTP Method 颜色映射。
// 作用：让不同请求方法在列表和详情中保持稳定的视觉识别。
const getMethodBadgeClassName = (method: HttpMethod) => {
  switch (method) {
    case 'GET':
      return 'border-emerald-200 bg-emerald-500/10 text-emerald-700';
    case 'POST':
      return 'border-sky-200 bg-sky-500/10 text-sky-700';
    case 'PUT':
      return 'border-amber-200 bg-amber-500/10 text-amber-700';
    case 'PATCH':
      return 'border-violet-200 bg-violet-500/10 text-violet-700';
    case 'DELETE':
      return 'border-rose-200 bg-rose-500/10 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-500/10 text-slate-700';
  }
};

// JSON 序列化辅助方法。
// 作用：把对象安全格式化成带缩进的文本，供 textarea 初始值和详情预览复用。
const formatJson = (value: unknown) => {
  if (value === undefined || value === null) {
    return '';
  }

  return JSON.stringify(value, null, 2);
};

// tags 文本与数组互转工具。
// 作用：在表单里使用逗号分隔字符串，在请求体里恢复成字符串数组。
const formatTags = (tags?: string[]) => (tags && tags.length > 0 ? tags.join(', ') : '');

const normalizeTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

// JSON 输入解析器。
// 作用：统一处理 object/array/any 三种期望类型，并返回中文错误提示。
const parseJsonInput = <T,>(value: string, label: string, expectation: 'object' | 'array' | 'any' = 'any') => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(`${label} 必须是合法的 JSON。`);
  }

  if (expectation === 'array' && !Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 数组。`);
  }

  if (
    expectation === 'object' &&
    (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)
  ) {
    throw new Error(`${label} 必须是 JSON 对象。`);
  }

  return parsed as T;
};

// 请求头标准化器。
// 作用：把对象值统一转成字符串字典，满足 examples 接口的 request_headers 约束。
const toHeadersRecord = (value: unknown) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Request Headers 必须是 JSON 对象。');
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [key, String(entryValue)])
  ) as Record<string, string>;
};

// 规格表单默认值生成器。
// 作用：根据已有 spec 生成创建/编辑弹窗所需的文本草稿。
const getSpecFormDraft = (spec?: ApiSpec | null): SpecFormDraft => ({
  categoryId: spec?.category_id ? String(spec.category_id) : '',
  method: spec?.method ?? 'GET',
  path: spec?.path ?? '',
  summary: spec?.summary ?? '',
  description: spec?.description ?? '',
  version: spec?.version ?? '1.0.0',
  isPublic: spec?.is_public ?? true,
  docSource: spec?.doc_source ?? 'manual',
  tags: formatTags(spec?.tags),
  docMarkdown: spec?.doc_markdown ?? '',
  docMarkdownZh: spec?.doc_markdown_zh ?? '',
  docMarkdownEn: spec?.doc_markdown_en ?? '',
  requestBody: formatJson(spec?.request_body),
  parameters: formatJson(spec?.parameters),
  responses: formatJson(spec?.responses),
});

// 各类弹窗初始草稿。
// 作用：为 example/import/export/batch/AI 操作提供稳定的初始状态。
const getExampleDraft = (): ExampleDraft => ({
  name: '',
  requestHeaders: '',
  requestBody: '',
  responseStatus: '200',
  responseBody: '',
  durationMs: '',
});

const getImportDraft = (): ImportDraft => ({
  payload: '{\n  "specs": []\n}',
});

const getExportDraft = (): ExportDraft => ({
  format: 'json',
});

const getBatchGenDraft = (): BatchGenDraft => ({
  categoryId: '',
  lang: 'en',
  force: false,
});

const getAiActionDraft = (): AiActionDraft => ({
  lang: 'en',
});

// 导出下载器。
// 作用：把 export 接口返回的 JSON 或 Markdown 结果转换成浏览器下载文件。
const downloadExportPayload = ({
  payload,
  format,
  projectSlug,
}: {
  payload: ApiSpecExportPayload;
  format: ApiSpecExportFormat;
  projectSlug: string;
}) => {
  const extension = format === 'markdown' ? 'md' : 'json';
  const mimeType = format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8';
  const serializedContent =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const blob = new Blob([serializedContent], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = `${projectSlug || 'project'}-api-specs-${format}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

// 规格方法徽章。
// 作用：在列表和详情页统一展示 HTTP Method 的样式。
function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <Badge variant="outline" className={cn('font-mono', getMethodBadgeClassName(method))}>
      {method}
    </Badge>
  );
}

// 当前成员角色徽章。
// 作用：在页面头部直观展示当前用户的项目权限。
function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      Role: {getRoleLabel(role)}
    </Badge>
  );
}

// 代码块渲染器。
// 作用：统一承载 markdown、JSON 和 flow 内容等长文本展示。
function CodeBlock({
  value,
  emptyLabel,
}: {
  value?: string;
  emptyLabel: string;
}) {
  if (!value?.trim()) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
      <code>{value}</code>
    </pre>
  );
}

// JSON 预览块。
// 作用：把 request/response schema 等结构化字段包装成带标题的只读展示模块。
function JsonPreview({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{title}</div>
      <CodeBlock value={formatJson(value)} emptyLabel={emptyLabel} />
    </div>
  );
}

/**
 * 规格创建/编辑弹窗。
 * 作用：
 * 1. 统一承载 POST 和 PATCH 所需的大部分字段
 * 2. 在提交前完成 JSON 文本到结构化对象的校验与转换
 */
function SpecFormDialog({
  open,
  mode,
  spec,
  categories,
  isLoadingSpec,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: SpecFormMode;
  spec?: ApiSpec | null;
  categories: CategoryOption[];
  isLoadingSpec: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiSpecRequest | UpdateApiSpecRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SpecFormDraft>(() => getSpecFormDraft(spec));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateDraft = <K extends keyof SpecFormDraft>(key: K, value: SpecFormDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedPath = draft.path.trim();
    const trimmedVersion = draft.version.trim();

    if (!trimmedPath) {
      nextErrors.path = 'Path 是必填项。';
    }

    if (mode === 'create' && !trimmedVersion) {
      nextErrors.version = 'Version 是必填项。';
    }

    let requestBody: RequestBodySpec | undefined;
    let parameters: ParameterSpec[] | undefined;
    let responses: Record<string, ResponseSpec> | undefined;

    if (Object.keys(nextErrors).length === 0) {
      try {
        requestBody = parseJsonInput<RequestBodySpec>(draft.requestBody, 'Request Body', 'object');
      } catch (error) {
        nextErrors.requestBody = error instanceof Error ? error.message : 'Request Body 无法解析。';
      }

      try {
        parameters = parseJsonInput<ParameterSpec[]>(draft.parameters, 'Parameters', 'array');
      } catch (error) {
        nextErrors.parameters = error instanceof Error ? error.message : 'Parameters 无法解析。';
      }

      try {
        responses = parseJsonInput<Record<string, ResponseSpec>>(draft.responses, 'Responses', 'object');
      } catch (error) {
        nextErrors.responses = error instanceof Error ? error.message : 'Responses 无法解析。';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const categoryId = draft.categoryId ? Number(draft.categoryId) : undefined;
    const tags = normalizeTags(draft.tags);

    if (mode === 'create') {
      await onSubmit({
        category_id: categoryId,
        method: draft.method,
        path: trimmedPath,
        summary: draft.summary.trim(),
        description: draft.description,
        doc_markdown: draft.docMarkdown,
        doc_markdown_zh: draft.docMarkdownZh,
        doc_markdown_en: draft.docMarkdownEn,
        doc_source: draft.docSource,
        tags,
        request_body: requestBody,
        parameters,
        responses,
        version: trimmedVersion,
        is_public: draft.isPublic,
      });
      return;
    }

    await onSubmit({
      category_id: categoryId,
      path: trimmedPath,
      summary: draft.summary.trim(),
      description: draft.description,
      doc_markdown: draft.docMarkdown,
      doc_markdown_zh: draft.docMarkdownZh,
      doc_markdown_en: draft.docMarkdownEn,
      doc_source: draft.docSource,
      tags,
      request_body: requestBody,
      parameters,
      responses,
      is_public: draft.isPublic,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create API Spec' : 'Edit API Spec'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '通过 POST /v1/projects/:id/api-specs 创建新的 API 规格。'
              : '通过 PATCH /v1/projects/:id/api-specs/:sid 更新当前 API 规格。'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {mode === 'edit' && isLoadingSpec ? (
            <div className="space-y-3 py-2">
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-10 animate-pulse rounded-xl bg-muted" />
              <div className="h-48 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : mode === 'edit' && !spec ? (
            <Alert className="mt-2">
              <AlertTitle>Unable to load spec details</AlertTitle>
              <AlertDescription>
                当前规格详情尚未加载完成，请关闭后重试。
              </AlertDescription>
            </Alert>
          ) : (
            <form id="api-spec-form" className="space-y-6 py-1" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="spec-method">Method</Label>
                  {mode === 'create' ? (
                    <Select value={draft.method} onValueChange={(value) => updateDraft('method', value as HttpMethod)}>
                      <SelectTrigger id="spec-method" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METHOD_OPTIONS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={draft.method} readOnly disabled root />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spec-path">Path</Label>
                  <Input
                    id="spec-path"
                    value={draft.path}
                    onChange={(event) => updateDraft('path', event.target.value)}
                    placeholder="/api/v1/auth/login"
                    errorText={errors.path}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spec-version">Version</Label>
                  <Input
                    id="spec-version"
                    value={draft.version}
                    onChange={(event) => updateDraft('version', event.target.value)}
                    placeholder="1.0.0"
                    readOnly={mode === 'edit'}
                    disabled={mode === 'edit'}
                    errorText={errors.version}
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spec-category">Category</Label>
                  <Select
                    value={draft.categoryId || 'none'}
                    onValueChange={(value) => updateDraft('categoryId', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="spec-category" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="spec-summary">Summary</Label>
                  <Input
                    id="spec-summary"
                    value={draft.summary}
                    onChange={(event) => updateDraft('summary', event.target.value)}
                    placeholder="Short summary of the endpoint"
                    root
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spec-doc-source">Doc Source</Label>
                  <Select
                    value={draft.docSource}
                    onValueChange={(value) => updateDraft('docSource', value as ApiSpecDocSource)}
                  >
                    <SelectTrigger id="spec-doc-source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="spec-is-public">Public Spec</Label>
                    <div className="text-xs text-muted-foreground">
                      控制 `is_public`，决定规格是否可公开暴露。
                    </div>
                  </div>
                  <Switch
                    id="spec-is-public"
                    checked={draft.isPublic}
                    onCheckedChange={(checked) => updateDraft('isPublic', checked)}
                  />
                </div>
              </div>

              {mode === 'edit' ? (
                <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                  PATCH 接口当前不支持修改 `method` 和 `version`，编辑模式下这两个字段为只读。
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="spec-tags">Tags</Label>
                <Input
                  id="spec-tags"
                  value={draft.tags}
                  onChange={(event) => updateDraft('tags', event.target.value)}
                  placeholder="auth, public, login"
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spec-description">Description</Label>
                <Textarea
                  id="spec-description"
                  value={draft.description}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  placeholder="Detailed description for the endpoint"
                  rows={4}
                  root
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="spec-doc-markdown">Default Markdown</Label>
                  <Textarea
                    id="spec-doc-markdown"
                    value={draft.docMarkdown}
                    onChange={(event) => updateDraft('docMarkdown', event.target.value)}
                    placeholder="## POST /api/v1/auth/login"
                    rows={10}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spec-doc-markdown-zh">Chinese Markdown</Label>
                  <Textarea
                    id="spec-doc-markdown-zh"
                    value={draft.docMarkdownZh}
                    onChange={(event) => updateDraft('docMarkdownZh', event.target.value)}
                    placeholder="## POST /api/v1/auth/login"
                    rows={10}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spec-doc-markdown-en">English Markdown</Label>
                  <Textarea
                    id="spec-doc-markdown-en"
                    value={draft.docMarkdownEn}
                    onChange={(event) => updateDraft('docMarkdownEn', event.target.value)}
                    placeholder="## POST /api/v1/auth/login"
                    rows={10}
                    root
                  />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="spec-request-body">Request Body JSON</Label>
                  <Textarea
                    id="spec-request-body"
                    value={draft.requestBody}
                    onChange={(event) => updateDraft('requestBody', event.target.value)}
                    placeholder='{"required": true, "content_type": "application/json", "schema": {"type": "object"}}'
                    rows={12}
                    errorText={errors.requestBody}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spec-parameters">Parameters JSON</Label>
                  <Textarea
                    id="spec-parameters"
                    value={draft.parameters}
                    onChange={(event) => updateDraft('parameters', event.target.value)}
                    placeholder='[{"name": "Authorization", "in": "header", "required": true, "schema": {"type": "string"}}]'
                    rows={12}
                    errorText={errors.parameters}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spec-responses">Responses JSON</Label>
                  <Textarea
                    id="spec-responses"
                    value={draft.responses}
                    onChange={(event) => updateDraft('responses', event.target.value)}
                    placeholder='{"200": {"description": "Success", "content_type": "application/json", "schema": {"type": "object"}}}'
                    rows={12}
                    errorText={errors.responses}
                    root
                  />
                </div>
              </div>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="api-spec-form"
            loading={isSubmitting}
            disabled={(mode === 'edit' && (isLoadingSpec || !spec)) || isSubmitting}
          >
            {mode === 'create' ? 'Create Spec' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 规格删除确认弹窗。
 * 作用：在真正调用 DELETE 前展示不可逆提醒，避免误删。
 */
function DeleteSpecDialog({
  open,
  spec,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  spec?: ApiSpec | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Delete API Spec</DialogTitle>
          <DialogDescription>
            这会永久删除 {spec ? `${spec.method} ${spec.path}` : '当前选中的 API 规格'} 以及它的 examples。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Alert variant="destructive">
            <AlertTitle>Irreversible action</AlertTitle>
            <AlertDescription>
              后端会立即执行 `DELETE /projects/:id/api-specs/:sid`，删除后无法恢复。
            </AlertDescription>
          </Alert>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            Delete Spec
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 批量导入弹窗。
 * 作用：允许用户直接粘贴 `{ specs: [...] }` JSON 并触发批量 upsert。
 */
function ImportSpecsDialog({
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { specs: CreateApiSpecRequest[] }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ImportDraft>(() => getImportDraft());
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const parsed = parseJsonInput<{ specs: CreateApiSpecRequest[] }>(draft.payload, 'Import Payload', 'object');

      if (!parsed?.specs || !Array.isArray(parsed.specs)) {
        throw new Error('导入 payload 必须包含 `specs` 数组。');
      }

      setError('');
      await onSubmit(parsed);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '导入 payload 无法解析。');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import API Specs</DialogTitle>
          <DialogDescription>
            提交完整的 `{` specs: [...] `}` JSON，后端会按 `method + path` 执行 upsert。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="api-spec-import-form" className="space-y-3 py-1" onSubmit={handleSubmit}>
            <Textarea
              value={draft.payload}
              onChange={(event) => setDraft({ payload: event.target.value })}
              rows={18}
              errorText={error}
              root
            />
            <div className="text-xs text-muted-foreground">
              接口：POST /v1/projects/:id/api-specs/import
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="api-spec-import-form" loading={isSubmitting}>
            Import Specs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 导出弹窗。
 * 作用：选择导出格式并把服务返回结果转换成浏览器下载文件。
 */
function ExportSpecsDialog({
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (format: ApiSpecExportFormat) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ExportDraft>(() => getExportDraft());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Export API Specs</DialogTitle>
          <DialogDescription>
            选择导出格式，前端会直接下载接口返回内容。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-2 py-1">
            <Label htmlFor="api-spec-export-format">Export Format</Label>
            <Select
              value={draft.format}
              onValueChange={(value) => setDraft({ format: value as ApiSpecExportFormat })}
            >
              <SelectTrigger id="api-spec-export-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={isSubmitting} onClick={() => void onSubmit(draft.format)}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 批量生成文档弹窗。
 * 作用：收集语言、分类范围和 force 选项，触发后台并发生成任务。
 */
function BatchGenDocDialog({
  open,
  categories,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  categories: CategoryOption[];
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BatchGenDocRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<BatchGenDraft>(() => getBatchGenDraft());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Batch Generate Docs</DialogTitle>
          <DialogDescription>
            通过 POST /v1/projects/:id/api-specs/batch-gen-doc 提交后台生成任务。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="batch-gen-lang">Language</Label>
              <Select
                value={draft.lang}
                onValueChange={(value) => setDraft((current) => ({ ...current, lang: value as ApiSpecLanguage }))}
              >
                <SelectTrigger id="batch-gen-lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-gen-category">Category Scope</Label>
              <Select
                value={draft.categoryId || 'all'}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, categoryId: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger id="batch-gen-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole project</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="batch-gen-force">Force Regeneration</Label>
                <div className="text-xs text-muted-foreground">
                  打开后会重新生成已有文档，而不是仅补齐缺失文档。
                </div>
              </div>
              <Switch
                id="batch-gen-force"
                checked={draft.force}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, force: checked }))}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            onClick={() =>
              void onSubmit({
                category_id: draft.categoryId ? Number(draft.categoryId) : undefined,
                lang: draft.lang,
                force: draft.force,
              })
            }
          >
            Queue Job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * AI 单条动作弹窗。
 * 作用：为 `gen-doc` 和 `gen-test` 统一收集语言参数。
 */
function AiActionDialog({
  open,
  mode,
  spec,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: AiActionMode;
  spec?: ApiSpec | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (lang: ApiSpecLanguage) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AiActionDraft>(() => getAiActionDraft());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{mode === 'doc' ? 'Generate Documentation' : 'Generate Test'}</DialogTitle>
          <DialogDescription>
            {spec ? `${spec.method} ${spec.path}` : '当前选中的 API 规格'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-2 py-1">
            <Label htmlFor="ai-action-lang">Language</Label>
            <Select
              value={draft.lang}
              onValueChange={(value) => setDraft({ lang: value as ApiSpecLanguage })}
            >
              <SelectTrigger id="ai-action-lang" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={isSubmitting} onClick={() => void onSubmit(draft.lang)}>
            {mode === 'doc' ? 'Generate Doc' : 'Generate Test'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Example 创建弹窗。
 * 作用：通过 JSON 文本输入创建 request/response 示例，刷新详情页 examples 区域。
 */
function ExampleFormDialog({
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateApiExampleRequest) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ExampleDraft>(() => getExampleDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const trimmedName = draft.name.trim();
    const responseStatus = Number(draft.responseStatus);
    const durationMs = draft.durationMs.trim() ? Number(draft.durationMs) : undefined;

    if (!trimmedName) {
      nextErrors.name = 'Example name 是必填项。';
    }

    if (!Number.isInteger(responseStatus) || responseStatus < 100 || responseStatus > 599) {
      nextErrors.responseStatus = 'Response Status 需要是 100 到 599 的整数。';
    }

    if (draft.durationMs.trim() && (!Number.isFinite(durationMs) || (durationMs ?? 0) < 0)) {
      nextErrors.durationMs = 'Duration 必须是大于等于 0 的数字。';
    }

    let requestHeaders: Record<string, string> | undefined;
    let requestBody: unknown;
    let responseBody: unknown;

    if (Object.keys(nextErrors).length === 0) {
      try {
        const parsedHeaders = parseJsonInput<Record<string, unknown>>(draft.requestHeaders, 'Request Headers', 'object');
        requestHeaders = parsedHeaders ? toHeadersRecord(parsedHeaders) : undefined;
      } catch (error) {
        nextErrors.requestHeaders = error instanceof Error ? error.message : 'Request Headers 无法解析。';
      }

      try {
        requestBody = parseJsonInput(draft.requestBody, 'Request Body');
      } catch (error) {
        nextErrors.requestBody = error instanceof Error ? error.message : 'Request Body 无法解析。';
      }

      try {
        responseBody = parseJsonInput(draft.responseBody, 'Response Body');
      } catch (error) {
        nextErrors.responseBody = error instanceof Error ? error.message : 'Response Body 无法解析。';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      name: trimmedName,
      request_headers: requestHeaders,
      request_body: requestBody,
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Create API Example</DialogTitle>
          <DialogDescription>
            通过 POST /v1/projects/:id/api-specs/:sid/examples 新增请求/响应样例。
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="api-example-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-example-name">Example Name</Label>
                <Input
                  id="api-example-name"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Successful login"
                  errorText={errors.name}
                  root
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="api-example-status">Response Status</Label>
                  <Input
                    id="api-example-status"
                    type="number"
                    value={draft.responseStatus}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, responseStatus: event.target.value }))
                    }
                    errorText={errors.responseStatus}
                    root
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-example-duration">Duration (ms)</Label>
                  <Input
                    id="api-example-duration"
                    type="number"
                    min="0"
                    value={draft.durationMs}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, durationMs: event.target.value }))
                    }
                    errorText={errors.durationMs}
                    root
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="api-example-request-headers">Request Headers JSON</Label>
                <Textarea
                  id="api-example-request-headers"
                  value={draft.requestHeaders}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, requestHeaders: event.target.value }))
                  }
                  rows={12}
                  errorText={errors.requestHeaders}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-example-request-body">Request Body JSON</Label>
                <Textarea
                  id="api-example-request-body"
                  value={draft.requestBody}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, requestBody: event.target.value }))
                  }
                  rows={12}
                  errorText={errors.requestBody}
                  root
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-example-response-body">Response Body JSON</Label>
                <Textarea
                  id="api-example-response-body"
                  value={draft.responseBody}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, responseBody: event.target.value }))
                  }
                  rows={12}
                  errorText={errors.responseBody}
                  root
                />
              </div>
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="api-example-form" loading={isSubmitting}>
            Create Example
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * API Specifications 管理主页面。
 * 作用：
 * 1. 展示指定项目下 API 规格的列表、筛选、分页和详情
 * 2. 提供 CRUD、导入导出、AI 生成和 examples 管理入口
 * 3. 根据当前成员角色控制只读/可写操作
 */
export function ApiSpecManagementPage({
  projectId,
}: {
  projectId: number;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [method, setMethod] = useState<'all' | HttpMethod>('all');
  const [version, setVersion] = useState('');
  const [tag, setTag] = useState('');
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [generatedTestLanguage, setGeneratedTestLanguage] = useState<ApiSpecLanguage>('en');
  const [formMode, setFormMode] = useState<SpecFormMode>('create');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAICreateOpen, setIsAICreateOpen] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiSpec | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBatchGenOpen, setIsBatchGenOpen] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [aiAction, setAiAction] = useState<{ mode: AiActionMode; spec: ApiSpec | null } | null>(null);

  const deferredKeyword = useDeferredValue(keyword.trim());
  const normalizedVersion = version.trim();
  const normalizedTag = tag.trim();

  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const memberRoleQuery = useProjectMemberRole(projectId);
  const categoriesQuery = useProjectApiCategories(projectId);
  const resetToFirstPage = () => {
    if (page !== 1) {
      setPage(1);
    }
  };

  const specsQuery = useApiSpecs({
    projectId,
    page,
    pageSize: PAGE_SIZE,
    keyword: deferredKeyword || undefined,
    method: method === 'all' ? undefined : method,
    version: normalizedVersion || undefined,
    tag: normalizedTag || undefined,
  });

  const specs = specsQuery.data?.items ?? EMPTY_SPECS;

  const activeSpecId =
    selectedSpecId && specs.some((spec) => spec.id === selectedSpecId)
      ? selectedSpecId
      : specs[0]?.id ?? null;
  const selectedSpecSummary = specs.find((spec) => spec.id === activeSpecId) ?? null;
  const specDetailQuery = useApiSpec(projectId, activeSpecId ?? undefined);
  const specFullQuery = useApiSpecFull(projectId, activeSpecId ?? undefined);
  const specExamplesQuery = useApiSpecExamples(projectId, activeSpecId ?? undefined);
  const specShareQuery = useApiSpecShare(projectId, activeSpecId ?? undefined);
  const generatedTestQuery = useGeneratedApiTest(projectId, activeSpecId ?? undefined, generatedTestLanguage);
  const editingSpecQuery = useApiSpec(projectId, editingSpecId ?? undefined);

  const selectedSpec = specFullQuery.data || specDetailQuery.data || selectedSpecSummary;
  const categoryOptions = useMemo(
    () => buildCategoryOptions(categoriesQuery.data?.items),
    [categoriesQuery.data?.items]
  );
  const projectName = projectQuery.data?.name ?? 'Project';
  const projectSlug = projectQuery.data?.slug ?? `project-${projectId}`;
  const projectPlatform = projectQuery.data?.platform ?? '';
  const currentRole = memberRoleQuery.data?.role;
  const canWrite = currentRole ? WRITE_ROLES.includes(currentRole) : false;
  const canGoPrev = page > 1;
  const canGoNext = page < (specsQuery.data?.meta.total_pages || 1);
  const totalSpecs = specsQuery.data?.meta.total ?? projectStatsQuery.data?.api_spec_count ?? 0;
  const publicCountOnPage = specs.filter((spec) => spec.is_public).length;
  const documentedCountOnPage = specs.filter(
    (spec) => spec.doc_markdown || spec.doc_markdown_zh || spec.doc_markdown_en
  ).length;
  const examplesOnPage = specs.reduce((count, spec) => count + (spec.examples?.length || 0), 0);
  const apiSpecsPath = buildApiPath(`/projects/${projectId}/api-specs`);
  const activeSpecPath = activeSpecId
    ? buildApiPath(`/projects/${projectId}/api-specs/${activeSpecId}`)
    : buildApiPath(`/projects/${projectId}/api-specs/:sid`);
  const activeSpecFullPath = activeSpecId
    ? buildApiPath(`/projects/${projectId}/api-specs/${activeSpecId}/full`)
    : buildApiPath(`/projects/${projectId}/api-specs/:sid/full`);
  const activeSpecExamplesPath = activeSpecId
    ? buildApiPath(`/projects/${projectId}/api-specs/${activeSpecId}/examples`)
    : buildApiPath(`/projects/${projectId}/api-specs/:sid/examples`);
  const activeSpecSharePath = activeSpecId
    ? buildApiPath(`/projects/${projectId}/api-specs/${activeSpecId}/share`)
    : buildApiPath(`/projects/${projectId}/api-specs/:sid/share`);

  const createSpecMutation = useCreateApiSpec(projectId);
  const updateSpecMutation = useUpdateApiSpec(projectId);
  const createAIDraftMutation = useCreateApiSpecAIDraft(projectId);
  const refineAIDraftMutation = useRefineApiSpecAIDraft(projectId);
  const acceptAIDraftMutation = useAcceptApiSpecAIDraft(projectId);
  const deleteSpecMutation = useDeleteApiSpec(projectId);
  const publishShareMutation = usePublishApiSpecShare(projectId);
  const deleteShareMutation = useDeleteApiSpecShare(projectId);
  const importSpecsMutation = useImportApiSpecs(projectId);
  const exportSpecsMutation = useExportApiSpecs(projectId);
  const genDocMutation = useGenApiDoc(projectId);
  const genTestMutation = useGenApiTest(projectId);
  const batchGenMutation = useBatchGenApiDocs(projectId);
  const createExampleMutation = useCreateApiExample(projectId);
  const shareRoute = specShareQuery.data?.slug ? buildApiSpecShareRoute(specShareQuery.data.slug) : null;

  const openCreateDialog = () => {
    setFormMode('create');
    setEditingSpecId(null);
    setIsFormOpen(true);
  };

  const openAICreateDialog = () => {
    setIsAICreateOpen(true);
  };

  const openEditDialog = (specId: number) => {
    setSelectedSpecId(specId);
    setFormMode('edit');
    setEditingSpecId(specId);
    setIsFormOpen(true);
  };

  const handleRefresh = async () => {
    const tasks: Array<Promise<unknown>> = [
      projectQuery.refetch(),
      projectStatsQuery.refetch(),
      memberRoleQuery.refetch(),
      categoriesQuery.refetch(),
      specsQuery.refetch(),
    ];

    if (activeSpecId) {
      tasks.push(specDetailQuery.refetch(), specFullQuery.refetch(), specExamplesQuery.refetch());
    }

    await Promise.all(tasks);
    toast.success('Refreshed project API specification data');
  };

  const handleSpecSubmit = async (payload: CreateApiSpecRequest | UpdateApiSpecRequest) => {
    try {
      if (formMode === 'create') {
        const createdSpec = await createSpecMutation.mutateAsync(payload as CreateApiSpecRequest);
        setSelectedSpecId(createdSpec.id);
      } else if (editingSpecId) {
        const updatedSpec = await updateSpecMutation.mutateAsync({
          specId: editingSpecId,
          data: payload as UpdateApiSpecRequest,
        });
        setSelectedSpecId(updatedSpec.id);
      }

      setIsFormOpen(false);
      setEditingSpecId(null);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleDeleteSpec = async () => {
    if (!deleteTarget) {
      return;
    }

    const fallbackSpecId = specs.find((spec) => spec.id !== deleteTarget.id)?.id ?? null;

    try {
      await deleteSpecMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);

      if (activeSpecId === deleteTarget.id) {
        setSelectedSpecId(fallbackSpecId);
      }
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleImport = async (payload: { specs: CreateApiSpecRequest[] }) => {
    try {
      await importSpecsMutation.mutateAsync(payload);
      setIsImportOpen(false);
      setPage(1);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleExport = async (format: ApiSpecExportFormat) => {
    try {
      const payload = await exportSpecsMutation.mutateAsync({ format });
      downloadExportPayload({ payload, format, projectSlug });
      toast.success(`Exported ${format} file`);
      setIsExportOpen(false);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleBatchGenDoc = async (payload: BatchGenDocRequest) => {
    try {
      await batchGenMutation.mutateAsync(payload);
      setIsBatchGenOpen(false);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleAiAction = async (lang: ApiSpecLanguage) => {
    if (!aiAction?.spec) {
      return;
    }

    try {
      if (aiAction.mode === 'doc') {
        await genDocMutation.mutateAsync({ specId: aiAction.spec.id, lang });
        setDetailTab('docs');
      } else {
        await genTestMutation.mutateAsync({ specId: aiAction.spec.id, lang });
        setGeneratedTestLanguage(lang);
        setDetailTab('generated-test');
      }

      setAiAction(null);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleCreateExample = async (payload: CreateApiExampleRequest) => {
    if (!activeSpecId) {
      return;
    }

    try {
      await createExampleMutation.mutateAsync({ specId: activeSpecId, data: payload });
      setIsExampleOpen(false);
      setDetailTab('examples');
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleCopyShareLink = async (route = shareRoute) => {
    if (!route || typeof window === 'undefined') {
      return;
    }

    const absoluteUrl = new URL(route, window.location.origin).toString();
    await navigator.clipboard.writeText(absoluteUrl);
    toast.success('Public share link copied to clipboard');
  };

  const handlePublishShare = async () => {
    if (!activeSpecId) {
      return;
    }

    try {
      const share = await publishShareMutation.mutateAsync(activeSpecId);
      await handleCopyShareLink(buildApiSpecShareRoute(share.slug));
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleDeleteShare = async () => {
    if (!activeSpecId) {
      return;
    }

    try {
      await deleteShareMutation.mutateAsync(activeSpecId);
    } catch {
      // HTTP 错误由全局错误处理和 toast 负责提示。
    }
  };

  const handleCopyGeneratedTest = async () => {
    if (!generatedTestQuery.data) {
      return;
    }

    await navigator.clipboard.writeText(generatedTestQuery.data);
    toast.success('Generated test copied to clipboard');
  };

  const handleCreateAIDraft = async (
    payload: Parameters<typeof createAIDraftMutation.mutateAsync>[0]
  ) => createAIDraftMutation.mutateAsync(payload);

  const handleRefineAIDraft = async (
    draftId: number,
    payload: Parameters<typeof refineAIDraftMutation.mutateAsync>[0]['data']
  ) =>
    refineAIDraftMutation.mutateAsync({
      draftId,
      data: payload,
    });

  const handleAcceptAIDraft = async (
    draftId: number,
    payload: Parameters<typeof acceptAIDraftMutation.mutateAsync>[0]['data']
  ) =>
    acceptAIDraftMutation.mutateAsync({
      draftId,
      data: payload,
    });

  return (
    <div className="flex-1 space-y-8 p-6 pt-6">
      <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent p-6 transition-colors duration-500">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yMCAxMmgxNnYxNkgyMHoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PHBhdGggZD0iTTEyIDIwaDE2djE2SDEyeiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS1vcGFjaXR5PSIuMDUiLz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <Button asChild variant="link" className="h-auto px-0 text-sm text-muted-foreground">
              <Link href={ROUTES.CONSOLE.PROJECTS}>
                <ArrowLeft className="h-4 w-4" />
                Back to Projects
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">API Specifications</h1>
                <Braces className="h-6 w-6 text-primary" />
                <RoleBadge role={currentRole} />
              </div>

              <p className="max-w-4xl text-sm text-text-muted">
                管理项目
                {' '}
                <span className="font-semibold text-foreground">{projectName}</span>
                {' '}
                的 API 规格、examples、AI 文档和测试生成流程，对应后端入口为
                {' '}
                <code>{apiSpecsPath}</code>
                。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {projectSlug}
              </Badge>
              <Badge variant="outline">{getPlatformLabel(projectPlatform)}</Badge>
              <Badge variant="outline">{totalSpecs} specs</Badge>
              <Badge variant="outline">{projectStatsQuery.data?.category_count ?? 0} categories</Badge>
              <Badge variant="outline">{projectStatsQuery.data?.member_count ?? 0} members</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* API Specs 页面同样暴露环境页、分类页和 Test Cases 页入口，方便在项目核心配置模块之间切换。 */}
            <Button type="button" variant="outline" asChild>
              <Link href={buildProjectCategoriesRoute(projectId)}>
                <Tags className="h-4 w-4" />
                Categories
              </Link>
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={buildProjectEnvironmentsRoute(projectId)}>
                <Globe className="h-4 w-4" />
                Environments
              </Link>
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={buildProjectTestCasesRoute(projectId)}>
                <FlaskConical className="h-4 w-4" />
                Test Cases
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRefresh()}
              loading={
                specsQuery.isFetching ||
                projectQuery.isFetching ||
                projectStatsQuery.isFetching ||
                memberRoleQuery.isFetching
              }
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsImportOpen(true)} disabled={!canWrite}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsExportOpen(true)}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsBatchGenOpen(true)} disabled={!canWrite}>
              <Sparkles className="h-4 w-4" />
              Batch Gen Doc
            </Button>
            <Button type="button" variant="outline" onClick={openAICreateDialog} disabled={!canWrite}>
              <Bot className="h-4 w-4" />
              AI Create
            </Button>
            <Button type="button" onClick={openCreateDialog} disabled={!canWrite}>
              <Plus className="h-4 w-4" />
              Create Spec
            </Button>
          </div>
        </div>
      </div>

      {!canWrite && memberRoleQuery.isSuccess ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            当前角色是
            {' '}
            <strong>{getRoleLabel(currentRole)}</strong>
            ，可以查看与导出 API 规格，但不能执行创建、编辑、删除、导入和 AI 生成。
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {projectQuery.isLoading || projectStatsQuery.isLoading || specsQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Specs"
              value={totalSpecs}
              description={`Project slug: ${projectSlug}`}
              icon={FileJson2}
              variant="primary"
            />
            <StatCard
              title="Public On This Page"
              value={publicCountOnPage}
              description={`Visible results on page ${specsQuery.data?.meta.page || page}`}
              icon={ShieldCheck}
              variant="success"
            />
            <StatCard
              title="Docs Available"
              value={documentedCountOnPage}
              description="Specs already containing markdown docs"
              icon={ScrollText}
              variant="default"
            />
            <StatCard
              title="Examples Cached"
              value={specExamplesQuery.data?.total ?? examplesOnPage}
              description="Examples for the selected/current page specs"
              icon={FlaskConical}
              variant="warning"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden border-border/50 shadow-premium">
          <CardHeader className="gap-4 border-b bg-muted/20">
            <div>
              <CardTitle>Specification List</CardTitle>
              <CardDescription>
                {specsQuery.data?.meta
                  ? `Page ${specsQuery.data.meta.page} of ${specsQuery.data.meta.total_pages}, ${specsQuery.data.meta.total} total specs`
                  : `Connected to GET ${apiSpecsPath}`}
              </CardDescription>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Search path, summary, description"
                leftIcon={<Search className="size-4" />}
              />

              <Select
                value={method}
                onValueChange={(value) => {
                  setMethod(value as 'all' | HttpMethod);
                  resetToFirstPage();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  {METHOD_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={version}
                onChange={(event) => {
                  setVersion(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Version (exact match)"
              />

              <Input
                value={tag}
                onChange={(event) => {
                  setTag(event.target.value);
                  resetToFirstPage();
                }}
                placeholder="Tag (partial match)"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-6">
            {specsQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
                <div className="h-14 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Method</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {specs.map((spec) => (
                        <TableRow
                          key={spec.id}
                          data-state={spec.id === activeSpecId ? 'selected' : undefined}
                          className={cn(
                            'cursor-pointer transition-colors',
                            spec.id === activeSpecId ? 'bg-muted/50' : ''
                          )}
                          onClick={() => {
                            setSelectedSpecId(spec.id);
                            setDetailTab('overview');
                          }}
                        >
                          <TableCell>
                            <MethodBadge method={spec.method} />
                          </TableCell>
                          <TableCell className="min-w-[260px]">
                            <div className="space-y-1">
                              <div className="font-mono text-xs text-muted-foreground">ID {spec.id}</div>
                              <div className="font-medium">{spec.path}</div>
                              <div className="text-xs text-muted-foreground">{spec.summary || 'No summary'}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{spec.version}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {spec.tags?.length ? (
                                spec.tags.slice(0, 2).map((item) => (
                                  <Badge key={item} variant="outline">
                                    {item}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">No tags</span>
                              )}
                              {spec.tags?.length > 2 ? (
                                <Badge variant="outline">+{spec.tags.length - 2}</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={spec.is_public ? 'default' : 'secondary'}>
                              {spec.is_public ? 'Public' : 'Private'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(spec.updated_at, 'YYYY-MM-DD HH:mm')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedSpecId(spec.id);
                                  setDetailTab('overview');
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canWrite}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditDialog(spec.id);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canWrite}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedSpecId(spec.id);
                                  setAiAction({ mode: 'doc', spec });
                                }}
                              >
                                <Bot className="h-3.5 w-3.5" />
                                Gen Doc
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canWrite}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedSpecId(spec.id);
                                  setAiAction({ mode: 'test', spec });
                                }}
                              >
                                <FileCode2 className="h-3.5 w-3.5" />
                                Gen Test
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={!canWrite}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedSpecId(spec.id);
                                  setDeleteTarget(spec);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {specs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                            No API specs matched the current filters.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((currentPage) => currentPage - 1)}
                    disabled={!canGoPrev}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {specsQuery.data?.meta.page || page} of {specsQuery.data?.meta.total_pages || 1}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    disabled={!canGoNext}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-premium">
          <CardHeader className="gap-4 border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Selected Spec</CardTitle>
                <CardDescription>
                  Detail from <code>{activeSpecPath}</code>, full detail from <code>{activeSpecFullPath}</code>,
                  {' '}
                  examples from <code>{activeSpecExamplesPath}</code>.
                </CardDescription>
              </div>

              {selectedSpec ? (
                <div className="flex flex-wrap gap-2">
                  {specShareQuery.data ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCopyShareLink()}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link href={shareRoute || '#'} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Preview Share
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canWrite || deleteShareMutation.isPending}
                        onClick={() => void handleDeleteShare()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Disable Share
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canWrite || publishShareMutation.isPending}
                      onClick={() => void handlePublishShare()}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Publish Share
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => openEditDialog(selectedSpec.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => setAiAction({ mode: 'doc', spec: selectedSpec })}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    Gen Doc
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => setAiAction({ mode: 'test', spec: selectedSpec })}
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    Gen Test
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {!selectedSpec ? (
              <Alert>
                <AlertTitle>No API spec selected</AlertTitle>
                <AlertDescription>
                  从左侧列表中选择一条 API 规格，查看它的完整详情、文档和 examples。
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/10 bg-linear-to-br from-primary/10 via-transparent to-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <MethodBadge method={selectedSpec.method} />
                        <h2 className="font-mono text-base font-semibold">{selectedSpec.path}</h2>
                        <Badge variant="outline">v{selectedSpec.version}</Badge>
                        <Badge variant={selectedSpec.is_public ? 'default' : 'secondary'}>
                          {selectedSpec.is_public ? 'Public' : 'Private'}
                        </Badge>
                        {specShareQuery.data ? <Badge variant="outline">Shared</Badge> : null}
                        <Badge variant="outline">{selectedSpec.doc_source || 'manual'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedSpec.summary || 'No summary provided for this spec.'}
                      </p>
                      {specShareQuery.data ? (
                        <p className="text-xs text-muted-foreground">
                          分享接口：
                          {' '}
                          <code>{activeSpecSharePath}</code>
                          {' '}
                          · 对外页面：
                          {' '}
                          <code>{shareRoute}</code>
                        </p>
                      ) : null}
                    </div>

                    {/* 详情面板右上角提供项目概览和环境页入口，便于规格编写时切换上下文。 */}
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={buildProjectDetailRoute(projectId)}>
                          <FolderKanban className="h-3.5 w-3.5" />
                          Project Overview
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={buildProjectCategoriesRoute(projectId)}>
                          <Tags className="h-3.5 w-3.5" />
                          Categories
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={buildProjectEnvironmentsRoute(projectId)}>
                          <Globe className="h-3.5 w-3.5" />
                          Environments
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>

                <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="docs">Docs</TabsTrigger>
                    <TabsTrigger value="examples">Examples</TabsTrigger>
                    <TabsTrigger value="generated-test">Generated Test</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project ID</div>
                        <div className="mt-2 font-mono text-sm">{selectedSpec.project_id}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category ID</div>
                        <div className="mt-2 font-mono text-sm">{selectedSpec.category_id ?? 'Not set'}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created At</div>
                        <div className="mt-2 text-sm">{formatDate(selectedSpec.created_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated At</div>
                        <div className="mt-2 text-sm">{formatDate(selectedSpec.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-4">
                      <div className="mb-2 text-sm font-medium">Description</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedSpec.description || 'No description provided.'}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <JsonPreview
                        title="Request Body"
                        value={selectedSpec.request_body}
                        emptyLabel="This API spec does not define request body schema yet."
                      />
                      <JsonPreview
                        title="Parameters"
                        value={selectedSpec.parameters}
                        emptyLabel="This API spec does not define parameters yet."
                      />
                      <JsonPreview
                        title="Responses"
                        value={selectedSpec.responses}
                        emptyLabel="This API spec does not define responses yet."
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="docs" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Doc Source</div>
                        <div className="mt-2 text-sm">{selectedSpec.doc_source || 'manual'}</div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated (Default)</div>
                        <div className="mt-2 text-sm">
                          {selectedSpec.doc_updated_at
                            ? formatDate(selectedSpec.doc_updated_at, 'YYYY-MM-DD HH:mm')
                            : 'Not generated'}
                        </div>
                      </div>
                      <div className="rounded-xl border p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated (ZH / EN)</div>
                        <div className="mt-2 text-sm">
                          {(selectedSpec.doc_updated_at_zh &&
                            formatDate(selectedSpec.doc_updated_at_zh, 'YYYY-MM-DD HH:mm')) ||
                            'ZH not generated'}
                          {' / '}
                          {(selectedSpec.doc_updated_at_en &&
                            formatDate(selectedSpec.doc_updated_at_en, 'YYYY-MM-DD HH:mm')) ||
                            'EN not generated'}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">Default Markdown</div>
                          <Badge variant="outline">doc_markdown</Badge>
                        </div>
                        <CodeBlock
                          value={selectedSpec.doc_markdown}
                          emptyLabel="No default markdown stored for this spec."
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">Chinese Markdown</div>
                          <Badge variant="outline">doc_markdown_zh</Badge>
                        </div>
                        <CodeBlock
                          value={selectedSpec.doc_markdown_zh}
                          emptyLabel="No Chinese markdown stored for this spec."
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">English Markdown</div>
                          <Badge variant="outline">doc_markdown_en</Badge>
                        </div>
                        <CodeBlock
                          value={selectedSpec.doc_markdown_en}
                          emptyLabel="No English markdown stored for this spec."
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="examples" className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Examples</div>
                        <div className="text-xs text-muted-foreground">
                          当前列表通过 GET /projects/:id/api-specs/:sid/examples 拉取。
                        </div>
                      </div>

                      <Button type="button" size="sm" onClick={() => setIsExampleOpen(true)} disabled={!canWrite}>
                        <Plus className="h-3.5 w-3.5" />
                        Create Example
                      </Button>
                    </div>

                    {specExamplesQuery.isLoading ? (
                      <div className="space-y-3">
                        <div className="h-24 animate-pulse rounded-xl bg-muted" />
                        <div className="h-24 animate-pulse rounded-xl bg-muted" />
                      </div>
                    ) : specExamplesQuery.data?.items.length ? (
                      <div className="space-y-3">
                        {specExamplesQuery.data.items.map((example: ApiSpecExample) => (
                          <div key={example.id} className="space-y-3 rounded-xl border p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{example.name}</div>
                              <Badge variant="outline">Status {example.response_status}</Badge>
                              <Badge variant="outline">{example.duration_ms} ms</Badge>
                              <Badge variant="outline">{formatDate(example.created_at, 'YYYY-MM-DD HH:mm')}</Badge>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-3">
                              <JsonPreview
                                title="Request Headers"
                                value={example.request_headers}
                                emptyLabel="No request headers stored for this example."
                              />
                              <JsonPreview
                                title="Request Body"
                                value={example.request_body}
                                emptyLabel="No request body stored for this example."
                              />
                              <JsonPreview
                                title="Response Body"
                                value={example.response_body}
                                emptyLabel="No response body stored for this example."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Alert>
                        <AlertTitle>No examples yet</AlertTitle>
                        <AlertDescription>
                          当前规格还没有 request/response 样例，可以通过上方按钮创建。
                        </AlertDescription>
                      </Alert>
                    )}
                  </TabsContent>

                  <TabsContent value="generated-test" className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Generated Flow Test</div>
                        <div className="text-xs text-muted-foreground">
                          当前展示语言：
                          {' '}
                          <span className="font-medium">{generatedTestLanguage.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!generatedTestQuery.data}
                          onClick={() => void handleCopyGeneratedTest()}
                        >
                          <Boxes className="h-3.5 w-3.5" />
                          Copy
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setAiAction({ mode: 'test', spec: selectedSpec })}
                          disabled={!canWrite}
                        >
                          <FileCode2 className="h-3.5 w-3.5" />
                          Generate Test
                        </Button>
                      </div>
                    </div>

                    <CodeBlock
                      value={generatedTestQuery.data || selectedSpec.test_content}
                      emptyLabel="No generated test cached for this spec yet. Run `gen-test` to see the flow content here."
                    />
                  </TabsContent>
                </Tabs>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <FileJson2 className="h-4 w-4" />
                    Connected API Endpoints
                  </div>
                  <div className="space-y-2 font-mono text-xs text-muted-foreground">
                    <div>GET {apiSpecsPath}</div>
                    <div>POST {apiSpecsPath}</div>
                    <div>POST {apiSpecsPath}/import</div>
                    <div>GET {apiSpecsPath}/export</div>
                    <div>POST {apiSpecsPath}/batch-gen-doc</div>
                    <div>POST {apiSpecsPath}/ai-drafts</div>
                    <div>GET {apiSpecsPath}/ai-drafts/:aid</div>
                    <div>POST {apiSpecsPath}/ai-drafts/:aid/refine</div>
                    <div>POST {apiSpecsPath}/ai-drafts/:aid/accept</div>
                    <div>GET {activeSpecPath}</div>
                    <div>GET {activeSpecFullPath}</div>
                    <div>PATCH {activeSpecPath}</div>
                    <div>DELETE {activeSpecPath}</div>
                    <div>POST {activeSpecPath}/gen-doc</div>
                    <div>POST {activeSpecPath}/gen-test</div>
                    <div>GET {activeSpecExamplesPath}</div>
                    <div>POST {activeSpecExamplesPath}</div>
                    <div>GET {activeSpecSharePath}</div>
                    <div>POST {activeSpecSharePath}</div>
                    <div>DELETE {activeSpecSharePath}</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SpecFormDialog
        key={`${formMode}-${editingSpecQuery.data?.updated_at ?? editingSpecId ?? 'new'}-${isFormOpen ? 'open' : 'closed'}`}
        open={isFormOpen}
        mode={formMode}
        spec={formMode === 'edit' ? editingSpecQuery.data ?? null : null}
        categories={categoryOptions}
        isLoadingSpec={formMode === 'edit' && editingSpecQuery.isLoading}
        isSubmitting={createSpecMutation.isPending || updateSpecMutation.isPending}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingSpecId(null);
          }
        }}
        onSubmit={handleSpecSubmit}
      />

      <ApiSpecAICreateDialog
        open={isAICreateOpen}
        onOpenChange={setIsAICreateOpen}
        projectId={projectId}
        categories={categoryOptions}
        isSubmittingDraft={createAIDraftMutation.isPending}
        isSubmittingRefine={refineAIDraftMutation.isPending}
        isSubmittingAccept={acceptAIDraftMutation.isPending}
        onCreateDraft={handleCreateAIDraft}
        onRefineDraft={handleRefineAIDraft}
        onAcceptDraft={handleAcceptAIDraft}
        onAccepted={({ specId, continueToTests }) => {
          if (continueToTests) {
            router.push(`${buildProjectTestCasesRoute(projectId)}?fromSpec=${specId}&source=ai`);
            return;
          }

          setSelectedSpecId(specId);
          setDetailTab('overview');
        }}
      />

      <DeleteSpecDialog
        open={Boolean(deleteTarget)}
        spec={deleteTarget}
        isDeleting={deleteSpecMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDeleteSpec}
      />

      <ImportSpecsDialog
        open={isImportOpen}
        isSubmitting={importSpecsMutation.isPending}
        onOpenChange={setIsImportOpen}
        onSubmit={handleImport}
      />

      <ExportSpecsDialog
        open={isExportOpen}
        isSubmitting={exportSpecsMutation.isPending}
        onOpenChange={setIsExportOpen}
        onSubmit={handleExport}
      />

      <BatchGenDocDialog
        open={isBatchGenOpen}
        categories={categoryOptions}
        isSubmitting={batchGenMutation.isPending}
        onOpenChange={setIsBatchGenOpen}
        onSubmit={handleBatchGenDoc}
      />

      <AiActionDialog
        key={`${aiAction?.mode ?? 'none'}-${aiAction?.spec?.id ?? 'none'}-${aiAction ? 'open' : 'closed'}`}
        open={Boolean(aiAction)}
        mode={aiAction?.mode ?? 'doc'}
        spec={aiAction?.spec}
        isSubmitting={genDocMutation.isPending || genTestMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setAiAction(null);
          }
        }}
        onSubmit={handleAiAction}
      />

      <ExampleFormDialog
        key={`${activeSpecId ?? 'none'}-${isExampleOpen ? 'open' : 'closed'}`}
        open={isExampleOpen}
        isSubmitting={createExampleMutation.isPending}
        onOpenChange={setIsExampleOpen}
        onSubmit={handleCreateExample}
      />
    </div>
  );
}

export default ApiSpecManagementPage;
