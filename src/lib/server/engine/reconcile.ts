import { buildCurveData } from './curves.js';
import { computeHonestySignals } from './honesty.js';
import {
	GRID_STEPS,
	KDE_BANDWIDTH_DIVISOR,
	KDE_DEGENERATE_RANGE,
	MAX_LAYERS,
	RELATIVE_TOLERANCE_FACTOR,
	TOLERANCE_FLOOR,
	toPricePoint
} from './numericPolicy.js';
import {
	ENGINE_VERSION,
	type DirectionalParty,
	type LayerTrace,
	type MethodValue,
	type ReconcileOutcome,
	type ReconcileResult,
	type ToleranceMode,
	type VWTuple,
	type Zone
} from './types.js';
import { validateParties } from './validate.js';

type NumericTuple = readonly [number, number, number, number];

export interface ReconcileOptions {
	readonly tolerance?: { readonly mode: ToleranceMode };
}

function clamp(value: number, low: number, high: number): number {
	return Math.max(low, Math.min(high, value));
}

function arithmeticMidpoint(overlapLow: number, overlapHigh: number): number {
	return (overlapLow + overlapHigh) / 2;
}

function geometricMean(overlapLow: number, overlapHigh: number): number {
	return Math.sqrt(overlapLow * overlapHigh);
}

function nashBargaining(
	low: NumericTuple,
	high: NumericTuple,
	overlapLow: number,
	overlapHigh: number
): number {
	return clamp((low[3] + high[0]) / 2, overlapLow, overlapHigh);
}

function kalaiSmorodinsky(
	low: NumericTuple,
	high: NumericTuple,
	overlapLow: number,
	overlapHigh: number
): number {
	const lowRange = low[3] - overlapLow;
	const highRange = overlapHigh - high[0];
	if (lowRange + highRange === 0) return arithmeticMidpoint(overlapLow, overlapHigh);
	const candidate = (low[3] * highRange + high[0] * lowRange) / (lowRange + highRange);
	return clamp(candidate, overlapLow, overlapHigh);
}

function trapezoid(x: number, points: NumericTuple): number {
	const [tooLow, bargain, expensive, tooHigh] = points;
	if (x <= tooLow || x >= tooHigh) return 0;
	if (x < bargain) return (x - tooLow) / (bargain - tooLow);
	if (x <= expensive) return 1;
	return (tooHigh - x) / (tooHigh - expensive);
}

function jointAcceptabilityPeak(
	low: NumericTuple,
	high: NumericTuple,
	overlapLow: number,
	overlapHigh: number
): number {
	let bestPrice = overlapLow;
	let bestScore = -1;
	const step = (overlapHigh - overlapLow) / GRID_STEPS;
	for (let index = 0; index <= GRID_STEPS; index += 1) {
		const price = overlapLow + index * step;
		const score = trapezoid(price, low) * trapezoid(price, high);
		if (score > bestScore) {
			bestScore = score;
			bestPrice = price;
		}
	}
	return bestPrice;
}

function weightedByFlexibility(
	low: NumericTuple,
	high: NumericTuple,
	overlapLow: number,
	overlapHigh: number
): number {
	const lowWidth = low[3] - low[0];
	const highWidth = high[3] - high[0];
	const totalWidth = lowWidth + highWidth;
	if (totalWidth === 0) return arithmeticMidpoint(overlapLow, overlapHigh);
	const highWeight = lowWidth / totalWidth;
	return overlapLow + (overlapHigh - overlapLow) * highWeight;
}

