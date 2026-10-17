import { SPLIT_MAX_RESULT_BYTES } from './image-split';
import { isLocalResourceId, LOCAL_RESOURCE_CHUNK_SIZE } from './local-resources';
import { MAX_CLEANUP_BATCH_SIZE, type KnownMessageType } from './messages';
import { AI_PROVIDER_IDS, type PluginSettings } from './types';
import { OPTIONAL_TEXT_SPLIT_DELIMITERS, DEFAULT_TEXT_SPLIT_DELIMITERS } from './text-split-merge';
import { pluginMessageIds } from './message-catalog';

type ValidationResult = { ok: true } | { ok: false; detail: string; field?: keyof PluginSettings };
type PayloadValidator = (payload: unknown) => ValidationResult;

export type SettingsValidationResult = { ok: true } | {
  ok: false;
  detail: string;
  field?: keyof PluginSettings;
};

const OK: ValidationResult = { ok: true };
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_ITEMS = 100;
const MAX_EXPORT_ITEMS = 200;
const ENUMS = {
  insertPosition: ['viewportCenter', 'frameCenter'],
  cutoutService: ['removebg', 'custom'],
  cutoutQuality: ['original', 'high'],
  removeBgMode: ['newLayer', 'replaceOriginal', 'keepOriginalAndInsert'],
  compressScope: ['selection', 'currentFrame', 'currentPage'],
  compressMode: ['replaceOriginal', 'keepOriginalAndInsert'],
  cropMode: ['newLayer', 'replaceOriginal'],
  exportScope: ['allPages', 'currentPage', 'selection'],
  textFillScope: ['selection', 'currentFrame', 'currentContainer'],
  cleanupScope: ['selection', 'currentFrame', 'currentPage', 'allPages'],
  cleanupType: ['hidden', 'emptyText', 'emptyGroup', 'transparent', 'zeroSize', 'outsideFrame'],
  replaceScope: ['selection', 'currentContainer', 'currentFrame', 'currentPage', 'currentFile'],
  replaceTarget: ['text', 'style', 'textAndStyle'],
  replaceMode: ['text', 'font', 'fontSize', 'color'],
  replaceStyleKind: ['font', 'fontSize', 'color'],
  applyMode: ['wholeNode', 'matchedRange'],
  matchMode: ['contains', 'exact'],
  locateType: ['frame', 'group', 'component', 'text', 'layer'],
  locateScope: ['currentPage', 'selectedPages'],
  materialType: ['image', 'group', 'text', 'rectangle'],
  scaleMode: ['percent', 'targetWidth', 'targetHeight'],
  sizeFitAxis: ['width', 'height', 'both'],
  sizeFitStrategy: ['conservative', 'smart'],
  cacheScope: ['cache', 'history', 'all'],
  teamItemType: ['component', 'componentSet']
} as const;

export function validateMessagePayload(type: KnownMessageType, payload: unknown): ValidationResult {
  return PAYLOAD_VALIDATORS[type](payload);
}

