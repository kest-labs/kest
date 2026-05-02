import { describe, expect, it } from 'vitest';
import authEn from '@/i18n/modules/auth/en-US';
import authZh from '@/i18n/modules/auth/zh-Hans';
import commonEn from '@/i18n/modules/common/en-US';
import commonZh from '@/i18n/modules/common/zh-Hans';
import consoleEn from '@/i18n/modules/console/en-US';
import consoleZh from '@/i18n/modules/console/zh-Hans';
import dashboardEn from '@/i18n/modules/dashboard/en-US';
import dashboardZh from '@/i18n/modules/dashboard/zh-Hans';
import errorsEn from '@/i18n/modules/errors/en-US';
import errorsZh from '@/i18n/modules/errors/zh-Hans';
import marketingEn from '@/i18n/modules/marketing/en-US';
import marketingZh from '@/i18n/modules/marketing/zh-Hans';
import metadataEn from '@/i18n/modules/metadata/en-US';
import metadataZh from '@/i18n/modules/metadata/zh-Hans';
import navEn from '@/i18n/modules/nav/en-US';
import navZh from '@/i18n/modules/nav/zh-Hans';
import projectEn from '@/i18n/modules/project/en-US';
import projectZh from '@/i18n/modules/project/zh-Hans';
import settingsEn from '@/i18n/modules/settings/en-US';
import settingsZh from '@/i18n/modules/settings/zh-Hans';
import testEn from '@/i18n/modules/test/en-US';
import testZh from '@/i18n/modules/test/zh-Hans';

const modules = {
  auth: [authEn, authZh],
  common: [commonEn, commonZh],
  console: [consoleEn, consoleZh],
  dashboard: [dashboardEn, dashboardZh],
  errors: [errorsEn, errorsZh],
  marketing: [marketingEn, marketingZh],
  metadata: [metadataEn, metadataZh],
  nav: [navEn, navZh],
  project: [projectEn, projectZh],
  settings: [settingsEn, settingsZh],
  test: [testEn, testZh],
} as const;

function keyShape(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, keyShape(nested)])
    );
  }

  return 'leaf';
}

function collectEmptyStrings(value: unknown, path: string[] = []): string[] {
  if (typeof value === 'string') {
    return value.trim() ? [] : [path.join('.')];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    collectEmptyStrings(nested, [...path, key])
  );
}

function collectLeafPaths(value: unknown, path: string[] = []): string[] {
  if (typeof value === 'string') {
    return [path.join('.')];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    collectLeafPaths(nested, [...path, key])
  );
}

describe('i18n messages', () => {
  it('keeps en-US and zh-Hans module keys in sync', () => {
    Object.entries(modules).forEach(([moduleName, [en, zh]]) => {
      expect(keyShape(en), moduleName).toEqual(keyShape(zh));
    });
  });

  it('keeps en-US and zh-Hans leaf key counts aligned', () => {
    let totalEnLeafCount = 0;
    let totalZhLeafCount = 0;

    Object.entries(modules).forEach(([moduleName, [en, zh]]) => {
      const enLeafPaths = collectLeafPaths(en);
      const zhLeafPaths = collectLeafPaths(zh);

      totalEnLeafCount += enLeafPaths.length;
      totalZhLeafCount += zhLeafPaths.length;

      expect(
        enLeafPaths.length,
        `${moduleName} leaf keys en-US=${enLeafPaths.length}, zh-Hans=${zhLeafPaths.length}`
      ).toBe(zhLeafPaths.length);
    });

    expect(totalEnLeafCount, `total leaf keys en-US=${totalEnLeafCount}, zh-Hans=${totalZhLeafCount}`).toBe(
      totalZhLeafCount
    );
  });

  it('does not ship empty translation strings', () => {
    Object.entries(modules).forEach(([moduleName, [en, zh]]) => {
      expect(collectEmptyStrings(en), `${moduleName} en-US`).toEqual([]);
      expect(collectEmptyStrings(zh), `${moduleName} zh-Hans`).toEqual([]);
    });
  });
});
