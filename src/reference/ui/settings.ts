export type SettingsView =
  | 'main'
  | 'general'
  | 'defaultLayout'
  | 'compactLayout'
  | 'ai'
  | 'cutout'
  | 'compress'
  | 'privacy'
  | 'diagnostics'
  | 'feedback'
  | 'version';

export type SettingsLoadState = 'loading' | 'success' | 'error';
