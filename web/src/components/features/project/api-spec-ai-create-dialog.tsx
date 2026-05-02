'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Bot, FileJson2, HelpCircle, Sparkles, WandSparkles } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CategoryOption } from '@/components/features/project/category-helpers';
import { useT } from '@/i18n/client';
import type {
  AcceptApiSpecAIDraftRequest,
  AcceptApiSpecAIDraftResponse,
  ApiSpecAIDraft,
  ApiSpecAIDraftSpec,
  ApiSpecAIDraftStreamOptions,
  ApiSpecLanguage,
  CreateApiSpecAIDraftRequest,
  HttpMethod,
  ParameterSpec,
  RefineApiSpecAIDraftRequest,
  RequestBodySpec,
  ResponseSpec,
} from '@/types/api-spec';

const METHOD_OPTIONS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const LANGUAGE_OPTIONS: ApiSpecLanguage[] = ['en', 'zh'];
const REFINE_FIELDS = [
  'all',
  'summary',
  'description',
  'request_body',
  'parameters',
  'responses',
  'tags',
] as const;

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

const parseJsonField = <T,>(
  value: string,
  expected: 'object' | 'array',
  errorMessage: string
): T | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as T;
  const isArray = Array.isArray(parsed);
  if (expected === 'array' && !isArray) {
    throw new Error(errorMessage);
  }
  if (expected === 'object' && (parsed === null || isArray || typeof parsed !== 'object')) {
    throw new Error(errorMessage);
  }

  return parsed;
};

const normalizeTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    )
  );

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error
      ? error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')
      : false;

function DisabledReasonTooltip({
  children,
  disabled,
  reason,
  className = 'inline-flex',
}: {
  children: ReactNode;
  disabled: boolean;
  reason?: string;
  className?: string;
}) {
  if (!disabled || !reason) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} title={reason} aria-label={reason} className={className}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-center">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}