const PAYLOAD_VALIDATORS: Record<KnownMessageType, PayloadValidator> = {
  GET_MESSAGE_READ_STATE: noPayload,
  ACKNOWLEDGE_MESSAGE_WELCOME: noPayload,
  MARK_MESSAGE_READ: (payload) => isRecord(payload) && typeof payload.id === 'string' && pluginMessageIds.has(payload.id)
    && Object.keys(payload).length === 1 ? OK : invalid('消息标识无效'),
  GET_LOCAL_RESOURCE: (payload) => isRecord(payload) && isLocalResourceId(payload.id)
    && Number.isSafeInteger(payload.offset) && typeof payload.offset === 'number'
    && payload.offset >= 0 && payload.offset < 16 * 1024 * 1024 && payload.offset % LOCAL_RESOURCE_CHUNK_SIZE === 0
    ? OK : invalid('本地资源请求无效'),
  CANCEL_TASK: (payload) => isRecord(payload)
    ? stringField(payload, 'targetRequestId', 1, 256)
    : invalid('CANCEL_TASK payload 必须是对象'),
  UI_READY: noPayload,
  RESTART_UI: noPayload,
  GET_SELECTION: noPayload,
  GET_SETTINGS: noPayload,
  SAVE_SETTINGS: validateSettingsPatch,
  GET_HOME_LAYOUT: noPayload,
  SAVE_HOME_LAYOUT: validateHomeLayout,
  GET_COMPACT_LAYOUT: noPayload,
  SAVE_COMPACT_LAYOUT: validateCompactLayout,
  GET_TEXT_FILL_CUSTOM_FIELDS: noPayload,
  SAVE_TEXT_FILL_CUSTOM_FIELDS: validateTextFillCustomFields,
  CLEAR_CACHE: (payload) => validateConfirmedRecord(payload, 'CLEAR_CACHE', (record) => enumField(record, 'scope', ENUMS.cacheScope)),
  GET_DIAGNOSTIC_STATUS: noPayload,
  SAVE_DIAGNOSTIC_SETTINGS: (payload) => validateBooleanRecord(payload, 'detailedEnabled'),
  EXPORT_DIAGNOSTIC_LOGS: noPayload,
  CLEAR_DIAGNOSTIC_LOGS: (payload) => validateConfirmedRecord(payload, 'CLEAR_DIAGNOSTIC_LOGS'),
  INSERT_GENERATED_IMAGE: validateGeneratedImage,
  GET_REMOVE_BG_RUNTIME_CONFIG: noPayload,
  GET_REMOVE_BG_SOURCE: validateRemoveBgSource,
  GET_IMAGE_SOURCE: (payload) => isRecord(payload)
    ? stringField(payload, 'nodeId', 1, 256)
    : invalid('GET_IMAGE_SOURCE payload 必须是对象'),
  SCAN_IMAGE_SPLIT_SOURCE: (payload) => isRecord(payload) ? stringField(payload, 'nodeId', 1, 256) : invalid('图片源请求无效'),
  APPLY_IMAGE_SPLIT: validateImageSplitWrite,
  GET_TEXT_RECOGNITION_SOURCE: (payload) => isRecord(payload)
    ? stringField(payload, 'nodeId', 1, 256)
    : invalid('GET_TEXT_RECOGNITION_SOURCE payload 必须是对象'),
  PREVIEW_REMOVE_BG: validateRemoveBgSource,
  APPLY_REMOVE_BG: (payload) => validateConfirmedRecord(payload, 'APPLY_REMOVE_BG', validateRemoveBgWrite),
  SCAN_IMAGE_COMPRESS: (payload) => validateEnumRecord(payload, 'scope', ENUMS.compressScope),
  APPLY_IMAGE_COMPRESS: validateImageCompressWrite,
  SCAN_TRANSPARENT_CROP: noPayload,
  APPLY_TRANSPARENT_CROP: validateTransparentCropWrite,
  SCAN_BATCH_EXPORT_TARGETS: (payload) => validateEnumRecord(payload, 'scope', ENUMS.exportScope),
  PREVIEW_BATCH_EXPORT: validateBatchExportPreview,
  RUN_BATCH_EXPORT: validateBatchExportRun,
  PREVIEW_TEXT_FILL: validateTextFillPreview,
  RUN_TEXT_FILL: validateTextFillRun,
  PREVIEW_TEXT_SPLIT_MERGE: validateTextSplitMergePreview,
  RUN_TEXT_SPLIT_MERGE: validateTextSplitMergeRun,
  SCAN_CLEANUP: validateCleanupScan,
  RUN_CLEANUP: validateCleanupRun,
  FIND_REPLACE_PREVIEW: validateFindReplacePreview,
  RUN_FIND_REPLACE: validateFindReplaceRun,
  LIST_AVAILABLE_FONTS: noPayload,
  SCAN_FIND_REPLACE_STYLES: validateScanFindReplaceStyles,
  GET_FIND_REPLACE_HISTORY: noPayload,
  UPSERT_FIND_REPLACE_HISTORY: validateUpsertFindReplaceHistory,
  CLEAR_FIND_REPLACE_HISTORY: (payload) => validateConfirmedRecord(payload, 'CLEAR_FIND_REPLACE_HISTORY'),
  GET_LOCATE_PAGES: noPayload,
  SEARCH_LOCATE: validateLocateSearch,
  LOCATE_NODE: validateLocateNode,
  SCAN_DESIGN_STATS: validateDesignStats,
  GET_TEAM_LIBRARY: noPayload,
  INSERT_TEAM_LIBRARY_COMPONENT: validateTeamLibraryInsert,
  INSERT_ICON_SVG: validateIconInsert,
  INSERT_VECTOR_MAP_SVG: validateMapInsert,
  PREVIEW_SCALE: validateScale,
  RUN_SCALE: (payload) => validateConfirmedRecord(payload, 'RUN_SCALE', validateScaleRecord),
  PREVIEW_SIZE_FIT: validateSizeFit,
  RUN_SIZE_FIT: (payload) => validateConfirmedRecord(payload, 'RUN_SIZE_FIT', validateSizeFitRecord),
  IMAGE_COMPRESS_PLACEHOLDER: noPayload,
  BATCH_EXPORT_PLACEHOLDER: noPayload,
  VECTOR_MAP_PLACEHOLDER: noPayload,
  RESIZE_UI: validateResize,
  MINIMIZE_UI: validateMinimizeUi
};

function noPayload(payload: unknown): ValidationResult {
  return payload === undefined ? OK : invalid('不应包含 payload');
}

function objectPayload(payload: unknown): ValidationResult {
  return isRecord(payload) ? OK : invalid('payload 必须是对象');
}

