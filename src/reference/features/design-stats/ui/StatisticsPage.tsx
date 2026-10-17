import {localizeStatisticsReport} from '../../../statistics-localization';
import { useEffect, useRef, useState } from 'react';
import { isOperationCancelled } from "../../../shared/messages";
import type { DesignStatsMaterialType, DesignStatsResult, LocatePageInfo } from "../../../shared/messages";
import { Button, EmptyState, Panel, StatusTag } from "../../../ui/components/ui";
import { renderNoFeedback } from "../../../ui/feedback";
import { ToolPageProps, messageOf } from '../../../ui/pages/tool-page-shared';


const DESIGN_STATS_FILTER_OPTIONS: Array<{ label: string; value: DesignStatsMaterialType }> = [
  { label: '图片', value: 'image' },
  { label: '编组', value: 'group' },
  { label: '文本', value: 'text' },
  { label: '容器', value: 'rectangle' }
];

export default function StatisticsPage({ request, task, setTask, toast, renderFeedback = renderNoFeedback }: ToolPageProps) {
  const [includeMaterialTypes, setIncludeMaterialTypes] = useState<DesignStatsMaterialType[]>([]);
  const [result, setResult] = useState<DesignStatsResult | null>(null);
  const [pages, setPages] = useState<LocatePageInfo[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);
  const allPagesRef = useRef<HTMLInputElement | null>(null);
  const resultTextRef = useRef<HTMLTextAreaElement | null>(null);
  const allPagesSelected = pages.length > 0 && selectedPageIds.length === pages.length;
  const somePagesSelected = selectedPageIds.length > 0 && selectedPageIds.length < pages.length;

  useEffect(() => {
    let cancelled = false;
    void request<{ pages: LocatePageInfo[] }>('GET_LOCATE_PAGES')
      .then((data) => {
        if (cancelled) {
          return;
        }
        const nextPages = data.pages ?? [];
        const currentPageIds = nextPages.filter((page) => page.isCurrent).map((page) => page.pageId);
        setPages(nextPages);
        setSelectedPageIds(currentPageIds.length ? currentPageIds : nextPages.slice(0, 1).map((page) => page.pageId));
      })
      .catch(() => {
        if (!cancelled) {
          setPages([]);
          setSelectedPageIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    if (allPagesRef.current) {
      allPagesRef.current.indeterminate = somePagesSelected;
    }
  }, [somePagesSelected]);

  async function scan() {
    if (selectedPageIds.length === 0) {
      toast('请先选择至少一个页面', 'parameters');
      return;
    }

    setTask('loading', allPagesSelected ? '正在统计全部页面' : `正在统计 ${selectedPageIds.length} 个页面`);
    try {
      const data = await request<DesignStatsResult, { includeMaterialTypes: DesignStatsMaterialType[]; pageIds: string[] }>('SCAN_DESIGN_STATS', {
        includeMaterialTypes,
        pageIds: selectedPageIds
      });
      setResult(data);
      setTask(data.total ? 'success' : 'idle', data.total ? `已统计 ${data.total} 个对象` : '未找到匹配对象');
    } catch (error) {
      if (!isOperationCancelled(error)) setTask('error', messageOf(error));
    }
  }

  const localizedResultText=result?localizeStatisticsReport(result):'';

  async function copyResult() {
    if (!result?.text) {
      toast('请先生成统计结果', 'result');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(localizedResultText);
        toast('统计文本已复制', 'result', 'success');
        return;
      }
    } catch {
      // Fall through to the textarea selection fallback for sandboxed plugin iframes.
    }

    const fallbackSucceeded = copySelectedResultText(resultTextRef.current);
    toast(fallbackSucceeded ? '统计文本已复制' : '已选中文本，请手动复制', 'result', fallbackSucceeded ? 'success' : 'info');
  }

  function toggleMaterialType(type: DesignStatsMaterialType) {
    setIncludeMaterialTypes((current) => current.includes(type)
      ? current.filter((value) => value !== type)
      : [...current, type]);
  }

  function togglePage(pageId: string) {
    setSelectedPageIds((current) => current.includes(pageId)
      ? current.filter((value) => value !== pageId)
      : [...current, pageId]);
  }

  function toggleAllPages() {
    setSelectedPageIds(allPagesSelected ? [] : pages.map((page) => page.pageId));
  }

  function defaultSelectedPageIds() {
    const currentPageIds = pages.filter((page) => page.isCurrent).map((page) => page.pageId);
    return currentPageIds.length ? currentPageIds : pages.slice(0, 1).map((page) => page.pageId);
  }

  function resetScope() {
    setIncludeMaterialTypes([]);
    setResult(null);
    setSelectedPageIds(defaultSelectedPageIds());
    setIsPageMenuOpen(false);
    setTask('idle', '等待操作');
  }

  function clearResult() {
    setResult(null);
    setTask('idle', '等待操作');
  }

  const selectedPageNames = pages
    .filter((page) => selectedPageIds.includes(page.pageId))
    .map((page) => page.pageName);
  const pageMenuLabel = allPagesSelected
    ? '全部页面'
    : selectedPageNames.length === 1
      ? selectedPageNames[0]
      : selectedPageNames.length > 1
        ? `已选择 ${selectedPageNames.length} 个页面`
        : '请选择页面';

  return (
    <div className="page">
      <Panel title="统计范围">
        {renderFeedback('parameters')}
        <div className="statistics-page-picker">
          <button
            aria-expanded={isPageMenuOpen}
            className="statistics-page-picker-button"
            onClick={() => setIsPageMenuOpen((current) => !current)}
            type="button"
          >
            <span>{pageMenuLabel}</span>
            <strong>{selectedPageIds.length}/{pages.length}</strong>
          </button>
          {isPageMenuOpen ? (
            <div className="statistics-page-tree">
              <label className="checkline locate-tree-root">
                <input
                  aria-label="全部页面"
                  checked={allPagesSelected}
                  onChange={toggleAllPages}
                  ref={allPagesRef}
                  type="checkbox"
                />
                <span>全部页面</span>
                <strong>{pages.length}</strong>
              </label>
              <div className="locate-tree-children">
                {pages.map((page) => (
                  <label className="checkline" key={page.pageId}>
                    <input
                      aria-label={page.pageName}
                      checked={selectedPageIds.includes(page.pageId)}
                      onChange={() => togglePage(page.pageId)}
                      type="checkbox"
                    />
                    <span>{page.pageName}</span>
                    {page.isCurrent ? <StatusTag tone="primary">当前</StatusTag> : null}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="statistics-filter-block">
          <span className="field-label">附加统计内容</span>
          <p className="panel-note">默认统计顶层画框，可附加以下对象类型。</p>
          <div className="statistics-filter-grid">
            {DESIGN_STATS_FILTER_OPTIONS.map((option) => (
              <label className="checkline" key={option.value}>
                <input
                  aria-label={option.label}
                  checked={includeMaterialTypes.includes(option.value)}
                  onChange={() => toggleMaterialType(option.value)}
                  type="checkbox"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="statistics-actions">
          <Button onClick={resetScope}>重置</Button>
          <Button variant="primary" onClick={() => void scan()}>生成统计</Button>
        </div>
      </Panel>

      <Panel title="统计结果">
        {result ? (
          <textarea className="statistics-result-text" readOnly ref={resultTextRef} value={localizedResultText} />
        ) : (
          <EmptyState title="暂无统计结果" detail="点击生成统计后展示所选页面的设计图清单。" />
        )}
        {renderFeedback('result')}
        <div className="statistics-actions statistics-copy-actions">
          <Button onClick={clearResult} disabled={!result}>清空</Button>
          <Button onClick={() => void copyResult()} disabled={!result?.text}>复制</Button>
        </div>
      </Panel>
    </div>
  );
}

function copySelectedResultText(textarea: HTMLTextAreaElement | null): boolean {
  if (!textarea) {
    return false;
  }
  textarea.focus();
  textarea.select();

  try {
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  }
}