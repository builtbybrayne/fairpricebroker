import { CURVE_LOWER_PADDING, CURVE_STEPS, CURVE_UPPER_PADDING } from './numericPolicy.js';
import type { CurvePoint } from './types.js';

function trapezoid(x: number, points: readonly number[]): number {
	const [tooLow, bargain, expensive, tooHigh] = points;
	if (x <= tooLow || x >= tooHigh) return 0;
	if (x < bargain) return (x - tooLow) / (bargain - tooLow);
	if (x <= expensive) return 1;
	return (tooHigh - x) / (tooHigh - expensive);
}

export function buildCurveData(
	low: readonly number[],
	high: readonly number[]
): readonly CurvePoint[] {
	const globalMin = Math.min(low[0], high[0]) * CURVE_LOWER_PADDING;
	const globalMax = Math.max(low[3], high[3]) * CURVE_UPPER_PADDING;
	const step = (globalMax - globalMin) / CURVE_STEPS;
	const data: CurvePoint[] = [];

	for (let index = 0; index <= CURVE_STEPS; index += 1) {
		const price = globalMin + index * step;
		const lowAcceptability = trapezoid(price, low);
		const highAcceptability = trapezoid(price, high);
		data.push({
			price,
			low: lowAcceptability,
			high: highAcceptability,
			joint: lowAcceptability * highAcceptability
		});
	}

	return data;
}
