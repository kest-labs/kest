import common from './common/en-US';
import auth from './auth/en-US';
import nav from './nav/en-US';
import settings from './settings/en-US';
import errors from './errors/en-US';
import metadata from './metadata/en-US';
import dashboard from './dashboard/en-US';
import test from './test/en-US';
import marketing from './marketing/en-US';
import workspace from './workspace/en-US';
import console from './console/en-US';

/**
 * Static messages type derived from English (en-US) files.
 * This is used for IDE auto-completion and type checking.
 */
export const messages = {
  common,
  auth,
  nav,
  settings,
  errors,
  metadata,
  dashboard,
  test,
  marketing,
  workspace,
  console,
} as const;

export type Messages = typeof messages;