export function validateSettingsPatch(payload: unknown): SettingsValidationResult {
  if (!isRecord(payload)) return invalidSettings(undefined, 'SAVE_SETTINGS payload 必须是对象');

  const allowedKeys = new Set<keyof PluginSettings>([
    'aiProvider', 'aiProviderCustomName', 'apiBaseUrl', 'apiKey', 'modelName', 'iconModelName', 'customImageServiceUrl',
    'removeBgApiKey', 'cutoutProvider', 'allowImageUpload', 'savePromptHistory',
    'saveGeneratedImages', 'saveReplaceHistory', 'defaultImageRatio', 'defaultImageStyle',
    'defaultInsertPosition', 'themeMode', 'compactToolLabelsVisible', 'maxImageCompressBytes',
    'allowWebpExport', 'allowLossyReplaceOriginal'
  ]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key as keyof PluginSettings)) {
      return invalidSettings(undefined, `SAVE_SETTINGS.${key} 不受支持`);
    }
  }

  for (const key of ['apiBaseUrl', 'customImageServiceUrl'] as const) {
    if (payload[key] !== undefined && !validHttpUrl(payload[key], 2048, true)) {
      return invalidSettings(key, '必须为空或以 http://、https:// 开头的有效地址');
    }
  }
  if (payload.aiProvider !== undefined && (
    typeof payload.aiProvider !== 'string' || !(AI_PROVIDER_IDS as readonly string[]).includes(payload.aiProvider)
  )) {
    return invalidSettings('aiProvider', '不是支持的 AI 服务商');
  }
  if (payload.aiProviderCustomName !== undefined && !validString(payload.aiProviderCustomName, 0, 64)) {
    return invalidSettings('aiProviderCustomName', '长度不得超过 64 个字符');
  }
  for (const key of ['apiKey', 'removeBgApiKey'] as const) {
    if (payload[key] !== undefined && !validString(payload[key], 0, 2048)) {
      return invalidSettings(key, '长度不得超过 2048 个字符');
    }
  }
  for (const key of ['modelName', 'iconModelName', 'defaultImageRatio', 'defaultImageStyle'] as const) {
    if (payload[key] !== undefined && !validString(payload[key], 0, 256)) {
      return invalidSettings(key, '长度不得超过 256 个字符');
    }
  }
  if (payload.cutoutProvider !== undefined && !['', 'removebg', 'custom'].includes(payload.cutoutProvider as string)) {
    return invalidSettings('cutoutProvider', '不是支持的抠图服务');
  }
  if (payload.defaultInsertPosition !== undefined && !['', 'viewportCenter', 'frameCenter'].includes(payload.defaultInsertPosition as string)) {
    return invalidSettings('defaultInsertPosition', '不是支持的插入位置');
  }
  if (payload.themeMode !== undefined && !['system', 'light', 'dark'].includes(payload.themeMode as string)) {
    return invalidSettings('themeMode', '不是支持的主题模式');
  }
  if (payload.maxImageCompressBytes !== undefined && (
    typeof payload.maxImageCompressBytes !== 'number'
    || !Number.isFinite(payload.maxImageCompressBytes)
    || payload.maxImageCompressBytes < 1024 * 1024
    || payload.maxImageCompressBytes > 32 * 1024 * 1024
  )) {
    return invalidSettings('maxImageCompressBytes', '必须在 1 MiB 到 32 MiB 之间');
  }
  for (const key of [
    'allowImageUpload', 'savePromptHistory', 'saveGeneratedImages',
    'saveReplaceHistory', 'compactToolLabelsVisible', 'allowWebpExport', 'allowLossyReplaceOriginal'
  ] as const) {
    if (payload[key] !== undefined && typeof payload[key] !== 'boolean') {
      return invalidSettings(key, '必须为布尔值');
    }
  }
  return OK;
}

function validateHomeLayout(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SAVE_HOME_LAYOUT payload 必须是对象');
  for (const key of ['orderedPageIds', 'hiddenPageIds'] as const) {
    if (payload[key] !== undefined && !validStringArray(payload[key], 5000, 256)) return invalid(`SAVE_HOME_LAYOUT.${key} 不合法`);
  }
  return OK;
}

function validateCompactLayout(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SAVE_COMPACT_LAYOUT payload 必须是对象');
  for (const key of ['orderedPageIds', 'hiddenPageIds'] as const) {
    if (payload[key] !== undefined && !validStringArray(payload[key], 5000, 256)) return invalid(`SAVE_COMPACT_LAYOUT.${key} 不合法`);
  }
  return OK;
}

function validateTextFillCustomFields(payload: unknown): ValidationResult {
  if (!isRecord(payload) || !Array.isArray(payload.fields) || payload.fields.length > 20) {
    return invalid('SAVE_TEXT_FILL_CUSTOM_FIELDS.fields 最多 20 项');
  }
  const names = new Set<string>();
  for (const field of payload.fields) {
    if (!isRecord(field)) return invalid('SAVE_TEXT_FILL_CUSTOM_FIELDS.fields 含有无效项');
    const result = firstInvalid([
      stringField(field, 'id', 1, 64),
      stringField(field, 'name', 1, 20),
      stringArrayField(field, 'values', 100, 100),
      enumField(field, 'fillMode', ['sequence', 'random', 'cycle', 'fixed'])
    ]);
    if (!result.ok) return result;
    const normalizedName = (field.name as string).trim().toLocaleLowerCase();
    if (!normalizedName || names.has(normalizedName)) return invalid('自定义字段名称不能为空或重复');
    names.add(normalizedName);
  }
  return OK;
}

function validateGeneratedImage(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('INSERT_GENERATED_IMAGE payload 必须是对象');
  return firstInvalid([
    validateByteArray(payload.imageBytes, 'INSERT_GENERATED_IMAGE.imageBytes'),
    stringField(payload, 'name', 1, 256),
    enumField(payload, 'insertPosition', ENUMS.insertPosition)
  ]);
}

function validateRemoveBgSource(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('REMOVE_BG payload 必须是对象');
  return firstInvalid([
    stringField(payload, 'nodeId', 1, 256),
    enumField(payload, 'service', ENUMS.cutoutService),
    enumField(payload, 'quality', ENUMS.cutoutQuality)
  ]);
}