function consensusArithmeticMean(values: readonly number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function consensusMedian(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function consensusTrimmedMean(values: readonly number[]): number {
	if (values.length <= 2) return consensusArithmeticMean(values);
	const sorted = [...values].sort((a, b) => a - b);
	return consensusArithmeticMean(sorted.slice(1, -1));
}

function consensusKde(values: readonly number[]): number {
	const min = Math.min(...values);
	const max = Math.max(...values);
	if (max - min < KDE_DEGENERATE_RANGE) return (min + max) / 2;

	const bandwidth = (max - min) / KDE_BANDWIDTH_DIVISOR;
	const step = (max - min) / GRID_STEPS;
	let bestX = min;
	let bestDensity = -1;
	for (let index = 0; index <= GRID_STEPS; index += 1) {
		const x = min + index * step;
		let density = 0;
		for (const value of values) {
			const u = (x - value) / bandwidth;
			density += Math.exp(-0.5 * u * u);
		}
		if (density > bestDensity) {
			bestDensity = density;
			bestX = x;
		}
	}
	return bestX;
}

function consensusGeometricMean(values: readonly number[]): number {
	const product = values.reduce((accumulator, value) => accumulator * value, 1);
	return Math.pow(product, 1 / values.length);
}

function layer(methods: readonly MethodValue[]): LayerTrace {
	const values = methods.map(({ value }) => value);
	return {
		methods,
		values,
		spread: Math.max(...values) - Math.min(...values)
	};
}

function layerOne(
	low: NumericTuple,
	high: NumericTuple,
	overlapLow: number,
	overlapHigh: number
): LayerTrace {
	return layer([
		{ name: 'Arithmetic Midpoint', value: arithmeticMidpoint(overlapLow, overlapHigh) },
		{ name: 'Geometric Mean', value: geometricMean(overlapLow, overlapHigh) },
		{ name: 'Nash Bargaining', value: nashBargaining(low, high, overlapLow, overlapHigh) },
		{ name: 'Kalai-Smorodinsky', value: kalaiSmorodinsky(low, high, overlapLow, overlapHigh) },
		{
			name: 'Joint Acceptability',
			value: jointAcceptabilityPeak(low, high, overlapLow, overlapHigh)
		},
		{
			name: 'Flexibility-Weighted',
			value: weightedByFlexibility(low, high, overlapLow, overlapHigh)
		}
	]);
}

function consensusLayer(values: readonly number[]): LayerTrace {
	return layer([
		{ name: 'Mean', value: consensusArithmeticMean(values) },
		{ name: 'Median', value: consensusMedian(values) },
		{ name: 'Trimmed Mean', value: consensusTrimmedMean(values) },
		{ name: 'KDE Mode', value: consensusKde(values) },
		{ name: 'Geometric Mean', value: consensusGeometricMean(values) }
	]);
}

function syntheticZeroWidthLayer(bound: number): LayerTrace {
	return layer([
		{ name: 'Arithmetic Midpoint', value: bound },
		{ name: 'Geometric Mean', value: bound },
		{ name: 'Nash Bargaining', value: bound },
		{ name: 'Kalai-Smorodinsky', value: bound },
		{ name: 'Joint Acceptability', value: bound },
		{ name: 'Flexibility-Weighted', value: bound }
	]);
}

function intervalDistance(tuple: NumericTuple, fairPrice: number): number {
	return Math.max(0, tuple[0] - fairPrice, fairPrice - tuple[3]);
}

function assembleResult(
	lowTuple: VWTuple,
	highTuple: VWTuple,
	low: NumericTuple,
	high: NumericTuple,
	mode: ToleranceMode
): ReconcileResult {
	const dealLow = Math.max(low[0], high[0]);
	const dealHigh = Math.min(low[3], high[3]);
	const comfortLow = Math.max(low[1], high[1]);
	const comfortHigh = Math.min(low[2], high[2]);
	const hasComfortZone = comfortLow <= comfortHigh;
	const overlap = dealLow <= dealHigh;

	let overlapLow: number;
	let overlapHigh: number;
	let zone: Zone;
	if (hasComfortZone) {
		overlapLow = comfortLow;
		overlapHigh = comfortHigh;
		zone = 'comfort';
	} else if (overlap) {
		overlapLow = dealLow;
		overlapHigh = dealHigh;
		zone = 'deal';
	} else {
		overlapLow = dealHigh;
		overlapHigh = dealLow;
		zone = 'no-deal';
	}

	const zoneWidth = overlapHigh - overlapLow;
	const threshold =
		mode === 'relative-r1'
			? Math.max(TOLERANCE_FLOOR, zoneWidth * RELATIVE_TOLERANCE_FACTOR)
			: TOLERANCE_FLOOR;
	const convergedTrivially = zoneWidth === 0;
	const layers: LayerTrace[] = [];
	let fairPrice: number;
	let convergenceAchieved: boolean;

	if (convergedTrivially) {
		layers.push(syntheticZeroWidthLayer(overlapLow));
		fairPrice = overlapLow;
		convergenceAchieved = true;
	} else {
		layers.push(layerOne(low, high, overlapLow, overlapHigh));
		let previousValues = layers[0].values;
		for (let index = 1; index < MAX_LAYERS; index += 1) {
			const nextLayer = consensusLayer(previousValues);
			layers.push(nextLayer);
			if (nextLayer.spread < threshold) break;
			previousValues = nextLayer.values;
		}
		const finalLayer = layers[layers.length - 1];
		fairPrice = consensusMedian(finalLayer.values);
		convergenceAchieved = finalLayer.spread < threshold;
	}

	return {
		zone,
		hasComfortZone,
		overlap,
		overlapLow: toPricePoint(overlapLow),
		overlapHigh: toPricePoint(overlapHigh),
		dealLow: toPricePoint(dealLow),
		dealHigh: toPricePoint(dealHigh),
		gap: toPricePoint(overlap ? 0 : zoneWidth),
		fairPrice: toPricePoint(fairPrice),
		convergenceAchieved,
		convergedTrivially,
		layers,
		distances: {
			'low-preferring': toPricePoint(intervalDistance(low, fairPrice)),
			'high-preferring': toPricePoint(intervalDistance(high, fairPrice))
		},
		honesty: {
			'low-preferring': computeHonestySignals(low),
			'high-preferring': computeHonestySignals(high)
		},
		curves: buildCurveData(low, high),
		input: {
			'low-preferring': { tuple: lowTuple },
			'high-preferring': { tuple: highTuple }
		},
		meta: {
			inflection: 'reconciliation',
			algorithmVersion: 'reconciliation/1',
			numericPolicyVersion: 'np/1',
			honestySignalSetVersion: 'honesty/1',
			engineVersion: ENGINE_VERSION,
			toleranceMode: mode
		}
	};
}

export function reconcile(
	a: DirectionalParty,
	b: DirectionalParty,
	opts?: ReconcileOptions
): ReconcileOutcome {
	const validation = validateParties(a, b);
	if (!validation.ok) return validation;

	const aIsLow = a.direction === 'low-preferring';
	const lowTuple = aIsLow ? a.tuple : b.tuple;
	const highTuple = aIsLow ? b.tuple : a.tuple;
	const low = aIsLow ? validation.aValues : validation.bValues;
	const high = aIsLow ? validation.bValues : validation.aValues;
	const mode = opts?.tolerance?.mode ?? 'relative-r1';

	return { ok: true, result: assembleResult(lowTuple, highTuple, low, high, mode) };
}
