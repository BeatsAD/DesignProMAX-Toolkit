import { useCallback, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formatPluginErrorMessage, type KnownMessageType } from "../../shared/messages";
import type { HomeLayoutSettings, PluginSettings, SelectionSnapshot, TaskState } from "../../shared/types";
import { Field, IconButton, type ConfirmDialogInput } from "../components/ui";
import type { SettingsLoadState, SettingsView } from "../settings";
import { type FeedbackNotifier, type FeedbackRenderer, type FeedbackScope } from "../feedback";


export type Requester = <TData, TPayload = unknown>(
  type: KnownMessageType,
  payload?: TPayload,
  options?: { signal?: AbortSignal; onProgress?: (progress: { current: number; total: number; text: string }) => void }
) => Promise<TData>;

export const MAX_ACTIVE_IMAGE_RESULT_BYTES = 48 * 1024 * 1024;

export type ToolPageProps = {
  request: Requester;
  selection: SelectionSnapshot;
  settings?: PluginSettings;
  buildId?: string;
  task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  restartTask?: () => void;
  toast: FeedbackNotifier;
  renderFeedback?: FeedbackRenderer;
  confirm: (input: ConfirmDialogInput) => void;
  goSettings: (view?: SettingsView) => void;
  goHelp?: () => void;
  initialSettingsView?: SettingsView;
  reloadSettings?: () => Promise<void>;
  settingsLoadError?: string;
  settingsLoadState?: SettingsLoadState;
  onSettingsSaved: (settings: PluginSettings) => void;
  homeLayout?: HomeLayoutSettings;
  compactLayout?: HomeLayoutSettings;
  onHomeLayoutChange?: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>;
  onCompactLayoutChange?: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>;
  sessionCache?: Map<string, unknown>;
  getTaskSignal?: () => AbortSignal | undefined;
};

export const SESSION_KEYS = {
  aiCredentials: 'ai.credentials',
  aiResults: 'ai.results',
  aiDraft: 'ai.draft',
  cutoutResults: 'cutout.results',
  compressResults: 'compress.results',
  transparentCropResults: 'transparentCrop.results',
  batchExportPreview: 'export.preview',
  teamLibraryResult: 'teamLibrary.result'
} as const;

export type AiSessionCredentials = Pick<PluginSettings, 'aiProvider' | 'apiBaseUrl' | 'apiKey'>;

export function useSessionState<TValue>(
  sessionCache: Map<string, unknown> | undefined,
  key: string,
  initialValue: TValue
) {
  const [value, setValue] = useState<TValue>(() => {
    if (sessionCache?.has(key)) {
      return sessionCache.get(key) as TValue;
    }
    return initialValue;
  });

  const setSessionValue = useCallback((nextValue: TValue | ((current: TValue) => TValue)) => {
    setValue((current) => {
      const resolved = typeof nextValue === 'function'
        ? (nextValue as (current: TValue) => TValue)(current)
        : nextValue;
      sessionCache?.set(key, resolved);
      return resolved;
    });
  }, [key, sessionCache]);

  return [value, setSessionValue] as const;
}

export function PasswordField({
  label,
  labelSuffix,
  value,
  visible,
  onToggle,
  onChange,
  placeholder,
  error,
  actionSlot,
  hint
}: {
  label: string;
  labelSuffix?: React.ReactNode;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  actionSlot?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const Icon = visible ? EyeOff : Eye;
  const passwordControl = (
    <span className="password-field">
      <input
        aria-invalid={error ? true : undefined}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <IconButton
        ariaLabel={visible ? `隐藏${label}` : `显示${label}`}
        className="password-toggle"
        icon={Icon}
        onClick={onToggle}
        size="small"
        title={visible ? `隐藏${label}` : `显示${label}`}
      />
    </span>
  );
  return (
    <Field label={<span className="password-field-label">{label}{labelSuffix}</span>}>
      {actionSlot ? (
        <span className="password-field-row">
          {passwordControl}
          {actionSlot}
        </span>
      ) : passwordControl}
      {hint}
      <SettingsFieldError message={error} />
    </Field>
  );
}

export function SettingsFieldError({ message }: { message?: string }) {
  return message ? <span className="settings-field-error">{message}</span> : null;
}

export function messageOf(error: unknown): string {
  return formatPluginErrorMessage(error);
}