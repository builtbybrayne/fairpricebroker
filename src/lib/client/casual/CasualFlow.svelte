<script lang="ts">
	/**
	 * The casual co-present flow — the state machine of T3-m1-casual-mode §3.
	 *
	 * All state is in-memory Svelte state: never localStorage, never a
	 * persisted store. A reload loses everything, which is correct.
	 *
	 * Invariants (component tests assert them):
	 *  1. A's figures are never rendered during handover, party-b-entry,
	 *     both-look-now or transport-error — no template below reads
	 *     `aValues` in those states.
	 *  2. The reveal screen is never mounted before the `reveal` phase.
	 */
	import type { CasualResultPayload } from '$lib/server/casual/casualPayload';
	import { onMount, untrack, type Snippet } from 'svelte';
	import { asRawTuple, mintIdempotencyKey, type CasualState } from './casualClient';
	import PartyEntry from './PartyEntry.svelte';
	import Interstitial from './Interstitial.svelte';
	import OutcomeReveal from './OutcomeReveal.svelte';

	type EngineError = { kind: string; detail: string };
	type Response =
		{ ok: true; result: CasualResultPayload; shareRef: string } | { ok: false; error: EngineError };

	let {
		ref = null,
		rows,
		labels = { a: 'Party A', b: 'Party B' },
		currency = '£',
		phase = $bindable<CasualState>('idle'),
		onreveal = () => {},
		onphase = () => {},
		idle
	}: {
		ref?: string | null;
		rows: readonly { key: string; label: string }[];
		labels?: { a: string; b: string };
		currency?: string;
		phase?: CasualState;
		onreveal?: (r: CasualResultPayload) => void;
		/** Fires on every phase change (the page drives its step row from it). */
		onphase?: (p: CasualState) => void;
		idle?: Snippet<[() => void]>;
	} = $props();

	let aValues = $state<(string | null)[]>([null, null, null, null]);
	let bValues = $state<(string | null)[]>([null, null, null, null]);
	// The inbound ref is captured once, deliberately: it must not change
	// mid-flow if the URL does (T2-product-surfaces §3.1).
	let attributionRef = $state<string | null>(untrack(() => ref));
	let idempotencyKey = $state<string | null>(null);
	let response = $state<Response | null>(null);
	let pending = $state(false);
	let bError = $state<string | null>(null);
	let startedAt = $state<number | null>(null);
	let elapsedMs = $state<number | null>(null);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
	$effect(() => {
		onphase(phase);
	});

	/** Exposed so a parent (the hero CTA) can start the flow. */
	export function start() {
		if (phase !== 'idle') return;
		startedAt = performance.now();
		elapsedMs = null;
		phase = 'party-a-entry';
	}

	function aSubmit() {
		phase = 'a-confirm-hide';
	}
	function aConfirm() {
		phase = 'handover';
	}
	function handoverReady() {
		phase = 'party-b-entry';
	}
	function bSubmit() {
		// The ONLY mint point in the whole flow (§3).
		idempotencyKey = mintIdempotencyKey();
		bError = null;
		phase = 'both-look-now';
		void fire();
	}
	function retry() {
		phase = 'both-look-now';
		void fire();
	}
	function continueToReveal() {
		if (!response) return;
		if (response.ok) {
			elapsedMs = startedAt === null ? null : performance.now() - startedAt;
			phase = 'reveal';
			onreveal(response.result);
		} else {
			// Engine rejection: back to B with the detail; A's tuple kept; a
			// corrected resubmission mints a fresh key at the next b-submit.
			bError = response.error.detail;
			idempotencyKey = null;
			response = null;
			phase = 'party-b-entry';
		}
	}
	function reset() {
		aValues = [null, null, null, null];
		bValues = [null, null, null, null];
		response = null;
		idempotencyKey = null;
		pending = false;
		bError = null;
		startedAt = null;
		elapsedMs = null;
		phase = 'idle';
	}

	async function fire() {
		if (!idempotencyKey) return;
		pending = true;
		try {
			const res = await fetch('/api/casual/reconcile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					partyATuple: asRawTuple(aValues),
					partyBTuple: asRawTuple(bValues),
					ref: attributionRef,
					idempotencyKey
				})
			});
			let body: unknown = null;
			try {
				body = await res.json();
			} catch {
				throw new Error('unparseable');
			}
			if (res.status === 400 && isInvalidRef(body)) {
				// ref-rejected: discard the ref, retry silently with the SAME key.
				attributionRef = null;
				pending = false;
				void fire();
				return;
			}
			if (res.status !== 200) throw new Error(`http-${res.status}`);
			response = body as Response;
		} catch {
			// The seam's state is UNKNOWN after a transport failure — keep the key.
			phase = 'transport-error';
		} finally {
			pending = false;
		}
	}

	function isInvalidRef(body: unknown): boolean {
		return (
			typeof body === 'object' &&
			body !== null &&
			Object.keys(body).length === 1 &&
			(body as { error?: unknown }).error === 'invalid-ref'
		);
	}

	const canContinue = $derived(phase === 'both-look-now' && response !== null && !pending);
