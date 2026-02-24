import { useState } from 'react'
import { Plus, Folder, Edit2, Trash2, MoreVertical } from 'lucide-react'
import {
    useCategoryTree,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory
} from '@/hooks/use-kest-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CategoryTree } from '@/types/kest-api'

interface CategoryManagerProps {
    projectId: number
}

export function CategoryManager({ projectId }: CategoryManagerProps) {
    const { data: treeData, isLoading } = useCategoryTree(projectId)
    const createMutation = useCreateCategory()
    const updateMutation = useUpdateCategory()
    const deleteMutation = useDeleteCategory()

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null)
    const [editingCategory, setEditingCategory] = useState<CategoryTree | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#3B82F6',
        icon: 'folder',
    })

    const categories: CategoryTree[] = (() => {
        if (!treeData) return []
        if (Array.isArray(treeData)) return treeData
        if (Array.isArray((treeData as any)?.items)) return (treeData as any).items
        if (Array.isArray((treeData as any)?.data)) return (treeData as any).data
        return []
    })()

    const handleCreate = async () => {
        if (!formData.name) return
        try {
            await createMutation.mutateAsync({
                projectId,
                data: {
                    name: formData.name,
                    description: formData.description,
                    color: formData.color || undefined,
                    icon: formData.icon || undefined,
                    parent_id: selectedParentId || undefined,
                }
            })
            toast.success('Category created')
            setIsCreateOpen(false)
            setFormData({ name: '', description: '', color: '#3B82F6', icon: 'folder' })
            setSelectedParentId(null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to create category')
        }
    }

    const handleUpdate = async () => {
        if (!editingCategory || !formData.name) return
        try {
            await updateMutation.mutateAsync({
                projectId,
                categoryId: editingCategory.id,
                data: {
                    name: formData.name,
                    description: formData.description,
                    color: formData.color || undefined,
                    icon: formData.icon || undefined,
                }
            })
            toast.success('Category updated')
            setIsEditOpen(false)
            setEditingCategory(null)
            setFormData({ name: '', description: '', color: '#3B82F6', icon: 'folder' })
        } catch (err: any) {
            toast.error(err.message || 'Failed to update category')
        }
    }

    const handleDelete = async (categoryId: number) => {
        if (!confirm('Are you sure you want to delete this category? Sub-categories might also be affected.')) return
        try {
            const moveToInput = window.prompt('Optional: move test cases to category ID before delete (leave blank to unassociate).', '')
            const moveTo = moveToInput && moveToInput.trim()
                ? Number.parseInt(moveToInput.trim(), 10)
                : undefined
            await deleteMutation.mutateAsync({
                projectId,
                categoryId,
                moveTo: Number.isInteger(moveTo) ? moveTo : undefined,
            })
            toast.success('Category deleted')
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete category')
        }
    }

    const openCreateDialog = (parentId: number | null = null) => {
        setSelectedParentId(parentId)
        setFormData({ name: '', description: '', color: '#3B82F6', icon: 'folder' })
        setIsCreateOpen(true)
    }

    const openEditDialog = (category: CategoryTree) => {
        setEditingCategory(category)
        setFormData({
            name: category.name,
            description: category.description || '',
            color: category.color || '#3B82F6',
            icon: category.icon || 'folder',
        })
        setIsEditOpen(true)
    }

    const renderCategory = (category: CategoryTree, level = 0) => {
        return (
            <div key={category.id} className="space-y-1">
                <div
                    className="flex items-center justify-between p-2 hover:bg-accent rounded-md group"
                    style={{ marginLeft: `${level * 24}px` }}
                >
                    <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4" style={{ color: category.color || '#3B82F6' }} />
                        <span className="font-medium text-sm">{category.name}</span>
                        {category.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                - {category.description}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openCreateDialog(category.id)}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(category)} className="cursor-pointer">
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleDelete(category.id)}
                                    className="text-destructive cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {category.children && category.children.length > 0 && (
                    <div className="border-l border-border ml-2 pl-2">
                        {category.children.map(child => renderCategory(child, level + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl">Categories</CardTitle>
                    <CardDescription>Manage your API hierarchy</CardDescription>
                </div>
                <Button onClick={() => openCreateDialog(null)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                </Button>
            </CardHeader>
            <CardContent className="px-0">
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 w-full bg-accent animate-pulse rounded-md" />
                        ))}
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">No categories yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first category to organize APIs</p>
                        <Button onClick={() => openCreateDialog(null)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Category
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {categories.map(cat => renderCategory(cat))}
                    </div>
                )}
            </CardContent>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedParentId ? 'Add Sub-category' : 'Add Root Category'}
                        </DialogTitle>
                        <DialogDescription>
                            Create a new folder to organize your API endpoints.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. User Management"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Categorize user-related APIs"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="color">Color</Label>
                                <Input
                                    id="color"
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="icon">Icon</Label>
                                <Input
                                    id="icon"
                                    value={formData.icon}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="folder"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                        <DialogDescription>
                            Update category details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Input
                                id="edit-description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="edit-color">Color</Label>
                                <Input
                                    id="edit-color"
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-icon">Icon</Label>
                                <Input
                                    id="edit-icon"
                                    value={formData.icon}
                                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
