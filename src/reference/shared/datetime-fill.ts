import type { DateTimeConfig, DateTimePart, DateTimeStepUnit, TextFillRule } from './messages';

export const DEFAULT_DATE_TIME_CONFIG: DateTimeConfig = {
  parts: ['year', 'month', 'day', 'hour', 'minute'],
  dateFormat: 'dash',
  rangeStart: '2026-06-01T00:00:00',
  rangeEnd: '2026-06-30T23:59:59',
  step: 1,
  stepUnit: 'minute',
  fixedValue: '2026-06-27T09:30:00'
};

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_PART_TOKENS: Record<Extract<DateTimePart, 'year' | 'month' | 'day'>, string> = {
  year: 'YYYY',
  month: 'MM',
  day: 'DD'
};
const DATE_PART_SUFFIXES: Record<Extract<DateTimePart, 'year' | 'month' | 'day'>, string> = {
  year: '年',
  month: '月',
  day: '日'
};
const TIME_PART_TOKENS: Record<Extract<DateTimePart, 'hour' | 'minute' | 'second'>, string> = {
  hour: 'HH',
  minute: 'mm',
  second: 'ss'
};
export const DATE_TIME_STEP_UNITS: DateTimeStepUnit[] = ['year', 'month', 'day', 'hour', 'minute', 'second'];

export type DateTimeFormatOption = { value: DateTimeConfig['dateFormat']; label: string };

export function defaultDateTimeConfig(): DateTimeConfig {
  return { ...DEFAULT_DATE_TIME_CONFIG, parts: [...DEFAULT_DATE_TIME_CONFIG.parts] };
}

export function isValidLocalDateTime(value: unknown): value is string {
  return parseLocalDateTime(value) !== undefined;
}

export function parseLocalDateTime(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    && date.getHours() === Number(hour)
    && date.getMinutes() === Number(minute)
    && date.getSeconds() === Number(second)
    ? date
    : undefined;
}

export function serializeLocalDateTime(value: Date): string {
  return `${value.getFullYear().toString().padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`;
}

export function calendarDaysForMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

export function isValidDateTimeConfig(config: unknown): config is DateTimeConfig {
  if (!isDateTimeConfigShape(config)) return false;
  if (!config.parts.length || new Set(config.parts).size !== config.parts.length) return false;
  if (!isValidLocalDateTime(config.rangeStart) || !isValidLocalDateTime(config.rangeEnd) || !isValidLocalDateTime(config.fixedValue)) return false;
  if (parseLocalDateTime(config.rangeStart)!.getTime() > parseLocalDateTime(config.rangeEnd)!.getTime()) return false;
  return Number.isInteger(config.step) && config.step > 0 && config.step <= 100000;
}

export function formatDateTimeForRule(rule: TextFillRule, usageIndex: number): string | undefined {
  const config = rule.dateTime ?? defaultDateTimeConfig();
  const value = rawDateTimeForRule(rule, config, usageIndex);
  return value ? formatDateTime(value, config) : undefined;
}

export function formatDateTime(value: Date, config: DateTimeConfig): string {
  const parts = new Set(config.parts);
  const dateParts: string[] = [];
  if (parts.has('year')) dateParts.push(String(value.getFullYear()).padStart(4, '0'));
  if (parts.has('month')) dateParts.push(String(value.getMonth() + 1).padStart(2, '0'));
  if (parts.has('day')) dateParts.push(String(value.getDate()).padStart(2, '0'));
  const date = formatDateParts(dateParts, normalizeDateFormat(config.parts, config.dateFormat), parts);
  const weekday = parts.has('weekday') ? `星期${['日', '一', '二', '三', '四', '五', '六'][value.getDay()]}` : '';
  const timeParts: string[] = [];
  if (parts.has('hour')) timeParts.push(String(value.getHours()).padStart(2, '0'));
  if (parts.has('minute')) timeParts.push(String(value.getMinutes()).padStart(2, '0'));
  if (parts.has('second')) timeParts.push(String(value.getSeconds()).padStart(2, '0'));
  return [date, weekday, timeParts.join(':')].filter(Boolean).join(' ');
}

export function dateFormatOptions(parts: DateTimePart[]): DateTimeFormatOption[] {
  const selected = (['year', 'month', 'day'] as const)
    .filter((part) => parts.includes(part))
    .map((part) => DATE_PART_TOKENS[part]);
  const withOutputParts = (value: DateTimeConfig['dateFormat'], date: string) => ({ value, label: formatOutputPattern(parts, date) });
  if (!selected.length) return [withOutputParts('dash', '')];
  if (selected.length === 1) return [withOutputParts('dash', selected[0])];
  return [
    withOutputParts('dash', selected.join('-')),
    withOutputParts('slash', selected.join('/')),
    withOutputParts('chinese', (['year', 'month', 'day'] as const).filter((part) => parts.includes(part)).map((part) => `${DATE_PART_TOKENS[part]}${DATE_PART_SUFFIXES[part]}`).join(''))
  ];
}

