import { LanguagePicker } from '../../../ui/components/LanguagePicker';
import { LINKS } from '../../../../shared/links';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Clipboard, ChevronRight, CircleHelp, Eraser, ExternalLink, FileText, Github, Image as ImageIcon, Info, Mail, MessageCircle, QrCode, ShieldCheck, MessageSquare, SlidersHorizontal, Trash2 } from 'lucide-react';
import { APP_VERSION } from "../../../shared/constants";
import { DEFAULT_SETTINGS } from "../../../services/storage";
import { diagnosticStore, exportDiagnostics, type DiagnosticExportSnapshot } from "../../../shared/diagnostics";
import { formatPersistenceError, isOperationCancelled } from "../../../shared/messages";
import { validateSettingsPatch } from "../../../shared/payload-validation";
import type { DiagnosticStatusResult, ExportDiagnosticLogsResult } from "../../../shared/messages";
import type { AiProviderId, PluginSettings, SelectionSnapshot, TaskState } from "../../../shared/types";
import { Button, EmptyState, Field, Panel, SelectField } from "../../../ui/components/ui";
import pluginLogo from "../../../ui/assets/logo.png?inline";
import { ToolLayoutManager } from "../../../ui/components/ToolLayoutManager";
import type { SettingsView } from "../../../ui/settings";
import { renderNoFeedback } from "../../../ui/feedback";
import { ToolPageProps, PasswordField, SettingsFieldError, messageOf } from '../../../ui/pages/tool-page-shared';
const EMPTY_DIAGNOSTIC_FEEDBACK = {
    problemDescription: '',
    expectedResult: '',
    actualResult: '',
    reproductionSteps: ''
};
const FEEDBACK_CONTACT = {
    wechat: 'GoldM0535',
    email: 'wenbinailab@gmail.com'
} as const;
type SettingsSaveFailure = {
    source: 'settings';
    message: string;
    patch: Partial<PluginSettings>;
    retryable: boolean;
} | {
    source: 'diagnostics';
    message: string;
    detailedEnabled: boolean;
};
const SETTINGS_FIELD_LABELS: Partial<Record<keyof PluginSettings, string>> = {
    apiBaseUrl: 'API Base URL',
    apiKey: 'API Key',
    customImageServiceUrl: '自定义抠图服务地址',
    removeBgApiKey: 'remove.bg API Key',
    cutoutProvider: '默认抠图服务',
    themeMode: '主题模式',
};
function isInvalidSettingsPayload(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && (error as {
        code?: unknown;
    }).code === 'INVALID_PAYLOAD');
}
function settingsValidationField(error: unknown): keyof PluginSettings | undefined {
    if (!isInvalidSettingsPayload(error))
        return undefined;
    const field = (error as {
        field?: unknown;
    }).field;
    return typeof field === 'string' && Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, field)
        ? field as keyof PluginSettings
        : undefined;
}
function settingsValidationDetail(error: unknown): string {
    const detail = error && typeof error === 'object' ? (error as {
        detail?: unknown;
    }).detail : undefined;
    return typeof detail === 'string' && detail.trim()
        ? detail
        : '保存内容无效，请检查标注字段后重试';
}
function settingsFieldLabel(field: keyof PluginSettings): string {
    return SETTINGS_FIELD_LABELS[field] ?? '设置项';
}
function formatSettingsValidationError(error: unknown, field: keyof PluginSettings | undefined): string {
    const detail = settingsValidationDetail(error);
    return field ? `${settingsFieldLabel(field)}：${detail}` : detail;
}
function canRetrySettingsSave(failure: SettingsSaveFailure): boolean {
    return failure.source === 'diagnostics' || failure.retryable;
}
function savedSettingsValueForForm<K extends keyof PluginSettings>(key: K, savedValue: PluginSettings[K], patch: Partial<PluginSettings>): PluginSettings[K] {
    const submittedValue = patch[key];
    if ((key === 'apiKey' || key === 'removeBgApiKey')
        && savedValue === '********'
        && typeof submittedValue === 'string'
        && submittedValue !== '********') {
        return submittedValue as PluginSettings[K];
    }
    return savedValue;
}
type AiServiceActionState = 'idle' | 'testing' | 'loading' | 'success' | 'error';
function normalizeSettingsView(view:SettingsView):SettingsView{return view==='ai'||view==='compress'?'main':view;}
function copyTextWithTemporaryTextarea(value: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.readOnly = true;
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        return typeof document.execCommand === 'function' && document.execCommand('copy');
    }
    catch {
        return false;
    }
    finally {
        textarea.remove();
    }
}
export default function SettingsPage({ request, selection, settings, buildId, task, setTask: rawSetTask, toast, renderFeedback = renderNoFeedback, confirm, onSettingsSaved, initialSettingsView = 'main', reloadSettings, settingsLoadError, settingsLoadState = settings ? 'success' : 'loading', goHelp, homeLayout, compactLayout, onHomeLayoutChange, onCompactLayoutChange, sessionCache, getTaskSignal }: ToolPageProps) {
    const setTask = (state: TaskState, text: string) => rawSetTask(state, text, 'parameters');
    const [form, setForm] = useState<PluginSettings | undefined>(settings);
    const latestFormRef = useRef<PluginSettings | undefined>(settings);
    const lastSavedSettingsRef = useRef<PluginSettings | undefined>(settings);
    const pendingPatchRef = useRef<Partial<PluginSettings>>({});
    const activePatchRef = useRef<Partial<PluginSettings> | undefined>(undefined);
    const failedPatchRef = useRef<Partial<PluginSettings> | undefined>(undefined);
    const saveTimerRef = useRef<number | undefined>(undefined);
    const isSavingSettingsRef = useRef(false);
    const flushAfterActiveSaveRef = useRef(false);
    const mountedRef = useRef(true);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PluginSettings, string>>>({});
    const [settingsSaveError, setSettingsSaveError] = useState<SettingsSaveFailure>();
    const [diagnosticStatus, setDiagnosticStatus] = useState<DiagnosticStatusResult>({
        detailedEnabled: false,
        entryCount: 0
    });
    const [view, setView] = useState<SettingsView>(() => normalizeSettingsView(initialSettingsView));
    const [showApiKey, setShowApiKey] = useState(false);
    const [showRemoveBgKey, setShowRemoveBgKey] = useState(false);
    const current = form ?? settings;
    useEffect(() => {
        const previousSaved = lastSavedSettingsRef.current;
        const localForm = latestFormRef.current;
        lastSavedSettingsRef.current = settings;
        if (!settings || !previousSaved || !localForm) {
            setForm(settings);
            latestFormRef.current = settings;
            return;
        }
        const next = { ...settings };
        for (const key of Object.keys(settings) as Array<keyof PluginSettings>) {
            if (!Object.is(localForm[key], previousSaved[key])) {
                Object.assign(next, { [key]: localForm[key] });
            }
        }
        latestFormRef.current = next;
        setForm(next);
    }, [settings]);
    useEffect(() => {
        const nextView = normalizeSettingsView(initialSettingsView);
        if (view !== nextView) {
            void flushPendingSettingsSave();
            setView(nextView);
        }
    }, [initialSettingsView]);
    useEffect(() => () => {
        mountedRef.current = false;
        void flushPendingSettingsSave();
    }, []);
    useEffect(() => {
        let cancelled = false;
        Promise.resolve(request<DiagnosticStatusResult>('GET_DIAGNOSTIC_STATUS'))
            .then((status) => {
            if (cancelled || !status) {
                return;
            }
            setDiagnosticStatus(status);
            diagnosticStore.setDetailedEnabled(status.detailedEnabled);
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [request]);
    useEffect(() => {
        if (view === 'main') {
            return;
        }
        diagnosticStore.recordContext({
            event: 'feature:enter',
            feature: `设置中心/${settingsViewLabel(view)}`,
            selection: summarizeDiagnosticSelection(selection)
        });
    }, [selection, view]);
    function update<K extends keyof PluginSettings>(key: K, value: PluginSettings[K]) {
        if (!current) {
            return;
        }
        const next = {
            ...(latestFormRef.current ?? current),
            [key]: value
        };
        latestFormRef.current = next;
        setForm(next);
        clearSettingsSaveFailure();
        const patch = { [key]: value } as Partial<PluginSettings>;
        const validation = validateSettingsPatch(patch);
        if (!validation.ok) {
            removePendingPatchKey(key);
            setFieldErrors((errors) => ({ ...errors, [key]: validation.detail }));
            return;
        }
        setFieldErrors((errors) => {
            const { [key]: _removed, ...remaining } = errors;
            return remaining;
        });
        if (Object.is(lastSavedSettingsRef.current?.[key], value)) {
            removePendingPatchKey(key);
            return;
        }
        pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
        scheduleSettingsSave();
    }
    function scheduleSettingsSave() {
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = undefined;
            void flushPendingSettingsSave();
        }, 450);
    }
    async function flushPendingSettingsSave() {
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = undefined;
        }
        if (!Object.keys(pendingPatchRef.current).length) {
            return;
        }
        if (isSavingSettingsRef.current) {
            flushAfterActiveSaveRef.current = true;
            return;
        }
        const patch = pendingPatchRef.current;
        pendingPatchRef.current = {};
        await flushSettingsPatch(patch);
    }
    async function flushSettingsPatch(patch: Partial<PluginSettings>) {
        if (isSavingSettingsRef.current) {
            pendingPatchRef.current = { ...patch, ...pendingPatchRef.current };
            flushAfterActiveSaveRef.current = true;
            return;
        }
        isSavingSettingsRef.current = true;
        const activePatch = patch;
        activePatchRef.current = activePatch;
        if (mountedRef.current) {
            setTask('loading', '正在自动保存设置');
        }
        let succeeded = false;
        try {
            const data = await request<PluginSettings, Partial<PluginSettings>>('SAVE_SETTINGS', activePatch);
            lastSavedSettingsRef.current = data;
            const latest = latestFormRef.current ?? data;
            const next = { ...latest };
            for (const key of Object.keys(activePatch) as Array<keyof PluginSettings>) {
                if (Object.is(latest[key], activePatch[key])) {
                    Object.assign(next, { [key]: savedSettingsValueForForm(key, data[key], activePatch) });
                }
            }
            latestFormRef.current = next;
            if (mountedRef.current) {
                setForm(next);
            }
            onSettingsSaved(data);
            clearSettingsSaveFailure();
            succeeded = true;
            if (mountedRef.current) {
                setTask('success', '设置已自动保存');
            }
        }
        catch (error) {
            const invalidPayload = isInvalidSettingsPayload(error);
            const saved = lastSavedSettingsRef.current;
            const latest = latestFormRef.current;
            if (!invalidPayload && saved && latest) {
                const reverted = { ...latest };
                for (const key of Object.keys(activePatch) as Array<keyof PluginSettings>) {
                    if (Object.is(latest[key], activePatch[key])) {
                        Object.assign(reverted, { [key]: saved[key] });
                    }
                }
                latestFormRef.current = reverted;
                if (mountedRef.current) {
                    setForm(reverted);
                }
            }
            failedPatchRef.current = invalidPayload ? undefined : activePatch;
            if (mountedRef.current) {
                if (!isOperationCancelled(error)) {
                    const field = settingsValidationField(error);
                    const message = invalidPayload
                        ? formatSettingsValidationError(error, field)
                        : formatPersistenceError(error, '设置保存失败，内容未保存。请稍后手动重试');
                    if (field) {
                        setFieldErrors((errors) => ({ ...errors, [field]: settingsValidationDetail(error) }));
                    }
                    setSettingsSaveError({ source: 'settings', message, patch: activePatch, retryable: !invalidPayload });
                    setTask('error', message);
                }
            }
        }
        finally {
            isSavingSettingsRef.current = false;
            if (activePatchRef.current === activePatch) {
                activePatchRef.current = undefined;
            }
            const shouldFlushPending = succeeded && (flushAfterActiveSaveRef.current
                || (saveTimerRef.current === undefined && Object.keys(pendingPatchRef.current).length > 0));
            flushAfterActiveSaveRef.current = false;
            if (shouldFlushPending) {
                void flushPendingSettingsSave();
            }
        }
    }
    function removePendingPatchKey(key: keyof PluginSettings) {
        const { [key]: _removed, ...remaining } = pendingPatchRef.current;
        pendingPatchRef.current = remaining;
    }
    function clearSettingsSaveFailure() {
        failedPatchRef.current = undefined;
        if (mountedRef.current) {
            setSettingsSaveError(undefined);
        }
    }
    function retrySettingsSave() {
        const failure = settingsSaveError;
        if (!failure) {
            return;
        }
        if (failure.source === 'diagnostics') {
            void persistDetailedDiagnostics(failure.detailedEnabled);
            return;
        }
        if (!failure.retryable) {
            return;
        }
        const patch = failedPatchRef.current ?? failure.patch;
        if (!Object.keys(patch).length) {
            return;
        }
        const validation = validateSettingsPatch(patch);
        if (!validation.ok) {
            failedPatchRef.current = undefined;
            const field = validation.field;
            if (field) {
                setFieldErrors((errors) => ({ ...errors, [field]: validation.detail }));
            }
            const message = field
                ? `${settingsFieldLabel(field)}：${validation.detail}`
                : '保存内容无效，请检查标注字段后重试';
            setSettingsSaveError({ source: 'settings', message, patch, retryable: false });
            setTask('error', message);
            return;
        }
        const latest = latestFormRef.current;
        if (latest) {
            const next = { ...latest, ...patch };
            latestFormRef.current = next;
            setForm(next);
        }
        setSettingsSaveError(undefined);
        void flushSettingsPatch(patch);
    }
    function navigateSettingsView(nextView: SettingsView) {
        void flushPendingSettingsSave();
        setView(normalizeSettingsView(nextView));
    }
    async function copyFeedbackContact(label: string, value: string) {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                toast(`${label}已复制`, 'parameters', 'success');
                return;
            }
        }
        catch {
            // Figma's sandboxed iframe can deny clipboard access. Use the local selection fallback below.
        }
        const copied = copyTextWithTemporaryTextarea(value);
        toast(copied ? `${label}已复制` : '复制失败，请手动复制', 'parameters', copied ? 'success' : 'error');
    }
    function clearCache() {
        confirm({
            title: '确认清除缓存',
            summary: '仅清除插件缓存，保留设置和历史记录。',
            confirmText: '清除缓存',
            tone: 'danger',
            onConfirm: async () => {
                setTask('loading', '正在清除缓存');
                try {
                    await request('CLEAR_CACHE', { scope: 'cache', confirmed: true });
                    setTask('success', '缓存已清除');
                    toast('缓存已清除', 'parameters', 'success');
                }
                catch (error) {
                    if (!isOperationCancelled(error))
                        setTask('error', formatPersistenceError(error, '缓存清除失败，请稍后手动重试'));
                }
            }
        });
    }
    function clearReplaceHistory() {
        confirm({
            title: '确认清除替换记录',
            summary: '将清除字体、字号和颜色替换记录。',
            confirmText: '清除记录',
            tone: 'danger',
            onConfirm: async () => {
                setTask('loading', '正在清除替换记录');
                try {
                    await request('CLEAR_FIND_REPLACE_HISTORY', { confirmed: true });
                    setTask('success', '替换记录已清除');
                    toast('替换记录已清除', 'parameters', 'success');
                }
                catch (error) {
                    if (!isOperationCancelled(error))
                        setTask('error', formatPersistenceError(error, '替换记录清除失败，请稍后手动重试'));
                }
            }
        });
    }
    async function toggleDetailedDiagnostics(enabled: boolean) {
        clearSettingsSaveFailure();
        await persistDetailedDiagnostics(enabled);
    }
    async function persistDetailedDiagnostics(enabled: boolean) {
        const previous = diagnosticStatus.detailedEnabled;
        setDiagnosticStatus((old) => ({ ...old, detailedEnabled: enabled }));
        diagnosticStore.setDetailedEnabled(enabled);
        try {
            const status = await request<DiagnosticStatusResult, {
                detailedEnabled: boolean;
            }>('SAVE_DIAGNOSTIC_SETTINGS', {
                detailedEnabled: enabled
            });
            setDiagnosticStatus(status);
            diagnosticStore.setDetailedEnabled(status.detailedEnabled);
            clearSettingsSaveFailure();
            toast(enabled ? '详细诊断模式已开启' : '详细诊断模式已关闭', 'parameters', 'success');
        }
        catch (error) {
            setDiagnosticStatus((old) => ({ ...old, detailedEnabled: previous }));
            diagnosticStore.setDetailedEnabled(previous);
            if (!isOperationCancelled(error)) {
                const message = formatPersistenceError(error, '详细诊断设置保存失败，内容未保存。请稍后手动重试');
                setSettingsSaveError({ source: 'diagnostics', message, detailedEnabled: enabled });
                setTask('error', message);
            }
        }
    }
    async function exportLogs() {
        setTask('loading', '正在导出诊断日志');
        try {
            const mainSnapshot = await request<ExportDiagnosticLogsResult>('EXPORT_DIAGNOSTIC_LOGS');
            const snapshot = mergeDiagnosticSnapshots(mainSnapshot, current, EMPTY_DIAGNOSTIC_FEEDBACK, selection);
            downloadDiagnosticSnapshot(snapshot);
            setDiagnosticStatus((old) => ({ ...old, entryCount: snapshot.entries.length }));
            setTask('success', `诊断日志已导出，共 ${snapshot.entries.length} 条`);
            toast('诊断日志已导出，请将文件和问题描述一起反馈。', 'parameters', 'success');
        }
        catch (error) {
            if (!isOperationCancelled(error))
                setTask('error', messageOf(error));
        }
    }
    function clearLogs() {
        confirm({
            title: '确认清空诊断日志',
            summary: '将清空本地诊断日志。',
            confirmText: '确认清空',
            tone: 'danger',
            onConfirm: async () => {
                setTask('loading', '正在清空诊断日志');
                try {
                    diagnosticStore.clear();
                    const status = await request<DiagnosticStatusResult, {
                        confirmed: boolean;
                    }>('CLEAR_DIAGNOSTIC_LOGS', {
                        confirmed: true
                    });
                    setDiagnosticStatus(status);
                    setTask('success', '诊断日志已清空');
                }
                catch (error) {
                    if (!isOperationCancelled(error))
                        setTask('error', messageOf(error));
                }
            }
        });
    }
    if (!current) {
        if (settingsLoadState === 'error') {
            return (<div className="page settings-load-error">
          <EmptyState title={settingsLoadError === '当前未连接 Figma' ? '当前未连接 Figma' : '设置读取失败'} detail={settingsLoadError ?? '无法读取插件设置。'}/>
          <div className="actions center">
            <Button onClick={() => void reloadSettings?.()}>重新读取</Button>
            <Button variant="primary" onClick={goHelp}>查看帮助</Button>
          </div>
        </div>);
        }
        return <div className="page"><EmptyState title="正在读取设置" detail="请稍候。"/></div>;
    }
    return (<div className="page settings-page" onBlur={() => void flushPendingSettingsSave()}>
      {settingsSaveError ? (<section className="settings-save-error" role="alert">
          <div>
            <strong>{settingsSaveError.source === 'diagnostics' ? '详细诊断未保存' : '设置未保存'}</strong>
            <p>{settingsSaveError.message}</p>
          </div>
          <div className="settings-save-error-actions">
            {canRetrySettingsSave(settingsSaveError) ? <Button onClick={retrySettingsSave}>重试保存</Button> : null}
            <Button onClick={clearSettingsSaveFailure} variant="secondary">关闭</Button>
          </div>
        </section>) : null}
      {renderFeedback('parameters')}
      {view === 'main' ? (<>
          <section className="panel settings-list-panel" aria-label="设置中心">
            <div className="settings-list" aria-label="设置中心入口">
              <SettingsListButton icon={SlidersHorizontal} title="常规设置" description="紧凑工具栏文字与默认、紧凑模式布局" onClick={() => navigateSettingsView('general')}/>
              <SettingsListButton icon={Eraser} title="一键抠图配置" description="抠图服务、API 配置与图片上传许可" onClick={() => navigateSettingsView('cutout')}/>
              <SettingsListButton icon={ShieldCheck} title="隐私与数据" description="本地处理、联网服务与数据记录" onClick={() => navigateSettingsView('privacy')}/>
              <SettingsListButton icon={FileText} title="诊断日志" description={diagnosticStatus.detailedEnabled ? `详细诊断已开启，当前 ${diagnosticStatus.entryCount} 条` : `默认仅记录错误，当前 ${diagnosticStatus.entryCount} 条`} onClick={() => navigateSettingsView('diagnostics')}/>
              <SettingsListButton icon={MessageSquare} title="问题反馈" description="微信、GitHub、X 与邮箱" onClick={() => navigateSettingsView('feedback')}/>
              <SettingsListButton danger icon={Trash2} title="清除缓存" description="仅清除缓存，不影响已保存的服务凭证或诊断日志" onClick={clearCache}/>
              <SettingsListButton icon={CircleHelp} title="使用帮助" description="查看使用步骤、状态说明和隐私边界" onClick={() => goHelp?.()}/>
              <SettingsListButton icon={Info} title="版本号" description={`DesignProMAX Figma 插件 v${APP_VERSION}`} onClick={() => navigateSettingsView('version')}/>
            </div>
          </section>
        </>) : null}

      {view === 'general' ? (<SettingsSubPage title="常规设置" onBack={() => navigateSettingsView('main')}><Panel title="语言"><LanguagePicker/></Panel>
          <Panel title="主题模式">
            <SelectField label="主题模式" value={current.themeMode} onChange={(event) => update('themeMode', event.target.value as PluginSettings['themeMode'])}>
              <option value="system">跟随 Figma</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </SelectField>
            <p className="field-hint">顶部按钮切换为手动主题，可在这里恢复跟随 Figma。</p>
          </Panel>
          <Panel title="紧凑工具栏">
            <label className="checkline">
              <input type="checkbox" checked={current.compactToolLabelsVisible} onChange={(event) => update('compactToolLabelsVisible', event.target.checked)}/>
              显示紧凑工具栏功能文字
            </label>
            <p className="field-hint">关闭后仅显示功能图标，紧凑窗口会自动收缩为更小高度。</p>
          </Panel>
          <Panel title="布局管理">
            <div className="settings-layout-action-grid">
              <section className="settings-layout-action-card">
                <div>
                  <strong>默认模式布局</strong>
                  <p>调整首页功能卡片的顺序和显示范围。</p>
                </div>
                <Button onClick={() => navigateSettingsView('defaultLayout')} size="compact">管理默认模式</Button>
              </section>
              <section className="settings-layout-action-card">
                <div>
                  <strong>紧凑模式布局</strong>
                  <p>调整紧凑工具栏快捷功能的顺序和显示范围。</p>
                </div>
                <Button onClick={() => navigateSettingsView('compactLayout')} size="compact">管理紧凑模式</Button>
              </section>
            </div>
          </Panel>
        </SettingsSubPage>) : null}

      {view === 'defaultLayout' ? (<SettingsSubPage title="默认模式布局" onBack={() => navigateSettingsView('general')}>
          {homeLayout && onHomeLayoutChange ? (<ToolLayoutManager layout={homeLayout} mode="default" onLayoutChange={onHomeLayoutChange}/>) : (<EmptyState title="默认模式布局暂不可用" detail="请返回后重新读取设置，确认插件已连接 Figma。"/>)}
        </SettingsSubPage>) : null}

      {view === 'compactLayout' ? (<SettingsSubPage title="紧凑模式布局" onBack={() => navigateSettingsView('general')}>
          {compactLayout && onCompactLayoutChange ? (<ToolLayoutManager layout={compactLayout} mode="compact" onLayoutChange={onCompactLayoutChange}/>) : (<EmptyState title="紧凑模式布局暂不可用" detail="请返回后重新读取设置，确认插件已连接 Figma。"/>)}
        </SettingsSubPage>) : null}

      {null}

      {view === 'cutout' ? (<SettingsSubPage title="一键抠图配置" onBack={() => navigateSettingsView('main')}>
        <Panel title="一键抠图配置">
          <SelectField label="默认抠图服务" value={current.cutoutProvider} placeholder="请选择默认抠图服务" onChange={(event) => update('cutoutProvider', event.target.value as PluginSettings['cutoutProvider'])}>
            <option value="removebg">remove.bg API</option>
            <option value="custom">自定义抠图 API</option>
          </SelectField>
          <SettingsFieldError message={fieldErrors.cutoutProvider}/>
          <PasswordField label="remove.bg API Key" value={current.removeBgApiKey} visible={showRemoveBgKey} onToggle={() => setShowRemoveBgKey((visible) => !visible)} onChange={(value) => update('removeBgApiKey', value)} placeholder="请输入 remove.bg API Key" error={fieldErrors.removeBgApiKey}/>
          {current.cutoutProvider==='custom'?<PasswordField label="自定义服务 API Key" value={current.apiKey} visible={showApiKey} onToggle={()=>setShowApiKey(v=>!v)} onChange={value=>update('apiKey',value)} placeholder="请输入自定义服务 API Key"/>:null}<Field label="自定义抠图服务地址">
            <input aria-invalid={fieldErrors.customImageServiceUrl ? true : undefined} value={current.customImageServiceUrl} onChange={(event) => update('customImageServiceUrl', event.target.value)} placeholder="请输入自定义抠图服务地址"/>
            <SettingsFieldError message={fieldErrors.customImageServiceUrl}/>
          </Field>
          <p className="field-hint">外部抠图服务可能收费，只有主动处理时才上传选中图片。密钥保存在本地客户端中，不加密。</p><label className="checkline"><input type="checkbox" checked={current.allowImageUpload} onChange={(event) => update('allowImageUpload', event.target.checked)}/> 允许上传选中图片</label>
        </Panel>
        </SettingsSubPage>) : null}

      {null}

      {view === 'diagnostics' ? (<SettingsSubPage title="诊断日志" onBack={() => navigateSettingsView('main')}>
          <Panel title="诊断日志">
        <div className="diagnostic-log-row">
          <p className="diagnostic-log-description">
              日志仅保存在本地，导出前会自动隐藏密钥和图片内容。当前记录 {diagnosticStatus.entryCount} 条。
          </p>
          <div className="diagnostic-log-actions">
            <label className="checkline diagnostic-toggle">
              <input type="checkbox" checked={diagnosticStatus.detailedEnabled} onChange={(event) => void toggleDetailedDiagnostics(event.target.checked)}/>
              详细诊断模式
            </label>
            <div className="diagnostic-log-buttons">
              <Button onClick={() => void exportLogs()}>导出日志</Button>
              <Button variant="danger" onClick={clearLogs}>清空日志</Button>
            </div>
          </div>
        </div>
      </Panel>
        </SettingsSubPage>) : null}

      {view === 'privacy' ? (<SettingsSubPage title="隐私与数据" onBack={() => navigateSettingsView('main')}>
          <Panel title="替换记录">
            <div className="replace-history-settings">
              <label className="checkline">
                <input type="checkbox" checked={current.saveReplaceHistory} onChange={(event) => update('saveReplaceHistory', event.target.checked)}/>
                保存最近使用的替换
              </label>
              <p>只记录字体、字号和颜色，方便下次使用；不会保存文字内容或设计文件。</p>
              <Button variant="danger" onClick={clearReplaceHistory}>清除记录</Button>
            </div>
          </Panel>
          <Panel title="数据使用">
            <div className="privacy-note-list">
              <PrivacyNote title="本地使用" detail="裁剪、分割、文字处理、清理和尺寸适配在本地完成，不上传设计文件。"/>
              <PrivacyNote title="本地 OCR" detail="本地 OCR 不上传图片或识别文字。"/>
              <PrivacyNote title="在线抠图" detail="在线抠图只处理你选中的图片。"/>
            </div>
          </Panel>
          <Panel title="本地设置">
            <div className="privacy-note-list">
              <PrivacyNote title="服务配置" detail="服务地址和密钥保存在当前 Figma 客户端。密钥仅以掩码显示。"/>
              <PrivacyNote title="记录与排查" detail="插件不保存提示词和生成图片历史。问题排查记录只保存在本地，导出时会自动隐藏密钥和图片内容。"/>
            </div>
          </Panel>
        </SettingsSubPage>) : null}

      {view === 'feedback' ? (<SettingsSubPage title="问题反馈" onBack={() => navigateSettingsView('main')}>
          <section className="feedback-intro" aria-labelledby="feedback-support-title">
            <span className="feedback-intro-icon" aria-hidden="true"><MessageCircle size={20}/></span>
            <div>
              <h2 id="feedback-support-title">联系与支持</h2>
              <p>遇到问题或有功能建议？欢迎通过以下方式联系我。</p>
            </div>
          </section>
          <Panel title="反馈渠道">
            <div className="feedback-contact-grid">
              <section className="feedback-contact-card feedback-contact-card-wechat" aria-labelledby="feedback-wechat-title">
                <div className="feedback-contact-main">
                  <span className="feedback-contact-icon feedback-contact-icon-wechat" aria-hidden="true"><MessageCircle size={18}/></span>
                  <div className="feedback-contact-copy">
                    <span className="feedback-contact-label" id="feedback-wechat-title">微信反馈</span>
                    <strong className="feedback-contact-value">{FEEDBACK_CONTACT.wechat}</strong>
                  </div>
                </div>
                <div className="feedback-contact-actions">
                  <Button ariaLabel="复制反馈微信号" onClick={() => void copyFeedbackContact('微信号', FEEDBACK_CONTACT.wechat)} size="compact">
                    <Clipboard aria-hidden="true" size={15}/>
                    <span>复制微信号</span>
                  </Button>
                </div>

              </section>

              <section className="feedback-contact-card"><div className="feedback-contact-main"><span className="feedback-contact-icon"><Github size={18}/></span><div className="feedback-contact-copy"><span className="feedback-contact-label">GitHub</span><strong className="feedback-contact-value">BeatsAD</strong></div></div><div className="feedback-contact-actions"><a className="btn secondary compact" href={LINKS.github} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={15}/><span>打开主页</span></a></div></section>
<section className="feedback-contact-card"><div className="feedback-contact-main"><span className="feedback-contact-icon">𝕏</span><div className="feedback-contact-copy"><span className="feedback-contact-label">X</span><strong className="feedback-contact-value">@WenBin8nk</strong></div></div><div className="feedback-contact-actions"><a className="btn secondary compact" href={LINKS.x} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={15}/><span>打开主页</span></a></div></section>
<section className="feedback-contact-card feedback-contact-card-email" aria-labelledby="feedback-email-title">
                <div className="feedback-contact-main">
                  <span className="feedback-contact-icon feedback-contact-icon-email" aria-hidden="true"><Mail size={18}/></span>
                  <div className="feedback-contact-copy">
                    <span className="feedback-contact-label" id="feedback-email-title">邮件反馈</span>
                    <strong className="feedback-contact-value">{FEEDBACK_CONTACT.email}</strong>
                  </div>
                </div>
                <div className="feedback-contact-actions">
                  <Button ariaLabel="复制反馈邮箱" onClick={() => void copyFeedbackContact('邮箱', FEEDBACK_CONTACT.email)} size="compact">
                    <Clipboard aria-hidden="true" size={15}/>
                    <span>复制邮箱</span>
                  </Button>
                </div>
              </section>
            </div>
          </Panel>
        </SettingsSubPage>) : null}

      {view === 'version' ? (<SettingsSubPage title="版本号" onBack={() => navigateSettingsView('main')}>
          <Panel title="版本信息">
            <div className="version-brand">
              <img alt="" className="version-brand-logo" src={pluginLogo}/>
              <strong>DesignProMAX Toolkit</strong>
            </div>
            <div className="version-list">
              <div><span>插件版本</span><strong>v{APP_VERSION}</strong></div>
              <div><span>构建标识</span><strong title={buildId ?? '开发预览'}>{buildId ?? '开发预览'}</strong></div>
              <div><span>运行平台</span><strong>Figma 插件</strong></div>
              <div className="version-source-row">
                <span>插件开源地址</span>
                {LINKS.repository ? <a aria-label="在新窗口打开 DesignProMAX Toolkit GitHub 开源地址" className="version-source-link" href={LINKS.repository} rel="noreferrer" target="_blank" title="在新窗口打开 GitHub 开源地址">
                  <Github aria-hidden="true" size={20}/>
                </a> : <strong>待创建</strong>}
              </div>
            </div>
          </Panel>
        </SettingsSubPage>) : null}
    </div>);
}
function SettingsSubPage({ title, onBack, children }: {
    title: string;
    onBack: () => void;
    children: React.ReactNode;
}) {
    return (<div className="settings-subpage">
      <button className="settings-back" onClick={onBack} type="button">
        <ArrowLeft size={16}/>
        <span>{title === '默认模式布局' || title === '紧凑模式布局' ? '返回常规设置' : '返回设置'}</span>
      </button>
      <h1 className="settings-subpage-title">{title}</h1>
      {children}
    </div>);
}
function SettingsListButton({ icon: Icon, title, description, danger, hidden, onClick }: {
    icon: typeof Eraser;
    title: string;
    description: string;
    danger?: boolean;
    hidden?: boolean;
    onClick: () => void;
}) {
    return (<button className={`settings-list-item ${danger ? 'danger' : ''}`} hidden={hidden} onClick={onClick} type="button">
      <span className="settings-list-icon"><Icon size={18}/></span>
      <span className="settings-list-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight size={18}/>
    </button>);
}
function PrivacyNote({ title, detail }: {
    title: string;
    detail: string;
}) {
    return (<div className="privacy-note">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>);
}
function mergeDiagnosticSnapshots(mainSnapshot: DiagnosticExportSnapshot, settings: PluginSettings | undefined, feedback: {
    problemDescription: string;
    expectedResult: string;
    actualResult: string;
    reproductionSteps: string;
}, selection: SelectionSnapshot): DiagnosticExportSnapshot {
    const uiSnapshot = exportDiagnostics({
        entries: diagnosticStore.getEntries(),
        settings,
        diagnosticSettings: diagnosticStore.getSettings(),
        recentContext: diagnosticStore.getRecentContext()
    });
    const entries = [...mainSnapshot.entries, ...uiSnapshot.entries].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const recentContext = [
        ...(mainSnapshot.recentContext ?? []),
        ...(uiSnapshot.recentContext ?? []),
        {
            id: 'current-selection',
            timestamp: new Date().toISOString(),
            event: 'selection:current',
            selection: summarizeDiagnosticSelection(selection),
            version: APP_VERSION
        }
    ].sort((left, right) => left.timestamp.localeCompare(right.timestamp)).slice(-50);
    const exportedAt = new Date().toISOString();
    return {
        ...mainSnapshot,
        exportedAt,
        diagnosticSettings: uiSnapshot.diagnosticSettings,
        environment: buildDiagnosticEnvironment({
            exportedAt,
            settings,
            diagnosticSettings: uiSnapshot.diagnosticSettings,
            entryCount: entries.length
        }),
        feedbackTemplate: createDiagnosticFeedbackTemplate(feedback),
        recentContext,
        settings: uiSnapshot.settings ?? mainSnapshot.settings,
        entries
    };
}
function buildDiagnosticEnvironment({ exportedAt, settings, diagnosticSettings, entryCount }: {
    exportedAt: string;
    settings: PluginSettings | undefined;
    diagnosticSettings: DiagnosticExportSnapshot['diagnosticSettings'];
    entryCount: number;
}): NonNullable<DiagnosticExportSnapshot['environment']> {
    return {
        product: 'DesignProMAX',
        version: APP_VERSION,
        exportedAt,
        aiServiceConfigured: Boolean(settings?.apiBaseUrl),
        cutoutProvider: settings?.cutoutProvider ?? '',
        diagnosticLogCount: entryCount,
        detailedDiagnostics: diagnosticSettings.detailedEnabled,
        userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
        language: typeof navigator === 'undefined' ? undefined : navigator.language,
        platform: typeof navigator === 'undefined' ? undefined : navigator.platform,
        viewport: typeof window === 'undefined' ? undefined : {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
}
function createDiagnosticFeedbackTemplate(feedback: {
    problemDescription: string;
    expectedResult: string;
    actualResult: string;
    reproductionSteps: string;
}): NonNullable<DiagnosticExportSnapshot['feedbackTemplate']> {
    return {
        problemDescription: feedback.problemDescription.trim(),
        expectedResult: feedback.expectedResult.trim(),
        actualResult: feedback.actualResult.trim(),
        reproductionSteps: feedback.reproductionSteps
            .split('\n')
            .map((step) => step.trim())
            .filter(Boolean)
    };
}
function summarizeDiagnosticSelection(selection: SelectionSnapshot) {
    return {
        count: selection.count,
        types: selection.nodes.reduce<Record<string, number>>((counts, node) => {
            const type = node.type || 'UNKNOWN';
            counts[type] = (counts[type] ?? 0) + 1;
            return counts;
        }, {})
    };
}
function settingsViewLabel(view: SettingsView): string {
    const labels: Partial<Record<SettingsView, string>> = {
        main: '设置中心',
        general: '常规设置',
        defaultLayout: '默认模式布局',
        compactLayout: '紧凑模式布局',
        cutout: '一键抠图配置',
        privacy: '隐私与数据',
        diagnostics: '诊断日志',
        feedback: '问题反馈',
        version: '版本号'
    };
    return labels[view] ?? '设置中心';
}
function downloadDiagnosticSnapshot(snapshot: DiagnosticExportSnapshot) {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `designpromax-diagnostic-${formatDiagnosticTimestamp(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
}
function formatDiagnosticTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}
