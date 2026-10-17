import type { SelectionSnapshot } from '../shared/types';

export type PreviewSnapshot<TResult, TParams> = {
  result: TResult;
  params: TParams;
  selectionSignature: string;
  parameterSignature: string;
};

export function createSelectionSignature(selection: SelectionSnapshot): string {
  return `${selection.count}:${selection.nodes.map((node) => node.id).join('|')}`;
}

export function createParameterSignature(...parts: unknown[]): string {
  return JSON.stringify(parts);
}

export function createPreviewSnapshot<TResult, TParams>(
  result: TResult,
  params: TParams,
  selectionSignature: string,
  parameterSignature: string
): PreviewSnapshot<TResult, TParams> {
  return { result, params, selectionSignature, parameterSignature };
}

export function isPreviewSnapshotStale<TResult, TParams>(
  snapshot: PreviewSnapshot<TResult, TParams> | null,
  selectionSignature: string,
  parameterSignature: string
): boolean {
  return Boolean(
    snapshot && (
      snapshot.selectionSignature !== selectionSignature ||
      snapshot.parameterSignature !== parameterSignature
    )
  );
}
