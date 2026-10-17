import {useFigmaTheme} from '../../ui/figma-theme';
import {useCompactDockSizing} from '../useCompactDockSizing';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import type { PageId } from '../shared/constants';
import { diagnosticStore } from '../shared/diagnostics';
import { createPluginError, formatPersistenceError, isTaskControlledMessageType, type KnownMessageType } from '../shared/messages';
import type { HomeLayoutSettings, PluginSettings, TaskState } from '../shared/types';
import { normalizeHomeLayout } from '../services/storage';
import { Button, ConfirmDialog, IconButton, NoticeBar, type ConfirmDialogInput, type NoticeTone } from './components/ui';
import type { FeedbackNotifier, FeedbackRenderer, FeedbackScope } from './feedback';
import { usePluginBridge } from './hooks/usePluginBridge';
import {hasPendingWrites} from '../../ui/bridge';
import { useMessageCenter } from './hooks/useMessageCenter';
import { MessageNoticeBar } from './components/MessageNoticeBar';
import { MessageCenterDialog } from './components/MessageCenterDialog';
import './components/MessageCenter.css';
import logoSrc from './assets/logo.png?inline';
import { HomePage } from './pages/HomePage';
import { HelpPage } from './pages/HelpPage';
import { isToolVisible, toolEntries } from './toolRegistry';
import type { SettingsLoadState, SettingsView } from './settings';
import CleanupPage from '../features/cleanup/ui/CleanupPage';
import CutoutPage from '../features/remove-bg/ui/CutoutPage';
import ReplacePage from '../features/find-replace/ui/ReplacePage';
import ScalePage from '../features/scale/ui/ScalePage';
import SettingsPage from '../features/settings/ui/SettingsPage';
import StatisticsPage from '../features/design-stats/ui/StatisticsPage';
import TextFillPage from '../features/text-fill/ui/TextFillPage';
import TextRecognitionPage from '../features/text-recognition/ui/TextRecognitionPage';
import TextSplitMergePage from '../features/text-split-merge/ui/TextSplitMergePage';
import ImageSplitPage from '../features/image-split/ui/ImageSplitPage';
import TransparentCropPage from '../features/transparent-crop/ui/TransparentCropPage';

type ConfirmState = ConfirmDialogInput;

const TOAST_AUTO_DISMISS_MS = 2500;
const TASK_NOTICE_AUTO_DISMISS_MS = 4000;
const UI_MOTION_DURATION_MS = 180;
const loadMissingCompactLayout = async (): Promise<HomeLayoutSettings> => normalizeHomeLayout(undefined);

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type NoticeState = {
  id: number;
  page: PageId;
  scope: FeedbackScope;
  state: NoticeTone;
  text: string;
  dismissMs?: number;
};

type AppTaskState = {
  page: PageId;
  state: TaskState;
  text: string;
  cancellable: boolean;
};

type DockMotion = 'idle' | 'entering' | 'restoring';
type CompactPanelState = 'closed' | 'open' | 'closing';

type SharedPageProps = {
  request: ReturnType<typeof usePluginBridge>['request'];
  selection: ReturnType<typeof usePluginBridge>['selection'];
  settings?: PluginSettings;
  buildId?: string;
  task: { state: TaskState; text: string };
  setTask: (state: TaskState, text: string, scope?: FeedbackScope) => void;
  restartTask: () => void;
  toast: FeedbackNotifier;
  renderFeedback: FeedbackRenderer;
  confirm: (input: ConfirmState) => void;
  goSettings: (view?: SettingsView) => void;
  goHelp: () => void;
  initialSettingsView: SettingsView;
  reloadSettings: () => Promise<void>;
  settingsLoadError?: string;
  settingsLoadState: SettingsLoadState;
  onSettingsSaved: (settings: PluginSettings) => void;
};

const pageLabels = {
  home: '首页',
  help: '使用帮助',
  
  cutout: toolEntries.cutout.label,
  transparentCrop: toolEntries.transparentCrop.label,
  imageSplit: toolEntries.imageSplit.label,
  
  textFill: toolEntries.textFill.label,
  textRecognition: toolEntries.textRecognition.label,
  textSplitMerge: toolEntries.textSplitMerge.label,
  cleanup: toolEntries.cleanup.label,
  replace: toolEntries.replace.label,
  
  statistics: toolEntries.statistics.label,
  
  
  scale: toolEntries.scale.label,
  
  
  settings: '设置中心'
} as Record<PageId, string>;

