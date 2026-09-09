// T3-m2-domain-terms: the one vocabulary under every vertical.
//
//   reconciliation   one two-party reconciliation (the record)
//   buyer / seller   the two SIDES: the buyer prefers a lower price
//   broker           the middle SEAT; may act for a side
//   offer            a standing offer by one side, collecting reconciliations
//   vertical         a dictionary that names these things on screen
//
// The engine keeps its own words (low-preferring / high-preferring): the
// buyer is the low-preferring side by definition, and the mapping lives
// here, once. Client code may import this module; it carries no secrets.

export type Side = 'buyer' | 'seller';
export type Seat = 'buyer' | 'seller' | 'broker';
export type Direction = 'low-preferring' | 'high-preferring';
export type ReconciliationState = 'open' | 'locked' | 'closed' | 'cancelled';
export type FiguresStatus = 'draft' | 'submitted' | 'recalled';
export type AccessRole = 'owner' | 'manager' | 'member' | 'viewer';
export type ActorKind = 'user' | 'team' | 'org';

export const SIDES: readonly Side[] = ['buyer', 'seller'];

export const otherSide = (side: Side): Side => (side === 'buyer' ? 'seller' : 'buyer');

/** The engine boundary: a side's mathematical direction. */
export const sideToDirection: Record<Side, Direction> = {
	buyer: 'low-preferring',
	seller: 'high-preferring'
};

export const directionToSide: Record<Direction, Side> = {
	'low-preferring': 'buyer',
	'high-preferring': 'seller'
};

export function isSide(v: unknown): v is Side {
	return v === 'buyer' || v === 'seller';
}

export function isSeat(v: unknown): v is Seat {
	return v === 'buyer' || v === 'seller' || v === 'broker';
}

/** The side whose figures a seat enters: its own, or the one it acts for. */
export function sideOfSeat(seat: Seat, actsFor: Side | null): Side | null {
	if (seat === 'broker') return actsFor;
	return seat;
}

// The verticals ------------------------------------------------------------

export type VerticalId = 'salary-negotiation' | 'founders';

export interface VerticalDictionary {
	readonly id: VerticalId;
	/** The vertical's own name, as shown in the scope tag and account home. */
	readonly name: string;
	/** Display names for the underlying seats and objects. */
	readonly buyer: string;
	readonly seller: string;
	readonly offer: string;
	readonly offers: string;
	readonly broker: string;
	/** Which side makes offers here by default. */
	readonly defaultOfferer: Side;
	readonly brokerAllowed: boolean;
	/** Whether the broker sees both sides' figures (R7 / R11). */
	readonly brokerSeesFigures: boolean;
	/** Many sellers may respond to a buyer-offered offer, and the converse. */
	readonly multiSeller: boolean;
	readonly multiBuyer: boolean;
	/** Where the vertical's marketing page lives; null while it is coming. */
	readonly marketingPath: string | null;
	readonly ready: boolean;
}

export const VERTICALS: readonly VerticalDictionary[] = [
	{
		id: 'salary-negotiation',
		name: 'Salary Negotiation',
		buyer: 'Hiring Company',
		seller: 'Candidate',
		offer: 'Opportunity',
		offers: 'Opportunities',
		broker: 'Recruitment Consultant',
		defaultOfferer: 'buyer',
		brokerAllowed: true,
		brokerSeesFigures: true,
		multiSeller: true,
		multiBuyer: true,
		marketingPath: '/recruitment',
		ready: true
	},
	{
		id: 'founders',
		name: 'Founders',
		buyer: 'Customer',
		seller: 'Founder',
		offer: 'Price test',
		offers: 'Price tests',
		broker: 'Adviser',
		defaultOfferer: 'seller',
		brokerAllowed: false,
		brokerSeesFigures: false,
		multiSeller: false,
		multiBuyer: true,
		marketingPath: null,
		ready: false
	}
];

export function vertical(id: VerticalId): VerticalDictionary {
	const v = VERTICALS.find((x) => x.id === id);
	if (!v) throw new Error(`unknown vertical ${id}`);
	return v;
}

/** The vertical a route belongs to, for the top bar's scope tag. */
export function scopeFor(pathname: string): VerticalId | null {
	if (
		pathname.startsWith('/recruitment') ||
		pathname.startsWith('/app/offers') ||
		pathname.startsWith('/app/o/') ||
		pathname.startsWith('/app/rec/') ||
		/^\/rec\/[^/]+/.test(pathname)
	) {
		return 'salary-negotiation';
	}
	return null;
}
