import type { FlowVariableMappingRule } from '@/types/flow';

const SUPPORTED_PATH_KEY_PATTERN = /^[^.[\]]+$/;
const VARIABLE_NAME_PATTERN = /^[A-Za-z_]\w*$/;

export interface FlowParameterCandidate {
  id: string;
  displayPath: string;
  capturePath: string;
  fieldName: string;
  defaultVariableName: string;
  valueType: string;
  preview: string;
  value: unknown;
}

export interface FlowParameterSelection {
  capturePath: string;
  variableName: string;
}

export interface ParsedCaptureDefinition {
  variableName: string;
  path: string;
  raw: string;
  lineIndex: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const tryParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const getValueType = (value: unknown) => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
};

const getValuePreview = (value: unknown) => {
  const preview = typeof value === 'string' ? value : JSON.stringify(value);
  if (!preview) {
    return '';
  }
  return preview.length > 80 ? `${preview.slice(0, 77)}...` : preview;
};

const formatJsonPath = (parts: Array<string | number>) =>
  parts.reduce<string>((path, part) => {
    if (typeof part === 'number') {
      return `${path}[${part}]`;
    }
    return path ? `${path}.${part}` : part;
  }, '');

const getFieldName = (parts: Array<string | number>) => {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (typeof part === 'string') {
      return part;
    }
  }

  return 'value';
};

export const isValidFlowVariableName = (value: string) =>
  VARIABLE_NAME_PATTERN.test(value.trim());

export const normalizeFlowVariableName = (value: string) => {
  const words = value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'value';
  }

  const normalized = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join('')
    .replace(/[^A-Za-z0-9_]/g, '');

  if (!normalized) {
    return 'value';
  }
  if (/^[0-9]/.test(normalized)) {
    return `value${normalized}`;
  }

  return normalized;
};

export const parseFlowStepResponseBody = (rawResponse?: string | null): unknown | null => {
  const trimmed = rawResponse?.trim();
  if (!trimmed) {
    return null;
  }

  const response = tryParseJson(trimmed);
  if (!isRecord(response) || !('body' in response)) {
    return null;
  }

  const body = response.body;
  if (typeof body === 'string') {
    return tryParseJson(body);
  }

  if (body === null || typeof body === 'object') {
    return body;
  }

  return null;
};

export const extractFlowParameterCandidates = (
  rawResponse?: string | null
): FlowParameterCandidate[] => {
  const body = parseFlowStepResponseBody(rawResponse);
  if (body === null || body === undefined || typeof body !== 'object') {
    return [];
  }

  const candidates: Omit<FlowParameterCandidate, 'defaultVariableName'>[] = [];

  const visit = (value: unknown, parts: Array<string | number>) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...parts, index]));
      return;
    }

    if (isRecord(value)) {
      Object.entries(value).forEach(([key, item]) => {
        if (SUPPORTED_PATH_KEY_PATTERN.test(key)) {
          visit(item, [...parts, key]);
        }
      });
      return;
    }

    if (parts.length === 0) {
      return;
    }

    const capturePath = formatJsonPath(parts);
    const displayPath = `body.${capturePath}`;
    const fieldName = getFieldName(parts);
    candidates.push({
      id: displayPath,
      displayPath,
      capturePath,
      fieldName,
      valueType: getValueType(value),
      preview: getValuePreview(value),
      value,
    });
  };

  visit(body, []);

  const usedNames = new Map<string, number>();
  return candidates.map((candidate) => {
    const baseName = normalizeFlowVariableName(candidate.fieldName);
    const usedCount = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, usedCount + 1);

    return {
      ...candidate,
      defaultVariableName: usedCount === 0 ? baseName : `${baseName}${usedCount + 1}`,
    };
  });
};

export const parseCaptureDefinitions = (captures: string): ParsedCaptureDefinition[] =>
  captures
    .split('\n')
    .map((raw, lineIndex) => {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return null;
      }

      const colonIndex = trimmed.indexOf(':');
      const equalsIndex = trimmed.indexOf('=');
      const separatorIndex =
        colonIndex === -1
          ? equalsIndex
          : equalsIndex === -1
            ? colonIndex
            : Math.min(colonIndex, equalsIndex);

      if (separatorIndex === -1) {
        return null;
      }

      const variableName = trimmed.slice(0, separatorIndex).trim();
      const path = trimmed.slice(separatorIndex + 1).trim();
      if (!variableName || !path) {
        return null;
      }

      return {
        variableName,
        path,
        raw,
        lineIndex,
      };
    })
    .filter(Boolean) as ParsedCaptureDefinition[];

export const mergeCaptureDefinitions = (
  captures: string,
  selections: FlowParameterSelection[]
) => {
  const lines = captures.trim() ? captures.split('\n') : [];
  const definitions = parseCaptureDefinitions(captures);
  const definitionByName = new Map(definitions.map((definition) => [definition.variableName, definition]));

  for (const selection of selections) {
    const variableName = selection.variableName.trim();
    const capturePath = selection.capturePath.trim();
    if (!isValidFlowVariableName(variableName) || !capturePath) {
      continue;
    }

    const nextLine = `${variableName}: ${capturePath}`;
    const existing = definitionByName.get(variableName);
    if (existing) {
      lines[existing.lineIndex] = nextLine;
      continue;
    }

    lines.push(nextLine);
    definitionByName.set(variableName, {
      variableName,
      path: capturePath,
      raw: nextLine,
      lineIndex: lines.length - 1,
    });
  }

  return lines.join('\n').trimEnd();
};

export const createHandoffMappings = (
  selections: FlowParameterSelection[]
): FlowVariableMappingRule[] =>
  selections
    .map((selection) => {
      const variableName = selection.variableName.trim();
      return {
        source: variableName,
        target: variableName,
      };
    })
    .filter((mapping) => isValidFlowVariableName(mapping.source));

export const mergeVariableMappings = (
  mappings: FlowVariableMappingRule[],
  selections: FlowParameterSelection[]
) => {
  const merged = mappings.map((mapping) => ({
    source: mapping.source.trim(),
    target: mapping.target.trim(),
  }));
  const seen = new Set(merged.map((mapping) => `${mapping.source}->${mapping.target}`));

  for (const mapping of createHandoffMappings(selections)) {
    const key = `${mapping.source}->${mapping.target}`;
    if (seen.has(key)) {
      continue;
    }

    merged.push(mapping);
    seen.add(key);
  }

  return merged;
};
