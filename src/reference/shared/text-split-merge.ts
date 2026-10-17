export const DEFAULT_TEXT_SPLIT_DELIMITERS = ['、', '，', '。', '；'] as const;

export const OPTIONAL_TEXT_SPLIT_DELIMITERS = [',', '.', ';', '!', '?', '！', '？', '\n'] as const;

export type TextSplitMergeMode = 'merge' | 'split';
export type TextMergeSeparator = 'none' | 'space' | 'newline' | 'custom';
export type TextSplitDelimiterRetention = 'previous' | 'discard' | 'next';
export type TextSplitDirection = 'vertical' | 'horizontal';

export type PreviewTextSplitMergePayload = {
  mode: 'merge';
  separator: TextMergeSeparator;
  customSeparator?: string;
} | {
  mode: 'split';
  delimiters: string[];
  customDelimiters?: string;
  retainDelimiter: TextSplitDelimiterRetention;
  trimWhitespace: boolean;
  direction: TextSplitDirection;
  gap: number;
};

export type TextSplitMergeSource = {
  nodeId: string;
  name: string;
  before: string;
};

export type TextSplitMergePreviewItem = {
  sourceNodeIds: string[];
  before: string;
  after: string;
  outputIndex: number;
};

export type TextSplitMergePreviewResult = {
  mode: TextSplitMergeMode;
  sources: TextSplitMergeSource[];
  items: TextSplitMergePreviewItem[];
  outputCount: number;
  canRun: boolean;
  message: string;
  blockedReason?: string;
};

export type RunTextSplitMergePayload = PreviewTextSplitMergePayload & {
  expectedSources: TextSplitMergeSource[];
  confirmed: boolean;
};

export function mergeSeparatorValue(separator: TextMergeSeparator, customSeparator?: string): string {
  if (separator === 'space') return ' ';
  if (separator === 'newline') return '\n';
  if (separator === 'custom') return customSeparator ?? '';
  return '';
}

export function resolveTextSplitDelimiters(delimiters: readonly string[], customDelimiters?: string): Set<string> {
  const result = new Set<string>();
  for (const delimiter of delimiters) {
    for (const character of Array.from(delimiter)) {
      result.add(character);
    }
  }
  for (const character of Array.from(customDelimiters ?? '')) {
    result.add(character);
  }
  return result;
}

export function splitTextByDelimiters(
  text: string,
  delimiters: ReadonlySet<string>,
  retention: TextSplitDelimiterRetention,
  trimWhitespace: boolean
): string[] {
  const result: string[] = [];
  let current = '';
  let pending = '';

  const push = (value: string) => {
    const normalized = trimWhitespace ? value.trim() : value;
    if (normalized) result.push(normalized);
  };

  for (const character of Array.from(text)) {
    if (!delimiters.has(character)) {
      if (pending) {
        current += pending;
        pending = '';
      }
      current += character;
      continue;
    }

    if (retention === 'previous') {
      if (current) {
        push(`${current}${character}`);
        current = '';
      } else if (result.length) {
        result[result.length - 1] = `${result[result.length - 1]}${character}`;
      }
      continue;
    }

    if (retention === 'next') {
      if (current) {
        push(current);
        current = '';
      }
      pending += character;
      continue;
    }

    if (current) {
      push(current);
      current = '';
    }
  }

  if (pending) {
    if (current) {
      current = `${pending}${current}`;
    } else if (result.length) {
      result[result.length - 1] = `${result[result.length - 1]}${pending}`;
    } else {
      current = pending;
    }
  }
  if (current) push(current);
  return result;
}
