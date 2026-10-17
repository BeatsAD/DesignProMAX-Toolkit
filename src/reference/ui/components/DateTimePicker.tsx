import {useLocale} from '../../i18n';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { calendarDaysForMonth, parseLocalDateTime, serializeLocalDateTime } from '../../shared/datetime-fill';
import { IconButton } from './ui';



const POPOVER_GUTTER = 8;
const COMPACT_POPOVER_WIDTH = 264;
const COMPACT_POPOVER_HEIGHT = 276;

type PopoverPosition = {
  align: 'end' | 'start';
  placement: 'above' | 'below';
};

type TimePart = 'hour' | 'minute' | 'second';

const TIME_PART_LABELS: Record<TimePart, string> = { hour: '时', minute: '分', second: '秒' };

export function DateTimePicker({ label, value, onChange, timeParts = ['hour', 'minute', 'second'] }: { label: string; value: string; onChange: (value: string) => void; timeParts?: TimePart[] }) {
  const locale=useLocale();
  const WEEKDAY_LABELS=Array.from({length:7},(_,index)=>new Intl.DateTimeFormat(locale,{weekday:'narrow'}).format(new Date(2026,0,4+index)));
  const pickerId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseLocalDateTime(value) ?? new Date(2026, 0, 1, 0, 0, 0);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [activeTimePart, setActiveTimePart] = useState<TimePart | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const days = calendarDaysForMonth(viewDate.getFullYear(), viewDate.getMonth());

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const updatePopoverPosition = () => {
      const root = rootRef.current;
      const popover = popoverRef.current;
      if (!root || !popover) return;

      const rootRect = root.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const popoverWidth = popover.offsetWidth || COMPACT_POPOVER_WIDTH;
      const popoverHeight = popover.offsetHeight || COMPACT_POPOVER_HEIGHT;
      const spaceAbove = Math.max(0, rootRect.top - POPOVER_GUTTER);
      const spaceBelow = Math.max(0, viewportHeight - rootRect.bottom - POPOVER_GUTTER);
      const placement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'above' : 'below';
      const align = rootRect.left + popoverWidth > viewportWidth - POPOVER_GUTTER ? 'end' : 'start';
      setPopoverPosition({ align, placement });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);
    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [open]);

  function updateDate(next: Date) {
    onChange(serializeLocalDateTime(next));
  }

  function selectDay(day: Date) {
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes(), selected.getSeconds());
    updateDate(next);
    setViewDate(new Date(day.getFullYear(), day.getMonth(), 1));
  }

  function updateTime(part: 'hour' | 'minute' | 'second', rawValue: string) {
    const next = new Date(selected.getTime());
    const valueNumber = Number(rawValue);
    if (part === 'hour') next.setHours(valueNumber);
    if (part === 'minute') next.setMinutes(valueNumber);
    if (part === 'second') next.setSeconds(valueNumber);
    updateDate(next);
    setActiveTimePart(null);
  }

  const displayValue = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')} ${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}:${String(selected.getSeconds()).padStart(2, '0')}`;

  return <div className="date-time-picker" ref={rootRef}>
    <span className="date-time-picker-label">{label}</span>
    <button aria-controls={`${pickerId}-popover`} aria-expanded={open} className="date-time-picker-trigger" onClick={() => { setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1)); setActiveTimePart(null); setOpen((current) => !current); }} ref={triggerRef} type="button">
      <span>{displayValue}</span><CalendarDays aria-hidden="true" size={15} />
    </button>
    {open ? <div aria-label={`${label}选择器`} className="date-time-picker-popover" data-align={popoverPosition?.align ?? 'start'} data-placement={popoverPosition?.placement ?? 'below'} id={`${pickerId}-popover`} ref={popoverRef} role="dialog">
      <div className="date-time-picker-content">
        <div className="date-time-picker-calendar">
        <div className="date-time-picker-month"><IconButton ariaLabel="上个月" icon={ChevronLeft} onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} size="small" /><strong>{new Intl.DateTimeFormat(locale,{year:'numeric',month:'long'}).format(viewDate)}</strong><IconButton ariaLabel="下个月" icon={ChevronRight} onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} size="small" /></div>
        <div className="date-time-picker-weekdays">{WEEKDAY_LABELS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
        <div className="date-time-picker-days">{days.map((day) => {
          const selectedDay = day.getFullYear() === selected.getFullYear() && day.getMonth() === selected.getMonth() && day.getDate() === selected.getDate();
          const outside = day.getMonth() !== viewDate.getMonth();
          return <button aria-label={new Intl.DateTimeFormat(locale,{year:'numeric',month:'long',day:'numeric'}).format(day)} aria-pressed={selectedDay} className={`${selectedDay ? 'is-selected' : ''} ${outside ? 'is-outside' : ''}`} key={serializeLocalDateTime(day)} onClick={() => selectDay(day)} type="button">{day.getDate()}</button>;
        })}</div>
        </div>
        {timeParts.length ? <div className="date-time-picker-time" aria-label="时间选择"><div className="date-time-picker-time-title"><Clock3 aria-hidden="true" size={14} /> 时间</div><div className={`date-time-picker-time-grid is-${timeParts.length}`}>{timeParts.map((part) => <TimePartSelect active={activeTimePart === part} key={part} label={TIME_PART_LABELS[part]} onToggle={() => setActiveTimePart((current) => current === part ? null : part)} value={part === 'hour' ? selected.getHours() : part === 'minute' ? selected.getMinutes() : selected.getSeconds()} />)}</div>{activeTimePart && timeParts.includes(activeTimePart) ? <TimePartOptions part={activeTimePart} total={activeTimePart === 'hour' ? 24 : 60} value={activeTimePart === 'hour' ? selected.getHours() : activeTimePart === 'minute' ? selected.getMinutes() : selected.getSeconds()} onSelect={(next) => updateTime(activeTimePart, next)} /> : null}</div> : null}
      </div>
    </div> : null}
  </div>;
}

function TimePartSelect({ active, label, onToggle, value }: { active: boolean; label: string; onToggle: () => void; value: number }) {
  return <div className="date-time-picker-time-control"><span>{label}</span><button aria-expanded={active} aria-label={`选择${label}：${String(value).padStart(2, '0')}`} className="date-time-picker-time-trigger" onClick={onToggle} type="button"><b>{String(value).padStart(2, '0')}</b><ChevronDown aria-hidden="true" size={14} /></button></div>;
}

function TimePartOptions({ part, total, value, onSelect }: { part: TimePart; total: number; value: number; onSelect: (value: string) => void }) {
  return <div aria-label={`选择${TIME_PART_LABELS[part]}`} className={`date-time-picker-time-options${part === 'hour' ? ' is-hour' : ''}`} role="listbox">{Array.from({ length: total }, (_, index) => <button aria-selected={index === value} className={index === value ? 'is-selected' : ''} key={index} onClick={() => onSelect(String(index))} role="option" type="button">{String(index).padStart(2, '0')}</button>)}</div>;
}
