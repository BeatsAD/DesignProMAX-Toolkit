import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type KeyboardEvent,
  type Ref,
  type ReactElement,
  type ReactNode
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Image,
  Loader2,
  X,
  Info,
  type LucideIcon
} from 'lucide-react';
import type { TaskState } from '../../shared/types';

export type NoticeTone = TaskState | 'info' | 'warning';

export type ConfirmTone = 'primary' | 'warning' | 'danger';

export type ConfirmDetail = {
  label: string;
  value: string;
};

export type ConfirmDialogInput = {
  title: string;
  /** @deprecated Use summary for new confirmations. */
  body?: string;
  summary?: string;
  details?: ConfirmDetail[];
  warnings?: string[];
  confirmText: string;
  tone?: ConfirmTone;
  /** @deprecated Use tone: 'danger' for new confirmations. */
  danger?: boolean;
  onConfirm: () => void;
};

export type ObjectPreviewData = {
  name: string;
  typeLabel?: string;
  width?: number;
  height?: number;
  imageMimeType?: string;
  previewImageBytes?: number[];
  previewMimeType?: 'image/png';
};

export function Button({
  ariaLabel,
  children,
  variant = 'secondary',
  size = 'default',
  iconOnly = false,
  pressed,
  title,
  disabled,
  onClick,
  type = 'button',
  buttonRef
}: {
  ariaLabel?: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'default' | 'compact';
  iconOnly?: boolean;
  pressed?: boolean;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const className = [
    'btn',
    variant,
    size === 'compact' ? 'compact' : '',
    iconOnly ? 'icon-only' : '',
    pressed ? 'active' : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type={type}
      ref={buttonRef}
    >
      {children}
    </button>
  );
}

export function IconButton({
  active,
  ariaControls,
  ariaExpanded,
  ariaLabel,
  className,
  disabled,
  icon: Icon,
  onClick,
  pressed,
  size = 'default',
  title
}: {
  active?: boolean;
  ariaControls?: string;
  ariaExpanded?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  icon: LucideIcon;
  onClick?: () => void;
  pressed?: boolean;
  size?: 'default' | 'small';
  title?: string;
}) {
  const classes = ['icon-btn', size === 'small' ? 'small' : '', active ? 'active' : '', className].filter(Boolean).join(' ');

  return (
    <button
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      title={title ?? ariaLabel}
      type="button"
    >
      <Icon size={size === 'small' ? 15 : 16} />
    </button>
  );
}

export function IconText({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="icon-text">
      <Icon size={16} />
      {children}
    </span>
  );
}

export function Checkbox({
  ariaLabel,
  checked,
  disabled,
  hitArea = false,
  indeterminate = false,
  onChange
}: {
  ariaLabel: string;
  checked: boolean;
  disabled?: boolean;
  hitArea?: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const input = (
    <input
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      checked={checked}
      className="checkbox-control"
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      ref={inputRef}
      type="checkbox"
    />
  );
  return hitArea ? <label className="checkbox-hit-target">{input}</label> : input;
}

export type SegmentedControlOption<TValue extends string> = {
  value: TValue;
  label: string;
  icon?: LucideIcon;
};

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = option.value === value;
        return (
          <button
            aria-pressed={isSelected}
            className={isSelected ? 'active' : ''}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {Icon ? <Icon aria-hidden="true" size={15} /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type TabOption<TValue extends string> = {
  value: TValue;
  label: string;
};

export function Tabs<TValue extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  children
}: {
  ariaLabel: string;
  options: Array<TabOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  children: ReactNode;
}) {
  const controlId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  function selectIndex(index: number) {
    const nextIndex = (index + options.length) % options.length;
    const option = options[nextIndex];
    if (!option) return;
    onChange(option.value);
    buttonRefs.current[nextIndex]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectIndex(selectedIndex + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectIndex(selectedIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectIndex(options.length - 1);
    }
  }

  return (
    <div className="tabs-shell">
      <div
        aria-label={ariaLabel}
        className="tabs"
        onKeyDown={onKeyDown}
        role="tablist"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              aria-controls={`${controlId}-panel`}
              aria-selected={selected}
              className={selected ? 'active' : ''}
              id={`${controlId}-tab-${option.value}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              ref={(node) => { buttonRefs.current[index] = node; }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${controlId}-tab-${value}`}
        className="tab-panel"
        id={`${controlId}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export type RadioGroupOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
};

export function RadioGroup<TValue extends string>({
  ariaLabel,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  options: Array<RadioGroupOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  const groupName = `radio-${useId()}`;

  return (
    <div aria-label={ariaLabel} className="radio-group" role="radiogroup">
      {options.map((option) => (
        <label className={`radio-option ${option.description ? 'has-description' : ''}`} key={option.value}>
          <input
            checked={option.value === value}
            name={groupName}
            onChange={() => onChange(option.value)}
            type="radio"
            value={option.value}
          />
          {option.description ? (
            <span className="radio-option-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          ) : <span>{option.label}</span>}
        </label>
      ))}
    </div>
  );
}

export function Panel({ title, children, meta }: { title: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children, labelAction }: { label: ReactNode; children: ReactNode; labelAction?: ReactNode }) {
  const content = (
    <>
      {labelAction ? (
        <span className="field-label-row">
          <span>{label}</span>
          <span className="field-label-action">{labelAction}</span>
        </span>
      ) : <span>{label}</span>}
      {children}
    </>
  );

  if (labelAction) {
    return <div className="field">{content}</div>;
  }

  return (
    <label className="field">
      {content}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  placeholder,
  disabled,
  labelAction
}: {
  label: string;
  value: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  children: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  labelAction?: ReactNode;
}) {
  const controlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = useMemo(() => optionNodesToItems(children), [children]);
  const selectedValue = String(value);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const displayText = selectedOption?.label ?? placeholder ?? '请选择';
  const isPlaceholder = !selectedOption;
  const activeOption = options[activeIndex];
  const activeOptionId = `${controlId}-option-${activeIndex}`;
  const hasLabel = label.trim().length > 0;
  const accessibleLabel = hasLabel ? undefined : (placeholder ?? displayText);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function openMenu(nextIndex = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled || options.length === 0) {
      return;
    }

    setActiveIndex(clampIndex(nextIndex, options.length));
    setIsOpen(true);
  }

  function selectOption(option = activeOption) {
    if (!option || option.disabled || disabled) {
      return;
    }

    onChange?.({
      target: { value: option.value },
      currentTarget: { value: option.value }
    } as unknown as Parameters<NonNullable<typeof onChange>>[0]);
    closeMenu(true);
  }

  function moveActive(direction: 1 | -1) {
    if (!options.length) {
      return;
    }

    setActiveIndex((current) => nextEnabledOptionIndex(options, current, direction));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (isOpen) {
        moveActive(1);
      } else {
        openMenu();
      }
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (isOpen) {
        moveActive(-1);
      } else {
        openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      }
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        selectOption();
      } else {
        openMenu();
      }
    }

    if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      setActiveIndex(firstEnabledOptionIndex(options));
    }

    if (event.key === 'End' && isOpen) {
      event.preventDefault();
      setActiveIndex(lastEnabledOptionIndex(options));
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    }
  }

  return (
    <div className="field">
      {hasLabel ? (
        labelAction ? (
          <span className="field-label-row">
            <span id={`${controlId}-label`}>{label}</span>
            <span className="field-label-action">{labelAction}</span>
          </span>
        ) : <span id={`${controlId}-label`}>{label}</span>
      ) : null}
      <div className="select-control" ref={rootRef} onKeyDown={onKeyDown}>
        <button
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-label={accessibleLabel}
          aria-controls={`${controlId}-menu`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={hasLabel ? `${controlId}-label ${controlId}-value` : undefined}
          className={`select-trigger ${isPlaceholder ? 'is-placeholder' : ''}`}
          disabled={disabled}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
              setIsOpen(false);
            }
          }}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
            } else {
              openMenu();
            }
          }}
          role="combobox"
          ref={triggerRef}
          type="button"
        >
          <span id={`${controlId}-value`}>{displayText}</span>
          <ChevronDown aria-hidden="true" className="select-chevron" size={13} strokeWidth={1.8} />
        </button>
        {isOpen ? (
          <div
            {...(hasLabel ? { 'aria-labelledby': `${controlId}-label` } : { 'aria-label': accessibleLabel })}
            className="select-menu"
            id={`${controlId}-menu`}
            role="listbox"
          >
            {options.map((option, index) => (
              <button
                aria-selected={option.value === selectedValue}
                className={`select-option ${option.value === selectedValue ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                data-value={option.value}
                id={`${controlId}-option-${index}`}
                disabled={option.disabled}
                key={`${option.value}-${index}`}
                onClick={() => selectOption(option)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                ref={(node) => { optionRefs.current[index] = node; }}
                tabIndex={-1}
                type="button"
              >
                {option.value === selectedValue ? <CheckCircle2 aria-hidden="true" size={14} /> : <span className="select-option-spacer" />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
  tone?: 'neutral' | 'warning';
  color?: string;
};

export function MultiSelectField({
  label,
  value,
  options,
  onChange,
  placeholder = '请选择',
  disabled
}: {
  label: string;
  value: string[];
  options: MultiSelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const controlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const valueRef = useRef(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = new Set(value);
  const selectedOptions = options.filter((option) => selected.has(option.value));
  const displayText = selectedOptions.length ? selectedOptions.map((option) => option.label).join('、') : placeholder;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  function openMenu(nextIndex = firstEnabledMultiOptionIndex(options)) {
    if (disabled || !options.length) return;
    setActiveIndex(clampIndex(nextIndex, options.length));
    setIsOpen(true);
  }

  function closeMenu(restoreFocus = false) {
    setIsOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu(event.key === 'ArrowDown' ? firstEnabledMultiOptionIndex(options) : lastEnabledMultiOptionIndex(options));
      } else {
        setActiveIndex((current) => clampIndex(current + (event.key === 'ArrowDown' ? 1 : -1), options.length));
      }
    }
    if ((event.key === 'Enter' || event.key === ' ') && isOpen) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) toggleOption(option);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
    if (event.key === 'Home' && isOpen) {
      event.preventDefault();
      setActiveIndex(firstEnabledMultiOptionIndex(options));
    }
    if (event.key === 'End' && isOpen) {
      event.preventDefault();
      setActiveIndex(lastEnabledMultiOptionIndex(options));
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  }

  function toggleOption(option: MultiSelectOption) {
    if (disabled) {
      return;
    }
    const currentValue = valueRef.current;
    const currentSelected = new Set(currentValue);
    const next = currentSelected.has(option.value)
      ? currentValue.filter((item) => item !== option.value)
      : [...currentValue, option.value];
    valueRef.current = next;
    onChange(next);
  }

  return (
    <div className="field">
      <span id={`${controlId}-label`}>{label}</span>
      <div className="select-control" ref={rootRef} onKeyDown={onKeyDown}>
        <button
          aria-activedescendant={isOpen ? `${controlId}-option-${activeIndex}` : undefined}
          aria-controls={`${controlId}-menu`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={`${controlId}-label ${controlId}-value`}
          className={`select-trigger ${selectedOptions.length ? '' : 'is-placeholder'}`}
          disabled={disabled}
          onClick={() => isOpen ? closeMenu() : openMenu()}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget as Node | null)) closeMenu();
          }}
          ref={triggerRef}
          role="combobox"
          type="button"
        >
          <span id={`${controlId}-value`}>{displayText}</span>
          <ChevronDown aria-hidden="true" className="select-chevron" size={13} strokeWidth={1.8} />
        </button>
        {isOpen ? (
          <div aria-labelledby={`${controlId}-label`} className="select-menu" id={`${controlId}-menu`} role="listbox">
            {options.map((option, index) => {
              const isSelected = selected.has(option.value);
              return (
                <button
                  aria-selected={isSelected}
                  className={`select-option ${isSelected ? 'is-selected' : ''} ${option.tone === 'warning' ? 'is-warning' : ''}`}
                  data-value={option.value}
                  id={`${controlId}-option-${index}`}
                  key={option.value}
                  onClick={() => toggleOption(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  ref={(node) => { optionRefs.current[index] = node; }}
                  tabIndex={-1}
                  type="button"
                >
                  {isSelected ? <CheckCircle2 aria-hidden="true" size={14} /> : <span className="select-option-spacer" />}
                  {option.color ? <i aria-hidden="true" className="select-color-swatch" style={{ backgroundColor: option.color }} /> : null}
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type SelectOptionItem = {
  value: string;
  label: string;
  disabled: boolean;
};

function optionNodesToItems(children: ReactNode): SelectOptionItem[] {
  return Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const option = child as ReactElement<{
        children?: ReactNode;
        disabled?: boolean;
        value?: string | number;
      }>;
      const label = textFromReactNode(option.props.children);
      return {
        value: option.props.value === undefined ? label : String(option.props.value),
        label,
        disabled: Boolean(option.props.disabled)
      };
    });
}

function textFromReactNode(node: ReactNode): string {
  return Children.toArray(node).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return (index + length) % length;
}

function firstEnabledOptionIndex(options: SelectOptionItem[]): number {
  const index = options.findIndex((option) => !option.disabled);
  return index >= 0 ? index : 0;
}

function lastEnabledOptionIndex(options: SelectOptionItem[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index;
  }
  return 0;
}

function nextEnabledOptionIndex(options: SelectOptionItem[], current: number, direction: 1 | -1): number {
  for (let step = 1; step <= options.length; step += 1) {
    const index = clampIndex(current + step * direction, options.length);
    if (!options[index]?.disabled) return index;
  }
  return current;
}

function firstEnabledMultiOptionIndex(options: MultiSelectOption[]): number {
  return options.length ? 0 : 0;
}

function lastEnabledMultiOptionIndex(options: MultiSelectOption[]): number {
  return Math.max(0, options.length - 1);
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Info size={18} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function TaskStatus({ state, text }: { state: TaskState; text: string }) {
  const Icon = state === 'loading' ? Loader2 : state === 'success' ? CheckCircle2 : state === 'error' ? AlertTriangle : Info;
  return (
    <div className={`status-line ${state}`}>
      <Icon size={16} className={state === 'loading' ? 'spin' : ''} />
      <span>{text}</span>
    </div>
  );
}

export function NoticeBar({
  state,
  text,
  onClose,
  actionLabel,
  onAction
}: {
  state: NoticeTone;
  text: string;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const Icon = state === 'loading'
    ? Loader2
    : state === 'success'
      ? CheckCircle2
      : state === 'error' || state === 'warning'
        ? AlertTriangle
        : Info;

  return (
    <div className={`notice-bar ${state}`} role={state === 'error' || state === 'warning' ? 'alert' : 'status'}>
      <Icon size={16} className={state === 'loading' ? 'spin' : ''} />
      <span>{text}</span>
      {actionLabel && onAction ? <Button size="compact" onClick={onAction}>{actionLabel}</Button> : null}
      {onClose ? (
        <button aria-label="关闭提示" className="notice-close" onClick={onClose} type="button">
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  summary,
  details = [],
  warnings = [],
  confirmText,
  tone,
  danger,
  onCancel,
  onConfirm
}: ConfirmDialogInput & {
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resolvedTone = tone ?? (danger ? 'danger' : 'primary');
  const description = summary ?? body;
  const isRiskDialog = details.length > 0 || warnings.length > 0 || resolvedTone === 'warning';
  const hasDescription = Boolean(description || details.length || warnings.length);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (resolvedTone === 'danger' ? cancelRef.current : confirmRef.current)?.focus();

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onCancel, resolvedTone]);

  return (
    <div className="modal-backdrop">
      <div
        aria-describedby={hasDescription ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`confirm-dialog ${isRiskDialog ? 'is-risk' : 'is-compact'} tone-${resolvedTone}`}
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="confirm-dialog-title" id={titleId}>{title}</h2>
        <div className={`confirm-dialog-content ${isRiskDialog ? 'is-scrollable' : ''}`} id={!description && hasDescription ? descriptionId : undefined} tabIndex={isRiskDialog ? 0 : undefined}>
          {description ? <p className="confirm-dialog-summary" id={descriptionId}>{description}</p> : null}
          {details.length ? <dl className="confirm-dialog-details">{details.map((detail) => <div key={`${detail.label}:${detail.value}`}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
          {warnings.length ? <section className="confirm-dialog-warnings" aria-label="风险提示"><strong>风险提示</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}
        </div>
        <div className="confirm-dialog-actions">
          <Button buttonRef={cancelRef} onClick={onCancel}>取消</Button>
          <Button buttonRef={confirmRef} variant={resolvedTone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StatusTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warning' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function ObjectPreviewItem({ item, action, compact = false }: { item: ObjectPreviewData; action?: ReactNode; compact?: boolean }) {
  const imageUrl = bytesToDataUrl(item.previewImageBytes, item.previewMimeType);
  const details = [item.typeLabel, formatImageMime(item.imageMimeType), formatSize(item.width, item.height)].filter(Boolean).join(' · ');

  return (
    <div className={`object-preview ${compact ? 'compact' : ''}`}>
      <div className="object-preview-thumb">
        {imageUrl ? <img alt={`${item.name} 预览`} src={imageUrl} /> : <Image size={compact ? 18 : 22} />}
      </div>
      <div className="object-preview-main">
        <strong title={item.name}>{item.name}</strong>
        {details ? <span>{details}</span> : null}
      </div>
      {action ? <div className="object-preview-action">{action}</div> : null}
    </div>
  );
}

function formatImageMime(mimeType?: string): string | undefined {
  const labels: Record<string, string> = {
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
    'image/webp': 'WEBP'
  };

  return mimeType ? labels[mimeType] : undefined;
}

function formatSize(width?: number, height?: number): string | undefined {
  if (typeof width !== 'number' || typeof height !== 'number') {
    return undefined;
  }

  return `${Math.round(width)} x ${Math.round(height)}`;
}

function bytesToDataUrl(bytes?: number[], mimeType = 'image/png'): string | undefined {
  if (!bytes?.length) {
    return undefined;
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}
