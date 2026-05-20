import type { ProjectEnvironment } from '@/types/environment';

export const REQUEST_TEMPLATE_PATTERN = /\{\{([^}]+)\}\}/g;

export interface RequestRuntimeVariableLayers {
  workspace: Record<string, string>;
  collection: Record<string, string>;
  environment: Record<string, string>;
  runtime: Record<string, string>;
  merged: Record<string, string>;
}

const toVariableValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

export const variablesFromUnknown = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, entryValue]) => {
      const normalizedValue = toVariableValue(entryValue);
      return normalizedValue === null ? [] : [[key, normalizedValue] as const];
    })
  );
};

export const buildEnvironmentVariableRecord = (
  environment?: Pick<ProjectEnvironment, 'variables' | 'base_url'> | null
) => {
  const variables = variablesFromUnknown(environment?.variables);
  const baseUrl = environment?.base_url?.trim();

  if (baseUrl && !variables.base_url) {
    variables.base_url = baseUrl;
  }

  return variables;
};

export const buildRuntimeVariableLayers = ({
  workspaceVariables,
  collectionVariables,
  environment,
  runtimeVariables,
}: {
  workspaceVariables?: unknown;
  collectionVariables?: unknown;
  environment?: Pick<ProjectEnvironment, 'variables' | 'base_url'> | null;
  runtimeVariables?: unknown;
}): RequestRuntimeVariableLayers => {
  const workspace = variablesFromUnknown(workspaceVariables);
  const collection = variablesFromUnknown(collectionVariables);
  const environmentVariables = buildEnvironmentVariableRecord(environment);
  const runtime = variablesFromUnknown(runtimeVariables);

  return {
    workspace,
    collection,
    environment: environmentVariables,
    runtime,
    merged: {
      ...workspace,
      ...collection,
      ...environmentVariables,
      ...runtime,
    },
  };
};

export const resolveTemplateValue = (value: string, variables: Record<string, string>) =>
  value.replace(REQUEST_TEMPLATE_PATTERN, (match, key: string) => {
    const resolved = variables[key.trim()];
    return resolved === undefined ? match : resolved;
  });

export const findTemplateKeys = (value: string) =>
  Array.from(new Set(Array.from(value.matchAll(REQUEST_TEMPLATE_PATTERN)).map(match => match[1].trim())));

export const findUnresolvedTemplateKeys = (values: string[]) =>
  Array.from(new Set(values.flatMap(value => findTemplateKeys(value))));
