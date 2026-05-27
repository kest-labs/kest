'use client';

import { useTranslations } from 'next-intl';
import type {
  AllScopePaths,
  ScopedTranslations,
  TranslationValues,
  Translators,
  UnifiedTranslations,
} from './shared';

type TranslatorFn = (key: string, values?: TranslationValues) => string;

export function useT(): UnifiedTranslations;
export function useT<P extends AllScopePaths>(scope: P): ScopedTranslations<P>;
export function useT(scope?: string) {
  const rootT = useTranslations(scope as never) as unknown as TranslatorFn;
  const commonT = useTranslations('common') as unknown as TranslatorFn;
  const authT = useTranslations('auth') as unknown as TranslatorFn;
  const navT = useTranslations('nav') as unknown as TranslatorFn;
  const settingsT = useTranslations('settings') as unknown as TranslatorFn;
  const errorsT = useTranslations('errors') as unknown as TranslatorFn;
  const metadataT = useTranslations('metadata') as unknown as TranslatorFn;
  const dashboardT = useTranslations('dashboard') as unknown as TranslatorFn;
  const testT = useTranslations('test') as unknown as TranslatorFn;
  const marketingT = useTranslations('marketing') as unknown as TranslatorFn;
  const workspaceT = useTranslations('workspace') as unknown as TranslatorFn;
  const consoleT = useTranslations('console') as unknown as TranslatorFn;

  if (scope) {
    return rootT as ScopedTranslations<typeof scope>;
  }

  const translate = rootT as unknown as UnifiedTranslations;

  const namespaces: Translators = {
    common: commonT as Translators['common'],
    auth: authT as Translators['auth'],
    nav: navT as Translators['nav'],
    settings: settingsT as Translators['settings'],
    errors: errorsT as Translators['errors'],
    metadata: metadataT as Translators['metadata'],
    dashboard: dashboardT as Translators['dashboard'],
    test: testT as Translators['test'],
    marketing: marketingT as Translators['marketing'],
    workspace: workspaceT as Translators['workspace'],
    console: consoleT as Translators['console'],
  };

  return Object.assign(translate, namespaces);
}
