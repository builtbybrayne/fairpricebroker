import { MAG_MAX, MAG_MIN } from './numericPolicy.js';
import type { DecimalString, DirectionalParty, EngineError, VWTuple } from './types.js';

const DECIMAL_GRAMMAR = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

type NumericTuple = readonly [number, number, number, number];
type TupleValidationOutcome =
	| { readonly ok: true; readonly values: NumericTuple }
	| { readonly ok: false; readonly error: EngineError };

export type ValidationOutcome =
	| {
			readonly ok: true;
			readonly aValues: NumericTuple;
			readonly bValues: NumericTuple;
	  }
	| { readonly ok: false; readonly error: EngineError };

function error(
	kind: EngineError['kind'],
	detail: string
): { readonly ok: false; readonly error: EngineError } {
	return { ok: false, error: { kind, detail } };
}

export function compareExactDecimals(a: DecimalString | string, b: DecimalString | string): number {
	const [aInteger, aFraction = ''] = a.split('.');
	const [bInteger, bFraction = ''] = b.split('.');
	const integerA = BigInt(aInteger);
	const integerB = BigInt(bInteger);
	if (integerA < integerB) return -1;
	if (integerA > integerB) return 1;

	const width = Math.max(aFraction.length, bFraction.length);
	const fractionA = BigInt(aFraction.padEnd(width, '0') || '0');
	const fractionB = BigInt(bFraction.padEnd(width, '0') || '0');
	if (fractionA < fractionB) return -1;
	if (fractionA > fractionB) return 1;
	return 0;
}

function validateTuple(tuple: VWTuple, label: string): TupleValidationOutcome {
	const runtimeTuple: readonly unknown[] = tuple;
	if (!Array.isArray(runtimeTuple) || runtimeTuple.length !== 4) {
		return error('malformed-decimal', `${label} tuple must contain exactly four decimal strings`);
	}

	const values: number[] = [];
	for (let index = 0; index < runtimeTuple.length; index += 1) {
		const decimal = runtimeTuple[index];
		if (typeof decimal !== 'string' || !DECIMAL_GRAMMAR.test(decimal)) {
			return error('malformed-decimal', `${label}[${index}] is not a plain unsigned decimal`);
		}
		if (compareExactDecimals(decimal, '0') === 0) {
			return error('non-positive', `${label}[${index}] must be greater than zero`);
		}

		const value = Number(decimal);
		if (!Number.isFinite(value) || value < MAG_MIN || value > MAG_MAX) {
			return error(
				'out-of-magnitude-domain',
				`${label}[${index}] must convert to a number in [${MAG_MIN}, ${MAG_MAX}]`
			);
		}
		values.push(value);
	}

	for (let index = 1; index < runtimeTuple.length; index += 1) {
		if (
			compareExactDecimals(runtimeTuple[index] as string, runtimeTuple[index - 1] as string) <= 0
		) {
			return error('not-ascending', `${label} must be strictly ascending`);
		}
	}

	return { ok: true, values: values as unknown as NumericTuple };
}

export function validateParties(a: DirectionalParty, b: DirectionalParty): ValidationOutcome {
	const aValues = validateTuple(a.tuple, 'a');
	if (!aValues.ok) return aValues;

	const bValues = validateTuple(b.tuple, 'b');
	if (!bValues.ok) return bValues;

	const directionsAreValid =
		(a.direction === 'low-preferring' && b.direction === 'high-preferring') ||
		(a.direction === 'high-preferring' && b.direction === 'low-preferring');
	if (!directionsAreValid) {
		return error(
			'same-direction-parties',
			'exactly one low-preferring and one high-preferring party are required'
		);
	}

	return { ok: true, aValues: aValues.values, bValues: bValues.values };
}