function validateRemoveBgWrite(record: Record<string, unknown>): ValidationResult {
  return firstInvalid([
    stringField(record, 'sourceNodeId', 1, 256),
    enumField(record, 'mode', ENUMS.removeBgMode),
    validateByteArray(record.resultImageBytes, 'APPLY_REMOVE_BG.resultImageBytes')
  ]);
}

function validateImageCompressWrite(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'APPLY_IMAGE_COMPRESS', (record) => {
    const mode = enumField(record, 'mode', ENUMS.compressMode);
    if (!mode.ok) return mode;
    return validateImageItems(record.items, 'APPLY_IMAGE_COMPRESS.items', (item) => firstInvalid([
      stringField(item, 'nodeId', 1, 256),
      optionalDimension(item, 'width'),
      optionalDimension(item, 'height'),
      item.imageBytes === undefined ? OK : validateByteArray(item.imageBytes, 'APPLY_IMAGE_COMPRESS.items.imageBytes'),
      validateByteArray(item.resultImageBytes, 'APPLY_IMAGE_COMPRESS.items.resultImageBytes'),
      enumField(item, 'status', ['ready'])
    ]));
  });
}

function validateTransparentCropWrite(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'APPLY_TRANSPARENT_CROP', (record) => {
    const mode = enumField(record, 'mode', ENUMS.cropMode);
    if (!mode.ok) return mode;
    return validateImageItems(record.items, 'APPLY_TRANSPARENT_CROP.items', (item) => {
      const knownKeys = ['nodeId', 'sourcePixelWidth', 'sourcePixelHeight', 'bounds', 'resultImageBytes', 'status'];
      if (Object.keys(item).some((key) => !knownKeys.includes(key))) {
        return invalid('APPLY_TRANSPARENT_CROP.items 包含非写入字段');
      }
      return firstInvalid([
        stringField(item, 'nodeId', 1, 256),
        validateTransparentCropBounds(item.bounds),
        validateBridgeByteArray(item.resultImageBytes, 'APPLY_TRANSPARENT_CROP.items.resultImageBytes'),
        numberField(item, 'sourcePixelWidth', 1, 32768),
        numberField(item, 'sourcePixelHeight', 1, 32768),
        enumField(item, 'status', ['ready'])
      ]);
    });
  });
}

function validateTransparentCropBounds(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid('APPLY_TRANSPARENT_CROP.items.bounds 必须是对象');
  const knownKeys = ['left', 'top', 'right', 'bottom', 'width', 'height'];
  if (Object.keys(value).some((key) => !knownKeys.includes(key))) {
    return invalid('APPLY_TRANSPARENT_CROP.items.bounds 包含未知字段');
  }
  return firstInvalid([
    numberField(value, 'left', 0, 32767),
    numberField(value, 'top', 0, 32767),
    numberField(value, 'right', 0, 32767),
    numberField(value, 'bottom', 0, 32767),
    numberField(value, 'width', 1, 32768),
    numberField(value, 'height', 1, 32768)
  ]);
}

function validateBatchExportPreview(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('PREVIEW_BATCH_EXPORT payload 必须是对象');
  if (!validStringArray(payload.nodeIds, MAX_EXPORT_ITEMS, 256)) return invalid(`PREVIEW_BATCH_EXPORT.nodeIds 最多 ${MAX_EXPORT_ITEMS} 项`);
  if (!Array.isArray(payload.targets) || payload.targets.length > MAX_EXPORT_ITEMS) return invalid(`PREVIEW_BATCH_EXPORT.targets 最多 ${MAX_EXPORT_ITEMS} 项`);
  for (const target of payload.targets) {
    if (!isRecord(target)) return invalid('PREVIEW_BATCH_EXPORT.targets 含有无效项');
    const result = firstInvalid([
      stringField(target, 'nodeId', 1, 256),
      stringField(target, 'name', 1, 256),
      stringField(target, 'pageName', 1, 256),
      enumField(target, 'type', ['FRAME']),
      numberField(target, 'width', 1, 32768),
      numberField(target, 'height', 1, 32768),
      booleanField(target, 'visible'),
      booleanField(target, 'canExport')
    ]);
    if (!result.ok) return result;
  }
  return OK;
}

function validateBatchExportRun(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'RUN_BATCH_EXPORT', (record) => {
    if (!Array.isArray(record.items) || record.items.length > MAX_EXPORT_ITEMS) return invalid(`RUN_BATCH_EXPORT.items 最多 ${MAX_EXPORT_ITEMS} 项`);
    for (const item of record.items) {
      if (!isRecord(item)) return invalid('RUN_BATCH_EXPORT.items 含有无效项');
      const result = firstInvalid([
        stringField(item, 'nodeId', 1, 256),
        stringField(item, 'name', 1, 256),
        stringField(item, 'pageName', 1, 256),
        stringField(item, 'fileName', 1, 256),
        numberField(item, 'width', 1, 32768),
        numberField(item, 'height', 1, 32768),
        enumField(item, 'format', ['png']),
        numberEnumField(item, 'scale', [1]),
        enumField(item, 'status', ['ready', 'blocked'])
      ]);
      if (!result.ok) return result;
    }
    return OK;
  });
}