export function normalizeDateFormat(parts: DateTimePart[], dateFormat: DateTimeConfig['dateFormat']): DateTimeConfig['dateFormat'] {
  const options = dateFormatOptions(parts);
  return options.some((option) => option.value === dateFormat) ? dateFormat : options[0]?.value ?? 'dash';
}

export function dateTimeStepUnitOptions(parts: DateTimePart[]): DateTimeStepUnit[] {
  const selected = DATE_TIME_STEP_UNITS.filter((unit) => parts.includes(unit));
  return selected.length ? selected : ['day'];
}

export function defaultDateTimeStepUnit(parts: DateTimePart[]): DateTimeStepUnit {
  const options = dateTimeStepUnitOptions(parts);
  return options[options.length - 1];
}

export function normalizeDateTimePrecision(value: string, parts: DateTimePart[]): string {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return value;
  const next = new Date(parsed.getTime());
  if (!parts.includes('second')) next.setSeconds(0);
  if (!parts.includes('minute')) next.setMinutes(0, 0);
  if (!parts.includes('hour')) next.setHours(0, 0, 0, 0);
  return serializeLocalDateTime(next);
}

export function selectedDateTimeTimeParts(parts: DateTimePart[]): Array<Extract<DateTimePart, 'hour' | 'minute' | 'second'>> {
  return (['hour', 'minute', 'second'] as const).filter((part) => parts.includes(part));
}

function rawDateTimeForRule(rule: TextFillRule, config: DateTimeConfig, usageIndex: number): Date | undefined {
  if (rule.fillMode === 'fixed') return parseLocalDateTime(config.fixedValue);
  const start = parseLocalDateTime(config.rangeStart);
  const end = parseLocalDateTime(config.rangeEnd);
  if (!start || !end) return undefined;
  const count = countRangeSteps(start, end, config.step, config.stepUnit);
  if (!count) return undefined;
  const index = rule.fillMode === 'random' ? Math.floor(Math.random() * count) : usageIndex % count;
  return addLocalStep(start, index * config.step, config.stepUnit);
}

function formatOutputPattern(parts: DateTimePart[], date: string): string {
  const weekday = parts.includes('weekday') ? '星期X' : '';
  const time = selectedDateTimeTimeParts(parts).map((part) => TIME_PART_TOKENS[part]).join(':');
  return [date, weekday, time].filter(Boolean).join(' ');
}

function formatDateParts(values: string[], format: DateTimeConfig['dateFormat'], parts: Set<DateTimePart>): string {
  if (!values.length) return '';
  if (format !== 'chinese') return values.join(format === 'slash' ? '/' : '-');
  const chunks: string[] = [];
  if (parts.has('year')) chunks.push(`${values.shift()}年`);
  if (parts.has('month')) chunks.push(`${values.shift()}月`);
  if (parts.has('day')) chunks.push(`${values.shift()}日`);
  return chunks.join('');
}

function countRangeSteps(start: Date, end: Date, step: number, unit: DateTimeStepUnit): number {
  let low = 0;
  let high = 1;
  while (isRangeStepWithin(start, end, high, step, unit) && high <= Number.MAX_SAFE_INTEGER / 2) {
    low = high;
    high *= 2;
  }
  while (low + 1 < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (isRangeStepWithin(start, end, middle, step, unit)) low = middle;
    else high = middle;
  }
  return low + 1;
}

function isRangeStepWithin(start: Date, end: Date, index: number, step: number, unit: DateTimeStepUnit): boolean {
  const value = addLocalStep(start, index * step, unit);
  return Number.isFinite(value.getTime()) && value.getTime() <= end.getTime();
}

function addLocalStep(value: Date, amount: number, unit: DateTimeStepUnit): Date {
  const next = new Date(value.getTime());
  if (unit === 'year' || unit === 'month') {
    const day = next.getDate();
    next.setDate(1);
    if (unit === 'year') next.setFullYear(next.getFullYear() + amount);
    else next.setMonth(next.getMonth() + amount);
    next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
    return next;
  }
  if (unit === 'day') next.setDate(next.getDate() + amount);
  if (unit === 'hour') next.setHours(next.getHours() + amount);
  if (unit === 'minute') next.setMinutes(next.getMinutes() + amount);
  if (unit === 'second') next.setSeconds(next.getSeconds() + amount);
  return next;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isDateTimeConfigShape(value: unknown): value is DateTimeConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<DateTimeConfig>;
  return Array.isArray(config.parts)
    && config.parts.every((part) => ['year', 'month', 'day', 'hour', 'minute', 'second', 'weekday'].includes(part))
    && ['dash', 'slash', 'chinese'].includes(config.dateFormat ?? '')
    && typeof config.rangeStart === 'string'
    && typeof config.rangeEnd === 'string'
    && typeof config.fixedValue === 'string'
    && typeof config.step === 'number'
    && ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(config.stepUnit ?? '');
}
