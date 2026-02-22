import { useState } from 'react'
import { Plus, Edit, Trash2, Globe, X, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEnvironments, queryKeys } from '@/hooks/use-kest-api'
import { kestApi } from '@/services/kest-api.service'
import type { Environment, CreateEnvironmentRequest } from '@/types/kest-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface EnvironmentManagerProps {
  projectId: number
}

interface VarRow { key: string; value: string }

export function EnvironmentManager({ projectId }: EnvironmentManagerProps) {
  const { data: environments, isLoading } = useEnvironments(projectId)
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [vars, setVars] = useState<VarRow[]>([{ key: '', value: '' }])

  const resetForm = () => {
    setName('')
    setBaseUrl('')
    setVars([{ key: '', value: '' }])
    setEditingEnv(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (env: Environment) => {
    setEditingEnv(env)
    setName(env.name)
    setBaseUrl(env.base_url)
    const rows = env.variables && Object.keys(env.variables).length > 0
      ? Object.entries(env.variables).map(([key, value]) => ({ key, value }))
      : [{ key: '', value: '' }]
    setVars(rows)
    setDialogOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateEnvironmentRequest) => kestApi.environment.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environments(projectId) })
      toast.success('Environment created')
      setDialogOpen(false)
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create environment'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateEnvironmentRequest> }) =>
      kestApi.environment.update(projectId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environments(projectId) })
      toast.success('Environment updated')
      setDialogOpen(false)
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update environment'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => kestApi.environment.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.environments(projectId) })
      toast.success('Environment deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete environment'),
  })

  const handleSave = () => {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error('Name and Base URL are required')
      return
    }
    const variables: Record<string, string> = {}
    vars.forEach(v => { if (v.key.trim()) variables[v.key.trim()] = v.value })

    if (editingEnv) {
      updateMutation.mutate({ id: editingEnv.id, data: { name, base_url: baseUrl, variables } })
    } else {
      createMutation.mutate({ project_id: projectId, name, base_url: baseUrl, variables })
    }
  }

  const addVarRow = () => setVars([...vars, { key: '', value: '' }])
  const removeVarRow = (i: number) => setVars(vars.filter((_, idx) => idx !== i))
  const updateVar = (i: number, field: 'key' | 'value', val: string) => {
    const next = [...vars]
    next[i] = { ...next[i], [field]: val }
    setVars(next)
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const envs = (() => {
    if (!environments) return []
    if (Array.isArray(environments)) return environments
    if (Array.isArray((environments as any)?.items)) return (environments as any).items
    return []
  })() as Environment[]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Environments</h3>
          <p className="text-sm text-muted-foreground">Manage API environments and variables</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Environment
        </Button>
      </div>

      {envs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No environments configured</h3>
            <p className="text-muted-foreground mb-4">Add your first environment to get started</p>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Environment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {envs.map((env) => (
            <Card key={env.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      {env.name}
                      {env.name.toLowerCase() === 'production' && <Badge variant="destructive">Prod</Badge>}
                      {env.name.toLowerCase() === 'development' && <Badge variant="secondary">Dev</Badge>}
                      {env.name.toLowerCase() === 'staging' && <Badge variant="outline">Staging</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{env.base_url}</code>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(env)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(env)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {env.variables && Object.keys(env.variables).length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Variables</p>
                    {Object.entries(env.variables).slice(0, 4).map(([key, value]) => (
                      <div key={key} className="text-xs flex items-center gap-2">
                        <code className="bg-muted px-1.5 py-0.5 rounded font-semibold">{key}</code>
                        <span className="text-muted-foreground">=</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded flex-1 truncate">{value}</code>
                      </div>
                    ))}
                    {Object.keys(env.variables).length > 4 && (
                      <p className="text-xs text-muted-foreground">+{Object.keys(env.variables).length - 4} more</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEnv ? 'Edit Environment' : 'New Environment'}</DialogTitle>
            <DialogDescription>
              {editingEnv ? 'Update environment settings and variables' : 'Configure a new environment for your project'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input placeholder="e.g. development" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Base URL *</Label>
                <Input placeholder="https://api.example.com" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addVarRow}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {vars.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-8 text-xs font-mono" placeholder="KEY" value={v.key} onChange={e => updateVar(i, 'key', e.target.value)} />
                    <Input className="h-8 text-xs font-mono" placeholder="value" value={v.value} onChange={e => updateVar(i, 'value', e.target.value)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeVarRow(i)} disabled={vars.length <= 1}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : editingEnv ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Environment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