function validateTextFillPreview(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('PREVIEW_TEXT_FILL payload 必须是对象');
  if (!Array.isArray(payload.rules) || payload.rules.length > 100) return invalid('PREVIEW_TEXT_FILL.rules 最多 100 项');
  const scope = enumField(payload, 'scope', ENUMS.textFillScope);
  if (!scope.ok) return scope;
  if (payload.targetNodeIds !== undefined && !stringArrayField(payload, 'targetNodeIds', 1000, 256).ok) {
    return invalid('PREVIEW_TEXT_FILL.targetNodeIds 最多 1000 项');
  }
  for (const rule of payload.rules) {
    if (!isRecord(rule)) return invalid('PREVIEW_TEXT_FILL.rules 含有无效项');
    if (typeof rule.fieldType !== 'string' || !/^custom:.+/.test(rule.fieldType)) return invalid('INVALID');
    const result = firstInvalid([
      stringField(rule, 'fieldType', 1, 64),
      optionalStringField(rule, 'fieldLabel', 40),
      rule.keywords === undefined ? OK : stringArrayField(rule, 'keywords', 20, 40),
      booleanField(rule, 'enabled'),
      enumField(rule, 'source', ['custom']),
      enumField(rule, 'fillMode', ['sequence', 'random', 'cycle', 'fixed']),
      stringArrayField(rule, 'customValues', 100, 100),
      rule.fallback === undefined ? OK : booleanField(rule, 'fallback')
    ]);
    if (!result.ok) return result;
  }
  return OK;
}

function validateTextFillRun(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'RUN_TEXT_FILL', (record) => validateTextItems(record.items, 'RUN_TEXT_FILL.items'));
}

function validateTextSplitMergePreview(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('PREVIEW_TEXT_SPLIT_MERGE payload 必须是对象');
  if (payload.mode === 'merge') {
    const separator = enumField(payload, 'separator', ['none', 'space', 'newline', 'custom']);
    if (!separator.ok) return separator;
    if (payload.customSeparator !== undefined && !validString(payload.customSeparator, 0, 20)) {
      return invalid('customSeparator 最长 20 个字符');
    }
    return payload.separator === 'custom' && !validString(payload.customSeparator, 1, 20)
      ? invalid('自定义连接符不能为空')
      : OK;
  }
  if (payload.mode !== 'split') return invalid('mode 必须是 merge 或 split');
  const allowedDelimiters = new Set<string>([...DEFAULT_TEXT_SPLIT_DELIMITERS, ...OPTIONAL_TEXT_SPLIT_DELIMITERS]);
  if (!Array.isArray(payload.delimiters) || payload.delimiters.length > allowedDelimiters.size || payload.delimiters.some((value) => typeof value !== 'string' || !allowedDelimiters.has(value))) {
    return invalid('delimiters 包含不支持的分隔符');
  }
  if (payload.customDelimiters !== undefined && !validString(payload.customDelimiters, 0, 20)) {
    return invalid('customDelimiters 最长 20 个字符');
  }
  return firstInvalid([
    enumField(payload, 'retainDelimiter', ['previous', 'discard', 'next']),
    booleanField(payload, 'trimWhitespace'),
    enumField(payload, 'direction', ['vertical', 'horizontal']),
    numberField(payload, 'gap', 0, 200)
  ]);
}

function validateTextSplitMergeRun(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('RUN_TEXT_SPLIT_MERGE payload 必须是对象');
  const preview = validateTextSplitMergePreview(payload);
  if (!preview.ok) return preview;
  if (payload.confirmed !== true) return invalid('RUN_TEXT_SPLIT_MERGE.confirmed 必须为 true');
  if (!Array.isArray(payload.expectedSources) || payload.expectedSources.length === 0 || payload.expectedSources.length > 100) {
    return invalid('expectedSources 必须包含 1-100 项');
  }
  for (const source of payload.expectedSources) {
    if (!isRecord(source) || !validString(source.nodeId, 1, 256) || !validString(source.name, 0, 256) || !validString(source.before, 0, 5000)) {
      return invalid('expectedSources 含有无效项');
    }
  }
  return OK;
}

function validateCleanupScan(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SCAN_CLEANUP payload 必须是对象');
  return firstInvalid([
    enumField(payload, 'scope', ENUMS.cleanupScope),
    booleanField(payload, 'includeLocked'),
    booleanField(payload, 'includeComponentInstanceChildren'),
    enumArrayField(payload, 'types', ENUMS.cleanupType, 6)
  ]);
}

function validateCleanupRun(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'RUN_CLEANUP', (record) => firstInvalid([
    stringArrayField(record, 'nodeIds', MAX_CLEANUP_BATCH_SIZE, 256),
    record.types === undefined ? OK : enumArrayField(record, 'types', ENUMS.cleanupType, 6)
  ]));
}

function validateFindReplacePreview(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('FIND_REPLACE_PREVIEW payload 必须是对象');
  return firstInvalid([
    enumField(payload, 'mode', ENUMS.replaceMode, true),
    enumField(payload, 'scope', ENUMS.replaceScope),
    enumField(payload, 'target', ENUMS.replaceTarget, true),
    enumField(payload, 'applyMode', ENUMS.applyMode, true),
    stringField(payload, 'findText', 0, 5000),
    stringField(payload, 'replaceText', 0, 5000),
    enumField(payload, 'matchMode', ENUMS.matchMode),
    booleanField(payload, 'caseSensitive'),
    booleanField(payload, 'includeHiddenText'),
    booleanField(payload, 'includeLockedText'),
    payload.styleFind === undefined ? OK : validateFindReplaceStyle(payload.styleFind, 'styleFind', true),
    payload.styleReplace === undefined ? OK : validateFindReplaceStyle(payload.styleReplace, 'styleReplace', true),
    payload.styleFindAny === undefined ? OK : validateFindReplaceStyleArray(payload.styleFindAny, 'styleFindAny', 100)
  ]);
}

