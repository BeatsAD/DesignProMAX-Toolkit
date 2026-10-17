import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { compareAvailableFontStyles, getAvailableFontFamilyDisplayLabel, getAvailableFontStyleDisplayLabel, matchesAvailableFontFamilyQuery } from "../../../shared/font-localization";
import { isOperationCancelled } from "../../../shared/messages";
import type { AvailableFontInfo, FindReplacePreviewPayload, FindReplacePreviewResult, FindReplaceHistoryEntry, FindReplaceMode, FindReplaceScope, FindReplaceStyleKind, FindReplaceStyleOption, FindReplaceTextStyle, ScanFindReplaceStylesResult } from "../../../shared/messages";
import type { ToolExecutionResult } from "../../../shared/types";
import { Button, Checkbox, EmptyState, NoticeBar, Field, Panel, SelectField, Tabs } from "../../../ui/components/ui";
import { renderNoFeedback } from "../../../ui/feedback";
import { createParameterSignature, createPreviewSnapshot, createSelectionSignature, isPreviewSnapshotStale, type PreviewSnapshot } from "../../../ui/preview-snapshot";
import { ToolPageProps, messageOf } from '../../../ui/pages/tool-page-shared';


export default function ReplacePage({ request, selection, settings, task, setTask, toast, renderFeedback = renderNoFeedback, confirm }: ToolPageProps) {
  const [activeMode, setActiveMode] = useState<FindReplaceMode>('text');
  const [scope, setScope] = useState<Extract<FindReplaceScope, 'selection' | 'currentPage' | 'currentFile'>>('selection');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [includeHiddenText, setIncludeHiddenText] = useState(true);
  const [includeLockedText, setIncludeLockedText] = useState(true);
  const [availableFonts, setAvailableFonts] = useState<AvailableFontInfo[]>([]);
  const [fontTargetFamily, setFontTargetFamily] = useState('');
  const [fontTargetStyle, setFontTargetStyle] = useState('');
  const [fontSizeTarget, setFontSizeTarget] = useState('');
  const [customFontSize, setCustomFontSize] = useState('');
  const [colorTarget, setColorTarget] = useState('#1664FF');
  const [styleOptions, setStyleOptions] = useState<Record<FindReplaceStyleKind, FindReplaceStyleOption[]>>({
    font: [], fontSize: [], color: []
  });
  const [scanState, setScanState] = useState<Record<FindReplaceStyleKind, 'idle' | 'loading' | 'success' | 'error'>>({
    font: 'idle', fontSize: 'idle', color: 'idle'
  });
  const [scanMeta, setScanMeta] = useState<Record<FindReplaceStyleKind, Pick<ScanFindReplaceStylesResult, 'unsupportedCount' | 'skippedHiddenCount' | 'skippedLockedCount'>>>({
    font: { unsupportedCount: 0, skippedHiddenCount: 0, skippedLockedCount: 0 },
    fontSize: { unsupportedCount: 0, skippedHiddenCount: 0, skippedLockedCount: 0 },
    color: { unsupportedCount: 0, skippedHiddenCount: 0, skippedLockedCount: 0 }
  });
  const [history, setHistory] = useState<FindReplaceHistoryEntry[]>([]);
  const [previewSnapshots, setPreviewSnapshots] = useState<Partial<Record<FindReplaceMode, PreviewSnapshot<FindReplacePreviewResult, FindReplacePreviewPayload>>>>({});
  const [selectedPreviewKeys, setSelectedPreviewKeys] = useState<Partial<Record<FindReplaceMode, string[]>>>({});
  const selectedText = selection.nodes.find((node) => node.type === 'TEXT' && node.text);
  const activeStyleKind = activeMode === 'text' ? undefined : activeMode;
  const activeSources = activeStyleKind ? styleOptions[activeStyleKind].map((option) => option.style) : [];
  const activeTarget = activeStyleKind ? targetStyleForKind(activeStyleKind) : {};
  const currentPayload: FindReplacePreviewPayload = activeMode === 'text'
    ? {
        mode: 'text', scope, target: 'text', applyMode: 'wholeNode', findText, replaceText,
        matchMode: 'contains', caseSensitive, includeHiddenText, includeLockedText
      }
    : {
        mode: activeMode, scope, target: 'style', applyMode: 'matchedRange', findText: '', replaceText: '',
        matchMode: 'contains', caseSensitive: false, includeHiddenText, includeLockedText,
        ...(activeSources.length ? { styleFindAny: activeSources } : {}),
        styleReplace: activeTarget
      };
  const replaceSelectionSignature = activeStyleKind || scope === 'selection' ? createSelectionSignature(selection) : '';
  const replaceParameterSignature = createParameterSignature(currentPayload);
  const previewSnapshot = previewSnapshots[activeMode] ?? null;
  const preview = previewSnapshot?.result ?? null;
  const previewStale = isPreviewSnapshotStale(previewSnapshot, replaceSelectionSignature, replaceParameterSignature);
  const activeHistory = activeStyleKind && settings?.saveReplaceHistory !== false
    ? history.filter((entry) => entry.kind === activeStyleKind)
    : [];
  const recentTargets = activeStyleKind ? uniqueHistoryTargets(activeStyleKind, activeHistory) : [];
  const recentFontSizeValues = activeMode === 'fontSize'
    ? recentTargets.flatMap((style) => typeof style.fontSize === 'number' ? [String(style.fontSize)] : [])
    : [];
  const recentColorValues = activeMode === 'color'
    ? recentTargets.flatMap((style) => normalizeUiHex(style.color ?? '') ? [normalizeUiHex(style.color ?? '') as string] : [])
    : [];
  const fontTargetAvailable = Boolean(fontTargetFamily && fontTargetStyle
    && availableFonts.some((font) => font.family === fontTargetFamily && font.style === fontTargetStyle));
  const selectedKeys = selectedPreviewKeys[activeMode] ?? [];
  const selectedKeySet = new Set(selectedKeys);
  const selectedPreviewItems = preview
    ? preview.items.filter((item) => selectedKeySet.has(findReplacePreviewItemKey(item)))
    : [];
  const runnableItems = selectedPreviewItems;
  const allPreviewItemsSelected = preview ? preview.items.length > 0 && selectedPreviewItems.length === preview.items.length : false;
  const somePreviewItemsSelected = selectedPreviewItems.length > 0 && !allPreviewItemsSelected;
  const canPreview = activeMode === 'text'
    ? Boolean(findText.trim() && replaceText)
    : Boolean(selection.count && scanState[activeMode] === 'success' && activeSources.length && Object.keys(activeTarget).length && (activeMode !== 'font' || fontTargetAvailable)
      && activeSources.some((source) => styleValue(activeMode, source) !== styleValue(activeMode, activeTarget)));
  const runButtonLabel = preview && runnableItems.length < preview.items.length ? '替换选中项' : '全部替换';

  useEffect(() => {
    let active = true;
    async function loadReferenceData() {
      const [fontResult, historyResult] = await Promise.allSettled([
        request<{ fonts: AvailableFontInfo[] }>('LIST_AVAILABLE_FONTS', undefined),
        request<{ entries: FindReplaceHistoryEntry[] }>('GET_FIND_REPLACE_HISTORY', undefined)
      ]);
      if (!active) return;
      setAvailableFonts(fontResult.status === 'fulfilled' && Array.isArray(fontResult.value.fonts) ? fontResult.value.fonts : []);
      setHistory(historyResult.status === 'fulfilled' && Array.isArray(historyResult.value.entries) ? historyResult.value.entries : []);
    }
    void loadReferenceData();
    return () => { active = false; };
  }, [request]);

  useEffect(() => {
    if (!activeStyleKind) return undefined;
    if (selection.count === 0) {
      setStyleOptions((current) => ({ ...current, [activeStyleKind]: [] }));
      setScanState((current) => ({ ...current, [activeStyleKind]: 'idle' }));
      setScanMeta((current) => ({
        ...current,
        [activeStyleKind]: { unsupportedCount: 0, skippedHiddenCount: 0, skippedLockedCount: 0 }
      }));
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setScanState((current) => ({ ...current, [activeStyleKind]: 'loading' }));
    request<ScanFindReplaceStylesResult>('SCAN_FIND_REPLACE_STYLES', {
      scope: 'selection',
      kind: activeStyleKind,
      includeHiddenText,
      includeLockedText
    }, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        setStyleOptions((current) => ({ ...current, [activeStyleKind]: data.items }));
        setScanMeta((current) => ({
          ...current,
          [activeStyleKind]: {
            unsupportedCount: data.unsupportedCount,
            skippedHiddenCount: data.skippedHiddenCount,
            skippedLockedCount: data.skippedLockedCount
          }
        }));
        setScanState((current) => ({ ...current, [activeStyleKind]: 'success' }));
      })
      .catch((error) => {
        if (!active || isOperationCancelled(error)) return;
        setScanState((current) => ({ ...current, [activeStyleKind]: 'error' }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeStyleKind, includeHiddenText, includeLockedText, replaceSelectionSignature, request, selection.count]);

  function targetStyleForKind(kind: FindReplaceStyleKind): FindReplaceTextStyle {
    if (kind === 'font') return compactStyle({ fontFamily: fontTargetFamily, fontStyle: fontTargetStyle });
    if (kind === 'fontSize') {
      return compactStyle({ fontSize: numericStyleValue(fontSizeTarget === 'custom' ? customFontSize : fontSizeTarget) });
    }
    return compactStyle({ color: normalizeUiHex(colorTarget) });
  }

  function selectFontFamily(family: string) {
    const familyFonts = availableFonts.filter((font) => font.family === family).sort(compareAvailableFontStyles);
    const currentStyle = family === fontTargetFamily && familyFonts.some((font) => font.style === fontTargetStyle)
      ? fontTargetStyle
      : undefined;
    const recentStyle = recentTargets.find((target) => target.fontFamily === family
      && familyFonts.some((font) => font.style === target.fontStyle))?.fontStyle;
    const regularStyle = familyFonts.find((font) => font.style === 'Regular' || font.style === 'Normal')?.style;
    setFontTargetFamily(family);
    setFontTargetStyle(currentStyle ?? recentStyle ?? regularStyle ?? familyFonts[0]?.style ?? '');
  }

  async function makePreview() {
    if ((activeStyleKind || scope === 'selection') && selection.count === 0) {
      setTask('error', '请先在画布中选择文本、容器或画板', 'selection');
      return;
    }
    if (!canPreview) {
      setTask('error', activeMode === 'text' ? '请填写查找文字和替换文字' : '请选择原样式和有效的目标样式', 'parameters');
      return;
    }
    setTask('loading', `正在生成${replaceModeLabel(activeMode)}预览`);
    try {
      const payload = currentPayload;
      const data = await request<FindReplacePreviewResult, FindReplacePreviewPayload>('FIND_REPLACE_PREVIEW', payload);
      const snapshot = createPreviewSnapshot(data, payload, replaceSelectionSignature, replaceParameterSignature);
      setPreviewSnapshots((current) => ({ ...current, [activeMode]: snapshot }));
      setSelectedPreviewKeys((current) => ({
        ...current,
        [activeMode]: data.items.map(findReplacePreviewItemKey)
      }));
      setTask('success', `找到 ${data.total} 条匹配，涉及 ${data.affectedNodeCount} 个文本节点`);
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', messageOf(error));
    }
  }

  function run() {
    if (!previewSnapshot?.result.items.length || !runnableItems.length || previewStale) return;
    const snapshot = previewSnapshot;
    const mode = activeMode;
    const items = runnableItems;
    const affectedNodeCount = new Set(items.map((item) => item.nodeId)).size;
    const affectedRangeCount = items.filter((item) => typeof item.rangeStart === 'number' && typeof item.rangeEnd === 'number').length;
    const actionLabel = items.length < snapshot.result.items.length ? '替换选中项' : '全部替换';
    confirm({
      title: `确认${actionLabel}`,
      summary: `将处理 ${items.length} 条匹配。`,
      details: [
        { label: '涉及文本节点', value: `${affectedNodeCount} 个` },
        { label: '局部片段', value: `${affectedRangeCount} 个` }
      ],
      confirmText: actionLabel,
      tone: 'warning',
      onConfirm: async () => {
        setTask('loading', `正在执行${replaceModeLabel(mode)}`);
        try {
          const data = await request<ToolExecutionResult>('RUN_FIND_REPLACE', { items, confirmed: true });
          setTask(('cancelled' in data && data.cancelled) ? 'cancelled' : 'success', data.message);
          if (data.successCount > 0 && mode !== 'text' && settings?.saveReplaceHistory !== false) {
            const historyPayload = historyPayloadFromPreview(snapshot.params);
            if (historyPayload) {
              try {
                const saved = await request<{ entries: FindReplaceHistoryEntry[] }>('UPSERT_FIND_REPLACE_HISTORY', historyPayload);
                setHistory(saved.entries);
              } catch {
                toast('替换完成，但历史记录保存失败', 'result');
              }
            }
          }
        } catch (error) {
          if (!isOperationCancelled(error)) setTask('error', messageOf(error));
        }
      }
    });
  }

  function clearPreview() {
    setPreviewSnapshots((current) => ({ ...current, [activeMode]: undefined }));
    setSelectedPreviewKeys((current) => ({ ...current, [activeMode]: [] }));
    setTask('idle', '等待操作');
  }

  function togglePreviewItem(item: FindReplacePreviewResult['items'][number]) {
    const key = findReplacePreviewItemKey(item);
    setSelectedPreviewKeys((current) => {
      const currentKeys = current[activeMode] ?? [];
      return {
        ...current,
        [activeMode]: currentKeys.includes(key)
          ? currentKeys.filter((itemKey) => itemKey !== key)
          : [...currentKeys, key]
      };
    });
  }

  function toggleAllPreviewItems() {
    if (!preview) return;
    setSelectedPreviewKeys((current) => ({
      ...current,
      [activeMode]: allPreviewItemsSelected ? [] : preview.items.map(findReplacePreviewItemKey)
    }));
  }

  return (
    <div className="page replace-page">
      <Tabs ariaLabel="文本替换功能" options={REPLACE_TAB_OPTIONS} value={activeMode} onChange={setActiveMode}>
        <Panel title="替换范围">
          {renderFeedback('selection')}
          <SelectField label="查找范围" value={scope} placeholder="请选择查找范围" onChange={(event) => setScope(event.target.value as typeof scope)}>
            {REPLACE_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          <div className="replace-advanced-options">
            {activeMode === 'text' ? (
              <label className="checkline"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} /> 区分大小写</label>
            ) : null}
            <label className="checkline"><input type="checkbox" checked={includeHiddenText} onChange={(event) => setIncludeHiddenText(event.target.checked)} /> 包含隐藏文本</label>
            <label className="checkline"><input type="checkbox" checked={includeLockedText} onChange={(event) => setIncludeLockedText(event.target.checked)} /> 包含锁定文本</label>
          </div>
        </Panel>

        <Panel title={`${replaceModeLabel(activeMode)}条件`}>
          {renderFeedback('parameters')}
          {activeMode === 'text' ? (
            <>
              <div className="form-grid">
                <Field label="查找文字"><input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="请输入需要查找的文字" /></Field>
                <Field label="替换为"><input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="请输入替换后的文字" /></Field>
              </div>
              <div className="replace-inline-actions">
                <Button disabled={!selectedText?.text} onClick={() => selectedText?.text && setFindText(selectedText.text)}>用选中文字查找</Button>
                <Button variant="primary" disabled={!canPreview} onClick={() => void makePreview()}>生成预览</Button>
              </div>
            </>
          ) : null}

          {activeStyleKind ? (
            <>
              {scanState[activeStyleKind] === 'loading' ? <NoticeBar state="loading" text="正在扫描文字样式"/> : null}
              {scanState[activeStyleKind] === 'error' ? <NoticeBar state="error" text="样式扫描失败，请调整选区或重新进入当前功能。"/> : null}
              {scanMeta[activeStyleKind].unsupportedCount ? <NoticeBar state="warning" text={`已跳过 ${scanMeta[activeStyleKind].unsupportedCount} 处无法安全识别的样式。`}/> : null}
              <div className="replace-style-fields">
                <ReadOnlyStyleSources
                  kind={activeStyleKind}
                  options={styleOptions[activeStyleKind]}
                  selectionCount={selection.count}
                />
                {activeMode === 'font' ? (
                  <>
                    <FontTargetSelect
                      fonts={availableFonts}
                      recentTargets={recentTargets}
                      value={fontTargetFamily}
                      onChange={selectFontFamily}
                    />
                    <FontWeightSelect
                      family={fontTargetFamily}
                      fonts={availableFonts}
                      value={fontTargetStyle}
                      onChange={setFontTargetStyle}
                    />
                  </>
                ) : null}
                {activeMode === 'fontSize' ? (
                  <SelectField label="替换为" value={fontSizeTarget} placeholder="请选择目标字号" onChange={(event) => setFontSizeTarget(event.target.value)}>
                    {recentFontSizeValues.length ? <option disabled value="recent-heading">最近使用</option> : null}
                    {recentFontSizeValues.map((size) => <option key={`recent-${size}`} value={size}>{size}</option>)}
                    <option disabled value="common-heading">常用字号</option>
                    {COMMON_FONT_SIZES.filter((size) => !recentFontSizeValues.includes(size)).map((size) => <option key={size} value={size}>{size}</option>)}
                    <option value="custom">自定义字号</option>
                  </SelectField>
                ) : null}
                {activeMode === 'color' ? (
                  <Field label="替换为">
                    <div className="replace-color-target">
                      {recentColorValues.length ? (
                        <ColorSwatchGroup label="最近使用" colors={recentColorValues} value={colorTarget} onChange={setColorTarget} />
                      ) : null}
                      <ColorSwatchGroup label="常用颜色" colors={COMMON_REPLACE_COLORS.filter((color) => !recentColorValues.includes(color))} value={colorTarget} onChange={setColorTarget} />
                      <div className="replace-color-input">
                        <input aria-label="选择目标颜色" type="color" value={normalizeUiHex(colorTarget) ?? '#1664FF'} onChange={(event) => setColorTarget(event.target.value.toUpperCase())} />
                        <input aria-label="输入目标颜色 HEX" value={colorTarget} onChange={(event) => setColorTarget(event.target.value.toUpperCase())} placeholder="#1664FF" />
                      </div>
                    </div>
                  </Field>
                ) : null}
              </div>
              {activeMode === 'fontSize' && fontSizeTarget === 'custom' ? (
                <Field label="自定义字号"><input inputMode="decimal" min="0.1" max="1000" type="number" value={customFontSize} onChange={(event) => setCustomFontSize(event.target.value)} placeholder="请输入 0.1–1000" /></Field>
              ) : null}
              {activeMode === 'font' && !fontTargetAvailable ? <NoticeBar state="warning" text="历史目标字体当前不可用，请重新选择目标字体。"/> : null}
            </>
          ) : null}

          {activeMode !== 'text' ? (
            <div className="replace-option-row">
              <div className="replace-option-actions">
                <Button variant="primary" disabled={!canPreview || Boolean(activeStyleKind && scanState[activeStyleKind] === 'loading')} onClick={() => void makePreview()}>生成预览</Button>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="结果预览" meta={preview && activeStyleKind ? <span className="panel-count">已选择 {runnableItems.length} / {preview.total}</span> : undefined}>
          {previewStale ? <NoticeBar state="warning" text="配置或选区已变更，请重新生成预览。"/> : null}
          <div className="replace-preview-body">
            {preview?.items.length ? (
              activeStyleKind ? (
                <div className="preview-table-scroll replace-style-preview-scroll" role="region" aria-label="预览结果" tabIndex={0}>
                  <table className="batch-result-table preview-table replace-style-preview-table">
                    <colgroup><col /><col /><col /><col /></colgroup>
                    <thead>
                      <tr>
                        <th className="replace-preview-check-cell">
                          <Checkbox
                            ariaLabel="全选预览项"
                            checked={allPreviewItemsSelected}
                            indeterminate={somePreviewItemsSelected}
                            onChange={toggleAllPreviewItems}
                          />
                        </th>
                        <th>文本</th>
                        <th>{stylePreviewColumnLabels(activeStyleKind).current}</th>
                        <th>{stylePreviewColumnLabels(activeStyleKind).target}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.map((item) => {
                        const itemKey = findReplacePreviewItemKey(item);
                        const currentValue = styleKindValueLabel(activeStyleKind, item.beforeStyle);
                        const targetValue = styleKindValueLabel(activeStyleKind, item.afterStyle);
                        return (
                          <tr key={itemKey}>
                            <td className="replace-preview-check-cell">
                              <Checkbox
                                ariaLabel={`选择文本 ${item.beforeText || item.name}`}
                                checked={selectedKeySet.has(itemKey)}
                                onChange={() => togglePreviewItem(item)}
                              />
                            </td>
                            <td className="replace-style-preview-cell" title={item.beforeText}>{item.beforeText}</td>
                            <td className="replace-style-preview-cell" title={currentValue}>{previewValue(activeMode, item.beforeText, item.beforeStyle)}</td>
                            <td className="replace-style-preview-cell" title={targetValue}>{previewValue(activeMode, item.afterText, item.afterStyle)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <div className="replace-preview-cards">
                    <div className="batch-result-selection-bar replace-mobile-selection-bar">
                      <Checkbox ariaLabel="全选预览项" checked={allPreviewItemsSelected} indeterminate={somePreviewItemsSelected} onChange={toggleAllPreviewItems} />
                      <span>已选择 {runnableItems.length} / {preview.total}</span>
                    </div>
                    {preview.items.map((item, index) => (
                      <article className="replace-preview-card" key={`${item.nodeId}-${item.rangeStart ?? 'node'}-${index}`}>
                        <Checkbox
                          ariaLabel={`选择文本 ${item.beforeText || item.name}`}
                          checked={selectedKeySet.has(findReplacePreviewItemKey(item))}
                          onChange={() => togglePreviewItem(item)}
                        />
                        <strong>{scopeLabelForItem(item)}</strong>
                        <span className="replace-preview-sample">“{item.beforeText}”</span>
                        <dl>
                          <div><dt>修改前</dt><dd>{previewValue(activeMode, item.beforeText, item.beforeStyle)}</dd></div>
                          <div><dt>修改后</dt><dd>{previewValue(activeMode, item.afterText, item.afterStyle)}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  <div className="preview-table-scroll replace-preview-scroll" role="region" aria-label="预览结果" tabIndex={0}>
                    <table className="batch-result-table preview-table replace-text-preview-table">
                      <thead><tr><th className="batch-result-check-cell"><Checkbox hitArea ariaLabel="全选预览项" checked={allPreviewItemsSelected} indeterminate={somePreviewItemsSelected} onChange={toggleAllPreviewItems} /></th><th>页面 / 容器</th><th>文字样例</th><th>修改前</th><th>修改后</th></tr></thead>
                      <tbody>
                        {preview.items.map((item, index) => (
                          <tr key={`${item.nodeId}-${item.rangeStart ?? 'node'}-${index}`}>
                            <td className="batch-result-check-cell"><Checkbox hitArea ariaLabel={`选择文本 ${item.beforeText || item.name}`} checked={selectedKeySet.has(findReplacePreviewItemKey(item))} onChange={() => togglePreviewItem(item)} /></td>
                            <td className="replace-preview-cell" title={scopeLabelForItem(item)}>{scopeLabelForItem(item)}</td>
                            <td className="replace-preview-cell" title={item.beforeText}>{item.beforeText}</td>
                            <td className="replace-preview-cell" title={item.beforeText}>{previewValue(activeMode, item.beforeText, item.beforeStyle)}</td>
                            <td className="replace-preview-cell" title={item.afterText}>{previewValue(activeMode, item.afterText, item.afterStyle)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : <EmptyState title="暂无预览" detail="配置替换条件并生成预览后再执行。" />}
          </div>
          {!previewStale ? renderFeedback('result') : null}
          <div className="replace-preview-actions">
            <Button disabled={!preview} onClick={clearPreview}>清空预览</Button>
            <Button variant="primary" disabled={!runnableItems.length || previewStale || task.state === 'loading'} onClick={run}>{runButtonLabel}</Button>
          </div>
        </Panel>
      </Tabs>
    </div>
  );
}

type FontTargetCategory = 'all' | 'local' | 'team';

type AvailableFontFamily = {
  family: string;
  fonts: AvailableFontInfo[];
  representative: AvailableFontInfo;
};

type FontTargetOption = {
  key: string;
  value: string;
  label: string;
  disabled: boolean;
  recent: boolean;
};

function ReadOnlyStyleSources({
  kind,
  options,
  selectionCount
}: {
  kind: FindReplaceStyleKind;
  options: FindReplaceStyleOption[];
  selectionCount: number;
}) {
  const noun = styleKindNoun(kind);
  const emptyText = selectionCount ? `当前选区未发现可替换的${noun}` : '请先在画布中选择文本、容器或画板';
  return (
    <div className="field replace-source-field">
      <span>原{noun}</span>
      <div aria-label={`当前选区${noun}`} className="replace-source-list" role="list">
        {options.length ? options.map((option) => (
          <div className="replace-source-item" key={option.value} role="listitem" title={option.label}>
            <span className="replace-source-value">
              {kind === 'color' && option.style.color ? <i aria-hidden="true" style={{ backgroundColor: option.style.color }} /> : null}
              <span>{option.label}</span>
            </span>
            <small>{option.count} 处</small>
          </div>
        )) : <span className="replace-source-empty">{emptyText}</span>}
      </div>
    </div>
  );
}

function FontTargetSelect({
  fonts,
  recentTargets,
  value,
  onChange
}: {
  fonts: AvailableFontInfo[];
  recentTargets: FindReplaceTextStyle[];
  value: string;
  onChange: (value: string) => void;
}) {
  const controlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontTargetCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const fontFamilies = useMemo(() => groupAvailableFontFamilies(fonts), [fonts]);
  const familiesByName = new Map(fontFamilies.map((item) => [item.family, item]));
  const recentFamilies = [...new Set(recentTargets.flatMap((target) => target.fontFamily ? [target.fontFamily] : []))];
  const recentFamilySet = new Set(recentFamilies);
  const matchesQuery = (label: string) => !normalizedQuery || label.toLocaleLowerCase().includes(normalizedQuery);
  const matchesCategory = (item: AvailableFontFamily) => category === 'all'
    || category === 'local' && item.fonts.some((font) => font.referrers.includes('local'))
    || category === 'team' && item.fonts.some((font) => font.referrers.includes('team') || font.referrers.includes('org'));
  const matchesFontQuery = (item: AvailableFontFamily) => item.fonts.some((font) => matchesAvailableFontFamilyQuery(font, normalizedQuery));
  const recentOptions: FontTargetOption[] = recentFamilies.flatMap((family) => {
    const item = familiesByName.get(family);
    if ((item ? !matchesFontQuery(item) : !matchesQuery(family))
      || (item ? !matchesCategory(item) : category !== 'all')) return [];
    return [{
      key: `recent-${family}`,
      value: family,
      label: item ? getAvailableFontFamilyDisplayLabel(item.representative) : family,
      disabled: !item,
      recent: true
    }];
  });
  const fontOptions: FontTargetOption[] = fontFamilies
    .filter((item) => matchesCategory(item) && matchesFontQuery(item) && !recentFamilySet.has(item.family))
    .map((item) => ({
      key: `font-${item.family}`,
      value: item.family,
      label: getAvailableFontFamilyDisplayLabel(item.representative),
      disabled: false,
      recent: false
    }));
  const options = [...recentOptions, ...fontOptions];
  const selectedFamily = familiesByName.get(value);
  const selectedLabel = selectedFamily ? getAvailableFontFamilyDisplayLabel(selectedFamily.representative) : value;
  const firstEnabledIndex = Math.max(0, options.findIndex((option) => !option.disabled));
  const lastEnabledIndex = Math.max(0, options.map((option) => !option.disabled).lastIndexOf(true));

  useEffect(() => {
    if (!isOpen) return undefined;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!options.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => options[current] && !options[current]?.disabled ? current : firstEnabledIndex);
  }, [category, firstEnabledIndex, normalizedQuery, options.length]);

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  function closeMenu(restoreFocus = true) {
    setIsOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  }

  function openMenu() {
    setIsOpen(true);
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
  }

  function selectOption(option: FontTargetOption | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    closeMenu();
  }

  function moveActive(direction: 1 | -1) {
    for (let step = 1; step <= options.length; step += 1) {
      const index = (activeIndex + step * direction + options.length) % options.length;
      if (!options[index]?.disabled) {
        setActiveIndex(index);
        return;
      }
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (!options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(lastEnabledIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  }

  return (
    <div className="field">
      <span id={`${controlId}-label`}>字体</span>
      <div className="select-control font-target-select" ref={rootRef}>
        <button
          aria-controls={`${controlId}-menu`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={`${controlId}-label ${controlId}-value`}
          className={`select-trigger ${value ? '' : 'is-placeholder'}`}
          onClick={() => isOpen ? closeMenu(false) : openMenu()}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!isOpen) openMenu();
            } else if (event.key === 'Escape' && isOpen) {
              event.preventDefault();
              closeMenu();
            }
          }}
          ref={triggerRef}
          role="combobox"
          type="button"
        >
          <span id={`${controlId}-value`}>{selectedLabel || '请选择目标字体'}</span>
          <ChevronDown aria-hidden="true" className="select-chevron" size={13} strokeWidth={1.8} />
        </button>
        {isOpen ? (
          <div className="select-menu font-target-menu" id={`${controlId}-menu`} onKeyDown={handleMenuKeyDown}>
            <div className="font-target-search">
              <Search aria-hidden="true" size={14} />
              <input
                aria-activedescendant={options.length ? `${controlId}-option-${activeIndex}` : undefined}
                aria-controls={`${controlId}-listbox`}
                aria-expanded={true}
                aria-label="搜索目标字体"
                aria-autocomplete="list"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索字体"
                ref={searchRef}
                role="combobox"
                value={query}
              />
            </div>
            <div aria-label="字体来源" className="font-target-categories" role="tablist">
              {FONT_TARGET_CATEGORIES.map((item) => (
                <button
                  aria-selected={category === item.value}
                  className={category === item.value ? 'active' : ''}
                  key={item.value}
                  onClick={() => { setCategory(item.value); setActiveIndex(0); }}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div aria-labelledby={`${controlId}-label`} className="font-target-options" id={`${controlId}-listbox`} role="listbox">
              {options.length ? options.map((option, index) => (
                <div key={option.key}>
                  {index === 0 || (options[index - 1]?.recent && !option.recent)
                    ? <div className="font-target-group-label">{option.recent ? '最近使用' : '字体列表'}</div>
                    : null}
                  <button
                    aria-selected={option.value === value}
                    className={`select-option ${option.value === value ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                    disabled={option.disabled}
                    id={`${controlId}-option-${index}`}
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    ref={(node) => { optionRefs.current[index] = node; }}
                    role="option"
                    tabIndex={-1}
                    title={`${option.label}${option.label !== option.value ? `｜规范名：${option.value}` : ''}${option.disabled ? '（当前不可用）' : ''}`}
                    type="button"
                  >
                    {option.value === value ? <Check aria-hidden="true" size={14} /> : <span className="select-option-spacer" />}
                    <span>{option.label}</span>
                    {option.disabled ? <small>当前不可用</small> : null}
                  </button>
                </div>
              )) : <div className="font-target-empty">未找到匹配字体</div>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FontWeightSelect({
  fonts,
  family,
  value,
  onChange
}: {
  fonts: AvailableFontInfo[];
  family: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = fonts.filter((font) => font.family === family).sort(compareAvailableFontStyles);
  return (
    <SelectField
      disabled={!family || !styles.length}
      label="字重"
      onChange={(event) => onChange(event.target.value)}
      placeholder={family ? '请选择字重' : '请先选择字体'}
      value={value}
    >
      {styles.map((font) => (
        <option key={font.style} value={font.style}>{getAvailableFontStyleDisplayLabel(font)}</option>
      ))}
    </SelectField>
  );
}

function groupAvailableFontFamilies(fonts: AvailableFontInfo[]): AvailableFontFamily[] {
  const grouped = new Map<string, AvailableFontInfo[]>();
  for (const font of fonts) {
    const familyFonts = grouped.get(font.family) ?? [];
    familyFonts.push(font);
    grouped.set(font.family, familyFonts);
  }
  return [...grouped.entries()]
    .map(([family, familyFonts]) => {
      const sortedFonts = familyFonts.sort(compareAvailableFontStyles);
      return {
        family,
        fonts: sortedFonts,
        representative: sortedFonts.find((font) => font.displayFamily && font.displayFamily !== family)
          ?? sortedFonts[0] as AvailableFontInfo
      };
    })
    .sort((left, right) => getAvailableFontFamilyDisplayLabel(left.representative)
      .localeCompare(getAvailableFontFamilyDisplayLabel(right.representative), 'zh-CN', { numeric: true }));
}

function ColorSwatchGroup({
  label,
  colors,
  value,
  onChange
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeUiHex(value);
  const normalizedColors = [...new Set(colors.flatMap((color) => normalizeUiHex(color) ? [normalizeUiHex(color) as string] : []))];
  return (
    <div className="replace-color-swatch-group">
      <span>{label}</span>
      <div aria-label={label} className="replace-color-swatches" role="group">
        {normalizedColors.map((color) => (
          <button
            aria-label={`${label} ${color}`}
            aria-pressed={normalizedValue === color}
            className={normalizedValue === color ? 'active' : ''}
            key={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            title={color}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}

const REPLACE_TAB_OPTIONS: Array<{ label: string; value: FindReplaceMode }> = [
  { label: '文字替换', value: 'text' },
  { label: '字体替换', value: 'font' },
  { label: '字号替换', value: 'fontSize' },
  { label: '颜色替换', value: 'color' }
];

const COMMON_FONT_SIZES = ['8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48', '56', '64', '72', '96'];

const COMMON_REPLACE_COLORS = ['#000000', '#FFFFFF', '#666666', '#999999', '#1664FF', '#24A148', '#F1C21B', '#DA1E28'];

const FONT_TARGET_CATEGORIES: Array<{ label: string; value: FontTargetCategory }> = [
  { label: '全部字体', value: 'all' },
  { label: '本地字体', value: 'local' },
  { label: '团队/企业字体', value: 'team' }
];

const REPLACE_SCOPE_OPTIONS: Array<{ label: string; value: Extract<FindReplaceScope, 'selection' | 'currentPage' | 'currentFile'> }> = [
  { label: '所有页面', value: 'currentFile' },
  { label: '当前页面', value: 'currentPage' },
  { label: '当前选中', value: 'selection' }
];

function numericStyleValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function compactStyle(style: FindReplaceTextStyle): FindReplaceTextStyle {
  const compacted: FindReplaceTextStyle = {};
  if (style.fontFamily?.trim()) {
    compacted.fontFamily = style.fontFamily.trim();
  }
  if (style.fontStyle?.trim()) {
    compacted.fontStyle = style.fontStyle.trim();
  }
  if (typeof style.fontSize === 'number') {
    compacted.fontSize = style.fontSize;
  }
  if (style.color?.trim()) {
    compacted.color = style.color.trim();
  }
  return compacted;
}

function styleValue(kind: FindReplaceStyleKind, style: FindReplaceTextStyle): string {
  if (kind === 'font') return style.fontFamily ? `${style.fontFamily}\u0000${style.fontStyle || 'Regular'}` : '';
  if (kind === 'fontSize') return typeof style.fontSize === 'number' ? String(style.fontSize) : '';
  return normalizeUiHex(style.color ?? '') ?? '';
}

function styleKindValueLabel(kind: FindReplaceStyleKind, style: FindReplaceTextStyle): string {
  if (kind === 'font') return fontLabel(style);
  if (kind === 'fontSize') return String(style.fontSize ?? '-');
  return normalizeUiHex(style.color ?? '') ?? '-';
}

function fontLabel(style: FindReplaceTextStyle): string {
  return style.fontFamily ? `${style.fontFamily} / ${style.fontStyle || 'Regular'}` : '';
}

function replaceModeLabel(mode: FindReplaceMode): string {
  return mode === 'text' ? '文字替换' : mode === 'font' ? '字体替换' : mode === 'fontSize' ? '字号替换' : '颜色替换';
}

function styleKindNoun(kind: FindReplaceStyleKind): string {
  return kind === 'font' ? '字体' : kind === 'fontSize' ? '字号' : '颜色';
}

function uniqueHistoryTargets(kind: FindReplaceStyleKind, entries: FindReplaceHistoryEntry[]): FindReplaceTextStyle[] {
  const seen = new Set<string>();
  const targets: FindReplaceTextStyle[] = [];
  for (const entry of [...entries].sort((left, right) => right.usedAt - left.usedAt)) {
    const value = styleValue(kind, entry.targetStyle);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    targets.push(entry.targetStyle);
  }
  return targets;
}

function findReplacePreviewItemKey(item: FindReplacePreviewResult['items'][number]): string {
  return `${item.nodeId}:${item.rangeStart ?? 'node'}:${item.rangeEnd ?? 'node'}`;
}

function stylePreviewColumnLabels(kind: FindReplaceStyleKind): { current: string; target: string } {
  const noun = styleKindNoun(kind);
  return { current: `当前${noun}`, target: `替换${noun}` };
}

function historyPayloadFromPreview(payload: FindReplacePreviewPayload) {
  if (!payload.mode || payload.mode === 'text' || !payload.styleFindAny?.length || !payload.styleReplace) return undefined;
  return { kind: payload.mode, sourceStyles: payload.styleFindAny, targetStyle: payload.styleReplace };
}

function normalizeUiHex(value: string): string | undefined {
  const match = /^#?([0-9A-Fa-f]{6})$/.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : undefined;
}

function previewValue(mode: FindReplaceMode, text: string, style: FindReplaceTextStyle): ReactElement | string {
  if (mode === 'text') return text || '-';
  if (mode === 'font') return fontLabel(style) || '-';
  if (mode === 'fontSize') return typeof style.fontSize === 'number' ? String(style.fontSize) : '-';
  const color = normalizeUiHex(style.color ?? '');
  return color ? <span className="replace-color-value"><i aria-hidden="true" style={{ backgroundColor: color }} />{color}</span> : '-';
}

function scopeLabelForItem(item: { pageName?: string; containerName?: string }): string {
  return [item.pageName, item.containerName].filter(Boolean).join(' / ') || '-';
}