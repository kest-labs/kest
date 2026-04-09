'use client';

import { useEffect, useState } from 'react';
import { Bot, FileJson2, HelpCircle, Sparkles, WandSparkles } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { CategoryOption } from '@/components/features/project/category-helpers';
import type {
  AcceptApiSpecAIDraftRequest,
  AcceptApiSpecAIDraftResponse,
  ApiSpecAIDraft,
  ApiSpecAIDraftSpec,
  ApiSpecLanguage,
  CreateApiSpecAIDraftRequest,
  HttpMethod,
  ParameterSpec,
  RefineApiSpecAIDraftRequest,
  RequestBodySpec,
  ResponseSpec,
} from '@/types/api-spec';

const METHOD_OPTIONS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const LANGUAGE_OPTIONS: Array<{ value: ApiSpecLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
];
const REFINE_FIELDS = [
  { value: 'all', label: 'All Fields' },
  { value: 'summary', label: 'Summary' },
  { value: 'description', label: 'Description' },
  { value: 'request_body', label: 'Request Body' },
  { value: 'parameters', label: 'Parameters' },
  { value: 'responses', label: 'Responses' },
  { value: 'tags', label: 'Tags' },
];

interface EditableDraftState {
  categoryId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string;
  version: string;
  isPublic: boolean;
  requestBody: string;
  parameters: string;
  responses: string;
}

const createEmptyEditableDraft = (): EditableDraftState => ({
  categoryId: '',
  method: 'GET',
  path: '',
  summary: '',
  description: '',
  tags: '',
  version: '',
  isPublic: false,
  requestBody: '',
  parameters: '',
  responses: '',
});

const formatJsonInput = (value: unknown) => (value ? JSON.stringify(value, null, 2) : '');

const formatEditableDraft = (draft: ApiSpecAIDraftSpec): EditableDraftState => ({
  categoryId: draft.category_id ? String(draft.category_id) : '',
  method: draft.method,
  path: draft.path,
  summary: draft.summary,
  description: draft.description,
  tags: (draft.tags ?? []).join(', '),
  version: draft.version,
  isPublic: draft.is_public,
  requestBody: formatJsonInput(draft.request_body),
  parameters: formatJsonInput(draft.parameters),
  responses: formatJsonInput(draft.responses),
});

const parseJsonField = <T,>(value: string, label: string, expected: 'object' | 'array'): T | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as T;
  const isArray = Array.isArray(parsed);
  if (expected === 'array' && !isArray) {
    throw new Error(`${label} 必须是 JSON array。`);
  }
  if (expected === 'object' && (parsed === null || isArray || typeof parsed !== 'object')) {
    throw new Error(`${label} 必须是 JSON object。`);
  }

  return parsed;
};

const normalizeTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

