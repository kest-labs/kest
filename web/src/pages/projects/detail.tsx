import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Settings, ChevronRight, FolderTree, FileText, Search, Plus, Workflow, ChevronDown, MoreHorizontal, Trash2, Share2, ListPlus, Download, FileUp, FileDown } from 'lucide-react'
import { useProject, useAPISpecs, useCategoryTree, useAPISpecWithExamples, useDeleteAPISpec, useMembers, useAddMember, useUpdateMemberRole, useRemoveMember } from '@/hooks/use-kest-api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { kestApi } from '@/services/kest-api.service'
import { APIDetailPanel } from './api-detail-panel'
import { FlowList } from './flow-list'
import { CategoryManager } from './category-manager'
import { ProjectSettings } from './project-settings'
import { EnvironmentManager } from './environment-manager'
import { CreateAPISpecDialog } from './create-api-spec-dialog'
import { ImportAPISpecDialog } from './import-api-spec-dialog'
import { TestCasesPanel } from './test-cases'
import type { APISpec, CategoryTree, ProjectMember, ProjectMemberRole } from '@/types/kest-api'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-blue-600',
  POST: 'text-green-600',
  PUT: 'text-amber-600',
  PATCH: 'text-orange-600',
  DELETE: 'text-red-600',
  HEAD: 'text-purple-600',
  OPTIONS: 'text-gray-600',
}

type ViewMode = 'apis' | 'flows' | 'test-cases' | 'categories' | 'environments' | 'settings' | 'members'

