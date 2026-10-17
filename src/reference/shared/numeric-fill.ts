import type { NumericConfig } from './messages';

type NumericGeneration = {
  values: string[];
  formattedTotal?: string;
};

const MAX_PRECISION = 8;
const ZERO = '0';
const ONE = '1';

/**
 * 数值在这里始终是“放大后的十进制整数字符串”。
 * 不依赖宿主的高精度整数运行时，以兼容 Figma 主线程的旧版 JavaScript 引擎。
 */
export function generateNumericValues(config: NumericConfig, count: number): NumericGeneration {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('NUMERIC_CONFIG_INVALID:请至少选择 1 个数字填充目标');
  }
  const precision = config.precision;
  if (!Number.isInteger(precision) || precision < 0 || precision > MAX_PRECISION) {
    throw new Error(`NUMERIC_CONFIG_INVALID:小数位必须在 0 到 ${MAX_PRECISION} 之间`);
  }

  if (config.strategy === 'serial') return generateSerial(config, count, precision);
  if (config.strategy === 'rangeRandom') return generateRangeRandom(config, count, precision);
  if (config.strategy === 'totalRandom') return generateTotalRandom(config, count, precision);
  if (config.strategy === 'code') return generateCodeValues(config, count);
  throw new Error('NUMERIC_CONFIG_INVALID:当前数字生成方式不支持');
}

function generateSerial(config: NumericConfig, count: number, precision: number): NumericGeneration {
  const order = config.order ?? 'asc';
  const start = parseDecimal(config.start?.trim() || String(order === 'asc' ? 1 : count), precision, '起始值');
  const step = parseDecimal(config.step?.trim() || '1', precision, '步长');
  if (compareFixed(step, ZERO) <= 0) throw new Error('NUMERIC_CONFIG_INVALID:步长必须大于 0');
  const direction = order === 'desc' ? negateFixed(step) : step;
  return {
    values: Array.from({ length: count }, (_, index) => formatDecimal(
      addFixed(start, multiplyFixedByNumber(direction, index)),
      precision,
      config.trimTrailingZeros,
      undefined,
      unitSuffix(config)
    ))
  };
}

function generateRangeRandom(config: NumericConfig, count: number, precision: number): NumericGeneration {
  const min = parseDecimal(config.min?.trim() || '0', precision, '最小值');
  const max = parseDecimal(config.max?.trim() || '100', precision, '最大值');
  if (compareFixed(min, max) > 0) throw new Error('NUMERIC_CONFIG_INVALID:最小值不能大于最大值');
  const capacity = addFixed(subtractFixed(max, min), ONE);
  if (config.unique && compareFixed(capacity, String(count)) < 0) {
    throw new Error(`NUMERIC_CONFIG_INVALID:不重复随机需要至少 ${count} 个可用数值，当前范围不足`);
  }
  const used = new Set<string>();
  const values: string[] = [];
  while (values.length < count) {
    const next = addFixed(min, randomFixedBelow(capacity));
    if (config.unique && used.has(next)) continue;
    used.add(next);
    values.push(formatDecimal(next, precision, config.trimTrailingZeros, undefined, unitSuffix(config)));
  }
  return { values };
}

function generateTotalRandom(config: NumericConfig, count: number, precision: number): NumericGeneration {
  const total = parseDecimal(config.total?.trim() || '100', precision, '总数');
  const minimum = parseDecimal(config.minimumPerItem?.trim() || '0', precision, '单项最小值');
  if (compareFixed(total, ZERO) < 0 || compareFixed(minimum, ZERO) < 0) {
    throw new Error('NUMERIC_CONFIG_INVALID:总数和单项最小值不能为负数');
  }
  const baseline = multiplyFixedByNumber(minimum, count);
  if (compareFixed(baseline, total) > 0) throw new Error('NUMERIC_CONFIG_INVALID:总数不足以满足当前目标数量和单项最小值');

  let remaining = subtractFixed(total, baseline);
  const parts = Array.from({ length: count }, () => minimum);
  for (let index = 0; index < count - 1; index += 1) {
    const part = randomFixedBelow(addFixed(remaining, ONE));
    parts[index] = addFixed(parts[index], part);
    remaining = subtractFixed(remaining, part);
  }
  parts[count - 1] = addFixed(parts[count - 1], remaining);
  shuffle(parts);
  const suffix = unitSuffix(config);
  return {
    values: parts.map((value) => formatDecimal(value, precision, config.trimTrailingZeros, undefined, suffix)),
    formattedTotal: formatDecimal(total, precision, config.trimTrailingZeros, undefined, suffix)
  };
}

function generateCodeValues(config: NumericConfig, count: number): NumericGeneration {
  if (config.precision !== 0) throw new Error('NUMERIC_CONFIG_INVALID:编号编码仅支持整数，请选择“整数”小数精度');
  const order = config.order ?? 'asc';
  const start = parseDecimal(config.start?.trim() || String(order === 'asc' ? 1 : count), 0, '起始编号');
  const step = parseDecimal(config.step?.trim() || '1', 0, '每次变化');
  if (compareFixed(step, ZERO) <= 0) throw new Error('NUMERIC_CONFIG_INVALID:每次变化必须大于 0');
  const direction = order === 'desc' ? negateFixed(step) : step;
  const prefix = (config.prefix ?? '').trim();
  const suffix = (config.suffix ?? '').trim();
  return {
    values: Array.from({ length: count }, (_, index) => `${prefix}${formatDecimal(
      addFixed(start, multiplyFixedByNumber(direction, index)),
      0,
      false,
      config.integerPadWidth,
      ''
    )}${suffix}`)
  };
}

