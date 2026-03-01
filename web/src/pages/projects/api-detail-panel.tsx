import { useState, useEffect } from 'react'
import { Copy, ChevronDown, ChevronRight, Pencil, Save, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { queryKeys, useGenAPISpecDoc, useUpdateAPISpec } from '@/hooks/use-kest-api'
import { kestApi } from '@/services/kest-api.service'
import type { APISpec } from '@/types/kest-api'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500 text-white',
  POST: 'bg-green-500 text-white',
  PUT: 'bg-amber-500 text-white',
  PATCH: 'bg-orange-500 text-white',
  DELETE: 'bg-red-500 text-white',
  HEAD: 'bg-purple-500 text-white',
  OPTIONS: 'bg-gray-500 text-white',
}

interface APIDetailPanelProps {
  spec: APISpec
  projectId: number
  initialTab?: 'params' | 'body' | 'headers' | 'responses' | 'examples' | 'doc'
  autoOpenExampleForm?: boolean
}

type ExampleDefaults = {
  path: string
  method: string
  status: string
  description: string
  headers: string
  requestBody: string
  responseHeaders: string
  responseBody: string
}

const defaultStringValue = (fieldName: string) => {
  const key = fieldName.toLowerCase()
  if (key.includes('email')) return 'user@example.com'
  if (key.includes('name')) return 'example_name'
  if (key.includes('id')) return '123'
  if (key.includes('token') || key.includes('auth')) return 'token_value'
  if (key.includes('url') || key.includes('uri')) return 'https://api.example.com'
  if (key.includes('phone')) return '+1-555-0100'
  return `example_${fieldName || 'value'}`
}

const buildExampleFromSchema = (schema: any, fieldName = 'field', depth = 0): any => {
  if (!schema || depth > 5) return null

  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return buildExampleFromSchema(schema.oneOf[0], fieldName, depth + 1)
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return buildExampleFromSchema(schema.anyOf[0], fieldName, depth + 1)
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return buildExampleFromSchema(schema.allOf[0], fieldName, depth + 1)
  }

  switch (schema.type) {
    case 'object': {
      const result: Record<string, any> = {}
      const properties = schema.properties || {}
      for (const [key, value] of Object.entries(properties)) {
        result[key] = buildExampleFromSchema(value, key, depth + 1)
      }
      return result
    }
    case 'array':
      return [buildExampleFromSchema(schema.items || {}, fieldName, depth + 1)]
    case 'integer':
      return schema.minimum ?? 1
    case 'number':
      return schema.minimum ?? 1.23
    case 'boolean':
      return true
    case 'string':
    default:
      if (schema.format === 'date-time') return '2026-01-01T00:00:00Z'
      if (schema.format === 'date') return '2026-01-01'
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000'
      if (schema.format === 'email') return 'user@example.com'
      if (schema.format === 'uri' || schema.format === 'url') return 'https://api.example.com'
      return defaultStringValue(fieldName)
  }
}

const getPreferredStatusCode = (spec: APISpec) => {
  const codes = Object.keys(spec.responses || {}).filter((key) => /^\d{3}$/.test(key))
  const successCode = codes.find((code) => Number(code) >= 200 && Number(code) < 300)
  return successCode || '200'
}

const getResponseByStatus = (spec: APISpec, status: string) => {
  if (!spec.responses) return undefined
  return spec.responses[status] || Object.values(spec.responses)[0]
}

const toPrettyJson = (value: any) => JSON.stringify(value, null, 2)

