import { getTranslations } from 'next-intl/server';
import type {
  AllScopePaths,
  ScopedTranslations,
  TranslationValues,
  Translators,
  UnifiedTranslations,
} from './shared';

type TranslatorFn = (key: string, values?: TranslationValues) => string;

export async function getT(): Promise<UnifiedTranslations>;
export async function getT<P extends AllScopePaths>(scope: P): Promise<ScopedTranslations<P>>;
export async function getT(scope?: string) {
  const rootT = (await getTranslations(scope as never)) as unknown as TranslatorFn;

  if (scope) {
    return rootT as ScopedTranslations<typeof scope>;
  }

  const [
    commonT,
    authT,
    navT,
    settingsT,
    errorsT,
    metadataT,
    dashboardT,
    testT,
    marketingT,
    workspaceT,
    consoleT,
  ] = await Promise.all([
    getTranslations('common') as Promise<TranslatorFn>,
    getTranslations('auth') as Promise<TranslatorFn>,
    getTranslations('nav') as Promise<TranslatorFn>,
    getTranslations('settings') as Promise<TranslatorFn>,
    getTranslations('errors') as Promise<TranslatorFn>,
    getTranslations('metadata') as Promise<TranslatorFn>,
    getTranslations('dashboard') as Promise<TranslatorFn>,
    getTranslations('test') as Promise<TranslatorFn>,
    getTranslations('marketing') as Promise<TranslatorFn>,
    getTranslations('workspace') as Promise<TranslatorFn>,
    getTranslations('console') as Promise<TranslatorFn>,
  ]);

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

  const translate = rootT as unknown as UnifiedTranslations;

  return Object.assign(translate, namespaces);
}
