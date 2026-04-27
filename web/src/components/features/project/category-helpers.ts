import type { ProjectCategory } from '@/types/category';

// 带层级深度的分类节点。
// 作用：把树形分类展开后保留深度信息，便于表格缩进和排序判断。
export interface FlatProjectCategory extends ProjectCategory {
  depth: number;
}

// Select 组件使用的分类选项。
// 作用：统一分类下拉的数据结构和展示文本。
export interface CategoryOption {
  value: string;
  label: string;
  depth: number;
}

// 分类树扁平化工具。
// 作用：把嵌套 children 结构展开成带深度的线性数组。
export const flattenProjectCategories = (
  categories: ProjectCategory[] | undefined,
  depth = 0
): FlatProjectCategory[] => {
  if (!categories || categories.length === 0) {
    return [];
  }

  return categories.flatMap((category) => [
    { ...category, depth },
    ...flattenProjectCategories(category.children, depth + 1),
  ]);
};

// 分类下拉选项构建器。
// 作用：把扁平节点转成可直接渲染在 Select 中的选项。
export const buildCategoryOptions = (categories: ProjectCategory[] | undefined): CategoryOption[] =>
  flattenProjectCategories(categories).map((category) => ({
    value: String(category.id),
    label: `${category.depth > 0 ? `${'  '.repeat(category.depth)}↳ ` : ''}${category.name}`,
    depth: category.depth,
  }));

// 分类节点查找器。
// 作用：在树结构里递归定位指定 ID 的分类。
export const findProjectCategory = (
  categories: ProjectCategory[] | undefined,
  categoryId?: number | string | null
): ProjectCategory | null => {
  if (!categories || categoryId === undefined || categoryId === null) {
    return null;
  }

  for (const category of categories) {
    if (category.id === categoryId) {
      return category;
    }

    const childMatch = findProjectCategory(category.children, categoryId);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
};

// 子孙分类 ID 收集器。
// 作用：为编辑表单中的“父分类循环引用校验”提供禁用 ID 列表。
export const collectCategoryDescendantIds = (
  categories: ProjectCategory[] | undefined,
  categoryId?: number | string | null
): Array<number | string> => {
  const category = findProjectCategory(categories, categoryId);

  if (!category?.children?.length) {
    return [];
  }

  return category.children.flatMap((child) => [
    child.id,
    ...collectCategoryDescendantIds(category.children, child.id),
  ]);
};

// 同级分类重排工具。
// 作用：仅在当前分类的兄弟节点范围内计算上移/下移后的排序结果。
export const reorderCategoryIdsWithinSiblings = (
  categories: FlatProjectCategory[],
  categoryId: number | string,
  direction: 'up' | 'down'
) => {
  const currentIndex = categories.findIndex((category) => category.id === categoryId);

  if (currentIndex === -1) {
    return null;
  }

  const currentCategory = categories[currentIndex];
  const siblingIndexes = categories.reduce<number[]>((indexes, category, index) => {
    if ((category.parent_id ?? null) === (currentCategory.parent_id ?? null)) {
      indexes.push(index);
    }

    return indexes;
  }, []);

  const siblingPosition = siblingIndexes.indexOf(currentIndex);
  const targetIndex =
    direction === 'up'
      ? siblingIndexes[siblingPosition - 1]
      : siblingIndexes[siblingPosition + 1];

  if (targetIndex === undefined) {
    return null;
  }

  const nextIds = categories.map((category) => category.id);
  [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];
  return nextIds;
};
