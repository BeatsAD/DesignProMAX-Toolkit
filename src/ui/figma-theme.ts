import {useLayoutEffect, useSyncExternalStore} from 'react';
import {resolveTheme} from '../shared/theme';
import type {ThemeMode, ThemePreference} from '../shared/theme';

export function readHostTheme(): ThemeMode {
  const classes = document.documentElement.classList;
  if (classes.contains('figma-dark')) return 'dark';
  if (classes.contains('figma-light')) return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function subscribeHostTheme(notify: () => void): () => void {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['class']});
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', notify);
  return () => {
    observer.disconnect();
    media?.removeEventListener('change', notify);
  };
}

export function applyTheme(preference: ThemePreference, host: ThemeMode): ThemeMode {
  const mode = resolveTheme(preference, host);
  document.documentElement.dataset.theme = mode;
  // Consume live host tokens only when they describe the requested appearance.
  // A manual override of the opposite host theme uses the matching fallback palette.
  document.documentElement.dataset.themeSource = mode === host ? 'host' : 'override';
  return mode;
}

export function useFigmaTheme(preference: ThemePreference): ThemeMode {
  const host = useSyncExternalStore(subscribeHostTheme, readHostTheme, () => 'light' as const);
  useLayoutEffect(() => { applyTheme(preference, host); }, [preference, host]);
  useLayoutEffect(() => () => {
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themeSource;
  }, []);
  return resolveTheme(preference, host);
}
