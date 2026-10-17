import {useSyncExternalStore} from 'react';
import type {PreviewItem} from '../../../shared/types';
import {Checkbox} from '../../../ui/components/ui';

type Props = {
  items: PreviewItem[];
  selectedIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggle: (id: string, checked: boolean) => void;
  actionLabel: (item: PreviewItem) => string;
};

const wideQuery = '(min-width: 521px)';
function subscribeWidth(notify: () => void) {
  const media = window.matchMedia(wideQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}
const readWide = () => window.matchMedia(wideQuery).matches;

export function TextFillPreview({items, selectedIds, allSelected, someSelected, onToggleAll, onToggle, actionLabel}: Props) {
  const wide = useSyncExternalStore(subscribeWidth, readWide, () => false);
  const selectAll = <label className="text-fill-select-all"><Checkbox ariaLabel="选择全部填充项" checked={allSelected} indeterminate={someSelected} onChange={onToggleAll}/><span>全选</span></label>;
  return <>
    {!wide ? <div className="text-fill-preview-cards">
      {selectAll}
      {items.map(item => <article className="text-fill-preview-card" key={item.nodeId}>
        <div className="text-fill-preview-card-head">
          <label className="text-fill-item-select"><Checkbox ariaLabel={`选择 ${item.before}`} checked={selectedIds.includes(item.nodeId)} onChange={checked => onToggle(item.nodeId, checked)}/><span data-i18n-skip="true" title={item.fieldLabel}>{item.fieldLabel ?? '-'}</span></label>
          <span className="panel-count">{item.canRun === false ? '待分配' : actionLabel(item)}</span>
        </div>
        <dl><div><dt>修改前</dt><dd>{item.before}</dd></div><div><dt>修改后</dt><dd>{item.canRun === false ? '-' : item.after}</dd></div></dl>
      </article>)}
    </div> : <div className="text-fill-preview-scroll" role="region" aria-label="预览结果" tabIndex={0}>
      <table className="batch-result-table text-fill-preview-table"><thead><tr><th className="batch-result-check-cell"><Checkbox hitArea ariaLabel="选择全部填充项" checked={allSelected} indeterminate={someSelected} onChange={onToggleAll}/></th><th>修改前</th><th>匹配字段</th><th>处理</th><th>修改后</th></tr></thead>
        <tbody>{items.map(item => <tr key={item.nodeId}><td className="batch-result-check-cell"><label className="table-check-target"><Checkbox ariaLabel={`选择 ${item.before}`} checked={selectedIds.includes(item.nodeId)} onChange={checked => onToggle(item.nodeId, checked)}/></label></td><td title={item.before}>{item.before}</td><td data-i18n-skip="true" title={item.fieldLabel}>{item.fieldLabel ?? '-'}</td><td>{item.canRun === false ? '待分配' : actionLabel(item)}</td><td title={item.after}>{item.canRun === false ? '-' : item.after}</td></tr>)}</tbody>
      </table>
    </div>}
  </>;
}
