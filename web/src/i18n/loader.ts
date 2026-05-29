import { type Locale } from './config';

// Define available modules
export const AVAILABLE_MODULES = [
  'common',
  'auth',
  'nav',
  'settings',
  'errors',
  'metadata',
  'dashboard',
  'test',
  'marketing',
  'workspace',
  'console',
] as const;

export type ModuleName = (typeof AVAILABLE_MODULES)[number];

import type { Messages as StrictMessages } from './modules';

// Interface for loaded messages
export type Messages = StrictMessages;

type ModuleRegistry = {
  [K in ModuleName]: Record<
    Locale,
    () => Promise<Messages[K] | { default: Messages[K] }>
  >;
};

// Translation module loader with type safety
const moduleRegistry: ModuleRegistry = {
  common: {
    'zh-Hans': () => import('./modules/common/zh-Hans'),
    'en-US': () => import('./modules/common/en-US'),
  },
  auth: {
    'zh-Hans': () => import('./modules/auth/zh-Hans'),
    'en-US': () => import('./modules/auth/en-US'),
  },
  nav: {
    'zh-Hans': () => import('./modules/nav/zh-Hans'),
    'en-US': () => import('./modules/nav/en-US'),
  },
  settings: {
    'zh-Hans': () => import('./modules/settings/zh-Hans'),
    'en-US': () => import('./modules/settings/en-US'),
  },
  errors: {
    'zh-Hans': () => import('./modules/errors/zh-Hans'),
    'en-US': () => import('./modules/errors/en-US'),
  },
  metadata: {
    'zh-Hans': () => import('./modules/metadata/zh-Hans'),
    'en-US': () => import('./modules/metadata/en-US'),
  },
  dashboard: {
    'zh-Hans': () => import('./modules/dashboard/zh-Hans'),
    'en-US': () => import('./modules/dashboard/en-US'),
  },
  test: {
    'zh-Hans': () => import('./modules/test/zh-Hans'),
    'en-US': () => import('./modules/test/en-US'),
  },
  marketing: {
    'zh-Hans': () => import('./modules/marketing/zh-Hans'),
    'en-US': () => import('./modules/marketing/en-US'),
  },
  workspace: {
    'zh-Hans': () => import('./modules/workspace/zh-Hans'),
    'en-US': () => import('./modules/workspace/en-US'),
  },
  console: {
    'zh-Hans': () => import('./modules/console/zh-Hans'),
    'en-US': () => import('./modules/console/en-US'),
  },
};

type ModuleKey = keyof ModuleRegistry;

async function resolveModule<K extends ModuleKey>(
  moduleKey: K,
  locale: Locale
): Promise<Messages[K]> {
  try {
    const loadedModule = await moduleRegistry[moduleKey][locale]();
    return 'default' in loadedModule ? loadedModule.default : loadedModule;
  } catch (error) {
    console.warn(`Failed to load ${moduleKey} module for locale ${locale}:`, error);
    return {} as Messages[K];
  }
}

/**
 * Load all translation modules for a given locale
 */
export async function loadAllModules(locale: Locale): Promise<Messages> {
  // Load all modules in parallel for better performance
  const modulePromises = (Object.keys(moduleRegistry) as ModuleKey[]).map(async (key) => {
    const moduleData = await resolveModule(key, locale);
    return [key, moduleData] as const;
  });

  const loadedModules = await Promise.all(modulePromises);
  return Object.fromEntries(loadedModules) as Messages;
}

/**
 * Load a specific module for a given locale
 */
export async function loadModule<K extends ModuleKey>(
  moduleKey: K,
  locale: Locale
): Promise<Messages[K]> {
  return resolveModule(moduleKey, locale);
}
