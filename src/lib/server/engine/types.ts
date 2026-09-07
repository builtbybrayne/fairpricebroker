declare const decimalStringBrand: unique symbol;
declare const outputDecimalBrand: unique symbol;

export type DecimalString = string & { readonly [decimalStringBrand]: 'DecimalString' };
export type OutputDecimal = string & { readonly [outputDecimalBrand]: 'OutputDecimal' };

export type VWTuple = readonly [DecimalString, DecimalString, DecimalString, DecimalString];

export type Role = 'low-preferring' | 'high-preferring';

export interface DirectionalParty {
	readonly tuple: VWTuple;
	readonly direction: Role;
}

export const ENGINE_VERSION = '0.1.0' as const;

export type Zone = 'comfort' | 'deal' | 'no-deal';
export type ToleranceMode = 'relative-r1' | 'absolute-0.01';

export interface EngineVersionMeta {
	readonly inflection: 'reconciliation';
	readonly algorithmVersion: 'reconciliation/1';
	readonly numericPolicyVersion: 'np/1';
	readonly honestySignalSetVersion: 'honesty/1';
	readonly engineVersion: typeof ENGINE_VERSION;
	readonly toleranceMode: ToleranceMode;
}

export interface MethodValue {
	readonly name: string;
	readonly value: number;
}

export interface LayerTrace {
	readonly methods: readonly MethodValue[];
	readonly values: readonly number[];
	readonly spread: number;
}

export type SignalValue =
	{ readonly value: number } | { readonly value: null; readonly reason: 'zero-variance' };

export interface HonestySignals {
	readonly skewness: SignalValue;
	readonly kurtosis: SignalValue;
	readonly rangeCompression: number;
	readonly signalSetVersion: 'honesty/1';
}

export interface CurvePoint {
	readonly price: number;
	readonly low: number;
	readonly high: number;
	readonly joint: number;
}

export interface PricePoint {
	readonly float: number;
	readonly decimal: OutputDecimal;
}

export interface ReconcileResult {
	readonly zone: Zone;
	readonly hasComfortZone: boolean;
	readonly overlap: boolean;
	readonly overlapLow: PricePoint;
	readonly overlapHigh: PricePoint;
	readonly dealLow: PricePoint;
	readonly dealHigh: PricePoint;
	readonly gap: PricePoint;
	readonly fairPrice: PricePoint;
	readonly convergenceAchieved: boolean;
	readonly convergedTrivially: boolean;
	readonly layers: readonly LayerTrace[];
	readonly distances: Readonly<Record<Role, PricePoint>>;
	readonly honesty: Readonly<Record<Role, HonestySignals>>;
	readonly curves: readonly CurvePoint[];
	readonly input: Readonly<Record<Role, { readonly tuple: VWTuple }>>;
	readonly meta: EngineVersionMeta;
}

export type EngineErrorKind =
	| 'malformed-decimal'
	| 'non-positive'
	| 'out-of-magnitude-domain'
	| 'not-ascending'
	| 'same-direction-parties';

export interface EngineError {
	readonly kind: EngineErrorKind;
	readonly detail: string;
}

export type ReconcileOutcome =
	| { readonly ok: true; readonly result: ReconcileResult }
	| { readonly ok: false; readonly error: EngineError };

export type FieldClassification =
	| { readonly class: 'per-party-safe'; readonly owner: Role | 'both' }
	| { readonly class: 'host-safe' }
	| { readonly class: 'internal-only' };

export const FIELD_CLASSES = {
	zone: { class: 'per-party-safe', owner: 'both' },
	fairPrice: { class: 'per-party-safe', owner: 'both' },
	convergenceAchieved: { class: 'per-party-safe', owner: 'both' },
	convergedTrivially: { class: 'per-party-safe', owner: 'both' },
	meta: { class: 'per-party-safe', owner: 'both' },
	'distances.low-preferring': { class: 'per-party-safe', owner: 'low-preferring' },
	'distances.high-preferring': { class: 'per-party-safe', owner: 'high-preferring' },
	hasComfortZone: { class: 'internal-only' },
	overlap: { class: 'internal-only' },
	overlapLow: { class: 'internal-only' },
	overlapHigh: { class: 'internal-only' },
	dealLow: { class: 'internal-only' },
	dealHigh: { class: 'internal-only' },
	gap: { class: 'internal-only' },
	layers: { class: 'internal-only' },
	'honesty.low-preferring': { class: 'internal-only' },
	'honesty.high-preferring': { class: 'internal-only' },
	curves: { class: 'internal-only' },
	'input.low-preferring': { class: 'internal-only' },
	'input.high-preferring': { class: 'internal-only' }
} as const satisfies Record<string, FieldClassification>;
