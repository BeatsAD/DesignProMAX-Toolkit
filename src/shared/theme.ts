export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(preference: ThemePreference, host: ThemeMode): ThemeMode {
  return preference === 'system' ? host : preference;
}
