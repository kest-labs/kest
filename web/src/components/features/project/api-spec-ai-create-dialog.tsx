'use client';

import { useState } from 'react';
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
    throw new Error(`${label} must be a JSON array.`);
  }
  if (expected === 'object' && (parsed === null || isArray || typeof parsed !== 'object')) {
    throw new Error(`${label} must be a JSON object.`);
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

interface ApiSpecAICreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number | string;
  categories: CategoryOption[];
  isSubmittingDraft: boolean;
  isSubmittingRefine: boolean;
  isSubmittingAccept: boolean;
  onCreateDraft: (payload: CreateApiSpecAIDraftRequest) => Promise<ApiSpecAIDraft>;
  onRefineDraft: (
    draftId: number | string,
    payload: RefineApiSpecAIDraftRequest
  ) => Promise<ApiSpecAIDraft>;
  onAcceptDraft: (
    draftId: number | string,
    payload: AcceptApiSpecAIDraftRequest
  ) => Promise<AcceptApiSpecAIDraftResponse>;
  onAccepted: (result: { specId: number | string; continueToTests: boolean }) => void;
}

export function ApiSpecAICreateDialog({
  open,
  onOpenChange,
  ...props
}: ApiSpecAICreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ApiSpecAICreateDialogContent {...props} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function ApiSpecAICreateDialogContent({
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
}: Omit<ApiSpecAICreateDialogProps, 'open'>) {
  const [intent, setIntent] = useState('');
  const [seedMethod, setSeedMethod] = useState<HttpMethod>('GET');
  const [seedPath, setSeedPath] = useState('');
  const [seedCategoryId, setSeedCategoryId] = useState('');
  const [lang, setLang] = useState<ApiSpecLanguage>('en');
  const [useProjectConventions, setUseProjectConventions] = useState(true);
  const [draft, setDraft] = useState<ApiSpecAIDraft | null>(null);
  const [editableDraft, setEditableDraft] = useState<EditableDraftState>(createEmptyEditableDraft);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refineField, setRefineField] = useState('all');
  const [generateDoc, setGenerateDoc] = useState(true);
  const [generateTest, setGenerateTest] = useState(false);
  const [continueToTests, setContinueToTests] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateEditableDraft = <K extends keyof EditableDraftState>(key: K, value: EditableDraftState[K]) => {
    setEditableDraft((current) => ({ ...current, [key]: value }));
  };

  const buildDraftSpec = (): ApiSpecAIDraftSpec => {
    const requestBody = parseJsonField<RequestBodySpec>(editableDraft.requestBody, 'Request Body', 'object');
    const parameters = parseJsonField<ParameterSpec[]>(editableDraft.parameters, 'Parameters', 'array');
    const responses = parseJsonField<Record<string, ResponseSpec>>(editableDraft.responses, 'Responses', 'object');

    return {
      category_id: editableDraft.categoryId || undefined,
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
      setValidationError('Intent is required.');
      return;
    }

    setValidationError(null);

    const result = await onCreateDraft({
      intent: intent.trim(),
      method: seedMethod,
      path: seedPath.trim() || undefined,
      category_id: seedCategoryId || undefined,
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
      setValidationError('Refine instruction is required.');
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
      setValidationError(error instanceof Error ? error.message : 'Unable to refine the draft.');
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
      onAccepted({
        specId: result.spec.id,
        continueToTests,
      });
      onOpenChange(false);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Unable to create the spec.');
    }
  };

  return (
    <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Create API Spec
          </DialogTitle>
          <DialogDescription>
            Start with one sentence of product intent, then let AI draft the spec using the current
            project conventions. Project ID:
            {' '}
            <code>{projectId}</code>
            . Raw request secrets are not used as prompt context.
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
                Give AI the goal first, then optionally pin method, path, and category as seeds.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="ai-intent">Intent</Label>
                <Textarea
                  id="ai-intent"
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  placeholder="Example: Create an order endpoint for signed-in users with line items, shipping address, and coupon support"
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
                    Reuse the current project&apos;s versioning, tags, and response code patterns.
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
                    Review and adjust the draft before refining it again or creating the final spec.
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
                        <div className="text-sm text-muted-foreground">Mark the spec public after creation.</div>
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
                      Rewrite a focused part of the draft without regenerating everything.
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
                        placeholder="Example: Use the project's standard error envelope and wrap successful responses in data"
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
                    <CardDescription>Show the context, assumptions, and open questions behind this draft.</CardDescription>
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
                    The draft uses existing API specs in this project to infer method, parameters,
                    request body, and responses.
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
            <div className="flex items-center gap-2">
              <Switch checked={continueToTests} onCheckedChange={setContinueToTests} disabled={!draft} />
              <span className="text-sm text-muted-foreground">Open Test Cases after Create</span>
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
  );
}