</script>

<div
	class="flow"
	data-casual-state={phase}
	data-hydrated={hydrated ? '' : undefined}
	data-elapsed-ms={elapsedMs ?? ''}
>
	{#if phase === 'idle'}
		{#if idle}
			{@render idle(start)}
		{:else}
			<button class="pill pill--gold" type="button" onclick={start}>Set your meter</button>
		{/if}
	{:else if phase === 'party-a-entry'}
		<PartyEntry
			title={labels.a}
			partyLabel="A"
			accent="blue"
			{rows}
			bind:values={aValues}
			intro={`${labels.a}: set your four prices while the other person looks away.`}
			onsubmit={aSubmit}
		/>
	{:else if phase === 'a-confirm-hide'}
		<Interstitial
			screen="a-confirm-hide"
			accent="blue"
			title="Your four prices are sealed."
			body="They are hidden from here on. Hand the phone over when you are ready."
			action="Hide them and hand over"
			onaction={aConfirm}
		/>
	{:else if phase === 'handover'}
		<Interstitial
			screen="handover"
			accent="terracotta"
			title="Pass the phone to the other person."
			body="When it is in your hands, tap below. The first set of figures is hidden."
			action="I have the phone"
			onaction={handoverReady}
		/>
	{:else if phase === 'party-b-entry'}
		<div class="flow__b">
			{#if bError}
				<p class="flow__correction" role="alert">
					The instrument could not use those figures: {bError}
				</p>
			{/if}
			<PartyEntry
				title={labels.b}
				partyLabel="B"
				accent="terracotta"
				{rows}
				bind:values={bValues}
				intro="Now set yours. The other person cannot see this screen's figures either."
				submitLabel="Seal my meter"
				onsubmit={bSubmit}
			/>
		</div>
	{:else if phase === 'both-look-now'}
		<Interstitial
			screen="both-look-now"
			accent="gold"
			title="Both of you look now."
			body={pending
				? 'The instrument is working out the fair price.'
				: response?.ok === false
					? 'The instrument could not use one set of figures. Go back and correct them.'
					: 'The reveal is ready when you both are.'}
			action={pending ? 'Working…' : response?.ok === false ? 'Go back' : 'Reveal the fair price'}
			busy={!canContinue}
			onaction={continueToReveal}
		/>
	{:else if phase === 'transport-error'}
		<Interstitial
			screen="transport-error"
			accent="terracotta"
			title="That didn’t go through."
			body="Your figures are still here on this phone. Try again; nothing was stored either way."
			action="Try again"
			onaction={retry}
		>
			<button class="flow__giveup" type="button" onclick={reset}>Start over instead</button>
		</Interstitial>
	{:else if phase === 'reveal' && response?.ok}
		<OutcomeReveal
			result={response.result}
			shareRef={response.shareRef}
			{rows}
			{labels}
			{currency}
			onrestart={reset}
		/>
	{/if}
</div>

<style>
	.flow {
		width: 100%;
	}

	.flow__b {
		display: grid;
		gap: 16px;
	}

	.flow__correction {
		background: rgba(183, 105, 82, 0.12);
		color: #7a3a2a;
		border-radius: 12px;
		padding: 12px 16px;
		font-size: 16px;
	}

	.flow__giveup {
		font-size: 15px;
		color: var(--slate);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
</style>
