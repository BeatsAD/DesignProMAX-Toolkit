// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { TransparentCropBounds, TransparentCropSummary } from './transparent-crop';
import type { CutoutProvider, HomeLayoutSettings, PluginSettings, SelectionSnapshot } from './types';
import type { DiagnosticExportSnapshot, DiagnosticSettings } from './diagnostics';
export type { PreviewTextSplitMergePayload, RunTextSplitMergePayload, TextSplitMergePreviewResult } from './text-split-merge';
export type PluginErrorCode = 'NO_SELECTION' | 'UNSUPPORTED_SELECTION' | 'INVALID_PAYLOAD' | 'API_NOT_CONFIGURED' | 'SERVICE_UNAVAILABLE' | 'IMAGE_UPLOAD_DISABLED' | 'REMOVE_BG_API_KEY_REQUIRED' | 'REMOVE_BG_AUTH_FAILED' | 'REMOVE_BG_QUOTA_OR_RATE_LIMIT' | 'NETWORK_REQUEST_FAILED' | 'NETWORK_ERROR' | 'STORAGE_TIMEOUT' | 'STORAGE_UNAVAILABLE' | 'FIGMA_API_ERROR' | 'FONT_LOAD_FAILED' | 'IMAGE_READ_FAILED' | 'IMAGE_TOO_LARGE' | 'IMAGE_PIXEL_LIMIT_EXCEEDED' | 'IMAGE_INSERT_FAILED' | 'OCR_ENGINE_UNAVAILABLE' | 'OCR_ENGINE_TIMEOUT' | 'NODE_NOT_FOUND' | 'PERMISSION_DENIED' | 'OPERATION_CANCELLED' | 'REQUEST_TIMEOUT' | 'TASK_BUSY' | 'HOST_UNAVAILABLE' | 'UNKNOWN_ERROR';
export type PluginError = {
    code: PluginErrorCode;
    message: string;
    detail?: string;
    field?: keyof PluginSettings;
    recoverable: boolean;
};
export type UIToMainMessage<TType extends string = string, TPayload = unknown> = {
    type: TType;
    requestId: string;
    payload?: TPayload;
};
export type MainToUIMessage<TType extends string = string, TData = unknown> = {
    type: TType;
    requestId?: string;
    ok: boolean;
    data?: TData;
    error?: PluginError;
};
export type SelectionChangedMessage = {
    type: 'SELECTION_CHANGED';
    ok: true;
    data: SelectionSnapshot;
};
export type CancelTaskPayload = {
    targetRequestId: string;
};
export type TaskProgressData = {
    current: number;
    total: number;
    text: string;
};
export type TaskProgressMessage = {
    type: 'TASK_PROGRESS';
    requestId: string;
    ok: true;
    data: TaskProgressData;
};
export type PluginSessionStartedData = {
    sessionId: string;
    appVersion: string;
    buildId: string;
};
export type PluginSessionStartedMessage = {
    type: 'PLUGIN_SESSION_STARTED';
    ok: true;
    data: PluginSessionStartedData;
};
export type SaveSettingsPayload = Partial<PluginSettings>;
export type SaveHomeLayoutPayload = Partial<HomeLayoutSettings>;
export type SaveCompactLayoutPayload = Partial<HomeLayoutSettings>;
export type SaveDiagnosticSettingsPayload = Partial<DiagnosticSettings>;
export type ClearDiagnosticLogsPayload = {
    confirmed: boolean;
};
export type DiagnosticStatusResult = DiagnosticSettings & {
    entryCount: number;
};
export type ExportDiagnosticLogsResult = DiagnosticExportSnapshot;
export type InsertGeneratedImagePayload = {
    imageBytes: Uint8Array | number[];
    name: string;
    insertPosition: 'viewportCenter' | 'frameCenter';
};
export type PreviewRemoveBgPayload = {
    nodeId: string;
    service: CutoutProvider;
    quality: 'original' | 'high';
};
export type RemoveBgSourceResult = {
    sourceNodeId: string;
    sourceName: string;
    imageBytes: number[];
};
export type GetImageSourcePayload = {
    nodeId: string;
};
export type ImageSourceResult = {
  sourceToken: string;
    nodeId: string;
    imageBytes: number[];
    mimeType: string;
    originalBytes: number;
};
export type GetTextRecognitionSourcePayload = {
    nodeId: string;
};
export type TextRecognitionSourceResult = {
    nodeId: string;
    nodeName: string;
    imageBytes: number[];
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    originalBytes: number;
    width: number;
    height: number;
};
export type RemoveBgRuntimeConfig = {
    removeBgApiKey: string;
};
export type ApplyRemoveBgPayload = {
  sourceToken: string;
    sourceNodeId: string;
    resultImageBytes: Uint8Array | number[];
    mode: 'newLayer' | 'replaceOriginal' | 'keepOriginalAndInsert';
    confirmed: boolean;
};
export type ImageCompressScope = 'selection' | 'currentFrame' | 'currentPage';
export type ImageCompressFormat = 'smart' | 'original' | 'pngLossless' | 'jpg' | 'webp';
export type ImageCompressWriteMode = 'replaceOriginal' | 'keepOriginalAndInsert';
export type ImageCompressSourceFormat = 'png' | 'jpeg' | 'webp' | 'unknown';
export type ImageCompressEngine = 'canvas' | 'oxipng' | 'mozjpeg' | 'webp';
export type ScanImageCompressPayload = {
    scope: ImageCompressScope;
};
export type ImageCompressCandidate = {
    nodeId: string;
    name: string;
    type: string;
    typeLabel?: string;
    width?: number;
    height?: number;
    /**
     * 扫描阶段只返回画布元数据。以下字段只会在用户点击生成预览后，
     * 由 GET_IMAGE_SOURCE 的按需读取结果补充。
     */
    originalBytes?: number;
    mimeType?: string;
    imageBytes?: Uint8Array | number[];
};
export type PreviewImageCompressPayload = {
    items: ImageCompressCandidate[];
    qualityPercent: number;
    outputFormat: ImageCompressFormat;
};
export type ImageCompressResultItem = ImageCompressCandidate & {
    originalBytes: number;
    mimeType: string;
    /** 编码器产生的候选结果体积；即使拒绝候选也会保留该数字用于解释。 */
    candidateBytes: number;
    /** 最终采用体积。跳过或失败时回退为原始体积，避免统计把拒绝候选当成结果。 */
    compressedBytes: number;
    outputMimeType: string;
    resultImageBytes: Uint8Array | number[];
    savedBytes: number;
    savedRatio: number;
    sourceFormat: ImageCompressSourceFormat;
    targetFormat: ImageCompressSourceFormat;
    engine: ImageCompressEngine;
    lossless: boolean;
    durationMs: number;
    status: 'ready' | 'skipped' | 'failed';
    message: string;
};
export type ApplyImageCompressPayload = {
    items: ImageCompressResultItem[];
    mode: ImageCompressWriteMode;
    confirmed: boolean;
};
export type TransparentCropWriteMode = 'newLayer' | 'replaceOriginal';
export type TransparentCropCandidate = {
  sourceToken?: string;
    nodeId: string;
    name: string;
    type: string;
    typeLabel?: string;
    width?: number;
    height?: number;
    /** 扫描阶段不读取原图；以下元数据由 GET_IMAGE_SOURCE 按需补充。 */
    originalBytes?: number;
    mimeType?: string;
    imageBytes?: number[];
    previewImageBytes?: number[];
    previewMimeType?: 'image/png';
};
export type TransparentCropSourceCandidate = TransparentCropCandidate & {
    originalBytes: number;
    mimeType: string;
    imageBytes: number[];
};
export type TransparentCropResultItem = Omit<TransparentCropCandidate, 'originalBytes' | 'mimeType' | 'imageBytes'> & {
    originalBytes: number;
    mimeType: string;
    sourcePixelWidth: number;
    sourcePixelHeight: number;
    bounds?: TransparentCropBounds;
    crop?: TransparentCropSummary;
    resultImageBytes: Uint8Array | number[];
    resultBytes: number;
    status: 'ready' | 'skipped' | 'failed';
    message: string;
};
export type TransparentCropWriteItem = {
  sourceToken: string;
    nodeId: string;
    sourcePixelWidth: number;
    sourcePixelHeight: number;
    bounds: TransparentCropBounds;
    resultImageBytes: number[];
    status: 'ready';
};
export type ApplyTransparentCropPayload = {
    items: TransparentCropWriteItem[];
    mode: TransparentCropWriteMode;
    confirmed: boolean;
};
export type TransparentCropWriteFailure = {
    nodeId: string;
    message: string;
};
export type ApplyTransparentCropResult = {
  cancelled?: boolean;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    failures: TransparentCropWriteFailure[];
    message: string;
    recoverable: true;
};
export type BatchExportScope = 'allPages' | 'currentPage' | 'selection';
export type BatchExportFormat = 'png';
export type BatchExportScale = 1;
export type BatchExportIssue = '重名' | '空画板' | '隐藏画板' | '超大画板' | '缺少导出能力';
export type ScanBatchExportTargetsPayload = {
    scope: BatchExportScope;
};
export type BatchExportTarget = {
    nodeId: string;
    name: string;
    type: 'FRAME';
    pageName: string;
    width: number;
    height: number;
    visible: boolean;
    childCount: number;
    canExport: boolean;
    issues: BatchExportIssue[];
};
export type PreviewBatchExportPayload = {
    targets: BatchExportTarget[];
    nodeIds: string[];
};
export type BatchExportPreviewItem = {
    nodeId: string;
    name: string;
    pageName: string;
    width: number;
    height: number;
    fileName: string;
    format: BatchExportFormat;
    scale: BatchExportScale;
    status: 'ready' | 'blocked';
    issues: BatchExportIssue[];
};
export type BatchExportPreviewResult = {
    items: BatchExportPreviewItem[];
    total: number;
    readyCount: number;
    blockedCount: number;
};
export type RunBatchExportPayload = {
    items: BatchExportPreviewItem[];
    confirmed: boolean;
};
export type BatchExportRunItem = {
    nodeId: string;
    fileName: string;
    status: 'success' | 'failed';
    imageBytes?: number[];
    message: string;
};
export type BatchExportRunResult = {
    items: BatchExportRunItem[];
    successCount: number;
    failedCount: number;
    message: string;
    recoverable: boolean;
};
export type NumericStrategy = 'serial' | 'rangeRandom' | 'totalRandom' | 'code';
export type NumericConfig = {
    strategy: NumericStrategy;
    precision: number;
    trimTrailingZeros: boolean;
    unit: 'none' | 'percent' | 'hour' | 'minute' | 'kwh' | 'custom';
    customUnit?: string;
    order?: 'asc' | 'desc';
    start?: string;
    step?: string;
    integerPadWidth?: number;
    min?: string;
    max?: string;
    unique?: boolean;
    total?: string;
    minimumPerItem?: string;
    /** `code` 模式下包裹编号的文字。 */
    prefix?: string;
    suffix?: string;
};
export type DateTimePart = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'weekday';
export type DateTimeStepUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
export type DateTimeConfig = {
    parts: DateTimePart[];
    dateFormat: 'dash' | 'slash' | 'chinese';
    rangeStart: string;
    rangeEnd: string;
    step: number;
    stepUnit: DateTimeStepUnit;
    fixedValue: string;
};
export type TextFillRule = {
    fieldType: string;
    fieldLabel?: string;
    keywords?: string[];
    enabled: boolean;
    source: 'default' | 'custom';
    fillMode: 'sequence' | 'random' | 'cycle' | 'fixed';
    masked?: boolean;
    customValues?: string[];
    phoneType?: 'mobile' | 'landline' | 'mixed';
    numberType?: 'number' | 'sequence' | 'code';
    numberUnit?: 'none' | 'percent' | 'hour' | 'minute' | 'kwh' | 'custom';
    customUnit?: string;
    numeric?: NumericConfig;
    dateTime?: DateTimeConfig;
    regionMode?: 'fixed' | 'random';
    provinceAdcode?: number;
    cityAdcode?: number;
    districtAdcode?: number;
    fallback?: boolean;
};
export type TextFillCustomField = {
    id: string;
    name: string;
    values: string[];
    fillMode: TextFillRule['fillMode'];
};
export type SaveTextFillCustomFieldsPayload = {
    fields: TextFillCustomField[];
};
export type PreviewTextFillPayload = {
    scope: 'selection' | 'currentFrame' | 'currentContainer';
    rules: TextFillRule[];
    /** 数字总额分配重新预览时，由 UI 指定参与分配的文本节点。 */
    targetNodeIds?: string[];
};
export type RunTextFillPayload = {
    items: Array<{
        nodeId: string;
        before: string;
        after: string;
    }>;
    confirmed: boolean;
};
export type ScanCleanupPayload = {
    scope: 'selection' | 'currentFrame' | 'currentPage' | 'allPages';
    includeLocked: boolean;
    includeComponentInstanceChildren: boolean;
    types: Array<'hidden' | 'emptyText' | 'emptyGroup' | 'transparent' | 'zeroSize' | 'outsideFrame'>;
};
export type RunCleanupPayload = {
    nodeIds: string[];
    types?: Array<'hidden' | 'emptyText' | 'emptyGroup' | 'transparent' | 'zeroSize' | 'outsideFrame'>;
    includeComponentInstanceChildren?: boolean;
    confirmed: boolean;
};
export type CleanupRunFailure = {
    nodeId: string;
    reason: string;
};
export type RunCleanupResult = {
  cancelled?: boolean;
    requestedCount: number;
    successCount: number;
    failedCount: number;
    successNodeIds: string[];
    failedItems: CleanupRunFailure[];
    message: string;
    recoverable: true;
};
export type FindReplaceScope = 'selection' | 'currentContainer' | 'currentFrame' | 'currentPage' | 'currentFile';
export type FindReplaceTarget = 'text' | 'style' | 'textAndStyle';
export type FindReplaceApplyMode = 'wholeNode' | 'matchedRange';
export type FindReplaceStatus = 'ready' | 'skipped' | 'failed';
export type FindReplaceMode = 'text' | 'font' | 'fontSize' | 'color';
export type FindReplaceStyleKind = Exclude<FindReplaceMode, 'text'>;
export type FindReplaceTextStyle = {
    fontFamily?: string;
    fontStyle?: string;
    fontSize?: number;
    color?: string;
};
export type AvailableFontReferrer = 'local' | 'team' | 'org' | 'official' | 'unknown';
export type AvailableFontInfo = {
    family: string;
    style: string;
    label: string;
    displayFamily?: string;
    displayStyle?: string;
    displayLabel?: string;
    aliases?: string[];
    searchKeywords?: string[];
    familyAliases?: string[];
    styleAliases?: string[];
    familySearchKeywords?: string[];
    styleSearchKeywords?: string[];
    referrers: AvailableFontReferrer[];
};
export type FindReplaceStyleOption = {
    value: string;
    label: string;
    count: number;
    style: FindReplaceTextStyle;
};
export type ScanFindReplaceStylesPayload = {
    scope: FindReplaceScope;
    kind: FindReplaceStyleKind;
    includeHiddenText: boolean;
    includeLockedText: boolean;
};
export type ScanFindReplaceStylesResult = {
    items: FindReplaceStyleOption[];
    scannedCount: number;
    skippedLockedCount: number;
    skippedHiddenCount: number;
    unsupportedCount: number;
    traversalMode?: 'children' | 'deep-query';
};
export type FindReplaceHistoryEntry = {
    kind: FindReplaceStyleKind;
    sourceStyles: FindReplaceTextStyle[];
    targetStyle: FindReplaceTextStyle;
    usedAt: number;
};
export type UpsertFindReplaceHistoryPayload = Omit<FindReplaceHistoryEntry, 'usedAt'>;
export type ClearFindReplaceHistoryPayload = {
    confirmed: boolean;
};
export type FindReplacePreviewItem = {
    nodeId: string;
    name: string;
    before: string;
    after: string;
    beforeText: string;
    afterText: string;
    beforeStyle: FindReplaceTextStyle;
    afterStyle: FindReplaceTextStyle;
    pageName?: string;
    containerName?: string;
    rangeStart?: number;
    rangeEnd?: number;
    applyMode: FindReplaceApplyMode;
    status: FindReplaceStatus;
    reason?: string;
};
export type FindReplacePreviewResult = {
    items: FindReplacePreviewItem[];
    total: number;
    skipped: number;
    scannedCount: number;
    skippedLockedCount: number;
    skippedHiddenCount: number;
    affectedNodeCount: number;
    affectedRangeCount: number;
    traversalMode?: 'children' | 'deep-query';
};
export type FindReplacePreviewPayload = {
    mode?: FindReplaceMode;
    scope: FindReplaceScope;
    target?: FindReplaceTarget;
    applyMode?: FindReplaceApplyMode;
    findText: string;
    replaceText: string;
    matchMode: 'contains' | 'exact';
    caseSensitive: boolean;
    includeHiddenText: boolean;
    includeLockedText: boolean;
    styleFind?: FindReplaceTextStyle;
    styleFindAny?: FindReplaceTextStyle[];
    styleReplace?: FindReplaceTextStyle;
};
export type RunFindReplacePayload = {
    items: FindReplacePreviewItem[];
    confirmed: boolean;
};
export type LocateSearchType = 'frame' | 'group' | 'component' | 'text' | 'layer';
export type LocateSearchScope = 'currentPage' | 'selectedPages';
export type DesignStatsMaterialType = 'image' | 'group' | 'text' | 'rectangle';
export type ScanDesignStatsPayload = {
    includeMaterialTypes: DesignStatsMaterialType[];
    pageIds?: string[];
};
export type DesignStatsPageSummary = {
    pageId: string;
    pageName: string;
    count: number;
};
export type DesignStatsResult = {
    text: string;
    total: number;
    pages: DesignStatsPageSummary[];
};
export type LocatePageInfo = {
    pageId: string;
    pageName: string;
    isCurrent: boolean;
};
export type SearchLocatePayload = {
    query: string;
    types: LocateSearchType[];
    scope: LocateSearchScope;
    pageIds?: string[];
};
export type LocateNodePayload = {
    nodeId: string;
    pageId?: string;
    selectAfterLocate: boolean;
};
export type PreviewScalePayload = {
    nodeIds: string[];
    mode: 'percent' | 'targetWidth' | 'targetHeight';
    value: number;
};
export type RunScalePayload = PreviewScalePayload & {
    confirmed: boolean;
};
export type SizeFitAxis = 'width' | 'height' | 'both';
export type SizeFitStrategy = 'conservative' | 'smart';
export type PreviewSizeFitPayload = {
    nodeIds: string[];
    targetWidth: number;
    targetHeight: number;
    axis: SizeFitAxis;
    strategy: SizeFitStrategy;
};
export type RunSizeFitPayload = PreviewSizeFitPayload & {
    confirmed: boolean;
};
export type ClearCachePayload = {
    scope: 'cache' | 'history' | 'all';
    confirmed: boolean;
};
export type ResizeUiPayload = {
    width: number;
    height: number;
};
export type MinimizeUiPayload = {
    minimized: boolean;
    width: number;
    height: number;
};
export type TeamLibraryItemType = 'component' | 'componentSet';
export type TeamLibraryItem = {
    id: string;
    itemType: TeamLibraryItemType;
    name: string;
    originalName: string;
    ukey: string;
    libraryName: string;
    groupPath: string[];
    description?: string;
    previewUrl?: string;
    coverUrl?: string;
    thumbnailUrl?: string;
};
export type TeamLibraryGroup = {
    id: string;
    name: string;
    path: string[];
    items: TeamLibraryItem[];
};
export type TeamLibrary = {
    id: string;
    name: string;
    groups: TeamLibraryGroup[];
};
export type TeamLibraryStatus = 'ready' | 'empty' | 'unsupported' | 'error';
export type TeamLibraryResult = {
    status: TeamLibraryStatus;
    libraries: TeamLibrary[];
    totalItems: number;
    message?: string;
};
export type InsertTeamLibraryComponentPayload = {
    itemType: TeamLibraryItemType;
    ukey: string;
    name?: string;
    dropPosition?: {
        x: number;
        y: number;
    };
};
export type InsertTeamLibraryComponentResult = {
    insertedNodeId: string;
    insertedName: string;
    sourceType: TeamLibraryItemType;
};
export type IconLibraryCategory = 'common' | 'user' | 'arrow' | 'file' | 'device' | 'data' | 'chart' | 'status' | 'power' | 'map' | 'system';
export type IconLibraryCategoryFilter = 'all' | IconLibraryCategory;
export type IconLibrarySource = {
    name: string;
    license: string;
    url: string;
};
export type IconLibraryLicenseSource = IconLibrarySource & {
    packageName: string;
    packageVersion: string;
    repository: string;
    iconCount: number;
    generatedAt: string;
    sourcePath: string;
};
export type IconLibraryLicenseManifest = {
    generatedAt: string;
    totalIconCount: number;
    sources: IconLibraryLicenseSource[];
};
export type IconLibraryItem = {
    id: string;
    name: string;
    nameZh: string;
    category: IconLibraryCategory;
    source: string;
    license: string;
    tagsZh: string[];
    tagsEn: string[];
    pinyin: string;
};
export type IconLibraryBodyMap = Record<string, string>;
export type IconInsertPosition = 'viewportCenter' | 'frameCenter';
export type InsertIconSvgPayload = {
    iconId: string;
    svg: string;
    name: string;
    size: number;
    color: string;
    strokeWidth: number;
    insertPosition: IconInsertPosition;
    dropPosition?: {
        x: number;
        y: number;
    };
};
export type InsertIconSvgResult = {
    insertedNodeId: string;
    insertedName: string;
    size: number;
};
export type VectorMapLevel = 'country' | 'province' | 'city' | 'district';
export type VectorMapIndexItem = {
    id: string;
    adcode: number;
    name: string;
    level: VectorMapLevel;
    parentAdcode: number | null;
    childCount?: number;
    viewBox: string;
    width: number;
    height: number;
};
export type VectorMapGeometry = {
    pathData: string;
    childPathData?: string;
    childPaths?: VectorMapChildPath[];
    labelPoints?: VectorMapLabelPoint[];
};
export type VectorMapItem = VectorMapIndexItem & VectorMapGeometry;
export type VectorMapChildPath = {
    adcode: number;
    name: string;
    level: VectorMapLevel;
    pathData: string;
};
export type VectorMapLabelPoint = {
    adcode: number;
    name: string;
    level: VectorMapLevel;
    x: number;
    y: number;
};
export type VectorMapInsertPosition = 'viewportCenter' | 'frameCenter';
export type InsertVectorMapSvgPayload = {
    mapId: string;
    name: string;
    svg: string;
    width: number;
    height: number;
    insertPosition: VectorMapInsertPosition;
};
export type InsertVectorMapSvgResult = {
    insertedNodeId: string;
    insertedName: string;
    width: number;
    height: number;
};
export type KnownMessageType = 'GET_MESSAGE_READ_STATE' | 'MARK_MESSAGE_READ' | 'ACKNOWLEDGE_MESSAGE_WELCOME' | 'GET_LOCAL_RESOURCE' | 'UI_READY' | 'RESTART_UI' | 'CANCEL_TASK' | 'GET_SELECTION' | 'GET_SETTINGS' | 'SAVE_SETTINGS' | 'GET_HOME_LAYOUT' | 'SAVE_HOME_LAYOUT' | 'GET_COMPACT_LAYOUT' | 'SAVE_COMPACT_LAYOUT' | 'GET_TEXT_FILL_CUSTOM_FIELDS' | 'SAVE_TEXT_FILL_CUSTOM_FIELDS' | 'CLEAR_CACHE' | 'GET_DIAGNOSTIC_STATUS' | 'SAVE_DIAGNOSTIC_SETTINGS' | 'EXPORT_DIAGNOSTIC_LOGS' | 'CLEAR_DIAGNOSTIC_LOGS' | 'INSERT_GENERATED_IMAGE' | 'GET_REMOVE_BG_RUNTIME_CONFIG' | 'GET_REMOVE_BG_SOURCE' | 'GET_IMAGE_SOURCE' | 'SCAN_IMAGE_SPLIT_SOURCE' | 'APPLY_IMAGE_SPLIT' | 'GET_TEXT_RECOGNITION_SOURCE' | 'PREVIEW_REMOVE_BG' | 'APPLY_REMOVE_BG' | 'SCAN_IMAGE_COMPRESS' | 'APPLY_IMAGE_COMPRESS' | 'SCAN_TRANSPARENT_CROP' | 'APPLY_TRANSPARENT_CROP' | 'SCAN_BATCH_EXPORT_TARGETS' | 'PREVIEW_BATCH_EXPORT' | 'RUN_BATCH_EXPORT' | 'PREVIEW_TEXT_FILL' | 'RUN_TEXT_FILL' | 'PREVIEW_TEXT_SPLIT_MERGE' | 'RUN_TEXT_SPLIT_MERGE' | 'SCAN_CLEANUP' | 'RUN_CLEANUP' | 'FIND_REPLACE_PREVIEW' | 'RUN_FIND_REPLACE' | 'LIST_AVAILABLE_FONTS' | 'SCAN_FIND_REPLACE_STYLES' | 'GET_FIND_REPLACE_HISTORY' | 'UPSERT_FIND_REPLACE_HISTORY' | 'CLEAR_FIND_REPLACE_HISTORY' | 'GET_LOCATE_PAGES' | 'SEARCH_LOCATE' | 'LOCATE_NODE' | 'SCAN_DESIGN_STATS' | 'GET_TEAM_LIBRARY' | 'INSERT_TEAM_LIBRARY_COMPONENT' | 'INSERT_ICON_SVG' | 'INSERT_VECTOR_MAP_SVG' | 'PREVIEW_SCALE' | 'RUN_SCALE' | 'PREVIEW_SIZE_FIT' | 'RUN_SIZE_FIT' | 'IMAGE_COMPRESS_PLACEHOLDER' | 'BATCH_EXPORT_PLACEHOLDER' | 'VECTOR_MAP_PLACEHOLDER' | 'RESIZE_UI' | 'MINIMIZE_UI';
export const MAX_CLEANUP_BATCH_SIZE=100;
