import type { WorkspaceModuleI18nKey } from '@/components/features/workspace/workspace-navigation';
import type { ScopedTranslations } from '@/i18n/shared';

type WorkspaceT = ScopedTranslations<'workspace'>;
type WorkspaceKey = Parameters<WorkspaceT>[0];

export function getWorkspaceModuleCopy(
  t: WorkspaceT,
  moduleKey: WorkspaceModuleI18nKey,
  field: 'label' | 'shortLabel' | 'description'
) {
  return t(`modules.${moduleKey}.${field}` as WorkspaceKey);
}