const getInitialExampleValues = (spec: APISpec): ExampleDefaults => {
  const status = getPreferredStatusCode(spec)
  const responseConfig = getResponseByStatus(spec, status)

  const requestHeadersObj: Record<string, any> = {}
  if (spec.request_body?.content_type) {
    requestHeadersObj['Content-Type'] = spec.request_body.content_type
  }
  if (!requestHeadersObj['Content-Type']) {
    requestHeadersObj['Content-Type'] = 'application/json'
  }

  const requestBodyObj = spec.request_body?.schema
    ? buildExampleFromSchema(spec.request_body.schema, 'request')
    : {
        name: 'example_name',
        description: 'example_description',
      }

  const responseHeadersObj: Record<string, any> = {}
  if (responseConfig?.content_type) {
    responseHeadersObj['Content-Type'] = responseConfig.content_type
  } else {
    responseHeadersObj['Content-Type'] = 'application/json'
  }

  const responseBodyObj = responseConfig?.schema
    ? buildExampleFromSchema(responseConfig.schema, 'response')
    : {
        success: Number(status) < 400,
        message: Number(status) < 400 ? 'ok' : 'request_failed',
        data: {},
      }

  return {
    path: spec.path || '',
    method: spec.method || 'GET',
    status,
    description: `${spec.method || 'GET'} ${spec.path || ''} example`.trim(),
    headers: toPrettyJson(requestHeadersObj),
    requestBody: toPrettyJson(requestBodyObj),
    responseHeaders: toPrettyJson(responseHeadersObj),
    responseBody: toPrettyJson(responseBodyObj),
  }
}

