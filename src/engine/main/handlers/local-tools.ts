import {mutateWithRecovery} from '../mutation';
// Migrated from DesignProMAX v1.0.48; adapted and maintained independently for Figma.
import type { AvailableFontInfo, AvailableFontReferrer, FindReplaceApplyMode, FindReplaceStyleKind, FindReplaceStyleOption, FindReplacePreviewItem, FindReplacePreviewPayload, FindReplacePreviewResult, FindReplaceTextStyle, FindReplaceTarget, PreviewSizeFitPayload, PreviewTextFillPayload, RunCleanupPayload, RunCleanupResult, RunFindReplacePayload, RunSizeFitPayload, RunTextFillPayload, ScanFindReplaceStylesPayload, ScanFindReplaceStylesResult, ScanCleanupPayload } from '../../shared/messages';
import { MAX_CLEANUP_BATCH_SIZE } from '../../shared/messages';
import { createAvailableFontLocalization } from '../../shared/font-localization';
import { buildTextFillPreview } from '../../shared/tooling';
import type { CleanupCandidate, SizeFitPreviewChange, SizeFitPreviewItem, ToolExecutionResult } from '../../shared/types';
import type { HandlerContext, HostNode, HostSolidPaint, HostTextSegStyle } from '../host-runtime';
import { findNodeById, resolveNodeById, resolveNodesById, collectNodesForScope, hasImageFill, hiddenReason, isEffectivelyLocked, isInsideInstance, isTransparentNode, loadNodeFont, nearestContainer, nearestPageName, nodeTypeLabel, nodesForScope, snapshotNode, snapshotNodeWithPreview } from './nodes';
import { reportTaskProgress, throwIfTaskCancelled, yieldTask, runItemBatch } from '../task';
import {guardNodes, withGuardedLayoutMutation, nodeWriteState, selectionState, assertSelection} from '../write-guard';
export function handlePreviewTextFill(context: HandlerContext, payload: PreviewTextFillPayload) {
    throwIfTaskCancelled(context);
    const nodes = nodesForScope(context.host, payload.scope).map(snapshotNode);
    return buildTextFillPreview(nodes, payload);
}
export async function handleListAvailableFonts(context: HandlerContext): Promise<{
    fonts: AvailableFontInfo[];
}> {
    const rawFonts = await context.host.listAvailableFontsAsync?.();
    const uniqueFonts = new Map<string, AvailableFontInfo>();
    for (const rawFont of rawFonts ?? []) {
        const font = normalizeAvailableFont(rawFont);
        if (!font) {
            continue;
        }
        const key = `${font.family}\u0000${font.style}`;
        const existing = uniqueFonts.get(key);
        uniqueFonts.set(key, existing ? mergeAvailableFonts(existing, font) : font);
    }
    return {
        fonts: [...uniqueFonts.values()].sort((left, right) => (left.displayLabel ?? left.label).localeCompare(right.displayLabel ?? right.label, 'zh-CN', { numeric: true }))
    };
}
export function handleScanFindReplaceStyles(context: HandlerContext, payload: ScanFindReplaceStylesPayload): ScanFindReplaceStylesResult {
    const collected = collectNodesForScope(context.host, payload.scope);
    const textNodes = collected.nodes.filter((node) => node.type === 'TEXT');
    const candidates = new Map<string, FindReplaceStyleOption>();
    let skippedLockedCount = 0;
    let skippedHiddenCount = 0;
    let unsupportedCount = 0;
    for (const [index, node] of textNodes.entries()) {
        throwIfTaskCancelled(context);
        reportTaskProgress(context, index + 1, textNodes.length, `正在扫描文字样式 ${index + 1}/${textNodes.length}`);
        if (!payload.includeHiddenText && hiddenReason(node)) {
            skippedHiddenCount += 1;
            continue;
        }
        if (!payload.includeLockedText && isEffectivelyLocked(node)) {
            skippedLockedCount += 1;
            continue;
        }
        const ranges = findKindStyleRanges(node, payload.kind);
        unsupportedCount += ranges.filter((range) => !range.option).length;
        for (const range of ranges) {
            if (!range.option)
                continue;
            const existing = candidates.get(range.option.value);
            candidates.set(range.option.value, existing
                ? { ...existing, count: existing.count + 1 }
                : { ...range.option, count: 1 });
        }
    }
    const items = [...candidates.values()].sort((left, right) => {
        if (payload.kind === 'fontSize') {
            return (left.style.fontSize ?? 0) - (right.style.fontSize ?? 0);
        }
        return left.label.localeCompare(right.label);
    });
    return {
        items,
        scannedCount: collected.nodes.length,
        skippedLockedCount,
        skippedHiddenCount,
        unsupportedCount,
        traversalMode: collected.traversalMode
    };
}
export async function handleRunTextFill(context: HandlerContext, payload: RunTextFillPayload): Promise<ToolExecutionResult> {
    if (!payload.confirmed) throw new Error('CONFIRM_REQUIRED');
    context = {...context, expectedSelection: context.expectedSelection ?? selectionState(context.host)};
    const outcome = await runItemBatch(context, payload.items, async (item, index) => {
        reportTaskProgress(context, index + 1, payload.items.length, `正在填充 ${index + 1}/${payload.items.length}`);
        const node = await resolveNodeById(context.host, item.nodeId);
        if (!node || node.type !== 'TEXT' || isEffectivelyLocked(node)) return false;
        const check = guardNodes(context, [node]);
        check();
        await loadNodeFont(context.host, node);
        check();
        if (isEffectivelyLocked(node)) throw new Error('LOCKED');
        withGuardedLayoutMutation(context, node, () => { node.characters = item.after; });
        return true;
    });
    commitUndoIfChanged(context, outcome.successCount);
    return {...result(outcome.successCount, outcome.failedCount, outcome.cancelled
        ? `操作已停止：成功 ${outcome.successCount} 项，失败 ${outcome.failedCount} 项；已完成的修改保留。`
        : `文本填充完成：成功 ${outcome.successCount} 个，失败 ${outcome.failedCount} 个`), cancelled: outcome.cancelled};
}
function buildFindReplaceItemsForNode(node: HostNode, payload: FindReplacePreviewPayload, target: FindReplaceTarget, applyMode: FindReplaceApplyMode): FindReplacePreviewItem[] {
    const text = String(node.characters ?? '');
    const pageName = nearestPageName(node);
    const containerName = nearestContainer(node)?.name;
    const wholeStyle = readTextStyle(node, 0, text.length);
    const styleReplace = normalizeStyle(payload.styleReplace);
    const ranges = applyMode === 'matchedRange'
        ? payload.findText
            ? findTextRanges(text, payload)
            : payload.styleFindAny?.length || payload.styleFind
                ? findStyleRanges(node)
                : [{ start: 0, end: text.length, value: text }]
        : [{ start: 0, end: text.length, value: text }];
    const items: FindReplacePreviewItem[] = [];
    for (const range of ranges) {
        const beforeStyle = applyMode === 'matchedRange' ? readTextStyle(node, range.start, range.end) : wholeStyle;
        if (!matchesStyleFindAny(beforeStyle, payload.styleFind, payload.styleFindAny)) {
            continue;
        }
        if (!matchesTextFind(applyMode === 'matchedRange' ? range.value : text, payload)) {
            continue;
        }
        const beforeText = applyMode === 'matchedRange' ? range.value : text;
        const afterText = target === 'style'
            ? beforeText
            : applyMode === 'matchedRange'
                ? replacePreviewText(beforeText, payload)
                : applyTextReplacement(beforeText, payload);
        const nextStyle = { ...beforeStyle, ...styleReplace };
        const before = applyMode === 'matchedRange' ? beforeText : text;
        const after = target === 'style' ? before : applyTextReplacement(text, payload);
        const changesText = beforeText !== afterText;
        const changesStyle = hasStyleChange(beforeStyle, nextStyle);
        if (!changesText && !changesStyle) {
            continue;
        }
        items.push({
            nodeId: node.id,
            name: node.name,
            before,
            after,
            beforeText,
            afterText,
            beforeStyle,
            afterStyle: nextStyle,
            pageName,
            containerName,
            rangeStart: applyMode === 'matchedRange' ? range.start : undefined,
            rangeEnd: applyMode === 'matchedRange' ? range.end : undefined,
            applyMode,
            status: 'ready'
        });
    }
    return items;
}
function orderedFindReplaceItems(items: FindReplacePreviewItem[]): FindReplacePreviewItem[] {
    return [...items].sort((left, right) => {
        if (left.nodeId !== right.nodeId) {
            return left.nodeId.localeCompare(right.nodeId);
        }
        return (right.rangeStart ?? 0) - (left.rangeStart ?? 0);
    });
}
function findTextRanges(text: string, payload: FindReplacePreviewPayload): Array<{
    start: number;
    end: number;
    value: string;
}> {
    if (!payload.findText) {
        return [];
    }
    if (payload.matchMode === 'exact') {
        return matchesTextFind(text, payload) ? [{ start: 0, end: text.length, value: text }] : [];
    }
    const haystack = payload.caseSensitive ? text : text.toLowerCase();
    const needle = payload.caseSensitive ? payload.findText : payload.findText.toLowerCase();
    const ranges: Array<{
        start: number;
        end: number;
        value: string;
    }> = [];
    let index = haystack.indexOf(needle);
    while (index >= 0) {
        const end = index + payload.findText.length;
        ranges.push({ start: index, end, value: text.slice(index, end) });
        index = haystack.indexOf(needle, end);
    }
    return ranges;
}
function matchesTextFind(text: string, payload: FindReplacePreviewPayload): boolean {
    if (!payload.findText) {
        return true;
    }
    if (payload.matchMode === 'exact') {
        const left = payload.caseSensitive ? text : text.toLowerCase();
        const right = payload.caseSensitive ? payload.findText : payload.findText.toLowerCase();
        return left === right;
    }
    const left = payload.caseSensitive ? text : text.toLowerCase();
    const right = payload.caseSensitive ? payload.findText : payload.findText.toLowerCase();
    return left.includes(right);
}
function replacePreviewText(input: string, payload: FindReplacePreviewPayload): string {
    if (!payload.replaceText) {
        return input;
    }
    if (!payload.findText) {
        return payload.replaceText;
    }
    if (payload.matchMode === 'exact') {
        return matchesTextFind(input, payload) ? payload.replaceText : input;
    }
    return payload.replaceText;
}
function applyTextReplacement(input: string, payload: FindReplacePreviewPayload): string {
    if (!payload.replaceText) {
        return input;
    }
    if (!payload.findText) {
        return payload.replaceText;
    }
    if (payload.matchMode === 'exact') {
        return matchesTextFind(input, payload) ? payload.replaceText : input;
    }
    const flags = payload.caseSensitive ? 'g' : 'gi';
    return input.replace(new RegExp(escapeRegExp(payload.findText), flags), () => payload.replaceText!);
}
function applyRangeFindReplace(node: HostNode, item: FindReplacePreviewItem, changed: () => void) {
    const start = item.rangeStart ?? 0;
    const end = item.rangeEnd ?? start;
    const text = String(node.characters ?? '');
    const changesText = item.beforeText !== item.afterText;
    if (changesText) {
        node.characters = `${text.slice(0, start)}${item.afterText}${text.slice(end)}`; changed();
    }
    const nextEnd = changesText ? start + item.afterText.length : end;
    applyRangeStyle(node, start, nextEnd, changesText ? item.afterStyle : changedStyleFields(item.beforeStyle, item.afterStyle), changed);
}
function applyWholeNodeStyle(node: HostNode, style: FindReplaceTextStyle, changed: () => void = () => {}) {
    const fontName = fontNameFromStyle(style);
    if (fontName) {
        node.fontName = fontName; changed();
    }
    if (typeof style.fontSize === 'number') {
        node.fontSize = style.fontSize; changed();
    }
    if (style.color) {
        node.fills = solidFillFromHex(style.color); changed();
    }
}
function applyRangeStyle(node: HostNode, start: number, end: number, style: FindReplaceTextStyle, changed: () => void = () => {}) {
    const fontName = fontNameFromStyle(style);
    if (fontName) {
        if (!node.setRangeFontName)
            throw new Error('RANGE_FONT_NAME_UNSUPPORTED');
        node.setRangeFontName(start, end, fontName); changed();
    }
    if (typeof style.fontSize === 'number') {
        if (!node.setRangeFontSize)
            throw new Error('RANGE_FONT_SIZE_UNSUPPORTED');
        node.setRangeFontSize(start, end, style.fontSize); changed();
    }
    if (style.color) {
        if (!node.setRangeFills)
            throw new Error('RANGE_FILL_UNSUPPORTED');
        node.setRangeFills(start, end, solidFillFromHex(style.color)); changed();
    }
}
function changedStyleFields(before: FindReplaceTextStyle, after: FindReplaceTextStyle): FindReplaceTextStyle {
    const changed: FindReplaceTextStyle = {};
    if (before.fontFamily !== after.fontFamily || before.fontStyle !== after.fontStyle) {
        changed.fontFamily = after.fontFamily;
        changed.fontStyle = after.fontStyle;
    }
    if (before.fontSize !== after.fontSize) {
        changed.fontSize = after.fontSize;
    }
    if (normalizeHexColor(before.color) !== normalizeHexColor(after.color)) {
        changed.color = after.color;
    }
    return changed;
}
async function loadReplacementFont(context: HandlerContext, style: FindReplaceTextStyle) {
    const fontName = fontNameFromStyle(style);
    if (fontName) {
        await context.host.loadFontAsync?.(fontName);
    }
}
function readTextStyle(node: HostNode, start: number, end: number): FindReplaceTextStyle {
    const segmentRanges = normalizedTextStyleRanges(node);
    if (segmentRanges) {
        const textLength = String(node.characters ?? '').length;
        const safeStart = Math.max(0, Math.min(textLength, Math.trunc(start)));
        const safeEnd = Math.max(safeStart, Math.min(textLength, Math.trunc(end)));
        const styles = segmentRanges
            .filter((range) => range.start < safeEnd && range.end > safeStart)
            .map((range) => range.style);
        return commonTextStyle(styles);
    }
    return readLegacyTextStyle(node, start, end);
}
function readLegacyTextStyle(node: HostNode, start: number, end: number): FindReplaceTextStyle {
    const fontName = node.getRangeFontName?.(start, end) ?? node.fontName;
    const fontSize = node.getRangeFontSize?.(start, end) ?? node.fontSize;
    const fills = node.getRangeFills?.(start, end) ?? node.fills;
    return {
        ...styleFromFontName(fontName),
        fontSize: typeof fontSize === 'number' ? fontSize : undefined,
        color: colorFromFills(fills)
    };
}
type TextStyleRange = {
    start: number;
    end: number;
    style: FindReplaceTextStyle;
};
function normalizedTextStyleRanges(node: HostNode): TextStyleRange[] | undefined {
    if (!Array.isArray(node.textStyles) || node.textStyles.length === 0) {
        return undefined;
    }
    const textLength = String(node.characters ?? '').length;
    if (textLength === 0) {
        return [];
    }
    const normalized = node.textStyles
        .map((segment) => normalizeTextStyleSegment(segment, textLength))
        .filter((segment): segment is TextStyleRange => Boolean(segment))
        .sort((left, right) => left.start - right.start || left.end - right.end);
    if (normalized.length === 0) {
        return [{ start: 0, end: textLength, style: {} }];
    }
    const covered: TextStyleRange[] = [];
    let cursor = 0;
    for (const segment of normalized) {
        if (segment.end <= cursor) {
            continue;
        }
        if (segment.start > cursor) {
            covered.push({ start: cursor, end: segment.start, style: {} });
        }
        const next = { ...segment, start: Math.max(cursor, segment.start) };
        if (next.end > next.start) {
            covered.push(next);
            cursor = next.end;
        }
        if (cursor >= textLength) {
            break;
        }
    }
    if (cursor < textLength) {
        covered.push({ start: cursor, end: textLength, style: {} });
    }
    return mergeTextStyleRanges(covered);
}
function normalizeTextStyleSegment(segment: HostTextSegStyle, textLength: number): TextStyleRange | undefined {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end)) {
        return undefined;
    }
    const start = Math.max(0, Math.min(textLength, Math.trunc(segment.start)));
    const end = Math.max(0, Math.min(textLength, Math.trunc(segment.end)));
    if (end <= start) {
        return undefined;
    }
    const textStyle = segment.textStyle;
    const fontName = textStyle?.fontName ?? textStyle?.localizedFontName;
    return {
        start,
        end,
        style: {
            ...styleFromFontName(fontName),
            fontSize: typeof textStyle?.fontSize === 'number' && Number.isFinite(textStyle.fontSize)
                ? textStyle.fontSize
                : undefined,
            color: colorFromFills(segment.fills)
        }
    };
}
function commonTextStyle(styles: FindReplaceTextStyle[]): FindReplaceTextStyle {
    if (styles.length === 0) {
        return {};
    }
    return {
        fontFamily: commonStyleValue(styles, 'fontFamily'),
        fontStyle: commonStyleValue(styles, 'fontStyle'),
        fontSize: commonStyleValue(styles, 'fontSize'),
        color: commonStyleValue(styles, 'color')
    };
}
function commonStyleValue<K extends keyof FindReplaceTextStyle>(styles: FindReplaceTextStyle[], key: K): FindReplaceTextStyle[K] | undefined {
    const first = styles[0][key];
    return styles.every((style) => style[key] === first) ? first : undefined;
}
function mergeTextStyleRanges(ranges: TextStyleRange[]): TextStyleRange[] {
    const merged: TextStyleRange[] = [];
    for (const range of ranges) {
        const previous = merged[merged.length - 1];
        if (previous && previous.end === range.start && styleSignature(previous.style) === styleSignature(range.style)) {
            previous.end = range.end;
        }
        else {
            merged.push({ ...range, style: { ...range.style } });
        }
    }
    return merged;
}
function styleFromFontName(fontName: unknown): FindReplaceTextStyle {
    if (typeof fontName === 'object' && fontName) {
        const candidate = fontName as {
            family?: unknown;
            fontFamily?: unknown;
            style?: unknown;
            fontStyle?: unknown;
        };
        return {
            fontFamily: stringValue(candidate.family) ?? stringValue(candidate.fontFamily),
            fontStyle: stringValue(candidate.style) ?? stringValue(candidate.fontStyle)
        };
    }
    if (typeof fontName === 'string') {
        return { fontFamily: fontName };
    }
    return {};
}
function fontNameFromStyle(style: FindReplaceTextStyle): {
    family: string;
    style: string;
} | undefined {
    if (!style.fontFamily) {
        return undefined;
    }
    return { family: style.fontFamily, style: style.fontStyle || 'Regular' };
}
function normalizeStyle(style: FindReplaceTextStyle | undefined): FindReplaceTextStyle {
    if (!style) {
        return {};
    }
    const normalized: FindReplaceTextStyle = {};
    const fontFamily = nonEmpty(style.fontFamily);
    const fontStyle = nonEmpty(style.fontStyle);
    const color = normalizeHexColor(style.color);
    if (fontFamily) {
        normalized.fontFamily = fontFamily;
    }
    if (fontStyle) {
        normalized.fontStyle = fontStyle;
    }
    if (typeof style.fontSize === 'number' && style.fontSize > 0) {
        normalized.fontSize = style.fontSize;
    }
    if (color) {
        normalized.color = color;
    }
    return normalized;
}
function matchesStyleFind(style: FindReplaceTextStyle, styleFind: FindReplaceTextStyle | undefined): boolean {
    const normalized = normalizeStyle(styleFind);
    if (normalized.fontFamily && normalized.fontFamily !== style.fontFamily) {
        return false;
    }
    if (normalized.fontStyle && normalized.fontStyle !== style.fontStyle) {
        return false;
    }
    if (typeof normalized.fontSize === 'number' && normalized.fontSize !== style.fontSize) {
        return false;
    }
    if (normalized.color && normalized.color !== normalizeHexColor(style.color)) {
        return false;
    }
    return true;
}
function matchesStyleFindAny(style: FindReplaceTextStyle, styleFind: FindReplaceTextStyle | undefined, styleFindAny: FindReplaceTextStyle[] | undefined): boolean {
    if (styleFindAny?.length) {
        return styleFindAny.some((candidate) => matchesStyleFind(style, candidate));
    }
    return matchesStyleFind(style, styleFind);
}
function findStyleRanges(node: HostNode): Array<{
    start: number;
    end: number;
    value: string;
}> {
    const text = String(node.characters ?? '');
    if (!text)
        return [];
    const segmentRanges = normalizedTextStyleRanges(node);
    if (segmentRanges) {
        return segmentRanges.map((range) => ({
            start: range.start,
            end: range.end,
            value: text.slice(range.start, range.end)
        }));
    }
    const ranges: Array<{
        start: number;
        end: number;
        value: string;
    }> = [];
    let start = 0;
    let previousKey = styleSignature(readLegacyTextStyle(node, 0, 1));
    for (let index = 1; index < text.length; index += 1) {
        const key = styleSignature(readLegacyTextStyle(node, index, index + 1));
        if (key === previousKey)
            continue;
        ranges.push({ start, end: index, value: text.slice(start, index) });
        start = index;
        previousKey = key;
    }
    ranges.push({ start, end: text.length, value: text.slice(start) });
    return ranges;
}
function findKindStyleRanges(node: HostNode, kind: FindReplaceStyleKind): Array<{
    start: number;
    end: number;
    option?: Omit<FindReplaceStyleOption, 'count'>;
}> {
    const text = String(node.characters ?? '');
    if (!text)
        return [];
    const segmentRanges = normalizedTextStyleRanges(node);
    if (segmentRanges) {
        const ranges: Array<{
            start: number;
            end: number;
            option?: Omit<FindReplaceStyleOption, 'count'>;
        }> = [];
        for (const segment of segmentRanges) {
            const option = styleOption(kind, segment.style);
            const previous = ranges[ranges.length - 1];
            if (previous && previous.end === segment.start && (previous.option?.value ?? '__unsupported__') === (option?.value ?? '__unsupported__')) {
                previous.end = segment.end;
            }
            else {
                ranges.push({ start: segment.start, end: segment.end, option });
            }
        }
        return ranges;
    }
    const ranges: Array<{
        start: number;
        end: number;
        option?: Omit<FindReplaceStyleOption, 'count'>;
    }> = [];
    let start = 0;
    let option = styleOption(kind, readLegacyTextStyle(node, 0, 1));
    let previousKey = option?.value ?? '__unsupported__';
    for (let index = 1; index < text.length; index += 1) {
        const nextOption = styleOption(kind, readLegacyTextStyle(node, index, index + 1));
        const nextKey = nextOption?.value ?? '__unsupported__';
        if (nextKey === previousKey)
            continue;
        ranges.push({ start, end: index, option });
        start = index;
        option = nextOption;
        previousKey = nextKey;
    }
    ranges.push({ start, end: text.length, option });
    return ranges;
}
function styleOption(kind: FindReplaceStyleKind, style: FindReplaceTextStyle): Omit<FindReplaceStyleOption, 'count'> | undefined {
    if (kind === 'font') {
        if (!style.fontFamily)
            return undefined;
        const fontStyle = style.fontStyle || 'Regular';
        return {
            value: `${style.fontFamily}\u0000${fontStyle}`,
            label: `${style.fontFamily} / ${fontStyle}`,
            style: { fontFamily: style.fontFamily, fontStyle }
        };
    }
    if (kind === 'fontSize') {
        if (typeof style.fontSize !== 'number' || !Number.isFinite(style.fontSize) || style.fontSize <= 0)
            return undefined;
        return { value: String(style.fontSize), label: String(style.fontSize), style: { fontSize: style.fontSize } };
    }
    const color = normalizeHexColor(style.color);
    return color ? { value: color, label: color, style: { color } } : undefined;
}
function styleSignature(style: FindReplaceTextStyle): string {
    return [style.fontFamily ?? '', style.fontStyle ?? '', style.fontSize ?? '', normalizeHexColor(style.color) ?? ''].join('\u0000');
}
function hasStyleChange(before: FindReplaceTextStyle, after: FindReplaceTextStyle): boolean {
    return (before.fontFamily !== after.fontFamily ||
        before.fontStyle !== after.fontStyle ||
        before.fontSize !== after.fontSize ||
        normalizeHexColor(before.color) !== normalizeHexColor(after.color));
}
function colorFromFills(fills: unknown): string | undefined {
    if (!Array.isArray(fills) || fills.length !== 1) {
        return undefined;
    }
    const firstFill = fills[0];
    if (!firstFill || typeof firstFill !== 'object') {
        return undefined;
    }
    const fill = firstFill as {
        type?: unknown;
        color?: unknown;
    };
    if (fill.type !== undefined && fill.type !== 'SOLID') {
        return undefined;
    }
    const color = fill.color;
    if (!color || typeof color !== 'object') {
        return undefined;
    }
    const rgb = color as {
        r?: unknown;
        g?: unknown;
        b?: unknown;
    };
    if (typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
        return undefined;
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}
function solidFillFromHex(color: string): ReadonlyArray<HostSolidPaint> {
    const normalized = normalizeHexColor(color);
    const rgb = hexToRgb(normalized ?? '#000000');
    return [{ type: 'SOLID', color: { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 } }];
}
function normalizeHexColor(color: string | undefined): string | undefined {
    const value = color?.trim();
    if (!value) {
        return undefined;
    }
    const shorthand = /^#?([0-9a-fA-F]{3})$/.exec(value);
    if (shorthand) {
        return `#${shorthand[1].split('').map((part) => `${part}${part}`).join('').toUpperCase()}`;
    }
    const full = /^#?([0-9a-fA-F]{6})$/.exec(value);
    return full ? `#${full[1].toUpperCase()}` : undefined;
}
function hexToRgb(color: string): {
    r: number;
    g: number;
    b: number;
} {
    const value = color.replace('#', '');
    return {
        r: parseInt(value.slice(0, 2), 16) / 255,
        g: parseInt(value.slice(2, 4), 16) / 255,
        b: parseInt(value.slice(4, 6), 16) / 255
    };
}
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
}
function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value : undefined;
}
function normalizeAvailableFont(rawFont: unknown): AvailableFontInfo | undefined {
    const candidate = rawFont as {
        family?: unknown;
        style?: unknown;
        fontName?: unknown;
        localizedFontName?: unknown;
        displayFontName?: unknown;
        localizedFamily?: unknown;
        localizedStyle?: unknown;
        displayFamily?: unknown;
        displayStyle?: unknown;
        localizedName?: unknown;
        displayName?: unknown;
        referrer?: unknown;
    };
    const fontName = typeof candidate?.fontName === 'object' && candidate.fontName
        ? candidate.fontName as {
            family?: unknown;
            style?: unknown;
        }
        : candidate;
    const family = stringValue(fontName.family);
    const style = stringValue(fontName.style) ?? 'Regular';
    if (!family) {
        return undefined;
    }
    const localizedFontName = objectValue(candidate.localizedFontName) ?? objectValue(candidate.displayFontName);
    const displayFamily = stringValue(localizedFontName?.family)
        ?? stringValue(candidate.localizedFamily)
        ?? stringValue(candidate.displayFamily);
    const displayStyle = stringValue(localizedFontName?.style)
        ?? stringValue(candidate.localizedStyle)
        ?? stringValue(candidate.displayStyle);
    const aliases = [stringValue(candidate.localizedName), stringValue(candidate.displayName)]
        .filter((value): value is string => Boolean(value));
    return {
        family,
        style,
        label: `${family} / ${style}`,
        ...createAvailableFontLocalization(family, style, { family: displayFamily, style: displayStyle, aliases }),
        referrers: [normalizeFontReferrer(candidate.referrer)]
    };
}
function objectValue(value: unknown): {
    family?: unknown;
    style?: unknown;
} | undefined {
    return typeof value === 'object' && value ? value as {
        family?: unknown;
        style?: unknown;
    } : undefined;
}
function normalizeFontReferrer(value: unknown): AvailableFontReferrer {
    return value === 'local' || value === 'team' || value === 'org' || value === 'official'
        ? value
        : 'unknown';
}
function mergeFontReferrers(left: AvailableFontReferrer[], right: AvailableFontReferrer[]): AvailableFontReferrer[] {
    return [...new Set([...left, ...right])];
}
function mergeAvailableFonts(left: AvailableFontInfo, right: AvailableFontInfo): AvailableFontInfo {
    const preferred = left.displayLabel && left.displayLabel !== left.label ? left : right;
    return {
        ...left,
        displayFamily: preferred.displayFamily,
        displayStyle: preferred.displayStyle,
        displayLabel: preferred.displayLabel,
        aliases: [...new Set([...(left.aliases ?? []), ...(right.aliases ?? [])])],
        searchKeywords: [...new Set([...(left.searchKeywords ?? []), ...(right.searchKeywords ?? [])])],
        familyAliases: [...new Set([...(left.familyAliases ?? []), ...(right.familyAliases ?? [])])],
        styleAliases: [...new Set([...(left.styleAliases ?? []), ...(right.styleAliases ?? [])])],
        familySearchKeywords: [...new Set([...(left.familySearchKeywords ?? []), ...(right.familySearchKeywords ?? [])])],
        styleSearchKeywords: [...new Set([...(left.styleSearchKeywords ?? []), ...(right.styleSearchKeywords ?? [])])],
        referrers: mergeFontReferrers(left.referrers, right.referrers)
    };
}
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function handleScanCleanup(context: HandlerContext, payload: ScanCleanupPayload) {
    const candidates: CleanupCandidate[] = [];
    const collected = collectNodesForScope(context.host, payload.scope);
    const nodes = collected.nodes;
    let skippedLockedCount = 0;
    let instanceInternalCount = 0;
    let officialHiddenCount = 0;
    let fallbackHiddenCount = 0;
    let officialLockedCount = 0;
    for (const [index, node] of nodes.entries()) {
        throwIfTaskCancelled(context);
        reportTaskProgress(context, index + 1, nodes.length, `正在扫描 ${index + 1}/${nodes.length}`);
        if (node.isVisible === false) {
            officialHiddenCount += 1;
        }
        else if (node.isVisible === undefined && node.visible === false) {
            fallbackHiddenCount += 1;
        }
        if (node.isLocked === true) {
            officialLockedCount += 1;
        }
        const insideInstance = isInsideInstance(node);
        if (insideInstance) {
            instanceInternalCount += 1;
        }
        const locked = isEffectivelyLocked(node);
        if (!payload.includeLocked && locked) {
            skippedLockedCount += 1;
            continue;
        }
        if (insideInstance && !payload.includeComponentInstanceChildren) continue;
        const reason = cleanupReason(node, payload.types);
        if (reason) {
            candidates.push({
                nodeId: node.id,
                name: node.name,
                type: node.type,
                typeLabel: nodeTypeLabel(node.type, hasImageFill(node)),
                reason,
                pageName: nearestPageName(node),
                locked,
                insideInstance
            });
        }
    }
    return {
        items: candidates,
        total: candidates.length,
        skipped: nodes.length - candidates.length,
        scannedCount: nodes.length,
        skippedLockedCount,
        instanceInternalCount,
        traversalMode: collected.traversalMode,
        officialHiddenCount,
        fallbackHiddenCount,
        officialLockedCount
    };
}
export async function handleRunCleanup(context: HandlerContext, payload: RunCleanupPayload): Promise<RunCleanupResult> {
    if (!payload.confirmed) {
        throw new Error('CONFIRM_REQUIRED');
    }
    if (payload.nodeIds.length > MAX_CLEANUP_BATCH_SIZE) {
        throw new Error('CLEANUP_BATCH_TOO_LARGE');
    }
    let successCount = 0;
    const successNodeIds: string[] = [];
    const failedItems: RunCleanupResult['failedItems'] = [];
    const types = cleanupTypesForRun(payload);
    const includeComponentInstanceChildren = payload.includeComponentInstanceChildren === true;
    const expectedSelection = context.expectedSelection ?? selectionState(context.host);
    let nodesById: Map<string, HostNode>;
    try {
        reportTaskProgress(context, 0, payload.nodeIds.length, '正在建立清理索引');
        nodesById = await resolveNodesById(context.host, payload.nodeIds);
    }
    catch (error) {
        throw cleanupHostError('建立清理索引', error);
    }
    assertSelection(context.host, expectedSelection);
    for (const [index, nodeId] of payload.nodeIds.entries()) {
        if (context.signal?.aborted) { if (!successCount && !failedItems.length) throwIfTaskCancelled(context); break; }
        try {
            reportTaskProgress(context, index + 1, payload.nodeIds.length, `正在清理 ${index + 1}/${payload.nodeIds.length}`);
            assertSelection(context.host, expectedSelection, new Set(successNodeIds));
            const node = nodesById.get(nodeId);
            if (node && context.expectedNodes?.has(nodeId) && context.expectedNodes.get(nodeId) !== nodeWriteState(node)) throw new Error('STALE');
            const failureReason = cleanupRunFailureReason(node, types, includeComponentInstanceChildren);
            if (failureReason) {
                failedItems.push({ nodeId, reason: failureReason });
                continue;
            }
            node!.remove!();
            successCount += 1;
            successNodeIds.push(nodeId);
        }
        catch (error) {
            throwIfTaskCancelled(context);
            failedItems.push({ nodeId, reason: cleanupRemovalFailureReason(error) });
        }
        finally {
            // Acknowledge completed deletes even when cancellation arrives during the yield.
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
    }
    try {
        commitUndoIfChanged(context, successCount);
    }
    catch (error) {
        throw cleanupHostError('提交撤销记录', error);
    }
    const failedCount = failedItems.length;
    return {
        cancelled: successNodeIds.length + failedItems.length < payload.nodeIds.length,
        requestedCount: payload.nodeIds.length,
        successCount,
        failedCount,
        successNodeIds,
        failedItems,
        message: `清理完成：成功 ${successCount} 个，失败 ${failedCount} 个，可通过 Figma 撤销恢复`,
        recoverable: true
    };
}
export function handleFindReplacePreview(context: HandlerContext, payload: FindReplacePreviewPayload) {
    const collected = collectNodesForScope(context.host, payload.scope);
    const textNodes = collected.nodes.filter((node) => node.type === 'TEXT');
    const target = payload.target ?? 'text';
    const applyMode = payload.applyMode ?? 'wholeNode';
    const items: FindReplacePreviewItem[] = [];
    let skippedLockedCount = 0;
    let skippedHiddenCount = 0;
    for (const [index, node] of textNodes.entries()) {
        throwIfTaskCancelled(context);
        reportTaskProgress(context, index + 1, textNodes.length, `正在查找 ${index + 1}/${textNodes.length}`);
        if (!payload.includeHiddenText && hiddenReason(node)) {
            skippedHiddenCount += 1;
            continue;
        }
        if (!payload.includeLockedText && isEffectivelyLocked(node)) {
            skippedLockedCount += 1;
            continue;
        }
        const nodeItems = buildFindReplaceItemsForNode(node, payload, target, applyMode);
        items.push(...nodeItems);
    }
    const affectedNodeIds = new Set(items.filter((item) => item.status === 'ready').map((item) => item.nodeId));
    const affectedRangeCount = items.filter((item) => item.status === 'ready' && item.applyMode === 'matchedRange').length;
    return {
        items,
        total: items.length,
        skipped: collected.nodes.length - textNodes.length + skippedLockedCount + skippedHiddenCount,
        scannedCount: collected.nodes.length,
        skippedLockedCount,
        skippedHiddenCount,
        affectedNodeCount: affectedNodeIds.size,
        affectedRangeCount,
        traversalMode: collected.traversalMode
    } satisfies FindReplacePreviewResult;
}
export async function handleRunFindReplace(context: HandlerContext, payload: RunFindReplacePayload): Promise<ToolExecutionResult> {
    if (!payload.confirmed) throw new Error('CONFIRM_REQUIRED');
    context = {...context, expectedSelection: context.expectedSelection ?? selectionState(context.host)};
    const grouped = new Map<string, FindReplacePreviewItem[]>();
    for (const item of orderedFindReplaceItems(payload.items)) grouped.set(item.nodeId, [...(grouped.get(item.nodeId) ?? []), item]);
    const groups = [...grouped.values()];
    let successCount = 0, failedCount = 0;
    const outcome = await runItemBatch(context, groups, async (items, index) => {
        reportTaskProgress(context, index + 1, groups.length, `正在替换 ${index + 1}/${groups.length}`);
        const node = await resolveNodeById(context.host, items[0].nodeId);
        if (!node || node.type !== 'TEXT' || isEffectivelyLocked(node) || items.some(item => item.status !== 'ready')) { failedCount += items.length; return false; }
        const check = guardNodes(context, [node]);
        try {
            check();
            await loadNodeFont(context.host, node);
            check();
            for (const item of items) { await loadReplacementFont(context, item.afterStyle); check(); }
            const before = {text: String(node.characters ?? ''), font: node.fontName, size: node.fontSize, fills: node.fills, ranges: normalizedTextStyleRanges(node)};
            withGuardedLayoutMutation(context, node, () => mutateWithRecovery(context.host, changed => {
                for (const item of items) {
                    if (item.applyMode === 'matchedRange' && typeof item.rangeStart === 'number' && typeof item.rangeEnd === 'number') applyRangeFindReplace(node, item, changed);
                    else { node.characters = item.afterText; changed(); applyWholeNodeStyle(node, item.afterStyle, changed); }
                }
            }, () => {
                node.characters = before.text;
                if (before.font !== 'mixed' && before.font) node.fontName = before.font;
                if (typeof before.size === 'number') node.fontSize = before.size;
                if (before.fills) node.fills = before.fills;
                for (const range of before.ranges ?? []) applyRangeStyle(node, range.start, range.end, range.style);
            }));
            successCount += items.length;
            return true;
        } catch (error) { if (!context.signal?.aborted) failedCount += items.length; throw error; }
    });
    commitUndoIfChanged(context, successCount);
    return {...result(successCount, failedCount, outcome.cancelled
        ? `操作已停止：成功 ${successCount} 项，失败 ${failedCount} 项；已完成的修改保留。`
        : `替换完成：成功 ${successCount} 个，失败 ${failedCount} 个`), cancelled: outcome.cancelled};
}
export async function handlePreviewSizeFit(context: HandlerContext, payload: PreviewSizeFitPayload) {
    throwIfTaskCancelled(context);
    const targetNodes = scaleTargetNodes(context, payload.nodeIds);
    const check = guardNodes(context, targetNodes);check();
    const items = await Promise.all(targetNodes.map((node) => buildSizeFitPreviewItem(context, node, payload)));
    check();
    return {
        items,
        total: items.length,
        skipped: 0
    };
}
export async function handleRunSizeFit(context: HandlerContext, payload: RunSizeFitPayload): Promise<ToolExecutionResult> {
    if (!payload.confirmed) throw new Error('CONFIRM_REQUIRED');
    const targetNodes = scaleTargetNodes(context, payload.nodeIds);
    const check = guardNodes(context, targetNodes);
    check();
    const preview = await handlePreviewSizeFit(context, { ...payload, nodeIds: targetNodes.map(node => node.id) });
    check();
    let frozenCount = 0;
    const outcome = await runItemBatch(context, preview.items, async (item, index) => {
        reportTaskProgress(context, index + 1, preview.items.length, `正在适配 ${index + 1}/${preview.items.length}`);
        const node = findNodeById(context.host.document.currentPage, item.nodeId);
        if (!node || !item.canRun) return false;
        guardNodes(context, [node])();
        withGuardedLayoutMutation(context, node, () => fitSizeTopLevelNode(context, node, item, payload));
        frozenCount += item.frozenCount ?? 0;
        return true;
    });
    commitUndoIfChanged(context, outcome.successCount);
    return {...result(outcome.successCount, outcome.failedCount, outcome.cancelled
        ? `操作已停止：成功 ${outcome.successCount} 项，失败 ${outcome.failedCount} 项；已完成的修改保留。`
        : `适配完成：成功 ${outcome.successCount} 个，失败 ${outcome.failedCount} 个，冻结 ${frozenCount} 个不确定区域，可通过 Figma 撤销恢复`), cancelled: outcome.cancelled};
}
async function buildSizeFitPreviewItem(context: HandlerContext, node: HostNode, payload: PreviewSizeFitPayload): Promise<SizeFitPreviewItem> {
    const snapshot = await snapshotNodeWithPreview(node, undefined, context);
    const beforeWidth = typeof node.width === 'number' ? node.width : 0;
    const beforeHeight = typeof node.height === 'number' ? node.height : 0;
    const afterWidth = payload.axis === 'height' ? beforeWidth : roundDimension(payload.targetWidth);
    const afterHeight = payload.axis === 'width' ? beforeHeight : roundDimension(payload.targetHeight);
    const widthRatio = beforeWidth > 0 ? afterWidth / beforeWidth : 0;
    const heightRatio = beforeHeight > 0 ? afterHeight / beforeHeight : 0;
    const noChange = afterWidth === beforeWidth && afterHeight === beforeHeight;
    const blockedReason = noChange ? undefined : sizeFitBlockedReason(node, payload);
    const fitMode: SizeFitPreviewItem['fitMode'] = noChange ? 'noChange' : sizeFitMode(node, payload, blockedReason);
    const analysis = blockedReason
        ? emptySizeFitAnalysis(blockedReason)
        : analyzeSizeFitPlan(createScaleSnapshot(node), afterWidth, afterHeight, payload, fitMode);
    const finalBlockedReason = blockedReason ?? analysis.blockedReason;
    return {
        nodeId: node.id,
        name: node.name,
        typeLabel: snapshot.typeLabel,
        previewImageBytes: snapshot.previewImageBytes,
        previewMimeType: snapshot.previewMimeType,
        beforeWidth,
        beforeHeight,
        afterWidth,
        afterHeight,
        widthRatio: roundDimension(widthRatio),
        heightRatio: roundDimension(heightRatio),
        fitMode,
        fitModeLabel: sizeFitModeLabel(fitMode),
        confidence: analysis.confidence,
        confidenceLabel: sizeFitConfidenceLabel(analysis.confidence),
        movedCount: analysis.movedCount,
        resizedCount: analysis.resizedCount,
        preservedCount: analysis.preservedCount,
        frozenCount: analysis.frozenCount,
        changes: analysis.changes,
        warnings: analysis.warnings,
        canRun: fitMode !== 'noChange' && !finalBlockedReason,
        blockedReason: finalBlockedReason
    };
}
function sizeFitBlockedReason(node: HostNode, payload: PreviewSizeFitPayload): string | undefined {
    if (payload.targetWidth <= 0 || payload.targetHeight <= 0) {
        return '目标尺寸无效';
    }
    if (isEffectivelyLocked(node)) {
        return '对象已锁定';
    }
    if (typeof node.width !== 'number' || node.width <= 0 || typeof node.height !== 'number' || node.height <= 0) {
        return '原尺寸无效';
    }
    if (!node.resize) {
        return '缺少尺寸调整能力';
    }
    const targetWidth = payload.axis === 'height' ? node.width : payload.targetWidth;
    const targetHeight = payload.axis === 'width' ? node.height : payload.targetHeight;
    const widthLimits = normalizeSizeFitLimits(node.width, node.minWidth, node.maxWidth);
    const heightLimits = normalizeSizeFitLimits(node.height, node.minHeight, node.maxHeight);
    if (typeof targetWidth === 'number' && targetWidth !== node.width) {
        if (widthLimits.min !== undefined && targetWidth < widthLimits.min) {
            return `目标宽度低于对象的最小宽度 ${roundDimension(widthLimits.min)}px`;
        }
        if (widthLimits.max !== undefined && targetWidth > widthLimits.max) {
            return `目标宽度超过对象的最大宽度 ${roundDimension(widthLimits.max)}px`;
        }
    }
    if (typeof targetHeight === 'number' && targetHeight !== node.height) {
        if (heightLimits.min !== undefined && targetHeight < heightLimits.min) {
            return `目标高度低于对象的最小高度 ${roundDimension(heightLimits.min)}px`;
        }
        if (heightLimits.max !== undefined && targetHeight > heightLimits.max) {
            return `目标高度超过对象的最大高度 ${roundDimension(heightLimits.max)}px`;
        }
    }
    if (node.type === 'GROUP' && node.children?.length && !hasMatchingAspectRatio(node, payload)) {
        return '分组仅支持保持宽高比的尺寸适配，请改用等比缩放或先转换为画板';
    }
    if ((node.constrainProportions === true
        || ['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'ELLIPSE'].includes(node.type))
        && !hasMatchingAspectRatio(node, payload)) {
        return '该对象已锁定宽高比，不能执行非等比尺寸适配';
    }
    return undefined;
}
function hasMatchingAspectRatio(node: HostNode, payload: PreviewSizeFitPayload): boolean {
    if (!node.width || !node.height) {
        return false;
    }
    const targetWidth = payload.axis === 'height' ? node.width : payload.targetWidth;
    const targetHeight = payload.axis === 'width' ? node.height : payload.targetHeight;
    return Math.abs((targetWidth / node.width) - (targetHeight / node.height)) < 0.0001;
}
function hasAutoLayout(node: HostNode): boolean {
    return typeof node.layoutMode === 'string' && node.layoutMode !== 'NONE';
}
function sizeFitMode(node: HostNode, payload: PreviewSizeFitPayload, blockedReason: string | undefined): SizeFitPreviewItem['fitMode'] {
    if (blockedReason) {
        return 'blocked';
    }
    if (!node.children?.length || isNativeSizeFitBoundary(node)) {
        return 'leaf';
    }
    if (hasAutoLayout(node)) {
        return 'autoLayout';
    }
    return payload.strategy;
}
function sizeFitModeLabel(mode: SizeFitPreviewItem['fitMode']): string {
    if (mode === 'noChange') {
        return '无需适配';
    }
    if (mode === 'autoLayout') {
        return '自动布局适配';
    }
    if (mode === 'conservative') {
        return '保守约束适配';
    }
    if (mode === 'smart') {
        return '智能结构适配';
    }
    if (mode === 'leaf') {
        return '简单对象适配';
    }
    return '不可适配';
}
function sizeFitConfidenceLabel(confidence: SizeFitPreviewItem['confidence']): string {
    return ({ high: '高', medium: '中', low: '低' } as const)[confidence];
}
function fitSizeTopLevelNode(context: HandlerContext, node: HostNode, item: SizeFitPreviewItem, payload: PreviewSizeFitPayload) {
    const blockedReason = sizeFitBlockedReason(node, {
        nodeIds: [node.id],
        targetWidth: item.afterWidth,
        targetHeight: item.afterHeight,
        axis: payload.axis,
        strategy: payload.strategy
    });
    if (blockedReason) {
        throw new Error(blockedReason);
    }
    const snapshot = createScaleSnapshot(node);
    throwIfTaskCancelled(context);
    if (item.fitMode === 'conservative' || item.fitMode === 'smart') {
        const analysis = analyzeSizeFitPlan(snapshot, item.afterWidth, item.afterHeight, payload, item.fitMode);
        if (!analysis.plan || analysis.blockedReason) {
            throw new Error(analysis.blockedReason ?? 'SIZE_FIT_PLAN_UNAVAILABLE');
        }
        assertSizeFitPlanWritable(analysis.plan);
        applySizeFitPlan(analysis.plan);
    }
    else {
        node.resize?.(item.afterWidth, item.afterHeight);
    }
}
type ScaleNodeSnapshot = {
    node: HostNode;
    id: string;
    type: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    constrainProportions?: boolean;
    layoutSizingHorizontal?: HostNode['layoutSizingHorizontal'];
    layoutSizingVertical?: HostNode['layoutSizingVertical'];
    layoutGrow?: number;
    layoutAlign?: HostNode['layoutAlign'];
    clipsContent?: boolean;
    textAutoResize?: string;
    minWidth?: number | null;
    maxWidth?: number | null;
    minHeight?: number | null;
    maxHeight?: number | null;
    fontName?: unknown;
    fontSize?: unknown;
    lineHeight?: unknown;
    letterSpacing?: unknown;
    paragraphSpacing?: unknown;
    rangeFontNames: unknown[];
    rangeFontSizes: Array<{
        start: number;
        end: number;
        value: number;
    }>;
    strokeWeight?: number;
    cornerRadius?: unknown;
    topLeftRadius?: unknown;
    topRightRadius?: unknown;
    bottomRightRadius?: unknown;
    bottomLeftRadius?: unknown;
    effects?: unknown;
    constraints?: HostNode['constraints'];
    parent?: ScaleNodeSnapshot;
    children: ScaleNodeSnapshot[];
};
function scaleTargetNodes(context: HandlerContext, nodeIds: string[]): HostNode[] {
    const nodes = nodeIds.length
        ? nodeIds.map((id) => findNodeById(context.host.document.currentPage, id)).filter(Boolean) as HostNode[]
        : context.host.document.currentPage.selection;
    return nodes.filter((node) => !nodes.some((candidate) => candidate !== node && isDescendantOf(node, candidate)));
}
function isDescendantOf(node: HostNode, maybeAncestor: HostNode): boolean {
    let current = node.parent ?? undefined;
    while (current) {
        if (current === maybeAncestor || current.id === maybeAncestor.id) {
            return true;
        }
        current = current.parent ?? undefined;
    }
    return false;
}
function createScaleSnapshot(node: HostNode, parent?: ScaleNodeSnapshot): ScaleNodeSnapshot {
    const snapshot: ScaleNodeSnapshot = {
        node,
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        constrainProportions: node.constrainProportions,
        layoutSizingHorizontal: node.layoutSizingHorizontal,
        layoutSizingVertical: node.layoutSizingVertical,
        layoutGrow: node.layoutGrow,
        layoutAlign: node.layoutAlign,
        clipsContent: node.clipsContent,
        textAutoResize: node.textAutoResize,
        minWidth: node.minWidth,
        maxWidth: node.maxWidth,
        minHeight: node.minHeight,
        maxHeight: node.maxHeight,
        fontName: node.fontName,
        fontSize: node.fontSize,
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
        paragraphSpacing: node.paragraphSpacing,
        rangeFontNames: snapshotRangeFontNames(node),
        rangeFontSizes: snapshotRangeFontSizes(node),
        strokeWeight: node.strokeWeight,
        cornerRadius: node.cornerRadius,
        topLeftRadius: node.topLeftRadius,
        topRightRadius: node.topRightRadius,
        bottomRightRadius: node.bottomRightRadius,
        bottomLeftRadius: node.bottomLeftRadius,
        effects: cloneScaleValue(node.effects),
        constraints: cloneScaleValue(node.constraints),
        parent,
        children: []
    };
    snapshot.children = (node.children ?? []).map((child) => createScaleSnapshot(child, snapshot));
    return snapshot;
}
function snapshotRangeFontNames(node: HostNode): unknown[] {
    const names: unknown[] = [];
    const characters = typeof node.characters === 'string' ? node.characters : '';
    const segmentRanges = normalizedTextStyleRanges(node);
    if (segmentRanges) {
        return segmentRanges
            .map((range) => fontNameFromStyle(range.style))
            .filter((fontName): fontName is {
            family: string;
            style: string;
        } => Boolean(fontName));
    }
    if (characters && node.getRangeFontName) {
        for (let index = 0; index < characters.length; index += 1) {
            names.push(node.getRangeFontName(index, index + 1));
        }
    }
    else {
        names.push(node.fontName);
    }
    return names;
}
function snapshotRangeFontSizes(node: HostNode): Array<{
    start: number;
    end: number;
    value: number;
}> {
    const characters = typeof node.characters === 'string' ? node.characters : '';
    const segmentRanges = normalizedTextStyleRanges(node);
    if (segmentRanges) {
        return segmentRanges.flatMap((range) => typeof range.style.fontSize === 'number'
            ? [{ start: range.start, end: range.end, value: range.style.fontSize }]
            : []);
    }
    if (!characters || !node.getRangeFontSize) {
        return [];
    }
    const ranges: Array<{
        start: number;
        end: number;
        value: number;
    }> = [];
    for (let index = 0; index < characters.length; index += 1) {
        const value = node.getRangeFontSize(index, index + 1);
        if (typeof value === 'number') {
            ranges.push({ start: index, end: index + 1, value });
        }
    }
    return ranges;
}
type SizeFitNodePlan = {
    snapshot: ScaleNodeSnapshot;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    source: 'root' | 'constraint' | 'cohort' | 'anchor' | 'fixed';
    frozen?: boolean;
    children: SizeFitNodePlan[];
};
type SizeFitPlanConfidence = SizeFitPreviewItem['confidence'];
type SizeFitGeometryAxis = 'horizontal' | 'vertical';
type SizeFitAxisResult = {
    position?: number;
    size?: number;
    source: SizeFitNodePlan['source'];
};
type SizeFitPlanContext = {
    confidence: SizeFitPlanConfidence;
    warnings: string[];
    defaultFixedCount: number;
    inferredCount: number;
    frozenRegionKeys: Set<string>;
};
type SizeFitPlanAnalysis = {
    plan?: SizeFitNodePlan;
    confidence: SizeFitPlanConfidence;
    warnings: string[];
    movedCount: number;
    resizedCount: number;
    preservedCount: number;
    frozenCount: number;
    changes: SizeFitPreviewChange[];
    blockedReason?: string;
};
function emptySizeFitAnalysis(blockedReason: string): SizeFitPlanAnalysis {
    return {
        confidence: 'low',
        warnings: [blockedReason],
        movedCount: 0,
        resizedCount: 0,
        preservedCount: 0,
        frozenCount: 0,
        changes: [],
        blockedReason
    };
}
function analyzeSizeFitPlan(snapshot: ScaleNodeSnapshot, targetWidth: number, targetHeight: number, payload: PreviewSizeFitPayload, mode: SizeFitPreviewItem['fitMode']): SizeFitPlanAnalysis {
    const rootChanged = snapshot.width !== targetWidth || snapshot.height !== targetHeight;
    const descendantCount = countSizeFitSnapshotNodes(snapshot) - 1;
    if (mode === 'noChange') {
        return {
            confidence: 'high',
            warnings: ['目标尺寸与原尺寸一致，无需执行适配。'],
            movedCount: 0,
            resizedCount: 0,
            preservedCount: descendantCount + 1,
            frozenCount: 0,
            changes: []
        };
    }
    if (mode === 'autoLayout') {
        return {
            confidence: 'high',
            warnings: ['使用 Figma 原生自动布局，仅调整根容器尺寸，不改写内部图层。'],
            movedCount: 0,
            resizedCount: rootChanged ? 1 : 0,
            preservedCount: descendantCount + (rootChanged ? 0 : 1),
            frozenCount: 0,
            changes: rootChanged ? [rootSizeFitPreviewChange(snapshot, targetWidth, targetHeight)] : []
        };
    }
    if (mode === 'leaf') {
        return {
            confidence: 'high',
            warnings: isNativeSizeFitBoundary(snapshot.node) && snapshot.children.length
                ? ['组合、实例和布尔图形按原子对象处理，不改写内部路径。']
                : [],
            movedCount: 0,
            resizedCount: rootChanged ? 1 : 0,
            preservedCount: descendantCount + (rootChanged ? 0 : 1),
            frozenCount: 0,
            changes: rootChanged ? [rootSizeFitPreviewChange(snapshot, targetWidth, targetHeight)] : []
        };
    }
    const context: SizeFitPlanContext = {
        confidence: 'high',
        warnings: [],
        defaultFixedCount: 0,
        inferredCount: 0,
        frozenRegionKeys: new Set()
    };
    const plan: SizeFitNodePlan = {
        snapshot,
        width: targetWidth,
        height: targetHeight,
        source: 'root',
        children: buildSizeFitChildPlans(snapshot, targetWidth, targetHeight, payload, context)
    };
    if (mode === 'conservative' && context.defaultFixedCount > 0) {
        addSizeFitWarning(context, `${context.defaultFixedCount} 个未配置约束的图层保持原位置和尺寸。`);
    }
    if (mode === 'smart' && context.inferredCount > 0) {
        addSizeFitWarning(context, `已按同级结构关系规划 ${context.inferredCount} 个图层；执行前请核对预览统计。`);
    }
    stabilizeSizeFitPlanWritability(plan, context);
    stabilizeSizeFitPlanLimits(plan, context);
    stabilizePlannedSizeFitGeometry(plan, context);
    const summary = summarizeSizeFitPlan(plan);
    inspectSizeFitPlanRisks(plan, context);
    inspectSizeFitShellExpansion(plan, context);
    inspectConservativeSizeFitCoverage(snapshot, targetWidth, targetHeight, payload, summary, context);
    return {
        plan,
        confidence: context.confidence,
        warnings: context.warnings,
        frozenCount: context.frozenRegionKeys.size,
        changes: collectSizeFitPreviewChanges(plan),
        ...summary
    };
}
function rootSizeFitPreviewChange(snapshot: ScaleNodeSnapshot, targetWidth: number, targetHeight: number): SizeFitPreviewChange {
    return {
        nodeId: snapshot.id,
        name: snapshot.node.name,
        changeType: 'resize',
        beforeWidth: snapshot.width,
        beforeHeight: snapshot.height,
        afterWidth: targetWidth,
        afterHeight: targetHeight
    };
}
function collectSizeFitPreviewChanges(plan: SizeFitNodePlan, limit = 24): SizeFitPreviewChange[] {
    const changes: SizeFitPreviewChange[] = [];
    const visit = (current: SizeFitNodePlan) => {
        if (changes.length >= limit)
            return;
        const moved = sizeFitPlanChangesPosition(current);
        const resized = sizeFitPlanChangesSize(current);
        if (moved || resized) {
            changes.push({
                nodeId: current.snapshot.id,
                name: current.snapshot.node.name,
                changeType: moved && resized ? 'moveAndResize' : moved ? 'move' : 'resize',
                beforeX: current.snapshot.x,
                beforeY: current.snapshot.y,
                afterX: current.x ?? current.snapshot.x,
                afterY: current.y ?? current.snapshot.y,
                beforeWidth: current.snapshot.width,
                beforeHeight: current.snapshot.height,
                afterWidth: current.width ?? current.snapshot.width,
                afterHeight: current.height ?? current.snapshot.height
            });
        }
        for (const child of current.children)
            visit(child);
    };
    visit(plan);
    return changes;
}
function buildSizeFitChildPlans(parent: ScaleNodeSnapshot, parentTargetWidth: number, parentTargetHeight: number, payload: PreviewSizeFitPayload, context: SizeFitPlanContext): SizeFitNodePlan[] {
    const horizontal = planSizeFitSiblingAxis(parent, 'horizontal', parentTargetWidth, payload, context);
    const vertical = planSizeFitSiblingAxis(parent, 'vertical', parentTargetHeight, payload, context);
    const plans = parent.children.map((snapshot) => {
        const horizontalResult = horizontal.get(snapshot.id) ?? fixedSizeFitAxisResult(snapshot, 'horizontal');
        const verticalResult = vertical.get(snapshot.id) ?? fixedSizeFitAxisResult(snapshot, 'vertical');
        let nextX = horizontalResult.position;
        let nextY = verticalResult.position;
        let nextWidth = horizontalResult.size ?? snapshot.width;
        let nextHeight = verticalResult.size ?? snapshot.height;
        if (shouldPreserveSizeFitAspectRatio(snapshot)
            && typeof snapshot.width === 'number' && snapshot.width > 0
            && typeof snapshot.height === 'number' && snapshot.height > 0
            && typeof nextWidth === 'number' && typeof nextHeight === 'number') {
            const widthChanged = nextWidth !== snapshot.width;
            const heightChanged = nextHeight !== snapshot.height;
            if (payload.axis !== 'both' && (widthChanged || heightChanged)) {
                nextWidth = snapshot.width;
                nextHeight = snapshot.height;
                addSizeFitWarning(context, '图标、矢量和组合对象在单轴适配中保持原尺寸，避免非等比拉伸。');
            }
            else if (widthChanged || heightChanged) {
                const ratio = Math.min(nextWidth / snapshot.width, nextHeight / snapshot.height);
                nextWidth = roundDimension(snapshot.width * ratio);
                nextHeight = roundDimension(snapshot.height * ratio);
                nextX = fitPositionForResolvedSize({
                    position: snapshot.x,
                    size: snapshot.width,
                    nextSize: nextWidth,
                    parentOriginalSize: parent.width,
                    parentTargetSize: parentTargetWidth,
                    constraint: snapshot.constraints?.horizontal
                });
                nextY = fitPositionForResolvedSize({
                    position: snapshot.y,
                    size: snapshot.height,
                    nextSize: nextHeight,
                    parentOriginalSize: parent.height,
                    parentTargetSize: parentTargetHeight,
                    constraint: snapshot.constraints?.vertical
                });
            }
        }
        const children = shouldStopSizeFitTraversal(snapshot)
            ? []
            : buildSizeFitChildPlans(snapshot, nextWidth ?? snapshot.width ?? parentTargetWidth, nextHeight ?? snapshot.height ?? parentTargetHeight, payload, context);
        return {
            snapshot,
            x: payload.axis === 'height' ? undefined : nextX,
            y: payload.axis === 'width' ? undefined : nextY,
            width: nextWidth,
            height: nextHeight,
            source: horizontalResult.source === 'fixed' ? verticalResult.source : horizontalResult.source,
            children
        };
    });
    synchronizeSizeFitTableColumns(parent, plans, payload, context);
    return plans;
}
function synchronizeSizeFitTableColumns(parent: ScaleNodeSnapshot, plans: SizeFitNodePlan[], payload: PreviewSizeFitPayload, context: SizeFitPlanContext) {
    if (payload.strategy !== 'smart' || payload.axis === 'height' || plans.length < 2)
        return;
    const rowPlans = plans.filter((plan) => plan.children.length >= 2
        && plan.snapshot.width && parent.width
        && plan.snapshot.width >= parent.width * 0.8);
    if (rowPlans.length < 2)
        return;
    const columnCount = rowPlans[0].children.length;
    if (!rowPlans.every((row) => row.children.length === columnCount))
        return;
    const reference = rowPlans[0];
    const aligned = rowPlans.slice(1).every((row) => row.children.every((column, index) => {
        const referenceColumn = reference.children[index];
        const tolerance = Math.max(4, (referenceColumn.snapshot.width ?? 0) * 0.03);
        return Math.abs((column.snapshot.x ?? 0) - (referenceColumn.snapshot.x ?? 0)) <= tolerance
            && Math.abs((column.snapshot.width ?? 0) - (referenceColumn.snapshot.width ?? 0)) <= tolerance;
    }));
    if (!aligned)
        return;
    for (const row of rowPlans.slice(1)) {
        row.children.forEach((column, index) => {
            column.x = reference.children[index].x;
            column.width = reference.children[index].width;
            column.source = 'cohort';
        });
    }
    addSizeFitWarning(context, `已统一 ${rowPlans.length} 行表格的 ${columnCount} 个列边界。`);
}
function planSizeFitSiblingAxis(parent: ScaleNodeSnapshot, axis: SizeFitGeometryAxis, parentTargetSize: number, payload: PreviewSizeFitPayload, context: SizeFitPlanContext): Map<string, SizeFitAxisResult> {
    const results = new Map<string, SizeFitAxisResult>();
    const active = axis === 'horizontal' ? payload.axis !== 'height' : payload.axis !== 'width';
    const parentOriginalSize = sizeFitAxisSize(parent, axis);
    if (!active || parentTargetSize === parentOriginalSize) {
        for (const child of parent.children)
            results.set(child.id, fixedSizeFitAxisResult(child, axis));
        return results;
    }
    if (payload.strategy === 'smart') {
        for (const cohort of createSizeFitCohorts(parent.children, axis)) {
            if (!shouldRedistributeSizeFitTrack(parent, cohort, axis, parentTargetSize))
                continue;
            const ordered = [...cohort].sort((left, right) => sizeFitAxisPosition(left, axis) - sizeFitAxisPosition(right, axis));
            const gaps = ordered.slice(1).map((item, index) => sizeFitAxisPosition(item, axis)
                - (sizeFitAxisPosition(ordered[index], axis) + sizeFitAxisSize(ordered[index], axis)));
            distributeSizeFitTrack(ordered, axis, parentTargetSize, sizeFitAxisPosition(ordered[0], axis), parentOriginalSize - (sizeFitAxisPosition(ordered[ordered.length - 1], axis)
                + sizeFitAxisSize(ordered[ordered.length - 1], axis)), gaps, results);
            context.inferredCount += ordered.length;
            addSizeFitWarning(context, '已根据同级轨道与弹性布局信号重新分配可用空间。');
        }
    }
    const unconfigured: ScaleNodeSnapshot[] = [];
    for (const child of parent.children) {
        if (results.has(child.id))
            continue;
        const configured = child.constraints?.[axis];
        if (configured !== undefined) {
            results.set(child.id, {
                ...fitAxisByConstraint({
                    position: sizeFitAxisPosition(child, axis),
                    size: sizeFitAxisSize(child, axis),
                    parentOriginalSize,
                    parentTargetSize,
                    constraint: payload.strategy === 'smart'
                        ? resolveSmartConfiguredSizeFitConstraint(child, axis, parentOriginalSize, configured)
                        : normalizeSizeFitConstraint(configured)
                }),
                source: 'constraint'
            });
        }
        else if (payload.strategy === 'conservative') {
            results.set(child.id, fixedSizeFitAxisResult(child, axis));
            context.defaultFixedCount += 1;
        }
        else {
            unconfigured.push(child);
        }
    }
    if (payload.strategy === 'smart' && unconfigured.length) {
        for (const cohort of createSizeFitCohorts(unconfigured, axis)) {
            inferSizeFitCohort(parent, cohort, axis, parentTargetSize, results, context);
        }
    }
    return results;
}
function resolveSmartConfiguredSizeFitConstraint(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis, parentOriginalSize: number, configured: string): SizeFitConstraint {
    const normalized = normalizeSizeFitConstraint(configured);
    if (normalized !== 'START' || shouldPreserveSizeFitAspectRatio(snapshot))
        return normalized;
    const position = sizeFitAxisPosition(snapshot, axis);
    const size = sizeFitAxisSize(snapshot, axis);
    const endOffset = parentOriginalSize - position - size;
    const tolerance = sizeFitEdgeTolerance(parentOriginalSize);
    const nearStart = Math.abs(position) <= tolerance;
    const nearEnd = Math.abs(endOffset) <= tolerance;
    if (nearStart && nearEnd)
        return 'STARTANDEND';
    if (nearEnd && !nearStart)
        return 'END';
    return normalized;
}
function shouldRedistributeSizeFitTrack(parent: ScaleNodeSnapshot, cohort: ScaleNodeSnapshot[], axis: SizeFitGeometryAxis, parentTargetSize: number): boolean {
    const parentOriginalSize = sizeFitAxisSize(parent, axis);
    if (cohort.length < 2 || parentTargetSize === parentOriginalSize || parentOriginalSize <= 0)
        return false;
    const ordered = [...cohort].sort((left, right) => sizeFitAxisPosition(left, axis) - sizeFitAxisPosition(right, axis));
    const tolerance = sizeFitEdgeTolerance(parentOriginalSize);
    const firstStart = sizeFitAxisPosition(ordered[0], axis);
    const lastEnd = sizeFitAxisPosition(ordered[ordered.length - 1], axis)
        + sizeFitAxisSize(ordered[ordered.length - 1], axis);
    if (Math.abs(firstStart) > tolerance || Math.abs(parentOriginalSize - lastEnd) > tolerance)
        return false;
    const gaps: number[] = [];
    let createsOverlap = false;
    for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        const originalGap = sizeFitAxisPosition(current, axis)
            - (sizeFitAxisPosition(previous, axis) + sizeFitAxisSize(previous, axis));
        if (originalGap < -tolerance || originalGap > Math.max(tolerance, parentOriginalSize * 0.08))
            return false;
        gaps.push(originalGap);
        const previousResult = fitAxisByConstraint({
            position: sizeFitAxisPosition(previous, axis),
            size: sizeFitAxisSize(previous, axis),
            parentOriginalSize,
            parentTargetSize,
            constraint: previous.constraints?.[axis]
        });
        const currentResult = fitAxisByConstraint({
            position: sizeFitAxisPosition(current, axis),
            size: sizeFitAxisSize(current, axis),
            parentOriginalSize,
            parentTargetSize,
            constraint: current.constraints?.[axis]
        });
        const plannedGap = (currentResult.position ?? sizeFitAxisPosition(current, axis))
            - ((previousResult.position ?? sizeFitAxisPosition(previous, axis))
                + (previousResult.size ?? sizeFitAxisSize(previous, axis)));
        if (plannedGap < -tolerance)
            createsOverlap = true;
    }
    if (gaps.length > 1) {
        const gapSpread = Math.max(...gaps) - Math.min(...gaps);
        if (gapSpread > Math.max(4, parentOriginalSize * 0.02))
            return false;
    }
    const hasFlexibleSignal = ordered.some((item) => hasFlexibleSizeFitSignal(item, axis));
    const repeatedTrack = ordered.length >= 3;
    const sizes = ordered.map((item) => sizeFitAxisSize(item, axis));
    const smallest = Math.min(...sizes);
    const largest = Math.max(...sizes);
    const equalSizedTrack = smallest > 0 && largest / smallest <= 1.08;
    return createsOverlap || hasFlexibleSignal || repeatedTrack || equalSizedTrack;
}
function hasFlexibleSizeFitSignal(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): boolean {
    return Boolean(snapshot.layoutGrow && snapshot.layoutGrow > 0)
        || sizeFitLayoutSizing(snapshot, axis) === 'FILL'
        || snapshot.layoutAlign === 'STRETCH';
}
function inferSizeFitCohort(parent: ScaleNodeSnapshot, cohort: ScaleNodeSnapshot[], axis: SizeFitGeometryAxis, parentTargetSize: number, results: Map<string, SizeFitAxisResult>, context: SizeFitPlanContext) {
    const parentOriginalSize = sizeFitAxisSize(parent, axis);
    const ordered = [...cohort].sort((left, right) => sizeFitAxisPosition(left, axis) - sizeFitAxisPosition(right, axis));
    const tolerance = sizeFitEdgeTolerance(parentOriginalSize);
    const firstStart = sizeFitAxisPosition(ordered[0], axis);
    const lastEnd = sizeFitAxisPosition(ordered[ordered.length - 1], axis) + sizeFitAxisSize(ordered[ordered.length - 1], axis);
    const startMargin = firstStart;
    const endMargin = parentOriginalSize - lastEnd;
    const gaps = ordered.slice(1).map((item, index) => sizeFitAxisPosition(item, axis)
        - (sizeFitAxisPosition(ordered[index], axis) + sizeFitAxisSize(ordered[index], axis)));
    const hasLargeOverlap = gaps.some((gap, index) => gap < -Math.min(sizeFitAxisSize(ordered[index], axis), sizeFitAxisSize(ordered[index + 1], axis)) * 0.35);
    if (hasLargeOverlap && ordered.length > 1) {
        lowerSizeFitConfidence(context, 'medium');
        recordFrozenSizeFitRegion(context, `overlap:${axis}:${ordered.map((item) => item.id).sort().join(',')}`);
        addSizeFitWarning(context, '检测到同级图层大面积重叠，该不确定轨道已保持原样。');
        for (const item of ordered)
            results.set(item.id, fixedSizeFitAxisResult(item, axis));
        return;
    }
    const maxGap = gaps.length ? Math.max(...gaps.map(Math.abs)) : 0;
    const spansTrack = ordered.length > 1
        && Math.abs(startMargin) <= tolerance
        && Math.abs(endMargin) <= tolerance
        && maxGap <= Math.max(tolerance, parentOriginalSize * 0.08);
    if (spansTrack) {
        distributeSizeFitTrack(ordered, axis, parentTargetSize, startMargin, endMargin, gaps, results);
        context.inferredCount += ordered.length;
        return;
    }
    for (const item of ordered) {
        const position = sizeFitAxisPosition(item, axis);
        const size = sizeFitAxisSize(item, axis);
        const endOffset = parentOriginalSize - position - size;
        const nearStart = Math.abs(position) <= tolerance;
        const nearEnd = Math.abs(endOffset) <= tolerance;
        if (nearStart && nearEnd && !shouldPreserveSizeFitAspectRatio(item)) {
            results.set(item.id, {
                ...fitAxisByConstraint({ position, size, parentOriginalSize, parentTargetSize, constraint: 'STARTANDEND' }),
                source: 'anchor'
            });
        }
        else if (nearEnd && !nearStart) {
            results.set(item.id, {
                ...fitAxisByConstraint({ position, size, parentOriginalSize, parentTargetSize, constraint: 'END' }),
                source: 'anchor'
            });
        }
        else if (!nearStart && !nearEnd && Math.abs((position + (size / 2)) - (parentOriginalSize / 2)) <= tolerance) {
            results.set(item.id, {
                ...fitAxisByConstraint({ position, size, parentOriginalSize, parentTargetSize, constraint: 'CENTER' }),
                source: 'anchor'
            });
            lowerSizeFitConfidence(context, 'medium');
        }
        else {
            results.set(item.id, fixedSizeFitAxisResult(item, axis));
        }
        context.inferredCount += 1;
    }
}
function distributeSizeFitTrack(items: ScaleNodeSnapshot[], axis: SizeFitGeometryAxis, parentTargetSize: number, startMargin: number, endMargin: number, gaps: number[], results: Map<string, SizeFitAxisResult>) {
    const safeGaps = gaps.map((gap) => Math.max(0, gap));
    const gapTotal = safeGaps.reduce((sum, gap) => sum + gap, 0);
    const available = Math.max(0, parentTargetSize - startMargin - endMargin - gapTotal);
    const flexible = items.filter((item) => hasFlexibleSizeFitSignal(item, axis));
    const sizes = items.map((item) => sizeFitAxisSize(item, axis));
    const smallest = Math.min(...sizes);
    const largest = Math.max(...sizes);
    const fixedSmallItem = items.length === 2 && flexible.length === 0 && smallest > 0 && largest / smallest > 2.5
        ? items[sizes.indexOf(smallest)]
        : undefined;
    const fixedItems = flexible.length
        ? items.filter((item) => !flexible.includes(item))
        : fixedSmallItem ? [fixedSmallItem] : [];
    const flexibleItems = items.filter((item) => !fixedItems.includes(item));
    const fixedTotal = fixedItems.reduce((sum, item) => sum + sizeFitAxisSize(item, axis), 0);
    const flexibleAvailable = Math.max(0, available - fixedTotal);
    const originalFlexibleTotal = flexibleItems.reduce((sum, item) => sum + sizeFitAxisSize(item, axis), 0);
    let cursor = startMargin;
    items.forEach((item, index) => {
        const originalSize = sizeFitAxisSize(item, axis);
        const nextSize = fixedItems.includes(item)
            ? originalSize
            : roundDimension(originalFlexibleTotal > 0
                ? flexibleAvailable * (originalSize / originalFlexibleTotal)
                : flexibleAvailable / Math.max(1, flexibleItems.length));
        results.set(item.id, {
            position: roundDimension(cursor),
            size: nextSize,
            source: 'cohort'
        });
        cursor += nextSize + (safeGaps[index] ?? 0);
    });
}
function createSizeFitCohorts(items: ScaleNodeSnapshot[], axis: SizeFitGeometryAxis): ScaleNodeSnapshot[][] {
    const remaining = new Set(items);
    const cohorts: ScaleNodeSnapshot[][] = [];
    while (remaining.size) {
        const seed = remaining.values().next().value as ScaleNodeSnapshot;
        remaining.delete(seed);
        const cohort = [seed];
        let changed = true;
        while (changed) {
            changed = false;
            for (const candidate of [...remaining]) {
                if (cohort.some((member) => sizeFitCrossAxisOverlap(member, candidate, axis) >= 0.8)) {
                    cohort.push(candidate);
                    remaining.delete(candidate);
                    changed = true;
                }
            }
        }
        cohorts.push(cohort);
    }
    return cohorts;
}
function fitAxisByConstraint({ position, size, parentOriginalSize, parentTargetSize, constraint }: {
    position: number | undefined;
    size: number | undefined;
    parentOriginalSize: number | undefined;
    parentTargetSize: number;
    constraint?: string;
}): {
    position?: number;
    size?: number;
} {
    if (typeof position !== 'number' && typeof size !== 'number') {
        return {};
    }
    const originalPosition = typeof position === 'number' ? position : 0;
    const originalSize = typeof size === 'number' ? size : undefined;
    const normalizedConstraint = normalizeSizeFitConstraint(constraint);
    if (normalizedConstraint === 'END' && typeof originalSize === 'number' && typeof parentOriginalSize === 'number') {
        const endOffset = parentOriginalSize - originalPosition - originalSize;
        return {
            position: roundDimension(parentTargetSize - endOffset - originalSize),
            size: originalSize
        };
    }
    if (normalizedConstraint === 'CENTER' && typeof originalSize === 'number' && typeof parentOriginalSize === 'number') {
        return {
            position: roundDimension(originalPosition + ((parentTargetSize - parentOriginalSize) / 2)),
            size: originalSize
        };
    }
    if (normalizedConstraint === 'STARTANDEND' && typeof originalSize === 'number' && typeof parentOriginalSize === 'number') {
        const endOffset = parentOriginalSize - originalPosition - originalSize;
        return {
            position: originalPosition,
            size: roundDimension(Math.max(0, parentTargetSize - originalPosition - endOffset))
        };
    }
    if (normalizedConstraint === 'SCALE') {
        const ratio = typeof parentOriginalSize === 'number' && parentOriginalSize > 0
            ? parentTargetSize / parentOriginalSize
            : 1;
        return {
            position: typeof position === 'number' ? roundDimension(position * ratio) : undefined,
            size: typeof originalSize === 'number' ? roundDimension(originalSize * ratio) : undefined
        };
    }
    return {
        position,
        size
    };
}
type SizeFitConstraint = 'START' | 'END' | 'STARTANDEND' | 'CENTER' | 'SCALE';
function normalizeSizeFitConstraint(constraint: string | undefined): SizeFitConstraint {
    const normalized = constraint?.toUpperCase();
    if (normalized === 'END' || normalized === 'MAX')
        return 'END';
    if (normalized === 'STARTANDEND' || normalized === 'STRETCH')
        return 'STARTANDEND';
    if (normalized === 'CENTER')
        return 'CENTER';
    if (normalized === 'SCALE')
        return 'SCALE';
    return 'START';
}
function sizeFitAxisPosition(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): number {
    return (axis === 'horizontal' ? snapshot.x : snapshot.y) ?? 0;
}
function sizeFitAxisSize(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): number {
    return (axis === 'horizontal' ? snapshot.width : snapshot.height) ?? 0;
}
function sizeFitCrossAxisOverlap(snapshot: ScaleNodeSnapshot, candidate: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): number {
    const crossAxis: SizeFitGeometryAxis = axis === 'horizontal' ? 'vertical' : 'horizontal';
    const start = sizeFitAxisPosition(snapshot, crossAxis);
    const end = start + sizeFitAxisSize(snapshot, crossAxis);
    const candidateStart = sizeFitAxisPosition(candidate, crossAxis);
    const candidateEnd = candidateStart + sizeFitAxisSize(candidate, crossAxis);
    const overlap = Math.max(0, Math.min(end, candidateEnd) - Math.max(start, candidateStart));
    const smallerSize = Math.min(sizeFitAxisSize(snapshot, crossAxis), sizeFitAxisSize(candidate, crossAxis));
    return smallerSize > 0 ? overlap / smallerSize : 0;
}
function sizeFitEdgeTolerance(parentSize: number): number {
    return Math.max(8, Math.min(64, parentSize * 0.06));
}
function fixedSizeFitAxisResult(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): SizeFitAxisResult {
    return {
        position: sizeFitAxisPosition(snapshot, axis),
        size: sizeFitAxisSize(snapshot, axis),
        source: 'fixed'
    };
}
function sizeFitLayoutSizing(snapshot: ScaleNodeSnapshot, axis: SizeFitGeometryAxis): string | undefined {
    return axis === 'horizontal' ? snapshot.layoutSizingHorizontal : snapshot.layoutSizingVertical;
}
function lowerSizeFitConfidence(context: SizeFitPlanContext, confidence: SizeFitPlanConfidence) {
    const rank: Record<SizeFitPlanConfidence, number> = { high: 0, medium: 1, low: 2 };
    if (rank[confidence] > rank[context.confidence])
        context.confidence = confidence;
}
function addSizeFitWarning(context: SizeFitPlanContext, warning: string) {
    if (!context.warnings.includes(warning))
        context.warnings.push(warning);
}
function countSizeFitSnapshotNodes(snapshot: ScaleNodeSnapshot): number {
    return 1 + snapshot.children.reduce((sum, child) => sum + countSizeFitSnapshotNodes(child), 0);
}
function recordFrozenSizeFitRegion(context: SizeFitPlanContext, key: string) {
    context.frozenRegionKeys.add(key);
}
function restoreSizeFitPlan(plan: SizeFitNodePlan) {
    plan.x = plan.snapshot.x;
    plan.y = plan.snapshot.y;
    plan.width = plan.snapshot.width;
    plan.height = plan.snapshot.height;
    plan.source = 'fixed';
    plan.frozen = true;
    for (const child of plan.children)
        restoreSizeFitPlan(child);
}
function freezeSizeFitPlans(plans: SizeFitNodePlan[], context: SizeFitPlanContext, key: string, warning: string) {
    for (const plan of plans)
        restoreSizeFitPlan(plan);
    recordFrozenSizeFitRegion(context, key);
    lowerSizeFitConfidence(context, 'medium');
    addSizeFitWarning(context, warning);
}
function sizeFitPlanHasChanges(plan: SizeFitNodePlan): boolean {
    return sizeFitPlanChangesPosition(plan)
        || sizeFitPlanChangesSize(plan)
        || plan.children.some(sizeFitPlanHasChanges);
}
function stabilizeSizeFitPlanWritability(plan: SizeFitNodePlan, context: SizeFitPlanContext) {
    for (const child of plan.children) {
        if (child.frozen)
            continue;
        const locked = isEffectivelyLocked(child.snapshot.node) && sizeFitPlanHasChanges(child);
        const cannotResize = sizeFitPlanChangesSize(child) && !child.snapshot.node.resize;
        if (locked || cannotResize) {
            const reason = locked ? '已锁定' : '不支持尺寸写入';
            freezeSizeFitPlans([child], context, `writable:${child.snapshot.id}`, `图层“${child.snapshot.node.name}”${reason}，已冻结该区域并继续处理其余安全内容。`);
            continue;
        }
        stabilizeSizeFitPlanWritability(child, context);
    }
}
function stabilizeSizeFitPlanLimits(plan: SizeFitNodePlan, context: SizeFitPlanContext) {
    for (const child of plan.children) {
        if (child.frozen)
            continue;
        const width = child.width ?? child.snapshot.width;
        const height = child.height ?? child.snapshot.height;
        const widthLimits = normalizeSizeFitLimits(child.snapshot.width, child.snapshot.minWidth, child.snapshot.maxWidth);
        const heightLimits = normalizeSizeFitLimits(child.snapshot.height, child.snapshot.minHeight, child.snapshot.maxHeight);
        const widthExceeded = typeof width === 'number'
            && ((widthLimits.min !== undefined && width < widthLimits.min)
                || (widthLimits.max !== undefined && width > widthLimits.max));
        const heightExceeded = typeof height === 'number'
            && ((heightLimits.min !== undefined && height < heightLimits.min)
                || (heightLimits.max !== undefined && height > heightLimits.max));
        if (widthExceeded || heightExceeded) {
            freezeSizeFitPlans([child], context, `limits:${child.snapshot.id}`, `图层“${child.snapshot.node.name}”的计划尺寸超出有效限制，已冻结该区域并继续处理其余安全内容。`);
            continue;
        }
        stabilizeSizeFitPlanLimits(child, context);
    }
}
function inspectSizeFitPlanRisks(plan: SizeFitNodePlan, context: SizeFitPlanContext) {
    const { snapshot } = plan;
    const width = plan.width ?? snapshot.width;
    const height = plan.height ?? snapshot.height;
    const widthLimits = normalizeSizeFitLimits(snapshot.width, snapshot.minWidth, snapshot.maxWidth);
    const heightLimits = normalizeSizeFitLimits(snapshot.height, snapshot.minHeight, snapshot.maxHeight);
    if (typeof width === 'number' && width !== snapshot.width) {
        if (widthLimits.inconsistent) {
            addSizeFitWarning(context, `图层“${snapshot.node.name}”的宽度限制与当前尺寸不一致，已忽略失效元数据。`);
        }
    }
    if (typeof height === 'number' && height !== snapshot.height) {
        if (heightLimits.inconsistent) {
            addSizeFitWarning(context, `图层“${snapshot.node.name}”的高度限制与当前尺寸不一致，已忽略失效元数据。`);
        }
    }
    if (snapshot.clipsContent
        && ((typeof snapshot.width === 'number' && typeof width === 'number' && width < snapshot.width)
            || (typeof snapshot.height === 'number' && typeof height === 'number' && height < snapshot.height))) {
        addSizeFitWarning(context, '计划包含裁剪容器，缩小尺寸时请重点核对内容是否被截断。');
    }
    if (snapshot.type === 'TEXT' && snapshot.textAutoResize && snapshot.textAutoResize !== 'NONE' && sizeFitPlanChangesSize(plan)) {
        lowerSizeFitConfidence(context, 'medium');
        addSizeFitWarning(context, '计划包含自动尺寸文本，最终文本框尺寸可能由 Figma 字体排版重新计算。');
    }
    for (const child of plan.children)
        inspectSizeFitPlanRisks(child, context);
}
type SizeFitRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
function stabilizePlannedSizeFitGeometry(plan: SizeFitNodePlan, context: SizeFitPlanContext) {
    let stabilized = true;
    while (stabilized) {
        stabilized = false;
        for (let index = 0; index < plan.children.length; index += 1) {
            for (let compareIndex = index + 1; compareIndex < plan.children.length; compareIndex += 1) {
                const left = plan.children[index];
                const right = plan.children[compareIndex];
                const originalOverlap = sizeFitRectOverlapRatio(sizeFitPlanRect(left, false), sizeFitPlanRect(right, false));
                const plannedOverlap = sizeFitRectOverlapRatio(sizeFitPlanRect(left, true), sizeFitPlanRect(right, true));
                if (originalOverlap > 0.02 || plannedOverlap < 0.08)
                    continue;
                const changed = [left, right].filter((item) => !item.frozen
                    && (sizeFitPlanChangesPosition(item) || sizeFitPlanChangesSize(item)));
                if (!changed.length)
                    continue;
                const names = changed.map((item) => `“${item.snapshot.node.name}”`).join('、');
                const ids = changed.map((item) => item.snapshot.id).sort().join(',');
                freezeSizeFitPlans(changed, context, `collision:${ids}`, `检测到新增重叠，已冻结区域 ${names} 并继续处理其余安全内容。`);
                stabilized = true;
                break;
            }
            if (stabilized)
                break;
        }
    }
    for (const child of plan.children) {
        if (!child.frozen)
            stabilizePlannedSizeFitGeometry(child, context);
    }
}
function sizeFitPlanRect(plan: SizeFitNodePlan, planned: boolean): SizeFitRect {
    return {
        x: planned ? plan.x ?? plan.snapshot.x ?? 0 : plan.snapshot.x ?? 0,
        y: planned ? plan.y ?? plan.snapshot.y ?? 0 : plan.snapshot.y ?? 0,
        width: planned ? plan.width ?? plan.snapshot.width ?? 0 : plan.snapshot.width ?? 0,
        height: planned ? plan.height ?? plan.snapshot.height ?? 0 : plan.snapshot.height ?? 0
    };
}
function sizeFitRectOverlapRatio(left: SizeFitRect, right: SizeFitRect): number {
    if (left.width <= 0 || left.height <= 0 || right.width <= 0 || right.height <= 0)
        return 0;
    const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
    const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
    const smallerArea = Math.min(left.width * left.height, right.width * right.height);
    return smallerArea > 0 ? (overlapWidth * overlapHeight) / smallerArea : 0;
}
function inspectSizeFitShellExpansion(plan: SizeFitNodePlan, context: SizeFitPlanContext) {
    if (plan.children.length) {
        inspectSizeFitShellExpansionAxis(plan, 'horizontal', context);
        inspectSizeFitShellExpansionAxis(plan, 'vertical', context);
    }
    for (const child of plan.children)
        inspectSizeFitShellExpansion(child, context);
}
function inspectSizeFitShellExpansionAxis(plan: SizeFitNodePlan, axis: SizeFitGeometryAxis, context: SizeFitPlanContext) {
    const originalSize = sizeFitAxisSize(plan.snapshot, axis);
    const plannedSize = axis === 'horizontal'
        ? plan.width ?? plan.snapshot.width ?? 0
        : plan.height ?? plan.snapshot.height ?? 0;
    if (originalSize <= 0 || plannedSize < originalSize * 1.2)
        return;
    const originalSpan = sizeFitChildPlanSpan(plan.children, axis, false);
    const plannedSpan = sizeFitChildPlanSpan(plan.children, axis, true);
    if (originalSpan / originalSize < 0.75 || plannedSpan / plannedSize > 0.7)
        return;
    lowerSizeFitConfidence(context, 'medium');
    addSizeFitWarning(context, `图层“${plan.snapshot.node.name}”扩大后内部内容保持固定，请确认新增留白符合预期。`);
}
function sizeFitChildPlanSpan(children: SizeFitNodePlan[], axis: SizeFitGeometryAxis, planned: boolean): number {
    if (!children.length)
        return 0;
    const starts = children.map((child) => {
        const rect = sizeFitPlanRect(child, planned);
        return axis === 'horizontal' ? rect.x : rect.y;
    });
    const ends = children.map((child) => {
        const rect = sizeFitPlanRect(child, planned);
        return axis === 'horizontal' ? rect.x + rect.width : rect.y + rect.height;
    });
    return Math.max(...ends) - Math.min(...starts);
}
function inspectConservativeSizeFitCoverage(snapshot: ScaleNodeSnapshot, targetWidth: number, targetHeight: number, payload: PreviewSizeFitPayload, summary: Pick<SizeFitPlanAnalysis, 'preservedCount'>, context: SizeFitPlanContext) {
    if (payload.strategy !== 'conservative')
        return;
    const total = countSizeFitSnapshotNodes(snapshot);
    if (total < 12)
        return;
    const widthDelta = payload.axis === 'height' || !snapshot.width
        ? 0
        : Math.abs(targetWidth - snapshot.width) / snapshot.width;
    const heightDelta = payload.axis === 'width' || !snapshot.height
        ? 0
        : Math.abs(targetHeight - snapshot.height) / snapshot.height;
    const changedCount = Math.max(0, total - summary.preservedCount);
    const coverage = total > 0 ? changedCount / total : 0;
    if (Math.max(widthDelta, heightDelta) < 0.2 || coverage >= 0.15)
        return;
    lowerSizeFitConfidence(context, 'medium');
    addSizeFitWarning(context, `有效适配覆盖率仅 ${roundDimension(coverage * 100)}%，大部分内容会保持原尺寸并形成空白区域。`);
}
type NormalizedSizeFitLimits = {
    min?: number;
    max?: number;
    inconsistent: boolean;
};
function normalizeSizeFitLimits(currentSize: number | undefined, rawMin: number | null | undefined, rawMax: number | null | undefined): NormalizedSizeFitLimits {
    if (typeof currentSize !== 'number' || !Number.isFinite(currentSize) || currentSize <= 0) {
        return { inconsistent: false };
    }
    const minCandidate = typeof rawMin === 'number' && Number.isFinite(rawMin) && rawMin > 0 ? rawMin : undefined;
    const maxCandidate = typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : undefined;
    const minConsistent = minCandidate === undefined || minCandidate <= currentSize;
    const maxConsistent = maxCandidate === undefined || maxCandidate >= currentSize;
    return {
        min: minConsistent ? minCandidate : undefined,
        max: maxConsistent ? maxCandidate : undefined,
        inconsistent: !minConsistent || !maxConsistent
    };
}
function summarizeSizeFitPlan(plan: SizeFitNodePlan): Pick<SizeFitPlanAnalysis, 'movedCount' | 'resizedCount' | 'preservedCount'> {
    const moved = (typeof plan.x === 'number' && plan.x !== plan.snapshot.x)
        || (typeof plan.y === 'number' && plan.y !== plan.snapshot.y);
    const resized = sizeFitPlanChangesSize(plan);
    let movedCount = moved ? 1 : 0;
    let resizedCount = resized ? 1 : 0;
    let preservedCount = moved || resized ? 0 : 1;
    const plannedChildIds = new Set(plan.children.map((child) => child.snapshot.id));
    for (const child of plan.children) {
        const summary = summarizeSizeFitPlan(child);
        movedCount += summary.movedCount;
        resizedCount += summary.resizedCount;
        preservedCount += summary.preservedCount;
    }
    for (const child of plan.snapshot.children) {
        if (!plannedChildIds.has(child.id))
            preservedCount += countSizeFitSnapshotNodes(child);
    }
    return { movedCount, resizedCount, preservedCount };
}
function fitPositionForResolvedSize({ position, size, nextSize, parentOriginalSize, parentTargetSize, constraint }: {
    position: number | undefined;
    size: number;
    nextSize: number;
    parentOriginalSize: number | undefined;
    parentTargetSize: number;
    constraint?: string;
}): number | undefined {
    if (typeof position !== 'number' || typeof parentOriginalSize !== 'number') {
        return position;
    }
    const normalizedConstraint = normalizeSizeFitConstraint(constraint);
    if (normalizedConstraint === 'END') {
        const endOffset = parentOriginalSize - position - size;
        return roundDimension(parentTargetSize - endOffset - nextSize);
    }
    if (normalizedConstraint === 'CENTER') {
        return roundDimension(position + ((parentTargetSize - parentOriginalSize) / 2) + ((size - nextSize) / 2));
    }
    if (normalizedConstraint === 'SCALE') {
        const ratio = parentOriginalSize > 0 ? parentTargetSize / parentOriginalSize : 1;
        return roundDimension(((position + (size / 2)) * ratio) - (nextSize / 2));
    }
    return position;
}
function shouldPreserveSizeFitAspectRatio(snapshot: ScaleNodeSnapshot): boolean {
    return snapshot.constrainProportions === true
        || ['GROUP', 'VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'ELLIPSE'].includes(snapshot.type);
}
function isNativeSizeFitBoundary(node: HostNode): boolean {
    return ['GROUP', 'INSTANCE', 'BOOLEAN_OPERATION'].includes(node.type);
}
function shouldStopSizeFitTraversal(snapshot: ScaleNodeSnapshot): boolean {
    return hasAutoLayout(snapshot.node) || isNativeSizeFitBoundary(snapshot.node);
}
function assertSizeFitPlanWritable(plan: SizeFitNodePlan) {
    if (isEffectivelyLocked(plan.snapshot.node) && (sizeFitPlanChangesPosition(plan) || sizeFitPlanChangesSize(plan))) {
        throw new Error('LOCKED_NODE');
    }
    if (sizeFitPlanChangesSize(plan) && !plan.snapshot.node.resize) {
        throw new Error('RESIZE_UNSUPPORTED');
    }
    for (const child of plan.children) {
        assertSizeFitPlanWritable(child);
    }
}
function sizeFitPlanChangesPosition(plan: SizeFitNodePlan): boolean {
    return (typeof plan.x === 'number' && plan.x !== plan.snapshot.x)
        || (typeof plan.y === 'number' && plan.y !== plan.snapshot.y);
}
function sizeFitPlanChangesSize(plan: SizeFitNodePlan): boolean {
    return (typeof plan.width === 'number' && plan.width !== plan.snapshot.width)
        || (typeof plan.height === 'number' && plan.height !== plan.snapshot.height);
}
function applySizeFitPlan(plan: SizeFitNodePlan) {
    const { node } = plan.snapshot;
    if (typeof plan.x === 'number' && node.x !== plan.x) {
        node.x = plan.x;
    }
    if (typeof plan.y === 'number' && node.y !== plan.y) {
        node.y = plan.y;
    }
    if (typeof plan.width === 'number' && typeof plan.height === 'number'
        && (node.width !== plan.width || node.height !== plan.height)) {
        node.resize?.(plan.width, plan.height);
    }
    for (const child of plan.children) {
        applySizeFitPlan(child);
    }
}
function cloneScaleValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => cloneScaleValue(item)) as T;
    }
    if (value && typeof value === 'object') {
        return { ...(value as Record<string, unknown>) } as T;
    }
    return value;
}
function roundDimension(value: number): number {
    return Math.round(value * 100) / 100;
}
function cleanupReason(node: HostNode, types: ScanCleanupPayload['types']): string | undefined {
    const hidden = hiddenReason(node);
    if (types.includes('hidden') && hidden) {
        return hidden;
    }
    if (types.includes('emptyText') && node.type === 'TEXT' && !String(node.characters ?? '').trim()) {
        return '空文本';
    }
    if (types.includes('emptyGroup') && ['GROUP', 'FRAME'].includes(node.type) && (!node.children || node.children.length === 0)) {
        return '空分组';
    }
    if (types.includes('transparent') && isTransparentNode(node)) {
        return '透明图层';
    }
    if (types.includes('zeroSize') && ((node.width ?? 1) <= 0 || (node.height ?? 1) <= 0)) {
        return '0 尺寸';
    }
    return undefined;
}
function cleanupTypesForRun(payload: RunCleanupPayload): ScanCleanupPayload['types'] {
    return payload.types?.length ? payload.types : ['hidden'];
}
function cleanupRunFailureReason(node: HostNode | undefined, types: ScanCleanupPayload['types'], includeComponentInstanceChildren: boolean): string | undefined {
    if (!node)
        return '目标节点已不存在';
    if (isEffectivelyLocked(node))
        return '目标节点已锁定';
    if (!node.remove)
        return '当前 Figma 环境不支持删除该节点';
    if (!includeComponentInstanceChildren && isInsideInstance(node))
        return '组件实例内部节点默认跳过';
    if (!cleanupReason(node, types))
        return '目标已不再符合清理规则';
    return undefined;
}
function cleanupRemovalFailureReason(error: unknown): string {
    if (error instanceof Error && error.message) {
        return 'Figma 未能删除该节点';
    }
    return 'Figma 删除该节点时未返回错误详情';
}
function cleanupHostError(stage: string, error: unknown): Error {
    const detail = error instanceof Error && error.message ? error.message : '宿主未返回错误详情';
    return new Error(`CLEANUP_HOST_ERROR:${stage}:${detail}`);
}
function result(successCount: number, failedCount: number, message: string): ToolExecutionResult {
    return { successCount, failedCount, message, recoverable: true };
}
function commitUndoIfChanged(context: HandlerContext, successCount: number): void {
    if (successCount > 0) {
        context.host.commitUndo?.();
    }
}
