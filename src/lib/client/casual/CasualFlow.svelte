<script lang="ts">
	/**
	 * The casual co-present flow (T3-m1-casual-mode §3, revised 8 Sep 2026):
	 * both meters are live side by side from the start. Each side seals its
	 * own meter, which hides it behind a plate for the handover; when both
	 * are sealed the reconciliation runs and the pair reveal it together.
	 *
	 * All state is in-memory Svelte state: never localStorage, never a
	 * persisted store. A reload loses everything, which is correct.
	 *
	 * Invariants (the e2e suite asserts them):
	 *  1. A sealed side's figures are not rendered anywhere until `reveal`
	 *     with `numbersShown` (the sealed meter renders a plate only).
	 *  2. The reveal screen is never mounted before the `reveal` phase.
	 */
	import type { CasualResultPayload } from '$lib/server/casual/casualPayload';
	import type { CasualScenario } from '$lib/casual/casualTemplate';
	import { onMount, untrack } from 'svelte';
	import { asRawTuple, mintIdempotencyKey, type CasualState } from './casualClient';
	import PartyEntry from './PartyEntry.svelte';
	import Interstitial from './Interstitial.svelte';
	import OutcomeReveal from './OutcomeReveal.svelte';

	type EngineError = { kind: string; detail: string };
	type Response =
		{ ok: true; result: CasualResultPayload; shareRef: string } | { ok: false; error: EngineError };

	let {
		ref = null,
		scenario,
		phase = $bindable<CasualState>('entry'),
		onreveal = () => {},
		onphase = () => {}
	}: {
		ref?: string | null;
		scenario: CasualScenario;
		phase?: CasualState;
		onreveal?: (r: CasualResultPayload) => void;
		/** Fires on every phase change (the page drives its step row from it). */
		onphase?: (p: CasualState) => void;
	} = $props();

	const seed = (s: CasualScenario) => ({
		a: s.a.example.map(String) as (string | null)[],
		b: s.b.example.map(String) as (string | null)[]
	});
	let aValues = $state<(string | null)[]>(untrack(() => seed(scenario).a));
	let bValues = $state<(string | null)[]>(untrack(() => seed(scenario).b));
	let sealedA = $state(false);
	let sealedB = $state(false);
	// The inbound ref is captured once, deliberately: it must not change
	// mid-flow if the URL does (T2-product-surfaces §3.1).
	let attributionRef = $state<string | null>(untrack(() => ref));
	let idempotencyKey = $state<string | null>(null);
	let response = $state<Response | null>(null);
	let pending = $state(false);
	let engineError = $state<string | null>(null);
	let startedAt = $state<number | null>(null);
	let elapsedMs = $state<number | null>(null);
	let hydrated = $state(false);
	onMount(() => {
		hydrated = true;
	});
	$effect(() => {
		onphase(phase);
	});
	// A new scenario re-seeds both meters, but only while nothing is sealed.
	$effect(() => {
		const s = scenario;
		untrack(() => {
			if (phase === 'entry' && !sealedA && !sealedB) {
				aValues = seed(s).a;
				bValues = seed(s).b;
			}
		});
	});

	/** True while a scenario switch is allowed (nothing sealed yet). */
	export function untouched() {
		return phase === 'entry' && !sealedA && !sealedB;
	}

	let root = $state<HTMLElement | null>(null);
	/** Puts focus on the first open meter (the hero CTA calls this). */
	export function start() {
		if (phase !== 'entry' && phase !== 'a-sealed' && phase !== 'b-sealed') return;
		if (startedAt === null) startedAt = performance.now();
		const first = root?.querySelector<HTMLElement>(
			'form:not([data-sealed]) .knob, form:not([data-sealed]) .dial'
		);
		first?.focus({ preventScroll: true });
	}

	function sealA() {
		if (startedAt === null) startedAt = performance.now();
		sealedA = true;
		afterSeal();
	}
	function sealB() {
		if (startedAt === null) startedAt = performance.now();
		sealedB = true;
		afterSeal();
	}
	function afterSeal() {
		engineError = null;
		if (sealedA && sealedB) {
			// The ONLY mint point in the whole flow (§3).
			idempotencyKey = mintIdempotencyKey();
			phase = 'both-look-now';
			void fire();
		} else {
			phase = sealedA ? 'a-sealed' : 'b-sealed';
		}
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
			// An engine rejection cannot say whose figures without unsealing a
			// side in front of the other, so the pair start over together.
			engineError = response.error.detail;
			reset(true);
		}
	}
	function reset(keepError = false) {
		aValues = seed(scenario).a;
		bValues = seed(scenario).b;
		sealedA = false;
		sealedB = false;
		response = null;
		idempotencyKey = null;
		pending = false;
		if (!keepError) engineError = null;
		startedAt = null;
		elapsedMs = null;
		phase = 'entry';
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
	const labels = $derived({ a: scenario.a.title, b: scenario.b.title });
</script>

<div
	class="flow"
	bind:this={root}
	data-casual-state={phase}
	data-hydrated={hydrated ? '' : undefined}
	data-elapsed-ms={elapsedMs ?? ''}
>
	{#if phase === 'reveal' && response?.ok}
		<OutcomeReveal
			result={response.result}
			shareRef={response.shareRef}
			{scenario}
			{labels}
			currency={scenario.currency}
			onrestart={() => reset()}
		/>
	{:else}
		{#if engineError}
			<p class="flow__correction" role="alert">
				The instrument could not use those figures: {engineError}. Both meters have been reset.
			</p>
		{/if}

		<div class="flow__panels">
			<PartyEntry
				side={scenario.a}
				partyLabel="A"
				accent="blue"
				bind:values={aValues}
				sealed={sealedA}
				sealedNote={sealedB ? 'Sealed.' : 'Sealed. Hand the phone over.'}
				currency={scenario.currency}
				min={scenario.min}
				max={scenario.max}
				step={scenario.step}
				onseal={sealA}
			/>
			<div class="flow__lock" aria-hidden="true">
				<svg viewBox="0 0 34 40"
					><rect x="3" y="17" width="28" height="20" rx="4" fill="currentColor" /><path
						d="M9 17v-5a8 8 0 0 1 16 0v5"
						fill="none"
						stroke="currentColor"
						stroke-width="4"
					/></svg
				>
				<span class="caps">Both set in private <br />Figures hidden until reveal</span>
			</div>
			<PartyEntry
				side={scenario.b}
				partyLabel="B"
				accent="terracotta"
				bind:values={bValues}
				sealed={sealedB}
				sealedNote={sealedA ? 'Sealed.' : 'Sealed. Hand the phone over.'}
				currency={scenario.currency}
				min={scenario.min}
				max={scenario.max}
				step={scenario.step}
				onseal={sealB}
			/>
		</div>

		{#if phase === 'both-look-now'}
			<Interstitial
				screen="both-look-now"
				accent="gold"
				title="Both of you look now."
				body={pending
					? 'The instrument is working out the fair price.'
					: response?.ok === false
						? 'The instrument could not use one set of figures. Start over together.'
						: 'The reveal is ready when you both are.'}
				action={pending
					? 'Working…'
					: response?.ok === false
						? 'Start over'
						: 'Reveal the fair price'}
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
				<button class="flow__giveup" type="button" onclick={() => reset()}
					>Start over instead</button
				>
			</Interstitial>
		{/if}
	{/if}
</div>

<style>
	.flow {
		width: 100%;
		display: grid;
		gap: 28px;
	}

	.flow__panels {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}

	.flow__lock {
		align-self: center;
		display: grid;
		justify-items: center;
		gap: 10px;
		width: 96px;
		color: var(--mist);
		text-align: center;
		font-size: 10px;
		letter-spacing: 0.18em;
		line-height: 1.5;
	}

	.flow__lock svg {
		width: 26px;
		height: 30px;
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

	@media (max-width: 900px) {
		.flow__panels {
			grid-template-columns: 1fr;
		}
		.flow__lock {
			width: auto;
			grid-auto-flow: column;
			gap: 14px;
		}
		.flow__lock br {
			display: none;
		}
	}
</style>