function validateScanFindReplaceStyles(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SCAN_FIND_REPLACE_STYLES payload 必须是对象');
  return firstInvalid([
    enumField(payload, 'scope', ENUMS.replaceScope),
    enumField(payload, 'kind', ENUMS.replaceStyleKind),
    booleanField(payload, 'includeHiddenText'),
    booleanField(payload, 'includeLockedText')
  ]);
}

function validateUpsertFindReplaceHistory(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('UPSERT_FIND_REPLACE_HISTORY payload 必须是对象');
  const baseResult = firstInvalid([
    enumField(payload, 'kind', ENUMS.replaceStyleKind),
    validateFindReplaceStyleArray(payload.sourceStyles, 'sourceStyles', 100),
    validateFindReplaceStyle(payload.targetStyle, 'targetStyle', false)
  ]);
  if (!baseResult.ok) return baseResult;
  const styles = [...(payload.sourceStyles as unknown[]), payload.targetStyle];
  return styles.every((style) => validHistoryStyleForKind(payload.kind, style))
    ? OK
    : invalid('历史样式与替换类型不匹配');
}

function validHistoryStyleForKind(kind: unknown, value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (kind === 'font') return validString(value.fontFamily, 1, 256) && value.fontSize === undefined && value.color === undefined;
  if (kind === 'fontSize') return typeof value.fontSize === 'number' && Number.isFinite(value.fontSize) && value.fontSize > 0
    && value.fontFamily === undefined && value.fontStyle === undefined && value.color === undefined;
  if (kind === 'color') return typeof value.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.color)
    && value.fontFamily === undefined && value.fontStyle === undefined && value.fontSize === undefined;
  return false;
}

function validateFindReplaceStyleArray(value: unknown, field: string, max: number): ValidationResult {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    return invalid(`${field} 必须包含 1-${max} 个样式条件`);
  }
  for (const style of value) {
    const result = validateFindReplaceStyle(style, field, false);
    if (!result.ok) return result;
  }
  return OK;
}

function validateFindReplaceStyle(value: unknown, field: string, allowEmpty: boolean): ValidationResult {
  if (!isRecord(value)) return invalid(`${field} 必须是样式对象`);
  const knownKeys = ['fontFamily', 'fontStyle', 'fontSize', 'color'];
  if (Object.keys(value).some((key) => !knownKeys.includes(key))) return invalid(`${field} 包含未知字段`);
  const results = [
    value.fontFamily === undefined ? OK : stringField(value, 'fontFamily', 1, 256),
    value.fontStyle === undefined ? OK : stringField(value, 'fontStyle', 1, 256),
    value.fontSize === undefined ? OK : numberField(value, 'fontSize', 0.1, 1000),
    value.color === undefined || /^#[0-9A-Fa-f]{6}$/.test(String(value.color)) ? OK : invalid(`${field}.color 必须为 #RRGGBB`)
  ];
  const result = firstInvalid(results);
  if (!result.ok) return result;
  return allowEmpty || knownKeys.some((key) => value[key] !== undefined) ? OK : invalid(`${field} 不能为空`);
}

function validateFindReplaceRun(payload: unknown): ValidationResult {
  return validateConfirmedRecord(payload, 'RUN_FIND_REPLACE', (record) => {
    if (!Array.isArray(record.items) || record.items.length > 5000) return invalid('RUN_FIND_REPLACE.items 最多 5000 项');
    for (const item of record.items) {
      if (!isRecord(item) || !validString(item.nodeId, 1, 256) || !validString(item.before, 0, 5000) || !validString(item.after, 0, 5000)) {
        return invalid('RUN_FIND_REPLACE.items 含有无效文本项');
      }
    }
    return OK;
  });
}

function validateLocateSearch(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SEARCH_LOCATE payload 必须是对象');
  return firstInvalid([
    stringField(payload, 'query', 0, 200),
    enumArrayField(payload, 'types', ENUMS.locateType, 5),
    enumField(payload, 'scope', ENUMS.locateScope),
    payload.pageIds === undefined ? OK : stringArrayField(payload, 'pageIds', 5000, 256)
  ]);
}

function validateLocateNode(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('LOCATE_NODE payload 必须是对象');
  return firstInvalid([stringField(payload, 'nodeId', 1, 256), optionalStringField(payload, 'pageId', 256), booleanField(payload, 'selectAfterLocate')]);
}

function validateDesignStats(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('SCAN_DESIGN_STATS payload 必须是对象');
  return firstInvalid([
    enumArrayField(payload, 'includeMaterialTypes', ENUMS.materialType, 4),
    payload.pageIds === undefined ? OK : stringArrayField(payload, 'pageIds', 5000, 256)
  ]);
}

function validateTeamLibraryInsert(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('INSERT_TEAM_LIBRARY_COMPONENT payload 必须是对象');
  return firstInvalid([
    enumField(payload, 'itemType', ENUMS.teamItemType),
    stringField(payload, 'ukey', 1, 256),
    optionalStringField(payload, 'name', 256),
    optionalPoint(payload.dropPosition, 'dropPosition')
  ]);
}

