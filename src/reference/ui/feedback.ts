import type { ReactElement } from 'react';
import type { NoticeTone } from './components/ui';

/**
 * Status feedback stays with the part of the workflow that caused it.
 * The shell owns the message lifecycle; pages choose the visual anchor.
 */
export type FeedbackScope = 'selection' | 'parameters' | 'result' | 'global';

export type FeedbackNotifier = (
  text: string,
  scope?: FeedbackScope,
  tone?: NoticeTone
) => void;

export type FeedbackRenderer = (scope: FeedbackScope) => ReactElement | null;

export const renderNoFeedback: FeedbackRenderer = () => null;