function parseDecimal(input: string, precision: number, label: string): string {
  const normalized = input.replace(/。/g, '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`NUMERIC_CONFIG_INVALID:${label}必须是有效的十进制数`);
  }
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  if (fraction.length > precision) {
    throw new Error(`NUMERIC_CONFIG_INVALID:${label}最多支持 ${precision} 位小数`);
  }
  const digits = stripLeadingZeros(`${whole}${fraction.padEnd(precision, '0')}`);
  return negative && digits !== ZERO ? `-${digits}` : digits;
}

function formatDecimal(value: string, precision: number, trimTrailingZeros: boolean, integerPadWidth: number | undefined, suffix: string): string {
  const negative = value.startsWith('-');
  const absolute = negative ? value.slice(1) : value;
  const padded = precision ? absolute.padStart(precision + 1, '0') : absolute;
  let whole = precision ? padded.slice(0, -precision) : padded;
  let fraction = precision ? padded.slice(-precision) : '';
  whole = stripLeadingZeros(whole);
  if (integerPadWidth && Number.isInteger(integerPadWidth) && integerPadWidth > whole.length) {
    whole = whole.padStart(Math.min(integerPadWidth, 12), '0');
  }
  if (trimTrailingZeros) fraction = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}${suffix}`;
}

function addFixed(left: string, right: string): string {
  const leftNegative = left.startsWith('-');
  const rightNegative = right.startsWith('-');
  const leftAbsolute = leftNegative ? left.slice(1) : left;
  const rightAbsolute = rightNegative ? right.slice(1) : right;
  if (leftNegative === rightNegative) return withSign(addPositive(leftAbsolute, rightAbsolute), leftNegative);
  const comparison = comparePositive(leftAbsolute, rightAbsolute);
  if (comparison === 0) return ZERO;
  return comparison > 0
    ? withSign(subtractPositive(leftAbsolute, rightAbsolute), leftNegative)
    : withSign(subtractPositive(rightAbsolute, leftAbsolute), rightNegative);
}

function subtractFixed(left: string, right: string): string {
  return addFixed(left, negateFixed(right));
}

function negateFixed(value: string): string {
  return value === ZERO ? ZERO : value.startsWith('-') ? value.slice(1) : `-${value}`;
}

function multiplyFixedByNumber(value: string, multiplier: number): string {
  if (!Number.isInteger(multiplier) || multiplier < 0) throw new Error('NUMERIC_CONFIG_INVALID:目标数量无效');
  if (value === ZERO || multiplier === 0) return ZERO;
  const negative = value.startsWith('-');
  const digits = negative ? value.slice(1) : value;
  let carry = 0;
  let output = '';
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const product = Number(digits[index]) * multiplier + carry;
    output = `${product % 10}${output}`;
    carry = Math.floor(product / 10);
  }
  while (carry > 0) {
    output = `${carry % 10}${output}`;
    carry = Math.floor(carry / 10);
  }
  return withSign(stripLeadingZeros(output), negative);
}

function compareFixed(left: string, right: string): number {
  const leftNegative = left.startsWith('-');
  const rightNegative = right.startsWith('-');
  if (leftNegative !== rightNegative) return leftNegative ? -1 : 1;
  const comparison = comparePositive(leftNegative ? left.slice(1) : left, rightNegative ? right.slice(1) : right);
  return leftNegative ? -comparison : comparison;
}

function addPositive(left: string, right: string): string {
  let carry = 0;
  let output = '';
  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  while (leftIndex >= 0 || rightIndex >= 0 || carry) {
    const sum = (leftIndex >= 0 ? Number(left[leftIndex--]) : 0) + (rightIndex >= 0 ? Number(right[rightIndex--]) : 0) + carry;
    output = `${sum % 10}${output}`;
    carry = Math.floor(sum / 10);
  }
  return stripLeadingZeros(output);
}

function subtractPositive(left: string, right: string): string {
  let borrow = 0;
  let output = '';
  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  while (leftIndex >= 0) {
    let difference = Number(left[leftIndex--]) - (rightIndex >= 0 ? Number(right[rightIndex--]) : 0) - borrow;
    if (difference < 0) {
      difference += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    output = `${difference}${output}`;
  }
  return stripLeadingZeros(output);
}

function comparePositive(left: string, right: string): number {
  const normalizedLeft = stripLeadingZeros(left);
  const normalizedRight = stripLeadingZeros(right);
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length > normalizedRight.length ? 1 : -1;
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft > normalizedRight ? 1 : -1;
}

function stripLeadingZeros(value: string): string {
  const stripped = value.replace(/^0+/, '');
  return stripped || ZERO;
}

function withSign(value: string, negative: boolean): string {
  const normalized = stripLeadingZeros(value);
  return negative && normalized !== ZERO ? `-${normalized}` : normalized;
}

function randomFixedBelow(limit: string): string {
  if (compareFixed(limit, ONE) <= 0) return ZERO;
  const digits = limit.length;
  while (true) {
    let candidate = '';
    for (let index = 0; index < digits; index += 1) candidate += Math.floor(Math.random() * 10).toString();
    candidate = stripLeadingZeros(candidate);
    if (comparePositive(candidate, limit) < 0) return candidate;
  }
}

function unitSuffix(config: NumericConfig): string {
  if (config.unit === 'percent') return '%';
  if (config.unit === 'hour') return '小时';
  if (config.unit === 'minute') return '分钟';
  if (config.unit === 'kwh') return 'kwh';
  return config.unit === 'custom' ? (config.customUnit ?? '').trim() : '';
}

function shuffle(values: string[]): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
}