export function ApiSpecAICreateDialog({
  open,
  onOpenChange,
  projectId,
  categories,
  isSubmittingDraft,
  isSubmittingRefine,
  isSubmittingAccept,
  onCreateDraft,
  onRefineDraft,
  onAcceptDraft,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  categories: CategoryOption[];
  isSubmittingDraft: boolean;
  isSubmittingRefine: boolean;
  isSubmittingAccept: boolean;
  onCreateDraft: (payload: CreateApiSpecAIDraftRequest) => Promise<ApiSpecAIDraft>;
  onRefineDraft: (
    draftId: number,
    payload: RefineApiSpecAIDraftRequest
  ) => Promise<ApiSpecAIDraft>;
  onAcceptDraft: (
    draftId: number,
    payload: AcceptApiSpecAIDraftRequest
  ) => Promise<AcceptApiSpecAIDraftResponse>;
  onAccepted: (specId: number) => void;
}) {
  const [intent, setIntent] = useState('');
  const [seedMethod, setSeedMethod] = useState<HttpMethod>('GET');
  const [seedPath, setSeedPath] = useState('');
  const [seedCategoryId, setSeedCategoryId] = useState('');
  const [lang, setLang] = useState<ApiSpecLanguage>('zh');
  const [useProjectConventions, setUseProjectConventions] = useState(true);
  const [draft, setDraft] = useState<ApiSpecAIDraft | null>(null);
  const [editableDraft, setEditableDraft] = useState<EditableDraftState>(createEmptyEditableDraft);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineField, setRefineField] = useState('all');
  const [generateDoc, setGenerateDoc] = useState(true);
  const [generateTest, setGenerateTest] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIntent('');
      setSeedMethod('GET');
      setSeedPath('');
      setSeedCategoryId('');
      setLang('zh');
      setUseProjectConventions(true);
      setDraft(null);
      setEditableDraft(createEmptyEditableDraft());
      setRefineInstruction('');
      setRefineField('all');
      setGenerateDoc(true);
      setGenerateTest(false);
      setValidationError(null);
    }
  }, [open]);

  const updateEditableDraft = <K extends keyof EditableDraftState>(key: K, value: EditableDraftState[K]) => {
    setEditableDraft((current) => ({ ...current, [key]: value }));
  };

  const buildDraftSpec = (): ApiSpecAIDraftSpec => {
    const requestBody = parseJsonField<RequestBodySpec>(editableDraft.requestBody, 'Request Body', 'object');
    const parameters = parseJsonField<ParameterSpec[]>(editableDraft.parameters, 'Parameters', 'array');
    const responses = parseJsonField<Record<string, ResponseSpec>>(editableDraft.responses, 'Responses', 'object');

    return {
      category_id: editableDraft.categoryId ? Number(editableDraft.categoryId) : undefined,
      method: editableDraft.method,
      path: editableDraft.path.trim(),
      summary: editableDraft.summary.trim(),
      description: editableDraft.description.trim(),
      tags: normalizeTags(editableDraft.tags),
      request_body: requestBody,
      parameters,
      responses,
      version: editableDraft.version.trim(),
      is_public: editableDraft.isPublic,
    };
  };

  const handleGenerateDraft = async () => {
    if (!intent.trim()) {
      setValidationError('Intent 是必填项。');
      return;
    }

    setValidationError(null);

    const result = await onCreateDraft({
      intent: intent.trim(),
      method: seedMethod,
      path: seedPath.trim() || undefined,
      category_id: seedCategoryId ? Number(seedCategoryId) : undefined,
      use_project_conventions: useProjectConventions,
      lang,
    });

    setDraft(result);
    setEditableDraft(formatEditableDraft(result.draft));
  };

  const handleRefine = async () => {
    if (!draft) {
      return;
    }

    if (!refineInstruction.trim()) {
      setValidationError('Refine instruction 不能为空。');
      return;
    }

    try {
      const currentDraft = buildDraftSpec();
      setValidationError(null);
      const result = await onRefineDraft(draft.id, {
        instruction: refineInstruction.trim(),
        fields: refineField === 'all' ? undefined : [refineField],
        current_draft: currentDraft,
        lang,
      });
      setDraft(result);
      setEditableDraft(formatEditableDraft(result.draft));
      setRefineInstruction('');
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Refine draft 失败。');
    }
  };

  const handleAccept = async () => {
    if (!draft) {
      return;
    }

    try {
      const overrides = buildDraftSpec();
      setValidationError(null);
      const result = await onAcceptDraft(draft.id, {
        overrides,
        generate_doc: generateDoc,
        generate_test: generateTest,
        lang,
      });
      onAccepted(result.spec.id);
      onOpenChange(false);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Create spec 失败。');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Create API Spec
          </DialogTitle>
          <DialogDescription>
            先输入一句话需求，再让 AI 结合项目现有接口风格生成 draft。当前项目 ID 为
            {' '}
            <code>{projectId}</code>
            ，不会读取 request 原始敏感数据。
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {validationError ? (
            <Alert variant="destructive">
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          ) : null}

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">1. Intent</CardTitle>
              <CardDescription>
                先给 AI 一句业务意图，可选补 method、path 和 category 作为 seed。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="ai-intent">Intent</Label>
                <Textarea
                  id="ai-intent"
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  placeholder="例如：新增一个创建订单接口，登录后可用，需要商品列表、收货地址、优惠券"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={seedMethod} onValueChange={(value) => setSeedMethod(value as HttpMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-path">Path</Label>
                <Input
                  id="ai-path"
                  value={seedPath}
                  onChange={(event) => setSeedPath(event.target.value)}
                  placeholder="/v1/orders"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={seedCategoryId || 'none'} onValueChange={(value) => setSeedCategoryId(value === 'none' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={lang} onValueChange={(value) => setLang(value as ApiSpecLanguage)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Language" />
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

              <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 lg:col-span-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Use project conventions</div>
                  <div className="text-sm text-muted-foreground">
                    让 AI 参考当前项目已有 specs 的版本、标签和状态码风格。
                  </div>
                </div>
                <Switch checked={useProjectConventions} onCheckedChange={setUseProjectConventions} />
              </div>
            </CardContent>
          </Card>

          {draft ? (
            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">2. Draft Review</CardTitle>
                  <CardDescription>
                    可以先人工微调，再做 refine 或直接创建正式 spec。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select
                        value={editableDraft.method}
                        onValueChange={(value) => updateEditableDraft('method', value as HttpMethod)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Method" />
                        </SelectTrigger>
                        <SelectContent>
                          {METHOD_OPTIONS.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="draft-path">Path</Label>
                      <Input
                        id="draft-path"
                        value={editableDraft.path}
                        onChange={(event) => updateEditableDraft('path', event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="draft-summary">Summary</Label>
                      <Input
                        id="draft-summary"
                        value={editableDraft.summary}
                        onChange={(event) => updateEditableDraft('summary', event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="draft-version">Version</Label>
                      <Input
                        id="draft-version"
                        value={editableDraft.version}
                        onChange={(event) => updateEditableDraft('version', event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editableDraft.categoryId || 'none'}
                        onValueChange={(value) => updateEditableDraft('categoryId', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {categories.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium">Public</div>
                        <div className="text-sm text-muted-foreground">Accept 后是否默认标记为 public。</div>
                      </div>
                      <Switch
                        checked={editableDraft.isPublic}
                        onCheckedChange={(checked) => updateEditableDraft('isPublic', checked)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-description">Description</Label>
                    <Textarea
                      id="draft-description"
                      value={editableDraft.description}
                      onChange={(event) => updateEditableDraft('description', event.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-tags">Tags</Label>
                    <Input
                      id="draft-tags"
                      value={editableDraft.tags}
                      onChange={(event) => updateEditableDraft('tags', event.target.value)}
                      placeholder="orders, checkout"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-request-body">Request Body JSON</Label>
                    <Textarea
                      id="draft-request-body"
                      value={editableDraft.requestBody}
                      onChange={(event) => updateEditableDraft('requestBody', event.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-parameters">Parameters JSON</Label>
                    <Textarea
                      id="draft-parameters"
                      value={editableDraft.parameters}
                      onChange={(event) => updateEditableDraft('parameters', event.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-responses">Responses JSON</Label>
                    <Textarea
                      id="draft-responses"
                      value={editableDraft.responses}
                      onChange={(event) => updateEditableDraft('responses', event.target.value)}
                      rows={10}
                      className="font-mono text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Refine
                    </CardTitle>
                    <CardDescription>
                      对当前 draft 局部重写，不需要整份重新生成。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Target Field</Label>
                      <Select value={refineField} onValueChange={setRefineField}>
                        <SelectTrigger>
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {REFINE_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="draft-refine">Instruction</Label>
                      <Textarea
                        id="draft-refine"
                        value={refineInstruction}
                        onChange={(event) => setRefineInstruction(event.target.value)}
                        placeholder="例如：沿用项目统一的错误响应结构，成功返回体包裹在 data 里"
                        rows={5}
                      />
                    </div>

                    <Button type="button" variant="outline" loading={isSubmittingRefine} onClick={() => void handleRefine()}>
                      <WandSparkles className="h-4 w-4" />
                      Apply Refine
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base">Why This Draft</CardTitle>
                    <CardDescription>展示 AI 当前参考的项目上下文与不确定项。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="space-y-2">
                      <div className="font-medium">Assumptions</div>
                      {draft.assumptions?.length ? (
                        <ul className="space-y-2 text-muted-foreground">
                          {draft.assumptions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground">No assumptions.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">Questions</div>
                      {draft.questions?.length ? (
                        <ul className="space-y-2 text-muted-foreground">
                          {draft.questions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground">No open questions.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">Project Conventions</div>
                      {draft.conventions ? (
                        <div className="flex flex-wrap gap-2">
                          {draft.conventions.default_version ? (
                            <Badge variant="outline">Version: {draft.conventions.default_version}</Badge>
                          ) : null}
                          {draft.conventions.auth_style ? (
                            <Badge variant="outline">Auth: {draft.conventions.auth_style}</Badge>
                          ) : null}
                          {(draft.conventions.common_tags ?? []).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Project conventions disabled.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">References</div>
                      {draft.references?.length ? (
                        <div className="space-y-2">
                          {draft.references.map((reference) => (
                            <div key={reference.id} className="rounded-lg border border-border/60 p-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{reference.method}</Badge>
                                <code className="text-xs">{reference.path}</code>
                                {reference.explicit ? <Badge variant="secondary">Explicit</Badge> : null}
                              </div>
                              <div className="mt-2 text-sm font-medium">{reference.summary || 'Untitled spec'}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                score {reference.score.toFixed(1)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">No references available.</div>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="font-medium">Field Insights</div>
                      {draft.field_insights && Object.keys(draft.field_insights).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(draft.field_insights).map(([field, insight]) => (
                            <div key={field} className="rounded-lg border border-border/60 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">{field}</span>
                                <Badge variant="outline">{Math.round(insight.confidence * 100)}%</Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{insight.source}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">No field insights.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="border-dashed border-border/70 bg-muted/20">
              <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 py-10 text-center">
                <FileJson2 className="h-10 w-10 text-primary/70" />
                <div className="space-y-1">
                  <div className="font-medium">Generate a structured draft first</div>
                  <div className="max-w-xl text-sm text-muted-foreground">
                    Draft 会结合项目内已有 API Specs 推导 method、parameters、request body 和 responses。
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </DialogBody>

        <DialogFooter className="justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={generateDoc} onCheckedChange={setGenerateDoc} disabled={!draft} />
              <span className="text-sm text-muted-foreground">Generate Doc</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={generateTest} onCheckedChange={setGenerateTest} disabled={!draft} />
              <span className="text-sm text-muted-foreground">Generate Test</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" loading={isSubmittingDraft} onClick={() => void handleGenerateDraft()}>
              <Sparkles className="h-4 w-4" />
              {draft ? 'Regenerate Draft' : 'Generate Draft'}
            </Button>
            <Button type="button" loading={isSubmittingAccept} onClick={() => void handleAccept()} disabled={!draft}>
              Create Spec
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