export function APIDetailPanel({ spec, projectId, initialTab = 'params', autoOpenExampleForm = false }: APIDetailPanelProps) {
  const initialExample = getInitialExampleValues(spec)
  const [activeTab, setActiveTab] = useState('params')
  const [editing, setEditing] = useState(false)
  const [editSummary, setEditSummary] = useState(spec.summary || '')
  const [editDescription, setEditDescription] = useState(spec.description || '')
  const [editTags, setEditTags] = useState(spec.tags?.join(', ') || '')
  const [showExampleForm, setShowExampleForm] = useState(false)
  const [examplePath, setExamplePath] = useState(spec.path || '')
  const [exampleMethod, setExampleMethod] = useState<string>(spec.method || 'GET')
  const [exampleStatus, setExampleStatus] = useState(initialExample.status)
  const [exampleDescription, setExampleDescription] = useState(initialExample.description)
  const [exampleHeaders, setExampleHeaders] = useState(initialExample.headers)
  const [exampleRequestBody, setExampleRequestBody] = useState(initialExample.requestBody)
  const [exampleResponseHeaders, setExampleResponseHeaders] = useState(initialExample.responseHeaders)
  const [exampleResponseBody, setExampleResponseBody] = useState(initialExample.responseBody)
  const [docLang, setDocLang] = useState<'zh' | 'en'>('zh')
  const getDocForLang = (s: APISpec, lang: 'zh' | 'en') => {
    if (lang === 'zh') return s.doc_markdown_zh || ''
    return s.doc_markdown_en || ''
  }
  const getDocUpdatedAtForLang = (s: APISpec, lang: 'zh' | 'en') => {
    if (lang === 'zh') return s.doc_updated_at_zh
    return s.doc_updated_at_en
  }
  const [docDraft, setDocDraft] = useState(getDocForLang(spec, 'zh'))
  const [docEditing, setDocEditing] = useState(false)

  const queryClient = useQueryClient()
  const updateMutation = useUpdateAPISpec()
  const genDocMutation = useGenAPISpecDoc()
  const resetExampleForm = () => {
    const defaults = getInitialExampleValues(spec)
    setExamplePath(defaults.path)
    setExampleMethod(defaults.method)
    setExampleStatus(defaults.status)
    setExampleDescription(defaults.description)
    setExampleHeaders(defaults.headers)
    setExampleRequestBody(defaults.requestBody)
    setExampleResponseHeaders(defaults.responseHeaders)
    setExampleResponseBody(defaults.responseBody)
  }

  const createExampleMutation = useMutation({
    mutationFn: (data: {
      name: string
      request_headers?: Record<string, any>
      request_body?: any
      response_status: number
      response_body?: any
      duration_ms?: number
    }) => kestApi.apiSpec.addExample(projectId, spec.id, data),
    onSuccess: () => {
      toast.success('Example saved')
      queryClient.invalidateQueries({ queryKey: queryKeys.apiSpec(spec.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.apiSpecWithExamples(spec.id) })
      resetExampleForm()
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save example')
    },
  })

  // Sync edit fields when spec changes
  useEffect(() => {
    setEditSummary(spec.summary || '')
    setEditDescription(spec.description || '')
    setEditTags(spec.tags?.join(', ') || '')
    setDocDraft(getDocForLang(spec, docLang))
    setDocEditing(false)
    resetExampleForm()
    setEditing(false)
  }, [spec.id])

  useEffect(() => {
    if (!docEditing) {
      setDocDraft(getDocForLang(spec, docLang))
    }
  }, [docLang, spec.doc_markdown, spec.doc_markdown_zh, spec.doc_markdown_en])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab, spec.id])

  useEffect(() => {
    if (!autoOpenExampleForm) return
    setActiveTab('examples')
    setShowExampleForm(true)
  }, [autoOpenExampleForm, spec.id])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const handleSave = () => {
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
    updateMutation.mutate(
      {
        projectId,
        id: spec.id,
        data: {
          summary: editSummary,
          description: editDescription,
          tags,
        },
      },
      {
        onSuccess: () => {
          toast.success('API spec updated')
          setEditing(false)
        },
        onError: () => {
          toast.error('Failed to update API spec')
        },
      }
    )
  }

  const handleCancel = () => {
    setEditSummary(spec.summary || '')
    setEditDescription(spec.description || '')
    setEditTags(spec.tags?.join(', ') || '')
    setEditing(false)
  }

  const handleGenerateDoc = () => {
    genDocMutation.mutate(
      { projectId, id: spec.id, lang: docLang },
      {
        onSuccess: (result) => {
          setDocDraft(getDocForLang(result, docLang))
          setDocEditing(false)
          setActiveTab('doc')
          toast.success('Documentation generated')
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to generate documentation')
        },
      }
    )
  }

  const handleSaveDoc = () => {
    const data = docLang === 'zh'
      ? { doc_markdown_zh: docDraft, doc_markdown: docDraft, doc_source: 'manual' as const }
      : { doc_markdown_en: docDraft, doc_markdown: docDraft, doc_source: 'manual' as const }

    updateMutation.mutate(
      {
        projectId,
        id: spec.id,
        data,
      },
      {
        onSuccess: () => {
          toast.success('Documentation saved')
          setDocEditing(false)
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to save documentation')
        },
      }
    )
  }

  const formatDocUpdateTime = (value?: string) => {
    if (!value) return 'Not generated yet'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  const pathParams = spec.parameters?.filter(p => p.in === 'path') || []
  const queryParams = spec.parameters?.filter(p => p.in === 'query') || []
  const headerParams = spec.parameters?.filter(p => p.in === 'header') || []
  const hasParams = pathParams.length > 0 || queryParams.length > 0
  const hasHeaders = headerParams.length > 0
  const hasBody = !!spec.request_body
  const hasResponses = !!(spec.responses && Object.keys(spec.responses).length > 0)
  const examples = spec.examples || []

  const parseJsonInput = (value: string, label: string) => {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    try {
      return JSON.parse(trimmed)
    } catch {
      throw new Error(`${label} must be valid JSON`)
    }
  }

  const handleSaveExample = () => {
    const statusCode = Number(exampleStatus)
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      toast.error('Status code must be between 100 and 599')
      return
    }
    if (!examplePath.trim()) {
      toast.error('Path is required')
      return
    }
    if (!exampleMethod.trim()) {
      toast.error('Method is required')
      return
    }

    try {
      const headers = parseJsonInput(exampleHeaders, 'Request headers')
      const requestBody = parseJsonInput(exampleRequestBody, 'Request body')
      parseJsonInput(exampleResponseHeaders, 'Response headers')
      const responseBody = parseJsonInput(exampleResponseBody, 'Response body')

      createExampleMutation.mutate({
        name: exampleDescription.trim() || `${exampleMethod.trim().toUpperCase()} ${examplePath.trim()} (${statusCode})`,
        request_headers: headers,
        request_body: requestBody,
        response_status: statusCode,
        response_body: responseBody,
      })
    } catch (error: any) {
      toast.error(error?.message || 'Invalid example payload')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* URL Bar - Postman style */}
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        <Badge className={`${METHOD_COLORS[spec.method] || 'bg-gray-500 text-white'} text-xs font-bold px-2.5 py-1 rounded-md shrink-0`}>
          {spec.method}
        </Badge>
        <div className="flex-1 flex items-center bg-muted rounded-md px-3 py-2 font-mono text-sm overflow-hidden">
          <span className="truncate">{spec.path}</span>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(spec.path)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Title + Description — editable */}
      <div className="px-4 py-3 border-b">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={editSummary}
              onChange={e => setEditSummary(e.target.value)}
              placeholder="Summary"
              className="text-lg font-semibold h-9"
            />
            <Textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Description"
              className="text-sm min-h-[60px] resize-none"
              rows={2}
            />
            <Input
              value={editTags}
              onChange={e => setEditTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="text-xs h-7"
            />
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-3 w-3 mr-1" /> {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="group relative">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{spec.summary || spec.path}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            {spec.description && (
              <p className="text-sm text-muted-foreground mt-1">{spec.description}</p>
            )}
            {spec.tags && spec.tags.length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {spec.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3 gap-2">
              <div className="text-[11px] text-muted-foreground">
                Doc source: <span className="font-medium">{spec.doc_source || 'manual'}</span> · Updated: {formatDocUpdateTime(getDocUpdatedAtForLang(spec, docLang))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('doc')}>
                Open Doc
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs: Params / Body / Headers / Responses / Examples */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-auto py-0">
            <TabsTrigger value="doc" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Doc {(spec.doc_markdown || spec.doc_markdown_zh || spec.doc_markdown_en) && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="params" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Params {hasParams && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{pathParams.length + queryParams.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="body" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Body {hasBody && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="headers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Headers {hasHeaders && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{headerParams.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="responses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Responses {hasResponses && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{Object.keys(spec.responses!).length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="examples" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2">
              Examples {examples.length > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">{examples.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-4">
            <TabsContent value="doc" className="mt-0 space-y-4">
              <div className="border rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={docLang === 'zh' ? 'default' : 'outline'}
                      onClick={() => setDocLang('zh')}
                    >
                      zh
                    </Button>
                    <Button
                      size="sm"
                      variant={docLang === 'en' ? 'default' : 'outline'}
                      onClick={() => setDocLang('en')}
                    >
                      en
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleGenerateDoc} disabled={genDocMutation.isPending}>
                      {genDocMutation.isPending ? 'Generating...' : 'AI Generate Doc'}
                    </Button>
                    {!docEditing && (
                      <Button size="sm" variant="outline" onClick={() => setDocEditing(true)}>
                        Edit
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(docDraft || '')} disabled={!docDraft}>
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Source: {spec.doc_source || 'manual'} · Updated: {formatDocUpdateTime(getDocUpdatedAtForLang(spec, docLang))}
                </p>

                {docEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={docDraft}
                      onChange={(e) => setDocDraft(e.target.value)}
                      placeholder="Write markdown documentation..."
                      rows={20}
                      className="font-mono text-xs"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setDocDraft(getDocForLang(spec, docLang)); setDocEditing(false) }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveDoc} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving...' : 'Save Doc'}
                      </Button>
                    </div>
                  </div>
                ) : docDraft ? (
                  <div className="border rounded-md bg-background p-5">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-2xl font-semibold mb-4">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2">{children}</h3>,
                        p: ({ children }) => <p className="text-sm leading-7 mb-3 text-foreground/90">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-6 space-y-1 mb-3 text-sm">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1 mb-3 text-sm">{children}</ol>,
                        li: ({ children }) => <li className="leading-7">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3">
                            {children}
                          </blockquote>
                        ),
                        code: ({ className, children }) => {
                          const raw = String(children ?? '')
                          const isBlock = !!className || raw.includes('\n')
                          if (isBlock) {
                            return (
                              <code className="block font-mono text-xs bg-muted rounded-md p-3 overflow-x-auto">
                                {children}
                              </code>
                            )
                          }
                          return <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{children}</code>
                        },
                        pre: ({ children }) => <pre className="my-3">{children}</pre>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                            {children}
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3">
                            <table className="w-full border-collapse text-sm">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => <th className="border px-3 py-2 bg-muted text-left font-medium">{children}</th>,
                        td: ({ children }) => <td className="border px-3 py-2 align-top">{children}</td>,
                        hr: () => <hr className="my-5 border-border" />,
                      }}
                    >
                      {docDraft}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                    No documentation yet. Click AI Generate Doc to create one.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="params" className="mt-0">
              {pathParams.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Path Parameters</h4>
                  <ParamTable params={pathParams} />
                </div>
              )}
              {queryParams.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Query Parameters</h4>
                  <ParamTable params={queryParams} />
                </div>
              )}
              {!hasParams && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No parameters defined for this endpoint
                </div>
              )}
            </TabsContent>

            <TabsContent value="body" className="mt-0">
              {spec.request_body ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-xs">{spec.request_body.content_type || 'application/json'}</Badge>
                    {spec.request_body.required && <Badge className="bg-orange-100 text-orange-700 text-[10px]">Required</Badge>}
                  </div>
                  {spec.request_body.description && (
                    <p className="text-sm text-muted-foreground mb-3">{spec.request_body.description}</p>
                  )}
                  {spec.request_body.schema && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Schema</h4>
                      <SchemaView schema={spec.request_body.schema} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No request body for this endpoint
                </div>
              )}
            </TabsContent>

            <TabsContent value="headers" className="mt-0">
              {headerParams.length > 0 ? (
                <ParamTable params={headerParams} />
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No custom headers defined
                </div>
              )}
            </TabsContent>

            <TabsContent value="responses" className="mt-0">
              {spec.responses && Object.keys(spec.responses).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(spec.responses).map(([code, resp]) => (
                    <ResponseItem key={code} code={code} response={resp} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No responses defined
                </div>
              )}
            </TabsContent>

            <TabsContent value="examples" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">API Examples</h4>
                <Button size="sm" variant="outline" onClick={() => setShowExampleForm((v) => !v)}>
                  {showExampleForm ? 'Hide Form' : 'Add Example'}
                </Button>
              </div>

              {showExampleForm && (
                <div className="border rounded-md p-4 space-y-3 bg-muted/20">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">`method` *</label>
                      <Input
                        value={exampleMethod}
                        onChange={(e) => setExampleMethod(e.target.value)}
                        placeholder="GET / POST / PUT..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">`path` *</label>
                      <Input
                        value={examplePath}
                        onChange={(e) => setExamplePath(e.target.value)}
                        placeholder="/users/{id}"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">`status_code` *</label>
                      <Input
                        value={exampleStatus}
                        onChange={(e) => setExampleStatus(e.target.value)}
                        placeholder="200"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">`description`</label>
                    <Textarea
                      value={exampleDescription}
                      onChange={(e) => setExampleDescription(e.target.value)}
                      placeholder="Create user success example"
                      rows={2}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="border rounded-md p-3 space-y-2 bg-background">
                      <h5 className="text-xs font-semibold">Request</h5>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">`request_headers` (JSON)</label>
                        <Textarea
                          value={exampleHeaders}
                          onChange={(e) => setExampleHeaders(e.target.value)}
                          placeholder='{"Authorization":"Bearer token","Content-Type":"application/json"}'
                          rows={7}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">`request_body` (JSON)</label>
                        <Textarea
                          value={exampleRequestBody}
                          onChange={(e) => setExampleRequestBody(e.target.value)}
                          placeholder='{"name":"John","email":"john@example.com"}'
                          rows={7}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="border rounded-md p-3 space-y-2 bg-background">
                      <h5 className="text-xs font-semibold">Response</h5>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">`response_headers` (JSON)</label>
                        <Textarea
                          value={exampleResponseHeaders}
                          onChange={(e) => setExampleResponseHeaders(e.target.value)}
                          placeholder='{"Content-Type":"application/json"}'
                          rows={7}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">`response_body` (JSON)</label>
                        <Textarea
                          value={exampleResponseBody}
                          onChange={(e) => setExampleResponseBody(e.target.value)}
                          placeholder='{"id":1,"name":"John"}'
                          rows={7}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    JSON 字段可以填 `{}`（空对象）或完整 JSON；不需要时可留空。
                  </p>

                  <div>
                    <p className="text-[11px] text-muted-foreground">
                      保存时会提交：`path` `method` `status_code` `request_headers` `request_body` `response_headers` `response_body` `description`
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSaveExample} disabled={createExampleMutation.isPending}>
                      {createExampleMutation.isPending ? 'Saving...' : 'Save Example'}
                    </Button>
                  </div>
                </div>
              )}

              {examples.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-md">
                  No examples yet
                </div>
              ) : (
                <div className="space-y-3">
                  {examples.map((example) => (
                    <div key={example.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px]">{example.method || spec.method}</Badge>
                          <span className="font-mono text-xs">{example.path || spec.path}</span>
                        </div>
                        <Badge className={(example.status_code || example.response_status) < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {example.status_code || example.response_status}
                        </Badge>
                      </div>
                      {(example.description || example.name) && (
                        <p className="text-xs text-muted-foreground">{example.description || example.name}</p>
                      )}
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">`request_headers`</p>
                          <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(example.request_headers, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">`response_headers`</p>
                          <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(example.response_headers, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">`request_body`</p>
                          <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(example.request_body, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] text-muted-foreground">`response_body`</p>
                          <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(example.response_body, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  )
}

function ParamTable({ params }: { params: any[] }) {
  return (
    <div className="border rounded-md overflow-hidden text-sm">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Required</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {params.map((p, idx) => (
            <tr key={idx} className="hover:bg-accent/30">
              <td className="px-3 py-2 font-mono text-xs font-medium">{p.name}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="text-[10px]">{p.schema?.type || 'string'}</Badge>
              </td>
              <td className="px-3 py-2">
                {p.required
                  ? <Badge className="bg-orange-100 text-orange-700 text-[10px]">Required</Badge>
                  : <span className="text-xs text-muted-foreground">Optional</span>
                }
              </td>
              <td className="px-3 py-2 text-muted-foreground text-xs">{p.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SchemaView({ schema }: { schema: any }) {
  if (!schema) return null

  if (schema.type === 'object' && schema.properties) {
    const required = schema.required || []
    return (
      <div className="border rounded-md overflow-hidden text-sm">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Field</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Required</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.entries(schema.properties).map(([name, prop]: [string, any]) => (
              <tr key={name} className="hover:bg-accent/30">
                <td className="px-3 py-2 font-mono text-xs font-medium">{name}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">{prop.type || 'any'}</Badge>
                  {prop.enum && <span className="text-[10px] text-muted-foreground ml-1">enum</span>}
                </td>
                <td className="px-3 py-2">
                  {required.includes(name)
                    ? <Badge className="bg-orange-100 text-orange-700 text-[10px]">Required</Badge>
                    : <span className="text-xs text-muted-foreground">Optional</span>
                  }
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {prop.format && <Badge variant="outline" className="text-[9px] mr-1">{prop.format}</Badge>}
                  {prop.enum && <span className="font-mono">[{prop.enum.join(', ')}]</span>}
                  {prop.minLength && <span>min: {prop.minLength}</span>}
                  {prop.default !== undefined && <span>default: {String(prop.default)}</span>}
                  {prop.items?.type && <span>items: {prop.items.type}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Fallback: show raw JSON
  return (
    <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
      {JSON.stringify(schema, null, 2)}
    </pre>
  )
}

function ResponseItem({ code, response }: { code: string; response: any }) {
  const [open, setOpen] = useState(parseInt(code) < 300)
  const isSuccess = parseInt(code) < 400

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <Badge className={`${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-xs`}>
          {code}
        </Badge>
        <span className="text-sm flex-1 truncate">{response.description}</span>
        {response.content_type && (
          <span className="text-[10px] text-muted-foreground">{response.content_type}</span>
        )}
      </button>
      {open && response.schema && (
        <div className="px-3 pb-3 border-t">
          <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto mt-2">
            {JSON.stringify(response.schema, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