export function ProjectDetailPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = parseInt(id || '0')
  const selectedSpecId = sid ? parseInt(sid) : null
  const [viewMode, setViewMode] = useState<ViewMode>('apis')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<APISpec | null>(null)
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<ProjectMemberRole>('write')
  const [memberRoleDraft, setMemberRoleDraft] = useState<Record<number, ProjectMemberRole>>({})
  const deleteAPISpec = useDeleteAPISpec()
  const addMember = useAddMember(projectId)
  const updateMemberRole = useUpdateMemberRole(projectId)
  const removeMember = useRemoveMember(projectId)

  // Sync viewMode with URL: if sid is present, always show apis
  useEffect(() => {
    if (sid) setViewMode('apis')
  }, [sid])

  useEffect(() => {
    if (sid) return
    const view = searchParams.get('view')
    if (view === 'test-cases' || view === 'flows' || view === 'categories' || view === 'environments' || view === 'settings' || view === 'members' || view === 'apis') {
      setViewMode(view)
    }
  }, [searchParams, sid])

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode !== 'apis') {
      navigate(`/projects/${projectId}?view=${mode}`, { replace: true })
    } else {
      navigate(`/projects/${projectId}`, { replace: true })
    }
  }

  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: apiSpecsData, isLoading: apisLoading } = useAPISpecs(projectId)
  const { data: categoryData } = useCategoryTree(projectId)
  const { data: membersData, isLoading: membersLoading } = useMembers(projectId)

  // Handle multiple possible response shapes from the API
  const apiSpecs: APISpec[] = (() => {
    if (!apiSpecsData) return []
    if (Array.isArray(apiSpecsData)) return apiSpecsData
    if (Array.isArray((apiSpecsData as any)?.items)) return (apiSpecsData as any).items
    if (Array.isArray((apiSpecsData as any)?.data)) return (apiSpecsData as any).data
    return []
  })()
  const categories: CategoryTree[] = (() => {
    if (!categoryData) return []
    if (Array.isArray(categoryData)) return categoryData
    if (Array.isArray((categoryData as any)?.items)) return (categoryData as any).items
    if (Array.isArray((categoryData as any)?.data)) return (categoryData as any).data
    return []
  })()
  const members: ProjectMember[] = (() => {
    if (!membersData) return []
    if (Array.isArray(membersData)) return membersData
    if (Array.isArray((membersData as any)?.items)) return (membersData as any).items
    if (Array.isArray((membersData as any)?.data)) return (membersData as any).data
    return []
  })()

  // Fetch full spec detail when a spec is selected
  const { data: selectedSpecDetail, isLoading: specDetailLoading } = useAPISpecWithExamples(projectId, selectedSpecId || 0)

  // Use full detail if available, fallback to list item for sidebar highlight
  const selectedSpec = useMemo(() => {
    if (selectedSpecDetail) return selectedSpecDetail as APISpec
    return apiSpecs.find(s => s.id === selectedSpecId) || null
  }, [selectedSpecDetail, apiSpecs, selectedSpecId])

  const specsByCategory = useMemo(() => {
    const map = new Map<number, APISpec[]>()
    apiSpecs.forEach(spec => {
      if (!spec.category_id) return
      const bucket = map.get(spec.category_id) || []
      bucket.push(spec)
      map.set(spec.category_id, bucket)
    })
    return map
  }, [apiSpecs])

  const uncategorizedSpecs = useMemo(
    () => apiSpecs.filter(s => !s.category_id),
    [apiSpecs]
  )

  const filterSpecs = (specs: APISpec[]) => {
    if (!searchQuery) return specs
    const q = searchQuery.toLowerCase()
    return specs.filter(s =>
      s.path?.toLowerCase().includes(q) ||
      s.summary?.toLowerCase().includes(q) ||
      s.method?.toLowerCase().includes(q)
    )
  }

  const toggleCategory = (catId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  // Auto-expand all categories on first load
  useMemo(() => {
    if (categories.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(categories.map(c => c.id)))
    }
  }, [categories])

  if (projectLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-72 border-r p-4 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-full" />
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project not found</h2>
          <Link to="/projects"><Button>Back to Projects</Button></Link>
        </div>
      </div>
    )
  }

  const handleDeleteSpec = () => {
    if (!deleteTarget) return
    const spec = deleteTarget
    deleteAPISpec.mutate(
      { projectId, id: spec.id },
      {
        onSuccess: () => {
          toast.success(`Deleted ${spec.method} ${spec.path}`)
          if (selectedSpecId === spec.id) {
            navigate(`/projects/${projectId}`, { replace: true })
          }
          setDeleteTarget(null)
        },
        onError: (error: any) => {
          toast.error(error?.message || 'Failed to delete API spec')
          setDeleteTarget(null)
        },
      }
    )
  }

  const handleAddMember = async () => {
    const userId = Number(newMemberUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error('Please enter a valid user ID')
      return
    }
    try {
      await addMember.mutateAsync({ user_id: userId, role: newMemberRole })
      setNewMemberUserId('')
      setNewMemberRole('write')
      toast.success('Member added')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add member')
    }
  }

  const handleUpdateMemberRole = async (member: ProjectMember) => {
    const role = memberRoleDraft[member.user_id] ?? member.role
    if (!role || role === member.role) {
      toast.info('No role changes')
      return
    }
    try {
      await updateMemberRole.mutateAsync({
        userId: member.user_id,
        data: { role },
      })
      toast.success('Member role updated')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update member role')
    }
  }

  const handleRemoveMember = async (member: ProjectMember) => {
    try {
      await removeMember.mutateAsync(member.user_id)
      toast.success('Member removed')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to remove member')
    }
  }

  const renderSpecItem = (spec: APISpec) => (
    <div
      key={spec.id}
      className={cn(
        'group/spec w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm',
        selectedSpecId === spec.id && viewMode === 'apis'
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50'
      )}
    >
      <button
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
        onClick={() => { navigate(`/projects/${projectId}/api-specs/${spec.id}`); setViewMode('apis') }}
      >
        <span className={cn('font-mono text-[10px] font-bold w-10 shrink-0', METHOD_COLORS[spec.method] || 'text-gray-500')}>
          {spec.method}
        </span>
        <span className="font-mono text-xs truncate flex-1">{spec.path}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover/spec:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent shrink-0">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => { navigate(`/projects/${projectId}/api-specs/${spec.id}`); setViewMode('apis') }}>
            <ListPlus className="h-3.5 w-3.5 mr-2" />
            Add Examples
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { toast.info('Share feature coming soon') }}>
            <Share2 className="h-3.5 w-3.5 mr-2" />
            Share
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setDeleteTarget(spec)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const renderCategoryTree = (cats: CategoryTree[]) => {
    return cats.map(cat => {
      const specs = filterSpecs(specsByCategory.get(cat.id) || [])
      const isExpanded = expandedCategories.has(cat.id)
      const hasSpecs = specs.length > 0

      return (
        <div key={cat.id}>
          <button
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium hover:bg-accent/50 rounded-md transition-colors"
            onClick={() => toggleCategory(cat.id)}
          >
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
            <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate flex-1 text-left">{cat.name}</span>
            <span className="text-[10px] text-muted-foreground">{specs.length}</span>
          </button>
          {isExpanded && hasSpecs && (
            <div className="ml-4 space-y-0.5">
              {specs.sort((a, b) => a.path.localeCompare(b.path)).map(renderSpecItem)}
            </div>
          )}
          {cat.children && cat.children.length > 0 && isExpanded && (
            <div className="ml-3">
              {renderCategoryTree(cat.children)}
            </div>
          )}
        </div>
      )
    })
  }

  const filteredUncategorized = filterSpecs(uncategorizedSpecs)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Sidebar - API Tree */}
      <div className="w-72 border-r flex flex-col bg-card shrink-0">
        {/* Project Header */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/projects">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold truncate">{project.name}</h2>
              <p className="text-[10px] text-muted-foreground font-mono">{project.slug}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search APIs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {/* API Tree */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {apisLoading ? (
              <div className="space-y-2 p-2">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-5 w-full" />)}
              </div>
            ) : (
              <>
                {renderCategoryTree(categories)}
                {filteredUncategorized.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">Uncategorized</span>
                      <span className="text-[10px]">{filteredUncategorized.length}</span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {filteredUncategorized.sort((a, b) => a.path.localeCompare(b.path)).map(renderSpecItem)}
                    </div>
                  </div>
                )}
                {apiSpecs.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    <p>No APIs yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Bottom Actions */}
        <div className="border-t p-2 space-y-1">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-xs h-7" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add API
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-xs h-7" onClick={() => setImportDialogOpen(true)}>
              <FileUp className="h-3.5 w-3.5 mr-1.5" /> Import
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 justify-start text-xs h-7" onClick={async () => {
              try {
                const res = await kestApi.apiSpec.export(projectId, 'json')
                const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `api-specs-${projectId}.json`
                a.click()
                URL.revokeObjectURL(url)
                toast.success('Export successful')
              } catch {
                toast.error('Failed to export API specs')
              }
            }}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'flows' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => switchView('flows')}
            >
              <Workflow className="h-3.5 w-3.5 mr-1" /> Flows
            </Button>
            <Button
              variant={viewMode === 'categories' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => switchView('categories')}
            >
              <FolderTree className="h-3.5 w-3.5 mr-1" /> Categories
            </Button>
            <Button
              variant={viewMode === 'settings' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => switchView('settings')}
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'apis' && selectedSpecId && specDetailLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Skeleton className="h-8 w-64 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
              <Skeleton className="h-[300px] w-full max-w-2xl" />
            </div>
          </div>
        )}
        {viewMode === 'apis' && selectedSpec && !specDetailLoading && (
          <APIDetailPanel spec={selectedSpec} projectId={projectId} />
        )}

        {viewMode === 'apis' && !selectedSpec && !specDetailLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
              {project.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
            <p className="text-muted-foreground mb-1">{project.description || 'No description'}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {apiSpecs.length} APIs
              </span>
              <span className="flex items-center gap-1">
                <FolderTree className="h-4 w-4" />
                {categories.length} Categories
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-6">Select an API from the sidebar to view its documentation</p>
          </div>
        )}

        {viewMode === 'flows' && (
          <div className="p-6 overflow-auto h-full">
            <FlowList projectId={projectId} />
          </div>
        )}

        {viewMode === 'test-cases' && (
          <div className="p-6 overflow-auto h-full">
            <TestCasesPanel projectId={projectId} />
          </div>
        )}

        {viewMode === 'categories' && (
          <div className="p-6 overflow-auto h-full">
            <CategoryManager projectId={projectId} />
          </div>
        )}

        {viewMode === 'environments' && (
          <div className="p-6 overflow-auto h-full">
            <EnvironmentManager projectId={projectId} />
          </div>
        )}

        {viewMode === 'settings' && (
          <div className="p-6 overflow-auto h-full">
            <ProjectSettings project={project} />
          </div>
        )}

        {viewMode === 'members' && (
          <div className="p-6 overflow-auto h-full">
            <div className="max-w-4xl">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Project Members</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage roles and access for this project.
                </p>
              </div>
              <div className="border rounded-md p-4 bg-card mb-4">
                <h3 className="text-sm font-medium mb-3">Add Member</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="User ID"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    className="sm:w-48"
                  />
                  <Select
                    value={newMemberRole}
                    onValueChange={(value: ProjectMemberRole) => setNewMemberRole(value)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">owner</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="write">write</SelectItem>
                      <SelectItem value="read">read</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddMember}
                    disabled={addMember.isPending}
                    className="sm:w-auto"
                  >
                    {addMember.isPending ? 'Adding...' : 'Add Member'}
                  </Button>
                </div>
              </div>
              {membersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center border rounded-md">
                  No members found
                </div>
              ) : (
                <div className="border rounded-md divide-y bg-card">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.username || 'Unknown user'}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={memberRoleDraft[member.user_id] ?? member.role}
                          onValueChange={(value: ProjectMemberRole) =>
                            setMemberRoleDraft((prev) => ({ ...prev, [member.user_id]: value }))
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">owner</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="write">write</SelectItem>
                            <SelectItem value="read">read</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateMemberRole(member)}
                          disabled={updateMemberRole.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={removeMember.isPending || member.role === 'owner'}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateAPISpecDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} projectId={projectId} />
      <ImportAPISpecDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} projectId={projectId} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Spec</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-mono font-semibold">{deleteTarget?.method} {deleteTarget?.path}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteSpec}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