function validateIconInsert(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('INSERT_ICON_SVG payload 必须是对象');
  return firstInvalid([
    stringField(payload, 'iconId', 1, 256),
    stringField(payload, 'name', 1, 256),
    stringField(payload, 'svg', 1, 2_000_000),
    numberField(payload, 'size', 1, 32768),
    numberField(payload, 'strokeWidth', 0, 100),
    enumField(payload, 'insertPosition', ENUMS.insertPosition),
    optionalPoint(payload.dropPosition, 'dropPosition')
  ]);
}

function validateMapInsert(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('INSERT_VECTOR_MAP_SVG payload 必须是对象');
  return firstInvalid([
    stringField(payload, 'mapId', 1, 256),
    stringField(payload, 'name', 1, 256),
    stringField(payload, 'svg', 1, 8_000_000),
    numberField(payload, 'width', 1, 32768),
    numberField(payload, 'height', 1, 32768),
    enumField(payload, 'insertPosition', ENUMS.insertPosition)
  ]);
}

function validateScale(payload: unknown): ValidationResult {
  return isRecord(payload) ? validateScaleRecord(payload) : invalid('PREVIEW_SCALE payload 必须是对象');
}

function validateScaleRecord(record: Record<string, unknown>): ValidationResult {
  const modeResult = enumField(record, 'mode', ENUMS.scaleMode);
  if (!modeResult.ok) return modeResult;
  const mode = record.mode;
  return firstInvalid([
    stringArrayField(record, 'nodeIds', 5000, 256),
    mode === 'percent' ? numberField(record, 'value', 1, 1000) : numberField(record, 'value', 1, 32768)
  ]);
}

function validateSizeFit(payload: unknown): ValidationResult {
  return isRecord(payload) ? validateSizeFitRecord(payload) : invalid('PREVIEW_SIZE_FIT payload 必须是对象');
}

function validateSizeFitRecord(record: Record<string, unknown>): ValidationResult {
  return firstInvalid([
    singleNodeIdField(record, 'nodeIds', 256),
    numberField(record, 'targetWidth', 1, 32768),
    numberField(record, 'targetHeight', 1, 32768),
    enumField(record, 'axis', ENUMS.sizeFitAxis),
    enumField(record, 'strategy', ENUMS.sizeFitStrategy)
  ]);
}

function singleNodeIdField(record: Record<string, unknown>, key: string, maxLength: number): ValidationResult {
  const value = record[key];
  return Array.isArray(value) && value.length === 1 && validString(value[0], 1, maxLength)
    ? OK
    : invalid(`${key} 必须且只能包含一个有效对象 ID`);
}

function validateResize(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('RESIZE_UI payload 必须是对象');
  return firstInvalid([numberField(payload, 'width', 1, 32768), numberField(payload, 'height', 1, 32768)]);
}

function validateMinimizeUi(payload: unknown): ValidationResult {
  if (!isRecord(payload)) return invalid('MINIMIZE_UI payload 必须是对象');
  return firstInvalid([
    booleanField(payload, 'minimized'),
    numberField(payload, 'width', 1, 32768),
    numberField(payload, 'height', 1, 32768)
  ]);
}

function validateImageItems(
  value: unknown,
  field: string,
  validateItem: (item: Record<string, unknown>) => ValidationResult
): ValidationResult {
  if (!Array.isArray(value) || value.length > MAX_IMAGE_ITEMS) return invalid(`${field} 最多 ${MAX_IMAGE_ITEMS} 项`);
  for (const item of value) {
    if (!isRecord(item)) return invalid(`${field} 含有无效项`);
    const result = validateItem(item);
    if (!result.ok) return result;
  }
  return OK;
}

function validateByteArray(value: unknown, field: string): ValidationResult {
  if (!(Array.isArray(value) || value instanceof Uint8Array)) return invalid(`${field} 必须是字节数组`);
  if (value.length > MAX_IMAGE_BYTES) return invalid(`${field} 单项不得超过 32 MiB`);
  for (let index = 0; index < value.length; index += 1) {
    const byte = value[index];
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return invalid(`${field} 含有非 0-255 整数`);
  }
  return OK;
}

function validateBridgeByteArray(value: unknown, field: string): ValidationResult {
  if (!Array.isArray(value) || value.length === 0) return invalid(`${field} 必须是非空普通字节数组`);
  return validateByteArray(value, field);
}

function optionalDimension(record: Record<string, unknown>, key: string): ValidationResult {
  return record[key] === undefined ? OK : numberField(record, key, 1, 32768);
}

function optionalPositiveNumber(record: Record<string, unknown>, key: string): ValidationResult {
  return record[key] === undefined ? OK : numberField(record, key, 1, 999999999);
}

function validateTextItems(value: unknown, field: string): ValidationResult {
  if (!Array.isArray(value) || value.length > 5000) return invalid(`${field} 最多 5000 项`);
  for (const item of value) {
    if (!isRecord(item) || !validString(item.nodeId, 1, 256) || !validString(item.before, 0, 5000) || !validString(item.after, 0, 5000)) return invalid(`${field} 含有无效文本项`);
  }
  return OK;
}

function validateConfirmedRecord(payload: unknown, type: string, validator: (record: Record<string, unknown>) => ValidationResult = () => OK): ValidationResult {
  if (!isRecord(payload)) return invalid(`${type} payload 必须是对象`);
  if (payload.confirmed !== true) return invalid(`${type}.confirmed 必须为 true`);
  return validator(payload);
}

