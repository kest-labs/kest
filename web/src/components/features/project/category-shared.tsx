'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { buildCategoryOptions } from '@/components/features/project/category-helpers';
import { useT } from '@/i18n/client';
import type {
  CreateCategoryRequest,
  ProjectCategory,
  UpdateCategoryRequest,
} from '@/types/category';

// 分类表单模式。
// 作用：区分当前弹窗是创建新分类还是编辑现有分类。
export type CategoryFormMode = 'create' | 'edit';

// 分类表单本地草稿。
// 作用：把分类字段转换成更适合输入控件绑定的字符串形态。
interface CategoryFormDraft {
  name: string;
  description: string;
  parentId: string;
  sortOrder: string;
}

// 分类表单默认值生成器。
// 作用：根据分类详情和默认父级生成弹窗初始值。
const getCategoryFormDraft = (
  category?: ProjectCategory | null,
  defaultParentId?: number | string | null
): CategoryFormDraft => ({
  name: category?.name ?? '',
  description: category?.description ?? '',
  parentId: String(category?.parent_id ?? defaultParentId ?? 'none'),
  sortOrder: category?.sort_order !== undefined ? String(category.sort_order) : '',
});

// 分类创建/编辑弹窗。
// 作用：
// 1. 统一承载创建和编辑两个流程
// 2. 在提交前完成名称、描述、排序值和父子循环关系校验
export function CategoryFormDialog({
  open,
  mode,
  category,
  categories,
  defaultParentId,
  invalidParentIds = [],
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  mode: CategoryFormMode;
  category?: ProjectCategory | null;
  categories: ProjectCategory[];
  defaultParentId?: number | string | null;
  invalidParentIds?: Array<number | string>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCategoryRequest | UpdateCategoryRequest) => Promise<void>;
}) {
  const formKey = `${mode}-${category?.id ?? 'new'}-${defaultParentId ?? 'none'}-${open ? 'open' : 'closed'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CategoryFormDialogBody
        key={formKey}
        mode={mode}
        category={category}
        categories={categories}
        defaultParentId={defaultParentId}
        invalidParentIds={invalidParentIds}
        isSubmitting={isSubmitting}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

function CategoryFormDialogBody({
  mode,
  category,
  categories,
  defaultParentId,
  invalidParentIds = [],
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  mode: CategoryFormMode;
  category?: ProjectCategory | null;
  categories: ProjectCategory[];
  defaultParentId?: number | string | null;
  invalidParentIds?: Array<number | string>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateCategoryRequest | UpdateCategoryRequest) => Promise<void>;
}) {
  const t = useT('project');
  const [draft, setDraft] = useState<CategoryFormDraft>(() =>
    getCategoryFormDraft(category, defaultParentId)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const normalizedInvalidParentIds = invalidParentIds.map((id) => String(id));

  // 父分类下拉选项。
  // 作用：把树形分类结构转换成可选择的扁平下拉项。
  const categoryOptions = buildCategoryOptions(categories);

  // 草稿更新辅助函数。
  // 作用：减少表单输入时的重复 setState 代码。
  const updateDraft = <K extends keyof CategoryFormDraft>(key: K, value: CategoryFormDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // 表单提交处理器。
  // 作用：集中执行字段裁剪、校验和请求体格式化。
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = draft.name.trim();
    const trimmedDescription = draft.description.trim();
    const nextErrors: Record<string, string> = {};
    let sortOrder: number | undefined;

    if (!trimmedName) {
      nextErrors.name = t('categoryForm.nameRequired');
    } else if (trimmedName.length > 100) {
      nextErrors.name = t('categoryForm.nameTooLong');
    }

    if (trimmedDescription.length > 500) {
      nextErrors.description = t('categoryForm.descriptionTooLong');
    }

    if (draft.sortOrder.trim()) {
      sortOrder = Number(draft.sortOrder);

      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        nextErrors.sortOrder = t('categoryForm.sortOrderInvalid');
      }
    }

    const parentId = draft.parentId === 'none' ? null : draft.parentId.trim() || null;

    if (parentId !== null && normalizedInvalidParentIds.includes(parentId)) {
      nextErrors.parentId = t('categoryForm.invalidLoop');
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      name: trimmedName,
      description: trimmedDescription || undefined,
      parent_id: parentId,
      sort_order: sortOrder,
    });
  };

  return (
    <DialogContent size="default">
      <DialogHeader>
        <DialogTitle>{mode === 'create' ? t('categoryForm.createTitle') : t('categoryForm.editTitle')}</DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? t('categoryForm.createDescription')
            : t('categoryForm.editDescription')}
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <form id="category-form" className="space-y-4 py-1" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="category-name">{t('categoryForm.nameLabel')}</Label>
            <Input
              id="category-name"
              value={draft.name}
              onChange={(event) => updateDraft('name', event.target.value)}
              placeholder={t('categoryForm.namePlaceholder')}
              errorText={errors.name}
              root
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">{t('categoryForm.descriptionLabel')}</Label>
            <Textarea
              id="category-description"
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
              placeholder={t('categoryForm.descriptionPlaceholder')}
              errorText={errors.description}
              root
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category-parent">{t('categoryForm.parentLabel')}</Label>
              <Select
                value={draft.parentId || 'none'}
                onValueChange={(value) => updateDraft('parentId', value)}
              >
                <SelectTrigger
                  id="category-parent"
                  className={errors.parentId ? 'border-destructive' : undefined}
                >
                  <SelectValue placeholder={t('categoryForm.selectParent')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('categoryForm.noParent')}</SelectItem>
                  {categoryOptions.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={normalizedInvalidParentIds.includes(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.parentId ? (
                <p className="text-xs font-medium text-destructive">{errors.parentId}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-sort-order">{t('categoryForm.sortOrderLabel')}</Label>
              <Input
                id="category-sort-order"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(event) => updateDraft('sortOrder', event.target.value)}
                placeholder={t('categoryForm.optional')}
                errorText={errors.sortOrder}
                root
              />
            </div>
          </div>
        </form>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="category-form" loading={isSubmitting}>
          {mode === 'create' ? t('categoryForm.createButton') : t('categoryForm.saveButton')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// 删除分类确认弹窗。
// 作用：
// 1. 对 destructive action 做二次确认
// 2. 明确说明当前后端删除行为和文档差异
export function DeleteCategoryDialog({
  open,
  category,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  category?: ProjectCategory | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT('project');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('categoryForm.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {category
              ? t('categoryForm.deleteDescriptionWithName', { name: category.name })
              : t('categoryForm.deleteDescriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <Alert variant="destructive">
            <AlertTitle>{t('categoryForm.deleteWarningTitle')}</AlertTitle>
            <AlertDescription>
              {t('categoryForm.deleteWarningDescription')}
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertTitle>{t('categoryForm.deleteScopeTitle')}</AlertTitle>
            <AlertDescription>
              {t('categoryForm.deleteScopeDescription')}
            </AlertDescription>
          </Alert>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" variant="destructive" loading={isDeleting} onClick={() => void onConfirm()}>
            {t('categoryForm.deleteButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
