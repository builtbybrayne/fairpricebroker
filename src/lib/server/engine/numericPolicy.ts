import type { OutputDecimal, PricePoint } from './types.js';

export const NUMERIC_POLICY_VERSION = 'np/1' as const;
export const DECIMAL_IO_VERSION = 'decimal-io/1' as const;

// A fixed cent-scale floor preserves prototype convergence on ordinary prices.
export const TOLERANCE_FLOOR = 0.01;
// Relative tolerance prevents fixed precision from becoming meaningless at large magnitudes.
export const RELATIVE_TOLERANCE_FACTOR = 1e-4;
// Both grid searches use 201 inclusive samples, matching the prototype.
export const GRID_STEPS = 200;
// KDE bandwidth is one third of the observed range.
export const KDE_BANDWIDTH_DIVISOR = 3;
// Near-degenerate KDE inputs use a stable midpoint shortcut.
export const KDE_DEGENERATE_RANGE = 0.01;
// Curve data uses 301 inclusive samples, matching the prototype.
export const CURVE_STEPS = 300;
// The curve begins below the smallest submitted price.
export const CURVE_LOWER_PADDING = 0.85;
// The curve ends above the largest submitted price.
export const CURVE_UPPER_PADDING = 1.15;
// Layer one plus at most seven consensus layers bounds convergence work.
export const MAX_LAYERS = 8;
// The lower input bound keeps six-value products far above double underflow.
export const MAG_MIN = 1e-9;
// The upper input bound keeps six-value products far below double overflow.
export const MAG_MAX = 1e15;

// Inputs are exact decimal strings until validation; computations use Number's
// round-to-nearest-even doubles; outputs use V8's shortest round-trip rendering,
// expanded to plain decimal notation when V8 selects exponential notation.
export const DECIMAL_IO_POLICY = {
	version: DECIMAL_IO_VERSION,
	input: 'exact-decimal-string',
	computation: 'ieee-754-binary64-round-to-nearest-even',
	output: 'shortest-round-trip-plain-decimal'
} as const;

function expandExponential(rendered: string): string {
	const [coefficient, exponentText] = rendered.toLowerCase().split('e');
	const exponent = Number(exponentText);
	const negative = coefficient.startsWith('-');
	const unsigned = negative ? coefficient.slice(1) : coefficient;
	const [integer, fraction = ''] = unsigned.split('.');
	const digits = integer + fraction;
	const decimalIndex = integer.length + exponent;

	let expanded: string;
	if (decimalIndex <= 0) {
		expanded = `0.${'0'.repeat(-decimalIndex)}${digits}`;
	} else if (decimalIndex >= digits.length) {
		expanded = `${digits}${'0'.repeat(decimalIndex - digits.length)}`;
	} else {
		expanded = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
	}

	return negative ? `-${expanded}` : expanded;
}

export function toOutputDecimal(value: number): OutputDecimal {
	if (Object.is(value, -0) || value === 0) return '0' as OutputDecimal;
	const rendered = String(value);
	return (
		rendered.toLowerCase().includes('e') ? expandExponential(rendered) : rendered
	) as OutputDecimal;
}

export function toPricePoint(float: number): PricePoint {
	return { float, decimal: toOutputDecimal(float) };
}