function validateEnumRecord(payload: unknown, key: string, values: readonly unknown[]): ValidationResult {
  return isRecord(payload) ? enumField(payload, key, values) : invalid(`${key} 所在 payload 必须是对象`);
}

function validateBooleanRecord(payload: unknown, key: string): ValidationResult {
  return isRecord(payload) ? booleanField(payload, key) : invalid(`${key} 所在 payload 必须是对象`);
}

function enumField(record: Record<string, unknown>, key: string, values: readonly unknown[], optional = false): ValidationResult {
  if (optional && record[key] === undefined) return OK;
  return values.includes(record[key]) ? OK : invalid(`${key} 不在允许的枚举范围内`);
}

function numberEnumField(record: Record<string, unknown>, key: string, values: readonly number[]): ValidationResult {
  return values.includes(record[key] as number) ? OK : invalid(`${key} 不在允许的数值范围内`);
}

function enumArrayField(record: Record<string, unknown>, key: string, values: readonly unknown[], max: number): ValidationResult {
  const value = record[key];
  return Array.isArray(value) && value.length <= max && value.every((item) => values.includes(item)) ? OK : invalid(`${key} 包含无效枚举或超过 ${max} 项`);
}

function stringField(record: Record<string, unknown>, key: string, min: number, max: number): ValidationResult {
  return validString(record[key], min, max) ? OK : invalid(`${key} 长度必须为 ${min}-${max}`);
}

function optionalStringField(record: Record<string, unknown>, key: string, max: number): ValidationResult {
  return record[key] === undefined || validString(record[key], 0, max) ? OK : invalid(`${key} 长度不得超过 ${max}`);
}

function stringArrayField(record: Record<string, unknown>, key: string, maxItems: number, maxLength: number): ValidationResult {
  return validStringArray(record[key], maxItems, maxLength) ? OK : invalid(`${key} 最多 ${maxItems} 项，单项最长 ${maxLength}`);
}

function numberField(record: Record<string, unknown>, key: string, min: number, max: number): ValidationResult {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? OK : invalid(`${key} 必须为 ${min}-${max}`);
}

function booleanField(record: Record<string, unknown>, key: string): ValidationResult {
  return typeof record[key] === 'boolean' ? OK : invalid(`${key} 必须为布尔值`);
}

function optionalPoint(value: unknown, field: string): ValidationResult {
  if (value === undefined) return OK;
  if (!isRecord(value)) return invalid(`${field} 必须是坐标对象`);
  return firstInvalid([numberField(value, 'x', -1_000_000, 1_000_000), numberField(value, 'y', -1_000_000, 1_000_000)]);
}

function validString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function validStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => validString(item, 1, maxLength));
}

function validHttpUrl(value: unknown, max: number, allowEmpty: boolean): boolean {
  if (allowEmpty && value === '') return true;
  if (!validString(value, 1, max)) return false;
  const matched = /^https?:\/\/((?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\]))(?::(\d{1,5}))?(?:[/?#][^\s]*)?$/i.exec(value.trim());
  if (!matched) return false;
  return matched[2] === undefined || Number(matched[2]) <= 65_535;
}

function firstInvalid(results: ValidationResult[]): ValidationResult {
  return results.find((result) => !result.ok) ?? OK;
}

function invalid(detail: string): ValidationResult {
  return { ok: false, detail };
}

function invalidSettings(
  field: keyof PluginSettings | undefined,
  detail: string
): SettingsValidationResult {
  return { ok: false, detail, ...(field ? { field } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateImageSplitWrite(payload: unknown): ValidationResult {
  if (!isRecord(payload) || payload.confirmed !== true || !isRecord(payload.source) || !Array.isArray(payload.items)
    || !payload.items.length || payload.items.length > 50) return invalid('请确认分割结果，单次最多 50 项');
  const source = payload.source;
  if (typeof source.nodeId !== 'string' || !source.nodeId || source.nodeId.length > 256
    || typeof source.fingerprint !== 'string' || source.fingerprint.length > 100
    || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height)
    || Number(source.width) < 1 || Number(source.height) < 1 || Number(source.width) * Number(source.height) > 12_000_000) return invalid('原图快照无效');
  let bytes = 0;
  const ids = new Set<string>();
  for (const item of payload.items) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string'
      || item.name.length > 256 || !isRecord(item.bounds) || !Array.isArray(item.imageBytes)) return invalid('分割结果无效');
    ids.add(item.id);
    const b = item.bounds;
    if (![b.x, b.y, b.width, b.height].every(Number.isSafeInteger) || Number(b.x) < 0 || Number(b.y) < 0
      || Number(b.width) < 1 || Number(b.height) < 1 || Number(b.x) + Number(b.width) > Number(source.width)
      || Number(b.y) + Number(b.height) > Number(source.height)) return invalid('分割边界超出原图');
    const imageBytes = item.imageBytes;
    bytes += imageBytes.length;
    if (bytes > SPLIT_MAX_RESULT_BYTES || imageBytes.length < 24 || !imageBytes.every(v => Number.isInteger(v) && v >= 0 && v <= 255)
      || ![137,80,78,71,13,10,26,10].every((v, i) => imageBytes[i] === v)) return invalid('分割图片无效或总量超过 48 MiB');
  }
  return OK;
}