function DraftGenerationPreview({
  status,
  elapsedSeconds,
  streamOutput,
  error,
}: {
  status: string;
  elapsedSeconds: number;
  streamOutput: string;
  error?: string | null;
}) {
  const t = useT('project');
  const elapsedLabel =
    elapsedSeconds <= 0
      ? t('apiSpecs.aiCreateDialog.starting')
      : t('apiSpecs.aiCreateDialog.elapsedSeconds', { seconds: elapsedSeconds });

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">
          {t('apiSpecs.aiCreateDialog.sections.previewTitle')}
        </CardTitle>
        <CardDescription>
          {status}
          {' • '}
          {elapsedLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">
                {t('apiSpecs.aiCreateDialog.sections.draftStructure')}
              </div>
              <Badge variant="secondary">{status}</Badge>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-3 text-sm font-medium">{t('common.parameters')}</div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-3 text-sm font-medium">{t('common.responses')}</div>
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {t('apiSpecs.aiCreateDialog.sections.liveOutput')}
              </div>
              <Badge variant="outline">{t('apiSpecs.aiCreateDialog.sections.streaming')}</Badge>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-muted-foreground">
              {streamOutput || t('apiSpecs.aiCreateDialog.placeholders.waitForTokens')}
            </pre>
          </div>

          {error ? (
            <Alert variant="destructive">
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>{t('apiSpecs.aiCreateDialog.sections.generationFailed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface ApiSpecAICreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number | string;
  categories: CategoryOption[];
  isSubmittingRefine: boolean;
  isSubmittingAccept: boolean;
  onCreateDraft: (
    payload: CreateApiSpecAIDraftRequest,
    options?: ApiSpecAIDraftStreamOptions
  ) => Promise<ApiSpecAIDraft>;
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
  isSubmittingRefine,
  isSubmittingAccept,
  onCreateDraft,
  onRefineDraft,
  onAcceptDraft,
  onAccepted,
}: Omit<ApiSpecAICreateDialogProps, 'open'>) {
  const t = useT('project');
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
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState(t('apiSpecs.aiCreateDialog.readyToGenerate'));
  const [draftStreamOutput, setDraftStreamOutput] = useState('');
  const [draftElapsedSeconds, setDraftElapsedSeconds] = useState(0);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [didDraftGenerationFail, setDidDraftGenerationFail] = useState(false);
  const draftAbortRef = useRef<AbortController | null>(null);
  const footerHelperMessage = isGeneratingDraft
    ? t('apiSpecs.aiCreateDialog.draftGeneratingHelp')
    : t('apiSpecs.aiCreateDialog.draftRequiredHelp');
  const draftOptionDisableReason =
    draft && isGeneratingDraft
      ? t('apiSpecs.aiCreateDialog.draftOptionsDisabledReason')
      : undefined;
  const generateDraftDisableReason =
    isSubmittingAccept || isSubmittingRefine
      ? t('apiSpecs.aiCreateDialog.generateDraftDisabledReason')
      : undefined;
  const createSpecDisableReason =
    draft && isGeneratingDraft
      ? t('apiSpecs.aiCreateDialog.createSpecDisabledReason')
      : undefined;
  const languageOptions = LANGUAGE_OPTIONS.map(value => ({
    value,
    label:
      value === 'en'
        ? t('apiSpecs.aiCreateDialog.languages.english')
        : t('apiSpecs.aiCreateDialog.languages.chinese'),
  }));
  const refineFields = REFINE_FIELDS.map(value => {
    switch (value) {
      case 'all':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.all') };
      case 'summary':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.summary') };
      case 'description':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.description') };
      case 'request_body':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.requestBody') };
      case 'parameters':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.parameters') };
      case 'responses':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.responses') };
      case 'tags':
        return { value, label: t('apiSpecs.aiCreateDialog.refineFields.tags') };
    }
  });

  useEffect(() => {
    if (!isGeneratingDraft) {
      setDraftElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setDraftElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isGeneratingDraft]);

  useEffect(() => {
    return () => {
      draftAbortRef.current?.abort();
    };
  }, []);

  const updateEditableDraft = <K extends keyof EditableDraftState>(
    key: K,
    value: EditableDraftState[K]
  ) => {
    setEditableDraft(current => ({ ...current, [key]: value }));
  };

  const buildDraftSpec = (): ApiSpecAIDraftSpec => {
    const requestBody = parseJsonField<RequestBodySpec>(
      editableDraft.requestBody,
      'object',
      t('common.jsonMustBeObject', { label: t('common.requestBody') })
    );
    const parameters = parseJsonField<ParameterSpec[]>(
      editableDraft.parameters,
      'array',
      t('common.jsonMustBeArray', { label: t('common.parameters') })
    );
    const responses = parseJsonField<Record<string, ResponseSpec>>(
      editableDraft.responses,
      'object',
      t('common.jsonMustBeObject', { label: t('common.responses') })
    );

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
      setValidationError(t('apiSpecs.aiCreateDialog.intentRequired'));
      return;
    }

    setValidationError(null);
    setDraftError(null);
    setDidDraftGenerationFail(false);
    setDraftStatus(t('apiSpecs.aiCreateDialog.preparingDraftStream'));
    setDraftStreamOutput('');
    setIsGeneratingDraft(true);

    draftAbortRef.current?.abort();
    const controller = new AbortController();
    draftAbortRef.current = controller;

    try {
      const result = await onCreateDraft(
        {
          intent: intent.trim(),
          method: seedMethod,
          path: seedPath.trim() || undefined,
          category_id: seedCategoryId || undefined,
          use_project_conventions: useProjectConventions,
          lang,
        },
        {
          signal: controller.signal,
          onStatus: status => {
            setDraftStatus(status || t('apiSpecs.aiCreateDialog.generatingStructuredDraft'));
          },
          onToken: chunk => {
            if (!chunk) {
              return;
            }
            setDraftStreamOutput(current => current + chunk);
          },
        }
      );

      setDraft(result);
      setEditableDraft(formatEditableDraft(result.draft));
      setDraftError(null);
      setDraftStatus(t('apiSpecs.aiCreateDialog.draftReady'));
      setDidDraftGenerationFail(false);
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        setDraftStatus(t('apiSpecs.aiCreateDialog.generationCanceled'));
        setDidDraftGenerationFail(false);
        return;
      }

      const message =
        error instanceof Error ? error.message : t('apiSpecs.aiCreateDialog.unableToGenerateDraft');
      setDraftError(message);
      setDraftStatus(t('apiSpecs.aiCreateDialog.generationFailedStatus'));
      setDidDraftGenerationFail(true);
      toast.error(t('apiSpecs.aiCreateDialog.toasts.generateFailedTitle'), {
        description: t('apiSpecs.aiCreateDialog.toasts.generateFailedDescription', { message }),
      });
    } finally {
      setIsGeneratingDraft(false);
      if (draftAbortRef.current === controller) {
        draftAbortRef.current = null;
      }
    }
  };

  const handleCancelDraftGeneration = () => {
    draftAbortRef.current?.abort();
  };

  const handleRefine = async () => {
    if (!draft) {
      return;
    }

    if (!refineInstruction.trim()) {
      setValidationError(t('apiSpecs.aiCreateDialog.refineInstructionRequired'));
      return;
    }

    try {
      const currentDraft = buildDraftSpec();
      setValidationError(null);
      setDraftError(null);
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
      setValidationError(
        error instanceof Error ? error.message : t('apiSpecs.aiCreateDialog.unableToRefineDraft')
      );
    }
  };

  const handleAccept = async () => {
    if (!draft) {
      return;
    }

    try {
      const overrides = buildDraftSpec();
      setValidationError(null);
      setDraftError(null);
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
      setValidationError(
        error instanceof Error ? error.message : t('apiSpecs.aiCreateDialog.unableToCreateSpec')
      );
    }
  };

  return (
    <DialogContent
      size="xl"
      hideCloseButton={isGeneratingDraft}
      onEscapeKeyDown={event => {
        if (isGeneratingDraft) {
          event.preventDefault();
        }
      }}
      onInteractOutside={event => {
        if (isGeneratingDraft) {
          event.preventDefault();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          {t('apiSpecs.aiCreateDialog.title')}
        </DialogTitle>
        <DialogDescription>
          {t('apiSpecs.aiCreateDialog.description', { projectId: String(projectId) })}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-6">
        {validationError ? (
          <Alert variant="destructive">
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>{t('apiSpecs.aiCreateDialog.validationError')}</AlertTitle>
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        ) : null}

        {draftError && draft ? (
          <Alert variant="destructive">
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>{t('apiSpecs.aiCreateDialog.latestGenerationFailed')}</AlertTitle>
            <AlertDescription>
              {t('apiSpecs.aiCreateDialog.latestGenerationFailedDescription', {
                message: draftError,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              {t('apiSpecs.aiCreateDialog.sections.intentTitle')}
            </CardTitle>
            <CardDescription>
              {t('apiSpecs.aiCreateDialog.sections.intentDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="ai-intent">{t('apiSpecs.aiCreateDialog.fields.intent')}</Label>
              <Textarea
                id="ai-intent"
                value={intent}
                onChange={event => setIntent(event.target.value)}
                placeholder={t('apiSpecs.aiCreateDialog.placeholders.intent')}
                rows={5}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label>{`${t('common.method')} / ${t('common.path')}`}</Label>
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <Select
                  value={seedMethod}
                  onValueChange={value => setSeedMethod(value as HttpMethod)}
                >
                  <SelectTrigger className="w-full" aria-label={t('common.method')}>
                    <SelectValue placeholder={t('common.method')} />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map(method => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  id="ai-path"
                  aria-label={t('common.path')}
                  className="font-mono"
                  value={seedPath}
                  onChange={event => setSeedPath(event.target.value)}
                  placeholder="/v1/orders"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('common.category')}</Label>
              <Select
                value={seedCategoryId || 'none'}
                onValueChange={value => setSeedCategoryId(value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('apiSpecs.aiCreateDialog.placeholders.category')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('apiSpecs.aiCreateDialog.fields.noCategory')}
                  </SelectItem>
                  {categories.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('apiSpecs.aiCreateDialog.fields.language')}</Label>
              <Select value={lang} onValueChange={value => setLang(value as ApiSpecLanguage)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('apiSpecs.aiCreateDialog.placeholders.language')} />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3 lg:col-span-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {t('apiSpecs.aiCreateDialog.fields.useProjectConventions')}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('apiSpecs.aiCreateDialog.fields.useProjectConventionsDescription')}
                </div>
              </div>
              <Switch checked={useProjectConventions} onCheckedChange={setUseProjectConventions} />
            </div>
          </CardContent>
        </Card>

        {isGeneratingDraft || (!draft && (didDraftGenerationFail || draftStreamOutput)) ? (
          <DraftGenerationPreview
            status={draftStatus}
            elapsedSeconds={draftElapsedSeconds}
            streamOutput={draftStreamOutput}
            error={didDraftGenerationFail ? draftError : null}
          />
        ) : draft ? (
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">
                  {t('apiSpecs.aiCreateDialog.sections.reviewTitle')}
                </CardTitle>
                <CardDescription>
                  {t('apiSpecs.aiCreateDialog.sections.reviewDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>{`${t('common.method')} / ${t('common.path')}`}</Label>
                    <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                      <Select
                        value={editableDraft.method}
                        onValueChange={value => updateEditableDraft('method', value as HttpMethod)}
                      >
                        <SelectTrigger className="w-full" aria-label={t('common.method')}>
                          <SelectValue placeholder={t('common.method')} />
                        </SelectTrigger>
                        <SelectContent>
                          {METHOD_OPTIONS.map(method => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        id="draft-path"
                        aria-label={t('common.path')}
                        className="font-mono"
                        value={editableDraft.path}
                        onChange={event => updateEditableDraft('path', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-summary">{t('common.summary')}</Label>
                    <Input
                      id="draft-summary"
                      value={editableDraft.summary}
                      onChange={event => updateEditableDraft('summary', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-version">{t('common.version')}</Label>
                    <Input
                      id="draft-version"
                      value={editableDraft.version}
                      onChange={event => updateEditableDraft('version', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('common.category')}</Label>
                    <Select
                      value={editableDraft.categoryId || 'none'}
                      onValueChange={value =>
                        updateEditableDraft('categoryId', value === 'none' ? '' : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('apiSpecs.aiCreateDialog.placeholders.category')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t('apiSpecs.aiCreateDialog.fields.noCategory')}
                        </SelectItem>
                        {categories.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{t('common.public')}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.fields.publicDescription')}
                      </div>
                    </div>
                    <Switch
                      checked={editableDraft.isPublic}
                      onCheckedChange={checked => updateEditableDraft('isPublic', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-description">{t('common.description')}</Label>
                  <Textarea
                    id="draft-description"
                    value={editableDraft.description}
                    onChange={event => updateEditableDraft('description', event.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-tags">{t('common.tags')}</Label>
                  <Input
                    id="draft-tags"
                    value={editableDraft.tags}
                    onChange={event => updateEditableDraft('tags', event.target.value)}
                    placeholder={t('apiSpecs.aiCreateDialog.placeholders.tags')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-request-body">
                    {t('apiSpecs.aiCreateDialog.fields.requestBodyJson')}
                  </Label>
                  <Textarea
                    id="draft-request-body"
                    value={editableDraft.requestBody}
                    onChange={event => updateEditableDraft('requestBody', event.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-parameters">
                    {t('apiSpecs.aiCreateDialog.fields.parametersJson')}
                  </Label>
                  <Textarea
                    id="draft-parameters"
                    value={editableDraft.parameters}
                    onChange={event => updateEditableDraft('parameters', event.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-responses">
                    {t('apiSpecs.aiCreateDialog.fields.responsesJson')}
                  </Label>
                  <Textarea
                    id="draft-responses"
                    value={editableDraft.responses}
                    onChange={event => updateEditableDraft('responses', event.target.value)}
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
                    {t('apiSpecs.aiCreateDialog.sections.refineTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('apiSpecs.aiCreateDialog.sections.refineDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t('apiSpecs.aiCreateDialog.fields.targetField')}</Label>
                    <Select value={refineField} onValueChange={setRefineField}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('apiSpecs.aiCreateDialog.fields.targetFieldPlaceholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {refineFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="draft-refine">
                      {t('apiSpecs.aiCreateDialog.fields.instruction')}
                    </Label>
                    <Textarea
                      id="draft-refine"
                      value={refineInstruction}
                      onChange={event => setRefineInstruction(event.target.value)}
                      placeholder={t('apiSpecs.aiCreateDialog.placeholders.refineInstruction')}
                      rows={5}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    loading={isSubmittingRefine}
                    onClick={() => void handleRefine()}
                  >
                    <WandSparkles className="h-4 w-4" />
                    {t('apiSpecs.aiCreateDialog.actions.applyRefine')}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('apiSpecs.aiCreateDialog.sections.whyTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('apiSpecs.aiCreateDialog.sections.whyDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium">
                      {t('apiSpecs.aiCreateDialog.review.assumptions')}
                    </div>
                    {draft.assumptions?.length ? (
                      <ul className="space-y-2 text-muted-foreground">
                        {draft.assumptions.map(item => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.review.noAssumptions')}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="font-medium">
                      {t('apiSpecs.aiCreateDialog.review.questions')}
                    </div>
                    {draft.questions?.length ? (
                      <ul className="space-y-2 text-muted-foreground">
                        {draft.questions.map(item => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.review.noQuestions')}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="font-medium">
                      {t('apiSpecs.aiCreateDialog.review.projectConventions')}
                    </div>
                    {draft.conventions ? (
                      <div className="flex flex-wrap gap-2">
                        {draft.conventions.default_version ? (
                          <Badge variant="outline">
                            {t('apiSpecs.aiCreateDialog.review.versionBadge', {
                              value: draft.conventions.default_version,
                            })}
                          </Badge>
                        ) : null}
                        {draft.conventions.auth_style ? (
                          <Badge variant="outline">
                            {t('apiSpecs.aiCreateDialog.review.authBadge', {
                              value: draft.conventions.auth_style,
                            })}
                          </Badge>
                        ) : null}
                        {(draft.conventions.common_tags ?? []).map(tag => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.review.projectConventionsDisabled')}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="font-medium">
                      {t('apiSpecs.aiCreateDialog.review.references')}
                    </div>
                    {draft.references?.length ? (
                      <div className="space-y-2">
                        {draft.references.map(reference => (
                          <div
                            key={reference.id}
                            className="rounded-lg border border-border/60 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{reference.method}</Badge>
                              <code className="text-xs">{reference.path}</code>
                              {reference.explicit ? (
                                <Badge variant="secondary">
                                  {t('apiSpecs.aiCreateDialog.review.explicit')}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 text-sm font-medium">
                              {reference.summary || t('apiSpecs.aiCreateDialog.review.untitledSpec')}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t('apiSpecs.aiCreateDialog.review.referenceScore', {
                                score: reference.score.toFixed(1),
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.review.noReferences')}
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="font-medium">
                      {t('apiSpecs.aiCreateDialog.review.fieldInsights')}
                    </div>
                    {draft.field_insights && Object.keys(draft.field_insights).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(draft.field_insights).map(([field, insight]) => (
                          <div key={field} className="rounded-lg border border-border/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{field}</span>
                              <Badge variant="outline">
                                {Math.round(insight.confidence * 100)}%
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {insight.source}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {t('apiSpecs.aiCreateDialog.review.noFieldInsights')}
                      </div>
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
                <div className="font-medium">{t('apiSpecs.aiCreateDialog.emptyState.title')}</div>
                <div className="max-w-xl text-sm text-muted-foreground">
                  {t('apiSpecs.aiCreateDialog.emptyState.description')}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogBody>

      <DialogFooter className="justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {draft ? (
            <>
              <DisabledReasonTooltip
                disabled={Boolean(draftOptionDisableReason)}
                reason={draftOptionDisableReason}
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={generateDoc}
                    onCheckedChange={setGenerateDoc}
                    disabled={isGeneratingDraft}
                    className={draftOptionDisableReason ? 'pointer-events-none' : undefined}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('apiSpecs.aiCreateDialog.toggles.generateDoc')}
                  </span>
                </div>
              </DisabledReasonTooltip>
              <DisabledReasonTooltip
                disabled={Boolean(draftOptionDisableReason)}
                reason={draftOptionDisableReason}
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={generateTest}
                    onCheckedChange={setGenerateTest}
                    disabled={isGeneratingDraft}
                    className={draftOptionDisableReason ? 'pointer-events-none' : undefined}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('apiSpecs.aiCreateDialog.toggles.generateTest')}
                  </span>
                </div>
              </DisabledReasonTooltip>
              <DisabledReasonTooltip
                disabled={Boolean(draftOptionDisableReason)}
                reason={draftOptionDisableReason}
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={continueToTests}
                    onCheckedChange={setContinueToTests}
                    disabled={isGeneratingDraft}
                    className={draftOptionDisableReason ? 'pointer-events-none' : undefined}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('apiSpecs.aiCreateDialog.toggles.openTestsAfterCreate')}
                  </span>
                </div>
              </DisabledReasonTooltip>
            </>
          ) : (
            <p className="max-w-md text-sm text-muted-foreground">{footerHelperMessage}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={isGeneratingDraft ? handleCancelDraftGeneration : () => onOpenChange(false)}
          >
            {isGeneratingDraft
              ? t('apiSpecs.aiCreateDialog.actions.cancelGeneration')
              : t('common.cancel')}
          </Button>
          <DisabledReasonTooltip
            disabled={Boolean(generateDraftDisableReason)}
            reason={generateDraftDisableReason}
          >
            <Button
              type="button"
              variant="outline"
              loading={isGeneratingDraft}
              disabled={isSubmittingAccept || isSubmittingRefine}
              onClick={() => void handleGenerateDraft()}
              className={generateDraftDisableReason ? 'pointer-events-none' : undefined}
            >
              <Sparkles className="h-4 w-4" />
              {didDraftGenerationFail
                ? t('apiSpecs.aiCreateDialog.actions.retryDraft')
                : draft
                  ? t('apiSpecs.aiCreateDialog.actions.regenerateDraft')
                  : t('apiSpecs.aiCreateDialog.actions.generateDraft')}
            </Button>
          </DisabledReasonTooltip>
          {draft ? (
            <DisabledReasonTooltip
              disabled={Boolean(createSpecDisableReason)}
              reason={createSpecDisableReason}
            >
              <Button
                type="button"
                loading={isSubmittingAccept}
                onClick={() => void handleAccept()}
                disabled={isGeneratingDraft}
                className={createSpecDisableReason ? 'pointer-events-none' : undefined}
              >
                {t('apiSpecs.aiCreateDialog.actions.createSpec')}
              </Button>
            </DisabledReasonTooltip>
          ) : null}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