export default function App() {
  const bridge = usePluginBridge();
  const {
    loadHomeLayout,
    loadCompactLayout: bridgeLoadCompactLayout,
    loadSettings,
    pluginSession,
    refreshSelection,
    request,
    send,
    selection
  } = bridge;
  const messageCenter = useMessageCenter(request);
  const [messageDialog, setMessageDialog] = useState<{ targetId?: string } | null>(null);
  const [messageWindowBusy, setMessageWindowBusy] = useState(false);
  const [messageWindowError, setMessageWindowError] = useState<string>();
  const messageOperationRef = useRef(false);
  const messageReturnSizeRef = useRef<{ width: number; height: number } | undefined>(undefined);
  const messageNoticeRef = useRef<HTMLButtonElement>(null);
  const restoreMessageFocusRef = useRef(false);
  const welcomeAttemptedRef = useRef(false);

  useEffect(() => {
    if (messageDialog || messageWindowBusy || !restoreMessageFocusRef.current) return;
    restoreMessageFocusRef.current = false;
    // Background inertness must be removed before restoring native focus.
    const frame = requestAnimationFrame(() => messageNoticeRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [messageDialog, messageWindowBusy]);
  const loadCompactLayout = bridgeLoadCompactLayout ?? loadMissingCompactLayout;
  const [page, setPage] = useState<PageId>('home');
  const pageRef = useRef<PageId>('home');
  const pageBeforeHelpRef = useRef<PageId>('home');
  const [settings, setSettings] = useState<PluginSettings>();
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  const [settingsLoadState, setSettingsLoadState] = useState<SettingsLoadState>('loading');
  const [settingsLoadError, setSettingsLoadError] = useState<string>();
  const [homeLayout, setHomeLayout] = useState<HomeLayoutSettings>();
  const [compactLayout, setCompactLayout] = useState<HomeLayoutSettings>();
  const compactLayoutFlight = useRef<Promise<HomeLayoutSettings> | undefined>(undefined);
  const [compactLayoutLoading, setCompactLayoutLoading] = useState(false);
  const [themePreference, setThemePreference] = useState<PluginSettings['themeMode']>('system');
  const themeMode = useFigmaTheme(themePreference);
  const [isCompactDock, setIsCompactDock] = useState(false);
  const [dockMotion, setDockMotion] = useState<DockMotion>('idle');
  const [compactFeaturePage, setCompactFeaturePage] = useState<PageId>();
  const [compactPanelState, setCompactPanelState] = useState<CompactPanelState>('closed');
  const [showCompactToolLabels, setShowCompactToolLabels] = useState(true);
  const compactDockSizeRef = useRef({ width: window.innerWidth, height: window.innerHeight });
  const compactToolStripRef = useRef<HTMLDivElement>(null);
  const dockMotionTimerRef = useRef<number | undefined>(undefined);
  const compactPanelTimerRef = useRef<number | undefined>(undefined);
  const compactPanelResizePendingRef = useRef<'opening' | 'closing' | undefined>(undefined);
  const themeTransitionTimerRef = useRef<number | undefined>(undefined);
  const [compactToolStripPosition, setCompactToolStripPosition] = useState({ atStart: true, atEnd: false });
  const [notices, setNotices] = useState<Partial<Record<FeedbackScope, NoticeState>>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const sessionCacheRef = useRef<Map<string, unknown>>(new Map());
  const taskControllerRef = useRef<AbortController | undefined>(undefined);
  const taskGenerationRef = useRef(0);
  const lastSessionIdRef = useRef<string | undefined>(undefined);
  const [task, setTaskState] = useState<AppTaskState>({
    page: 'home',
    state: 'idle',
    text: '等待操作',
    cancellable: false
  });
  const taskStateRef = useRef(task);

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.dataset.pluginUiMounted = 'true';
    window.dispatchEvent(new Event('designpromax:ui-ready'));
    send('UI_READY');
    diagnosticStore.recordContext({
      event: 'app:startup-package',
      result: 'success',
      data: {
        htmlBytes: readBuiltHtmlBytes(),
        url: window.location.href
      }
    });
    diagnosticStore.recordContext({
      event: 'app:mounted',
      result: 'success',
      durationMs: Math.round(performance.now())
    });
    // Two animation frames give the initial UI a paint opportunity. This is
    // measured from iframe navigation, not from the user's host menu click.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        diagnosticStore.recordContext({
          event: 'app:first-paint-opportunity',
          result: 'success',
          durationMs: Math.round(performance.now())
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const startedAt = performance.now();
    void Promise.allSettled([
      refreshSelection(), reloadSettings(), loadHomeLayout().then(setHomeLayout)
    ]).then((results) => diagnosticStore.recordContext({
      event: 'app:initialization-settled', result: results.every((item) => item.status === 'fulfilled') ? 'success' : 'error',
      durationMs: Math.round(performance.now() - startedAt)
    }));
  }, [loadHomeLayout, refreshSelection]);

  const ensureCompactLayout = useCallback(() => {
    if (compactLayout) return Promise.resolve(compactLayout);
    if (compactLayoutFlight.current) return compactLayoutFlight.current;
    const flight = loadCompactLayout().then((layout) => { setCompactLayout(layout); return layout; });
    compactLayoutFlight.current = flight;
    void flight.finally(() => { if (compactLayoutFlight.current === flight) compactLayoutFlight.current = undefined; }).catch(() => undefined);
    return flight;
  }, [compactLayout, loadCompactLayout]);
  useEffect(() => {
    if (page === 'settings') void ensureCompactLayout().catch(() => undefined);
  }, [page, ensureCompactLayout]);

  useEffect(() => {
    setThemePreference(settings?.themeMode ?? 'system');
  }, [settings?.themeMode]);

  useEffect(() => {
    setShowCompactToolLabels(settings?.compactToolLabelsVisible ?? true);
  }, [settings?.compactToolLabelsVisible]);

  const compactToolEntries = useMemo(() => {
    const normalizedLayout = normalizeHomeLayout(compactLayout);
    const hiddenPageIds = new Set(normalizedLayout.hiddenPageIds);
    return normalizedLayout.orderedPageIds
      .filter((pageId) => isToolVisible(pageId) && !hiddenPageIds.has(pageId))
      .map((pageId) => toolEntries[pageId]);
  }, [compactLayout]);
  const selectionFeedbackKey = `${selection.count}:${selection.nodes.map((node) => node.id).join('|')}`;

  useEffect(() => {
    if (!compactFeaturePage || compactToolEntries.some((tool) => tool.page === compactFeaturePage)) {
      return;
    }
    setCompactFeaturePage(undefined);
    setCompactPanelState('closed');
  }, [compactFeaturePage, compactToolEntries]);

  const {topbarRef,toolbarRef,getHeight:getCompactDockHeight} = useCompactDockSizing({
    active:isCompactDock && compactPanelState === 'closed' && !messageDialog && !messageWindowBusy,
    showLabels:showCompactToolLabels,
    sizeRef:compactDockSizeRef,
    busyRef:compactPanelResizePendingRef,
    send
  });

  useEffect(() => () => {
    if (dockMotionTimerRef.current !== undefined) {
      window.clearTimeout(dockMotionTimerRef.current);
    }
    if (compactPanelTimerRef.current !== undefined) {
      window.clearTimeout(compactPanelTimerRef.current);
    }
    if (themeTransitionTimerRef.current !== undefined) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }
    document.documentElement.classList.remove('theme-transition');
  }, []);

  useEffect(() => {
    if (!isCompactDock) {
      return undefined;
    }

    const strip = compactToolStripRef.current;
    if (!strip) {
      return undefined;
    }
    const syncPosition = () => {
      const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
      setCompactToolStripPosition({
        atStart: strip.scrollLeft <= 1,
        atEnd: strip.scrollLeft >= maxScrollLeft - 1
      });
    };

    syncPosition();
    strip.addEventListener('scroll', syncPosition, { passive: true });
    window.addEventListener('resize', syncPosition);
    return () => {
      strip.removeEventListener('scroll', syncPosition);
      window.removeEventListener('resize', syncPosition);
    };
  }, [isCompactDock, showCompactToolLabels]);


  useEffect(() => {
    diagnosticStore.recordContext({
      event: 'feature:enter',
      feature: getPageLabel(page)
    });
  }, [page]);

  const clearFeedback = useCallback((scope: FeedbackScope) => {
    setNotices((current) => {
      if (!current[scope]) return current;
      const next = { ...current };
      delete next[scope];
      return next;
    });
  }, []);

  const publishFeedback = useCallback((scope: FeedbackScope, state: NoticeTone, text: string, dismissMs?: number) => {
    const currentPage = pageRef.current;
    setNotices((current) => {
      const previous = current[scope];
      const id = state === 'loading' && previous?.page === currentPage && previous.state === 'loading'
        ? previous.id
        : (previous?.id ?? 0) + 1;
      return {
        ...current,
        [scope]: { id, page: currentPage, scope, state, text, dismissMs }
      };
    });
  }, []);

  useEffect(() => {
    clearFeedback('selection');
  }, [clearFeedback, selectionFeedbackKey]);

  useEffect(() => {
    const timers = (Object.entries(notices) as Array<[FeedbackScope, NoticeState | undefined]>)
      .flatMap(([scope, notice]) => {
        if (!notice?.dismissMs) return [];
        return [window.setTimeout(() => {
          setNotices((current) => current[scope]?.id === notice.id
            ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== scope))
            : current);
        }, notice.dismissMs)];
      });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [notices]);

  const controlledRequest = useCallback(<TData, TPayload = unknown>(type: KnownMessageType, payload?: TPayload, options?: { signal?: AbortSignal; deferCancellation?: boolean }): Promise<TData> => {
    const controlled = isTaskControlledMessageType(type);
    const generation = taskGenerationRef.current;
    const signal = options?.deferCancellation ? undefined : options?.signal ?? taskControllerRef.current?.signal;
    if (controlled && taskControllerRef.current && taskStateRef.current.state === 'loading') {
      const nextTask = { ...taskStateRef.current, cancellable: true };
      taskStateRef.current = nextTask;
      setTaskState(nextTask);
    }
    return request<TData, TPayload>(type, payload, signal ? {
      signal,
      onProgress: controlled ? ({ text }) => {
        if (generation !== taskGenerationRef.current || taskControllerRef.current?.signal.aborted) {
          return;
        }
        const currentPage = pageRef.current;
        const nextTask = { page: currentPage, state: 'loading' as TaskState, text, cancellable: true };
        taskStateRef.current = nextTask;
        setTaskState(nextTask);
        publishFeedback('result', 'loading', text);
      } : undefined
    } : undefined).then(data=>{
      if(controlled && generation!==taskGenerationRef.current)throw createPluginError('OPERATION_CANCELLED','操作已取消');
      return data;
    });
  }, [publishFeedback, request]);

  const updateTask = useCallback((state: TaskState, text: string, scope: FeedbackScope = 'result') => {
    const currentTask = taskStateRef.current;
    if (currentTask.state === 'cancelled' && state !== 'loading' && state !== 'cancelled') {
      return;
    }
    if (state === 'loading' && !taskControllerRef.current) {
      taskGenerationRef.current += 1;
      taskControllerRef.current = new AbortController();
    } else if (state !== 'loading') {
      taskControllerRef.current = undefined;
    }
    const currentPage = pageRef.current;
    const nextTask = {
      page: currentPage,
      state,
      text,
      cancellable: state === 'loading' ? currentTask.cancellable : false
    };
    taskStateRef.current = nextTask;
    setTaskState(nextTask);
    if (state === 'idle') {
      clearFeedback(scope);
      return;
    }
    publishFeedback(scope, state, text, state === 'success' || state === 'cancelled' ? TASK_NOTICE_AUTO_DISMISS_MS : undefined);
  }, [clearFeedback, publishFeedback]);

  const restartTask = useCallback(() => {
    taskGenerationRef.current += 1;
    taskControllerRef.current?.abort();
    taskControllerRef.current = undefined;
  }, []);

  const getTaskSignal = useCallback(() => taskControllerRef.current?.signal, []);

  const retireTask = useCallback((targetPage: PageId = pageRef.current) => {
    taskGenerationRef.current += 1;
    taskControllerRef.current?.abort();
    taskControllerRef.current = undefined;
    clearBinarySessionCache(sessionCacheRef.current);
    setNotices({});
    setConfirm(null);
    const nextTask = { page: targetPage, state: 'idle' as TaskState, text: '等待操作', cancellable: false };
    taskStateRef.current = nextTask;
    setTaskState(nextTask);
  }, []);

  const navigateToPage = useCallback((nextPage: PageId) => {
    const targetPage = nextPage === 'ai' ? 'home' : nextPage;
    if (targetPage === pageRef.current) {
      return;
    }
    retireTask(targetPage);
    pageRef.current = targetPage;
    setPage(targetPage);
  }, [retireTask]);

  const renderFeedback = useCallback<FeedbackRenderer>((scope) => {
    const notice = notices[scope];
    if (!notice || notice.page !== page) {
      return null;
    }
    const isCancellableTask = scope === 'result' && notice.state === 'loading' && task.cancellable;
    return (
      <div className={`feedback-slot feedback-slot-${scope}`}>
        <NoticeBar
          key={notice.id}
          state={notice.state}
          text={notice.text}
          onClose={notice.state === 'loading' ? undefined : () => clearFeedback(scope)}
          actionLabel={isCancellableTask ? '取消任务' : undefined}
          onAction={isCancellableTask ? cancelCurrentTask : undefined}
        />
      </div>
    );
  }, [clearFeedback, notices, page, task.cancellable]);

  useEffect(() => {
    const previousSessionId = lastSessionIdRef.current;
    lastSessionIdRef.current = pluginSession?.sessionId;
    if (pluginSession) {
      diagnosticStore.recordContext({
        event: 'app:plugin-session',
        result: 'success',
        data: pluginSession
      });
    }
    if (previousSessionId && pluginSession?.sessionId && previousSessionId !== pluginSession.sessionId) {
      clearAiServiceSessionCredentials(sessionCacheRef.current);
      retireTask();
      void refreshSelection().catch(() => undefined);
    }
  }, [pluginSession?.sessionId, refreshSelection, retireTask]);

  useEffect(() => {
    const onPageHide = () => {
      clearAiServiceSessionCredentials(sessionCacheRef.current);
      retireTask();
    };
    const onPageShow = () => {
      clearAiServiceSessionCredentials(sessionCacheRef.current);
      retireTask();
      void refreshSelection().catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearAiServiceSessionCredentials(sessionCacheRef.current);
        retireTask();
        return;
      }
      void refreshSelection().catch(() => undefined);
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshSelection, retireTask]);

  const sharedProps = useMemo(
    () => ({
      request: controlledRequest,
      selection,
      settings,
      buildId: pluginSession?.buildId,
      task: { state: 'idle' as TaskState, text: '等待操作' },
      setTask: updateTask,
      restartTask,
      toast: (text: string, scope: FeedbackScope = 'global', tone: NoticeTone = 'error') => {
        publishFeedback(scope, tone, text, tone === 'success' || tone === 'info' ? TOAST_AUTO_DISMISS_MS : undefined);
      },
      renderFeedback,
      confirm: (input: ConfirmState) => setConfirm(input),
      goSettings: (view: SettingsView = 'main') => {
        if (isCompactDock) {
          restoreCompactDock();
        }
        setSettingsView(view === 'ai' ? 'main' : view);
        navigateToPage('settings');
      },
      goHelp: () => {
        if (page !== 'help') {
          pageBeforeHelpRef.current = page;
        }
        navigateToPage('help');
      },
      initialSettingsView: settingsView,
      reloadSettings,
      settingsLoadError,
      settingsLoadState,
      onSettingsSaved: (nextSettings: PluginSettings) => setSettings(nextSettings),
      sessionCache: sessionCacheRef.current,
      getTaskSignal
    }),
    [controlledRequest, getTaskSignal, isCompactDock, navigateToPage, page, pluginSession?.buildId, publishFeedback, renderFeedback, restartTask, selection, settings, settingsLoadError, settingsLoadState, settingsView, updateTask]
  );
  const nextThemeMode: 'light' | 'dark' = themeMode === 'dark' ? 'light' : 'dark';
  const ThemeToggleIcon = themeMode === 'dark' ? Sun : Moon;
  const themeToggleLabel = nextThemeMode === 'dark' ? '切换为深色风格' : '切换为浅色风格';
  const minimizeToggleLabel = isCompactDock ? '展开插件窗口' : '最小化插件窗口';
  const MinimizeToggleIcon = isCompactDock ? Maximize2 : Minimize2;

  function cancelCurrentTask() {
    if (taskStateRef.current.state === 'cancelled') {
      return;
    }
    const waitingForWrite = hasPendingWrites();
    if (!waitingForWrite) taskGenerationRef.current += 1;
    taskControllerRef.current?.abort();
    if (!waitingForWrite) taskControllerRef.current = undefined;
    const currentPage = pageRef.current;
    const text = waitingForWrite ? '正在取消，请等待执行结果' : '任务已取消';
    const nextTask = { page: currentPage, state: (waitingForWrite ? 'loading' : 'cancelled') as TaskState, text, cancellable: false };
    taskStateRef.current = nextTask;
    setTaskState(nextTask);
    publishFeedback('result', waitingForWrite ? 'loading' : 'cancelled', text, waitingForWrite ? undefined : TASK_NOTICE_AUTO_DISMISS_MS);
  }

  useEffect(() => {
    const settled = (event: Event) => {
      if (!taskControllerRef.current?.signal.aborted) return;
      const {data,error} = (event as CustomEvent).detail;
      const cancelled = error?.code === 'OPERATION_CANCELLED' || data?.cancelled;
      const state: TaskState = error && !cancelled ? 'error' : cancelled ? 'cancelled' : 'success';
      const text = error ? error.message : data?.message ?? `已插入 ${data?.items?.filter((item: {nodeId?:string})=>item.nodeId).length ?? 0} 张`;
      taskControllerRef.current = undefined;
      const next = {page:pageRef.current,state,text,cancellable:false};
      taskStateRef.current=next;setTaskState(next);publishFeedback('result',state,text);
    };
    window.addEventListener('toolkit-write-settled',settled);
    return () => {window.removeEventListener('toolkit-write-settled',settled);};
  },[publishFeedback]);

  function returnHome() {
    restoreCompactDock();
    navigateToPage('home');
  }

  function openSettingsCenter() {
    restoreCompactDock();
    setSettingsView('main');
    navigateToPage('settings');
  }

  function startDockMotion(nextMotion: Exclude<DockMotion, 'idle'>) {
    if (dockMotionTimerRef.current !== undefined) {
      window.clearTimeout(dockMotionTimerRef.current);
    }
    setDockMotion(nextMotion);
    dockMotionTimerRef.current = window.setTimeout(() => {
      setDockMotion('idle');
      dockMotionTimerRef.current = undefined;
    }, UI_MOTION_DURATION_MS);
  }

  function startThemeTransition() {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    if (themeTransitionTimerRef.current !== undefined) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }
    themeTransitionTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transition');
      themeTransitionTimerRef.current = undefined;
    }, UI_MOTION_DURATION_MS);
  }

  useEffect(() => {
    if (welcomeAttemptedRef.current || messageCenter.welcomeStatus !== 'pending' || !messageCenter.welcomeMessage
      || messageDialog || messageWindowBusy || confirm || isCompactDock || page !== 'home'
      || settingsLoadState === 'loading' || task.state === 'loading') return;
    welcomeAttemptedRef.current = true;
    setMessageDialog({ targetId: messageCenter.welcomeMessage.id });
  }, [messageCenter.welcomeStatus, messageCenter.welcomeMessage, messageDialog, messageWindowBusy,
    confirm, isCompactDock, page, settingsLoadState, task.state]);

  async function openMessageCenter() {
    if (confirm || messageDialog || messageOperationRef.current || compactPanelResizePendingRef.current || compactPanelState === 'closing') return;
    messageOperationRef.current = true;
    setMessageWindowBusy(true);
    setMessageWindowError(undefined);
    try {
      if (isCompactDock && compactPanelState === 'closed') {
        const previousSize = { width: window.innerWidth, height: getCompactDockHeight() };
        await request('RESIZE_UI', compactDockSizeRef.current);
        messageReturnSizeRef.current = previousSize;
      }
      setMessageDialog({ targetId: messageCenter.notice?.id });
      welcomeAttemptedRef.current = true;
    } catch {
      setMessageWindowError('消息窗口展开失败，请点击通知栏重试');
    } finally {
      messageOperationRef.current = false;
      setMessageWindowBusy(false);
    }
  }

  async function closeMessageCenter() {
    if (messageOperationRef.current) return;
    messageOperationRef.current = true;
    setMessageWindowBusy(true);
    setMessageWindowError(undefined);
    let acknowledged = false;
    try {
      await messageCenter.acknowledgeWelcome();
      acknowledged = true;
      if (messageReturnSizeRef.current) {
        await request('MINIMIZE_UI', { minimized: true, ...messageReturnSizeRef.current });
        messageReturnSizeRef.current = undefined;
      }
      restoreMessageFocusRef.current = true;
      setMessageDialog(null);
    } catch {
      setMessageWindowError(acknowledged ? '消息窗口恢复失败，请再次关闭重试' : '公告确认保存失败，请重试关闭');
    } finally {
      messageOperationRef.current = false;
      setMessageWindowBusy(false);
    }
  }

  async function toggleCompactDock() {
    if (isCompactDock) {
      restoreCompactDock();
      return;
    }

    if (compactLayoutLoading) return;
    setCompactLayoutLoading(true);
    try { await ensureCompactLayout(); }
    catch { publishFeedback('global', 'error', '快捷布局加载失败，请重试。'); return; }
    finally { setCompactLayoutLoading(false); }
    compactDockSizeRef.current = { width: window.innerWidth, height: window.innerHeight };
    retireTask();
    startDockMotion('entering');
    setIsCompactDock(true);
  }

  async function openCompactTool(pageId: PageId) {
    if (compactPanelResizePendingRef.current || compactPanelState === 'closing') {
      return;
    }
    if (compactPanelState === 'open' && compactFeaturePage === pageId) {
      closeCompactFeaturePanel();
      return;
    }

    if (compactPanelTimerRef.current !== undefined) {
      window.clearTimeout(compactPanelTimerRef.current);
      compactPanelTimerRef.current = undefined;
    }

    if (compactPanelState === 'closed') {
      compactPanelResizePendingRef.current = 'opening';
      try {
        await request('RESIZE_UI', compactDockSizeRef.current);
      } catch {
        publishFeedback('global', 'error', '功能面板展开失败，请重试');
        return;
      } finally {
        compactPanelResizePendingRef.current = undefined;
      }
    }
    setCompactFeaturePage(pageId);
    setCompactPanelState('open');
    navigateToPage(pageId);
  }

  function closeCompactFeaturePanel() {
    if (compactPanelState !== 'open') {
      return;
    }

    setCompactPanelState('closing');
    if (prefersReducedMotion()) {
      void completeCompactFeaturePanelClose();
      return;
    }
    compactPanelTimerRef.current = window.setTimeout(() => {
      void completeCompactFeaturePanelClose();
    }, UI_MOTION_DURATION_MS);
  }

  async function completeCompactFeaturePanelClose() {
    if (compactPanelResizePendingRef.current) {
      return;
    }
    if (compactPanelTimerRef.current !== undefined) {
      window.clearTimeout(compactPanelTimerRef.current);
      compactPanelTimerRef.current = undefined;
    }

    compactPanelResizePendingRef.current = 'closing';
    try {
      await request('MINIMIZE_UI', {
        minimized: true,
        width: compactDockSizeRef.current.width,
        height: getCompactDockHeight()
      });
      setCompactPanelState('closed');
    } catch {
      setCompactPanelState('open');
      publishFeedback('global', 'error', '功能面板收起失败，请重试');
    } finally {
      compactPanelResizePendingRef.current = undefined;
    }
  }

  function handleCompactPanelAnimationEnd(event: ReactAnimationEvent<HTMLDivElement>) {
    if (
      event.target === event.currentTarget
      && event.animationName === 'compact-feature-panel-close'
      && compactPanelState === 'closing'
    ) {
      void completeCompactFeaturePanelClose();
    }
  }

  function restoreCompactDock() {
    if (!isCompactDock) {
      return;
    }

    if (compactPanelTimerRef.current !== undefined) {
      window.clearTimeout(compactPanelTimerRef.current);
      compactPanelTimerRef.current = undefined;
    }
    compactPanelResizePendingRef.current = undefined;
    setCompactPanelState('closed');
    startDockMotion('restoring');
    setIsCompactDock(false);
    send('MINIMIZE_UI', {
      minimized: false,
      width: compactDockSizeRef.current.width,
      height: compactDockSizeRef.current.height
    });
  }

  function scrollCompactTools(direction: -1 | 1) {
    const strip = compactToolStripRef.current;
    if (!strip) {
      return;
    }
    const distance = Math.max(160, Math.round(strip.clientWidth * 0.7));
    const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    strip.scrollTo({
      left: Math.min(maxScrollLeft, Math.max(0, strip.scrollLeft + distance * direction)),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  async function toggleTheme() {
    const previousThemeMode = themePreference;
    startThemeTransition();
    setThemePreference(nextThemeMode);

    try {
      const data = await request<PluginSettings, Partial<PluginSettings>>('SAVE_SETTINGS', { themeMode: nextThemeMode });
      setSettings(data);
    } catch (error) {
      startThemeTransition();
      setThemePreference(previousThemeMode);
      publishFeedback('global', 'error', formatPersistenceError(error, '主题设置保存失败，已恢复原主题'));
    }
  }

  async function reloadSettings() {
    setSettingsLoadState('loading');
    setSettingsLoadError(undefined);
    try {
      const nextSettings = await loadSettings();
      setSettings(nextSettings);
      setSettingsLoadState('success');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : '设置读取失败';
      setSettingsLoadState('error');
      setSettingsLoadError(message.includes('bridge is unavailable') || message === '当前未连接 Figma' ? '当前未连接 Figma' : message);
    }
  }

  async function saveHomeLayout(nextLayout: HomeLayoutSettings) {
    const previousLayout = homeLayout;
    setHomeLayout(nextLayout);

    try {
      const savedLayout = await request<HomeLayoutSettings, Partial<HomeLayoutSettings>>('SAVE_HOME_LAYOUT', nextLayout);
      setHomeLayout(savedLayout);
      return savedLayout;
    } catch (error) {
      setHomeLayout(previousLayout);
      publishFeedback('global', 'error', formatPersistenceError(error, '首页布局保存失败，请稍后手动重试'));
      throw error;
    }
  }

  async function saveCompactLayout(nextLayout: HomeLayoutSettings) {
    const previousLayout = compactLayout;
    setCompactLayout(nextLayout);

    try {
      const savedLayout = await request<HomeLayoutSettings, Partial<HomeLayoutSettings>>('SAVE_COMPACT_LAYOUT', nextLayout);
      setCompactLayout(savedLayout);
      return savedLayout;
    } catch (error) {
      setCompactLayout(previousLayout);
      publishFeedback('global', 'error', formatPersistenceError(error, '紧凑模式布局保存失败，请稍后手动重试'));
      throw error;
    }
  }

  const messageNotice = <MessageNoticeBar message={messageCenter.notice} unread={messageCenter.unread}
    buttonRef={messageNoticeRef}
    disabled={Boolean(confirm) || messageWindowBusy || compactPanelState === 'closing'} onOpen={() => void openMessageCenter()} />;

  return (
    <div className={`app-shell app-shell-no-sidebar ${isCompactDock ? 'compact-dock' : ''} ${dockMotion === 'idle' ? '' : `dock-motion-${dockMotion}`}`}>
      <main className="workspace" inert={Boolean(messageDialog) || messageWindowBusy}>
        <header className="topbar" ref={topbarRef}>
          <div className="topbar-left">
            <button className="topbar-home" aria-label="首页" title="返回首页" onClick={returnHome} type="button">
              <img alt="" src={logoSrc}/>
            </button>
            {isCompactDock ? messageNotice : (
              <div className="topbar-title">
                {page === 'home' ? <strong>{pageTitle(page)}</strong> : (
                  <button className="topbar-page-back" aria-label="返回首页" title="返回首页" onClick={returnHome} type="button">
                    <ArrowLeft aria-hidden="true" size={16}/><strong>{pageTitle(page)}</strong>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="topbar-right">
            {bridge.selectionRefreshFailed && isCompactDock ? <Button size="compact" title="选区读取失败，请重试。" onClick={()=>void refreshSelection().then(()=>clearFeedback('selection')).catch(()=>{})}>重试</Button> : null}
            <IconButton
              active={page === 'settings'}
              ariaLabel="打开设置中心"
              className="topbar-icon-btn"
              icon={Settings}
              onClick={openSettingsCenter}
              title="设置"
            />
            <IconButton
              ariaLabel={themeToggleLabel}
              className="topbar-icon-btn theme-toggle-btn"
              icon={ThemeToggleIcon}
              onClick={() => void toggleTheme()}
              pressed={themeMode === 'dark'}
              title={themeToggleLabel}
            />
            <IconButton
              ariaLabel={minimizeToggleLabel}
              className="topbar-icon-btn"
              icon={MinimizeToggleIcon}
              disabled={compactLayoutLoading}
              onClick={() => void toggleCompactDock()}
              title={minimizeToggleLabel}
            />
          </div>
        </header>

        {bridge.selectionRefreshFailed && !isCompactDock ? <div className="selection-refresh-retry"><NoticeBar state="error" text="选区读取失败，请重试。"/><Button onClick={()=>void refreshSelection().then(()=>clearFeedback('selection')).catch(()=>{})}>重试</Button></div> : null}
        {isCompactDock ? (
          <section ref={toolbarRef} aria-label="功能快捷入口" className={`compact-tool-strip ${showCompactToolLabels ? 'compact-tool-strip-labels' : 'compact-tool-strip-icons-only'}`}>
            <IconButton
              ariaLabel="查看前一组功能"
              className="compact-tool-switch"
              disabled={compactToolEntries.length === 0 || compactToolStripPosition.atStart}
              icon={ChevronLeft}
              onClick={() => scrollCompactTools(-1)}
              title="向左切换功能"
            />
            <div className="compact-tool-scroll" ref={compactToolStripRef} role="toolbar">
              {compactToolEntries.length > 0 ? compactToolEntries.map((tool) => {
                const Icon = tool.icon;
                const isOpen = compactPanelState === 'open' && compactFeaturePage === tool.page;
                const isActive = compactPanelState !== 'closed' && compactFeaturePage === tool.page;
                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? '收起' : '打开'}${tool.label}`}
                    className={`compact-tool-button ${isActive ? 'active' : ''}`}
                    key={tool.page}
                    onClick={() => void openCompactTool(tool.page)}
                    title={tool.label}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={20} />
                    {showCompactToolLabels ? <span className="compact-tool-label">{tool.label}</span> : null}
                  </button>
                );
              }) : <span className="compact-tool-empty">暂无快捷功能，可在常规设置中恢复。</span>}
            </div>
            <IconButton
              ariaLabel="查看后一组功能"
              className="compact-tool-switch"
              disabled={compactToolEntries.length === 0 || compactToolStripPosition.atEnd}
              icon={ChevronRight}
              onClick={() => scrollCompactTools(1)}
              title="向右切换功能"
            />
          </section>
        ) : null}

        {isCompactDock && compactFeaturePage ? (
          <section
            aria-hidden={compactPanelState === 'closed'}
            aria-label={`${pageTitle(compactFeaturePage)}功能页面`}
            className={`compact-feature-panel compact-feature-panel-${compactPanelState}`}
          >
            <div
              className="compact-feature-panel-content"
              inert={compactPanelState !== 'open' ? true : undefined}
              onAnimationEnd={handleCompactPanelAnimationEnd}
            >
              {renderFeedback('global')}
              <div
                aria-busy={task.page === compactFeaturePage && task.state === 'loading'}
                className="page-transition compact-feature-page"
                inert={task.page === compactFeaturePage && task.state === 'loading' ? true : undefined}
                key={compactFeaturePage}
              >
                {renderPage(compactFeaturePage, sharedProps, task, navigateToPage, homeLayout, compactLayout, saveHomeLayout, saveCompactLayout, () => navigateToPage(pageBeforeHelpRef.current), messageNotice)}
              </div>
            </div>
          </section>
        ) : null}

        {!isCompactDock ? <section className="content">
          {renderFeedback('global')}
          <div aria-busy={task.page === page && task.state === 'loading'} className="page-transition" inert={task.page === page && task.state === 'loading' ? true : undefined} key={page}>
            {renderPage(page, sharedProps, task, navigateToPage, homeLayout, compactLayout, saveHomeLayout, saveCompactLayout, () => navigateToPage(pageBeforeHelpRef.current), messageNotice)}
          </div>
        </section> : null}
      </main>

      {!isCompactDock && !messageDialog && !messageWindowBusy ? <ResizeHandle onResize={(size) => send('RESIZE_UI', size)} /> : null}

      {messageDialog && !confirm ? <MessageCenterDialog messages={messageCenter.messages} initialMessageId={messageDialog.targetId}
        onRead={messageCenter.markRead} onClose={() => void closeMessageCenter()} closing={messageWindowBusy} /> : null}
      {messageWindowError ? <div role="alert" className="message-window-error">{messageWindowError}</div> : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          summary={confirm.summary}
          details={confirm.details}
          warnings={confirm.warnings}
          confirmText={confirm.confirmText}
          tone={confirm.tone}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm.onConfirm;
            setConfirm(null);
            action();
          }}
        />
      ) : null}
    </div>
  );
}

function getPageLabel(page: PageId): string {
  return pageLabels[page] ?? page;
}

function clearBinarySessionCache(cache: Map<string, unknown>) {
  cache.delete('cutout.results');
  cache.delete('compress.results');
  cache.delete('transparentCrop.results');
}

function clearAiServiceSessionCredentials(cache: Map<string, unknown>) {
  cache.delete('ai.credentials');
}

function ResizeHandle({ onResize }: { onResize: (size: { width: number; height: number }) => void }) {
  const frameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    width: number;
    height: number;
  } | undefined>(undefined);
  const keyboardSizeRef = useRef({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const flushResize = () => {
    frameRef.current = undefined;
    if (dragRef.current) {
      onResize({ width: dragRef.current.width, height: dragRef.current.height });
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: window.innerWidth,
      startHeight: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) {
        return;
      }

      dragRef.current.width = dragRef.current.startWidth + moveEvent.clientX - dragRef.current.startX;
      dragRef.current.height = dragRef.current.startHeight + moveEvent.clientY - dragRef.current.startY;

      if (!frameRef.current) {
        frameRef.current = window.requestAnimationFrame(flushResize);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
      flushResize();
      dragRef.current = undefined;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 50 : 10;
    let { width, height } = keyboardSizeRef.current;
    if (event.key === 'ArrowLeft') width -= step;
    else if (event.key === 'ArrowRight') width += step;
    else if (event.key === 'ArrowUp') height -= step;
    else if (event.key === 'ArrowDown') height += step;
    else return;
    event.preventDefault();
    keyboardSizeRef.current = { width, height };
    onResize({ width, height });
  };

  return (
    <button
      aria-label="调整插件窗口大小"
      className="resize-handle"
      onFocus={() => { keyboardSizeRef.current = { width: window.innerWidth, height: window.innerHeight }; }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      type="button"
    />
  );
}

function renderPage(
  page: PageId,
  props: Omit<SharedPageProps, 'task'>,
  task: AppTaskState,
  setPage: (page: PageId) => void,
  homeLayout: HomeLayoutSettings | undefined,
  compactLayout: HomeLayoutSettings | undefined,
  onHomeLayoutChange: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>,
  onCompactLayoutChange: (layout: HomeLayoutSettings) => Promise<HomeLayoutSettings>,
  onHelpBack: () => void,
  messageNotice?: ReactNode
) {
  const pageTask = task.page === page
    ? { state: task.state, text: task.text }
    : { state: 'idle' as TaskState, text: '等待操作' };

  switch (page) {
    case 'home':
      return <HomePage layout={homeLayout} onLayoutChange={onHomeLayoutChange} onNavigate={setPage} onOpenFeedback={() => props.goSettings('feedback')} settings={props.settings} messageNotice={messageNotice} />;
    case 'help':
      return <HelpPage onBack={onHelpBack} onGoSettings={props.goSettings} onNavigate={setPage} settings={props.settings} />;
    case 'cutout':
      return <CutoutPage {...props} task={pageTask} />;
    case 'transparentCrop':
      return <TransparentCropPage {...props} task={pageTask} />;
    case 'imageSplit':
      return <ImageSplitPage {...props} task={pageTask} />;
    case 'textFill':
      return <TextFillPage {...props} task={pageTask} />;
    case 'textRecognition':
      return <TextRecognitionPage {...props} task={pageTask} />;
    case 'textSplitMerge':
      return <TextSplitMergePage {...props} task={pageTask} />;
    case 'cleanup':
      return <CleanupPage {...props} task={pageTask} />;
    case 'replace':
      return <ReplacePage {...props} task={pageTask} />;
    case 'statistics':
      return <StatisticsPage {...props} task={pageTask} />;
    case 'scale':
      return <ScalePage {...props} task={pageTask} />;
    case 'settings':
      return <SettingsPage
        {...props}
        compactLayout={compactLayout}
        homeLayout={homeLayout}
        onCompactLayoutChange={onCompactLayoutChange}
        onHomeLayoutChange={onHomeLayoutChange}
        task={pageTask}
      />;
    default:
      return null;
  }
}

function pageTitle(page: PageId): string {
  return pageLabels[page] ?? '首页';
}

function readBuiltHtmlBytes() {
  const value = document.querySelector<HTMLMetaElement>('meta[name="designpromax-html-bytes"]')?.content;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined;
}
