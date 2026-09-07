import type { HonestySignals, SignalValue } from './types.js';

function moments(values: readonly number[]): {
	readonly deviations: readonly number[];
	readonly sampleStandardDeviation: number;
} {
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	const deviations = values.map((value) => value - mean);
	const sumSquared = deviations.reduce((sum, deviation) => sum + deviation * deviation, 0);
	return { deviations, sampleStandardDeviation: Math.sqrt(sumSquared / (values.length - 1)) };
}

/** Precondition: four finite positive ascending (not necessarily strict) values. */
export function skewness(values: readonly number[]): SignalValue {
	const { deviations, sampleStandardDeviation } = moments(values);
	if (sampleStandardDeviation === 0) return { value: null, reason: 'zero-variance' };
	const n = values.length;
	const standardizedCubeSum = deviations.reduce(
		(sum, deviation) => sum + Math.pow(deviation / sampleStandardDeviation, 3),
		0
	);
	return { value: (n / ((n - 1) * (n - 2))) * standardizedCubeSum };
}

/** Precondition: four finite positive ascending (not necessarily strict) values. */
export function kurtosis(values: readonly number[]): SignalValue {
	const { deviations, sampleStandardDeviation } = moments(values);
	if (sampleStandardDeviation === 0) return { value: null, reason: 'zero-variance' };
	const n = values.length;
	const standardizedFourthPowerSum = deviations.reduce(
		(sum, deviation) => sum + Math.pow(deviation / sampleStandardDeviation, 4),
		0
	);
	const adjustedMoment = (n * (n + 1) * standardizedFourthPowerSum) / ((n - 1) * (n - 2) * (n - 3));
	const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
	return { value: adjustedMoment - correction };
}

/** Precondition: four finite positive ascending (not necessarily strict) values. */
export function rangeCompression(values: readonly number[]): number {
	const first = values[0];
	const last = values[values.length - 1];
	return (last - first) / ((first + last) / 2);
}

/** Precondition: four finite positive ascending (not necessarily strict) values. */
export function computeHonestySignals(values: readonly number[]): HonestySignals {
	return {
		skewness: skewness(values),
		kurtosis: kurtosis(values),
		rangeCompression: rangeCompression(values),
		signalSetVersion: 'honesty/1'
	};
}
