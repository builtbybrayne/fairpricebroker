<script lang="ts">
	/**
	 * The recruitment vertical (T3-m1-recruitment-demo §1): the standoff,
	 * the two-sided signal, who sees what, the two-dimensional outcome —
	 * told with the instrument doing the proving. No fabricated proof.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';
	import type { Zone } from '$lib/server/engine/types';
	import { OVERLAP_LABEL } from '$lib/client/demo/demoStages';
	import { formatSalary } from '$lib/client/demo/demoClient';

	const budgetRows = salaryNegotiationTemplate.questions.buyer.map((q) => ({
		key: q.key,
		label: q.label,
		help: q.prompt
	}));
	const candidateRows = salaryNegotiationTemplate.questions.seller.map((q) => ({
		key: q.key,
		label: q.label,
		help: q.prompt
	}));

	// Illustrative figures only: they show the shape of each outcome, never a
	// real placement. Chosen so the engine's zone rules hold for each.
	const wideAxis = { min: 30000, max: 90000, step: 10000 };
	const scenes: Record<
		Zone,
		{
			budget: [number, number, number, number];
			candidate: [number, number, number, number];
			zone: { lo: number; hi: number } | null;
			fair: number;
		}
	> = {
		comfort: {
			budget: [40000, 48000, 58000, 65000],
			candidate: [45000, 52000, 60000, 75000],
			zone: { lo: 52000, hi: 58000 },
			fair: 55000
		},
		deal: {
			budget: [38000, 44000, 50000, 56000],
			candidate: [52000, 58000, 66000, 78000],
			zone: { lo: 52000, hi: 56000 },
			fair: 54000
		},
		'no-deal': {
			budget: [36000, 42000, 48000, 52000],
			candidate: [58000, 64000, 72000, 85000],
			zone: null,
			fair: 55000
		}
	};
	const zoneOrder: readonly Zone[] = ['comfort', 'deal', 'no-deal'];

	let shown = $state<Zone>('deal');
	const scene = $derived(scenes[shown]);
	const guidance = $derived(salaryNegotiationTemplate.guidance(shown));

	let reducedMotion = $state(false);
	let narrow = $state(false);
	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const width = window.matchMedia('(max-width: 640px)');
		narrow = width.matches;
		const onWidth = (e: MediaQueryListEvent) => (narrow = e.matches);
		width.addEventListener('change', onWidth);
		return () => width.removeEventListener('change', onWidth);
	});
	// The shared canvas draws every tick; on a phone six labels collide.
	const axis = $derived(narrow ? { ...wideAxis, step: 20000 } : wideAxis);
</script>

<svelte:head>
	<title>For recruiters — Fair Price Broker</title>
	<meta
		name="description"
		content="Enter the client's budget, send the candidate a private link, and see whether you are in range before anyone has to name a number."
	/>
</svelte:head>

<main class="vertical">
	<section class="hero" aria-labelledby="hero-title">
		<div class="hero__copy">
			<h1 id="hero-title" class="hero__title">The salary conversation, without the standoff.</h1>
			<p class="hero__lede">
				Enter the client’s budget. Send the candidate a private link. See whether you are in range
				before anyone has to name a number.
			</p>
			<div class="hero__actions">
				<a class="pill pill--gold hero__cta" href={resolve('/recruitment/demo')}>
					Try it as a recruiter
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path
							d="M5 12h13M13 6l6 6-6 6"
							fill="none"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				</a>
				<a class="hero__secondary" href={resolve('/signin')}>Start free</a>
			</div>
			<p class="hero__caption">three minutes · no sign-up · use any numbers you like</p>
		</div>
		<div class="hero__reveal">
			<RevealCanvas
				{axis}
				yours={{ lo: scenes.comfort.budget[0], hi: scenes.comfort.budget[3] }}
				theirs={{ lo: scenes.comfort.candidate[0], hi: scenes.comfort.candidate[3] }}
				zone={scenes.comfort.zone}
				fair={scenes.comfort.fair}
				fairLabel={formatSalary(scenes.comfort.fair)}
				yourLabel="Employer budget"
				theirLabel="Candidate"
				zoneLabel="Overlap"
				variant="both"
				animate={!reducedMotion}
			/>
		</div>
	</section>

	<section class="standoff" aria-labelledby="standoff-title">
		<h2 id="standoff-title" class="section__title">
			Candidates are coached never to name a number first. So recruiters proceed blind.
		</h2>
		<div class="standoff__cols">
			<p>
				Every negotiation guide says the same thing: let the other side go first. So the salary
				check on a first call turns into a standoff. You can push for a figure and add friction to a
				relationship that has barely started, or you can move on without one and carry the risk.
			</p>
			<p>
				Either way, misalignment surfaces late: a declined offer, a reneged acceptance, weeks of
				work and a fee that never lands. Compensation mismatch is one of the commonest reasons an
				offer is declined, and agency recruiters carry that cost directly.
			</p>
		</div>
	</section>

	<section class="signal" aria-labelledby="signal-title">
		<h2 id="signal-title" class="section__title">
			Two sides answer four questions each. Nobody has to go first.
		</h2>
		<p class="section__lede">
			A range is not a number. Each side describes where salary stops making sense for them, in
			private, and the instrument finds where the two ranges meet.
		</p>

		<div class="signal__meters">
			<div class="signal__side">
				<p class="signal__who">You enter this, from what the client has told you.</p>
				<MeterPanel
					title="Employer budget"
					rows={budgetRows}
					values={scenes.comfort.budget.map(String)}
					mode="display"
					accent="blue"
					min={0}
					max={150000}
				/>
			</div>
			<div class="signal__side">
				<p class="signal__who">The candidate answers this, on their own, from the link you send.</p>
				<MeterPanel
					title="Candidate"
					rows={candidateRows}
					values={scenes.comfort.candidate.map(String)}
					mode="display"
					accent="terracotta"
					min={0}
					max={150000}
				/>
			</div>
		</div>

		<div class="sees raised">
			<h3 class="sees__title">Who sees what</h3>
			<dl class="sees__list">
				<div class="sees__row sees__row--blue">
					<dt>The recruiter</dt>
					<dd>
						Sees both sets of figures and the full outcome. This is your instrument; it does not
						hide the candidate’s answers from you.
					</dd>
				</div>
				<div class="sees__row sees__row--terracotta">
					<dt>The candidate</dt>
					<dd>
						Is told before they enter anything that you will see their figures, and why a lower
						first figure is in their interest. They never see the client’s budget. They get the
						outcome, not your numbers.
					</dd>
				</div>
				<div class="sees__row">
					<dt>The client</dt>
					<dd>Sees nothing unless you choose to tell them.</dd>
				</div>
			</dl>
		</div>
	</section>

	<section class="outcome" aria-labelledby="outcome-title">
		<h2 id="outcome-title" class="section__title">
			One read: how much overlap, and whether salary alone can close it.
		</h2>
		<p class="section__lede">
			You get the overlap, the fair figure, and a straight read on whether salary alone can close it
			or non-salary factors need to be in play: flexibility, equity, culture, purpose. Illustrative
			figures; try each outcome.
		</p>

		<div class="outcome__switch" role="group" aria-label="Show an outcome">
			{#each zoneOrder as z (z)}
				<button
					type="button"
					class="pill outcome__opt"
					class:outcome__opt--on={shown === z}
					aria-pressed={shown === z}
					onclick={() => (shown = z)}
				>
					{OVERLAP_LABEL[salaryNegotiationTemplate.guidance(z).overlap]}
				</button>
			{/each}
		</div>

		<div class="outcome__panel">
			<div class="outcome__canvas">
				{#key shown}
					<RevealCanvas
						{axis}
						yours={{ lo: scene.budget[0], hi: scene.budget[3] }}
						theirs={{ lo: scene.candidate[0], hi: scene.candidate[3] }}
						zone={scene.zone}
						fair={scene.fair}
						fairLabel={formatSalary(scene.fair)}
						yourLabel="Employer budget"
						theirLabel="Candidate"
						zoneLabel="Overlap"
						variant="both"
						compact
						animate={!reducedMotion}
					/>
				{/key}
			</div>
			<div class="outcome__read">
				<dl class="outcome__facts">
					<div>
						<dt>Overlap</dt>
						<dd>{OVERLAP_LABEL[guidance.overlap]}</dd>
					</div>
					<div>
						<dt>Non-salary factors</dt>
						<dd>{guidance.nonRemunerationInPlay ? 'Need to be in play' : 'Not needed to close'}</dd>
					</div>
				</dl>
				<p class="outcome__host">{guidance.brokerCopy}</p>
				<p class="outcome__party">
					<span class="outcome__party-label">The candidate reads:</span>
					{guidance.sideCopy}
				</p>
			</div>
		</div>
	</section>

	<section class="close raised" aria-labelledby="close-title">
		<h2 id="close-title" class="close__title">Play both sides in three minutes.</h2>
		<p class="close__lede">
			Enter a made-up budget as the recruiter, switch hats, answer as the candidate, and see the
			read you would get. Nothing you enter is treated as real.
		</p>
		<div class="close__actions">
			<a class="pill pill--gold hero__cta" href={resolve('/recruitment/demo')}>
				Try it as a recruiter
			</a>
			<a class="pill pill--navy close__secondary" href={resolve('/signin')}>Start free</a>
		</div>
	</section>
</main>

<style>
	.vertical {
		padding: 2px 14px 70px;
	}

	.section__title {
		font-size: 36px;
		line-height: 1.08;
		letter-spacing: -0.03em;
		max-width: 22ch;
	}

	.section__lede {
		margin-top: 16px;
		font-size: 19px;
		line-height: 1.5;
		color: var(--slate);
		max-width: 62ch;
	}

	/* hero ---------------------------------------------------------------- */
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 560px) 1fr;
		gap: 24px;
		min-height: 440px;
		background: var(--navy);
		border-radius: 20px;
		box-shadow: var(--lift-navy);
		color: var(--on-navy);
		overflow: hidden;
	}

	.hero__copy {
		padding: 66px 0 56px 66px;
	}

	.hero__title {
		color: var(--on-navy);
		font-size: 52px;
		line-height: 1;
		letter-spacing: -0.035em;
	}

	.hero__lede {
		margin-top: 22px;
		font-size: 22px;
		line-height: 1.35;
		color: var(--on-navy-soft);
		max-width: 30ch;
	}

	.hero__actions {
		margin-top: 30px;
		display: flex;
		align-items: center;
		gap: 26px;
		flex-wrap: wrap;
	}

	.hero__cta {
		height: 56px;
		padding: 0 30px;
		font-size: 21px;
		text-decoration: none;
	}

	.hero__cta svg {
		width: 22px;
		height: 22px;
	}

	.hero__secondary {
		color: var(--on-navy-soft);
		font-weight: 600;
		font-size: 18px;
		text-decoration: none;
		border-bottom: 2px solid rgba(153, 191, 229, 0.4);
	}

	.hero__secondary:hover {
		color: var(--on-navy);
		border-bottom-color: var(--on-navy);
	}

	.hero__caption {
		margin-top: 14px;
		font-size: 16px;
		font-weight: 500;
		color: var(--on-navy-soft);
	}

	.hero__reveal {
		position: relative;
		margin: 70px 36px 0 28px;
		height: 300px;
	}

	/* standoff ------------------------------------------------------------ */
	.standoff {
		max-width: 1040px;
		margin: 80px auto 0;
	}

	.standoff__cols {
		margin-top: 26px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 34px;
		font-size: 18px;
		line-height: 1.6;
		color: var(--ink);
	}

	/* signal -------------------------------------------------------------- */
	.signal {
		max-width: 1040px;
		margin: 90px auto 0;
	}

	.signal__meters {
		margin-top: 34px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 28px;
		align-items: start;
	}

	.signal__side {
		display: grid;
		gap: 12px;
	}

	.signal__who {
		font-size: 15px;
		color: var(--slate);
		padding-left: 6px;
	}

	.signal :global(.row) {
		grid-template-columns: minmax(0, 1.5fr) 1fr 84px;
		gap: 14px;
	}

	.signal :global(.row__label) {
		font-size: 15px;
		line-height: 1.3;
	}

	.sees {
		margin-top: 34px;
		padding: 30px 36px 32px;
	}

	.sees__title {
		font-size: 22px;
		letter-spacing: -0.01em;
	}

	.sees__list {
		margin: 18px 0 0;
		display: grid;
		gap: 16px;
	}

	.sees__row {
		display: grid;
		grid-template-columns: 150px 1fr;
		gap: 18px;
		align-items: baseline;
	}

	.sees__row dt {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 17px;
		color: var(--navy);
	}

	.sees__row--blue dt {
		color: var(--blue);
	}

	.sees__row--terracotta dt {
		color: var(--terracotta);
	}

	.sees__row dd {
		margin: 0;
		font-size: 17px;
		line-height: 1.5;
		color: var(--ink);
	}

	/* outcome ------------------------------------------------------------- */
	.outcome {
		max-width: 1040px;
		margin: 90px auto 0;
	}

	.outcome__switch {
		margin-top: 24px;
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.outcome__opt {
		height: 42px;
		padding: 0 20px;
		font-size: 15px;
		color: var(--slate);
		background: var(--ground);
		box-shadow: var(--raise-sm);
	}

	.outcome__opt:hover {
		color: var(--navy);
	}

	.outcome__opt--on {
		color: var(--navy);
		box-shadow: var(--inset-md);
	}

	.outcome__panel {
		margin-top: 20px;
		display: grid;
		grid-template-columns: 1.3fr 1fr;
		gap: 24px;
		align-items: stretch;
	}

	.outcome__canvas {
		position: relative;
		height: 380px;
		padding: 36px 24px 36px 28px;
		background: var(--navy);
		border-radius: 20px;
		box-shadow: var(--lift-navy);
		overflow: hidden;
	}

	.outcome__read {
		display: grid;
		gap: 16px;
		align-content: start;
		padding: 8px 4px;
	}

	.outcome__facts {
		margin: 0;
		display: flex;
		gap: 28px;
		flex-wrap: wrap;
	}

	.outcome__facts div {
		display: grid;
		gap: 4px;
	}

	.outcome__facts dt {
		font-size: 13px;
		color: var(--slate);
	}

	.outcome__facts dd {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 20px;
		color: var(--navy);
	}

	.outcome__host {
		font-size: 17px;
		line-height: 1.55;
		color: var(--ink);
	}

	.outcome__party {
		font-size: 15px;
		line-height: 1.5;
		color: var(--slate);
	}

	.outcome__party-label {
		color: var(--terracotta);
		font-weight: 600;
	}

	/* close --------------------------------------------------------------- */
	.close {
		max-width: 1040px;
		margin: 90px auto 0;
		padding: 46px 48px 48px;
		text-align: center;
	}

	.close__title {
		font-size: 34px;
		letter-spacing: -0.03em;
	}

	.close__lede {
		margin: 14px auto 0;
		font-size: 18px;
		line-height: 1.5;
		color: var(--slate);
		max-width: 52ch;
	}

	.close__actions {
		margin-top: 28px;
		display: flex;
		justify-content: center;
		gap: 18px;
		flex-wrap: wrap;
	}

	.close__secondary {
		height: 56px;
		padding: 0 30px;
		font-size: 19px;
		text-decoration: none;
	}

	/* responsive ---------------------------------------------------------- */
	@media (max-width: 1100px) {
		.hero {
			grid-template-columns: 1fr;
		}
		.hero__copy {
			padding: 48px 40px 0;
		}
		.hero__reveal {
			margin: 24px 40px 40px;
		}
		.signal__meters,
		.outcome__panel {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.standoff__cols {
			grid-template-columns: 1fr;
			gap: 18px;
		}
		.section__title {
			font-size: 28px;
		}
		.sees__row {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}

	@media (max-width: 640px) {
		.vertical {
			padding: 0 10px 50px;
		}
		.hero__copy {
			padding: 32px 22px 0;
		}
		.hero__title {
			font-size: 36px;
		}
		.hero__lede {
			font-size: 18px;
		}
		.hero__cta {
			height: 52px;
			font-size: 18px;
			padding: 0 24px;
		}
		.hero__caption {
			font-size: 14px;
		}
		.hero__reveal {
			margin: 16px 16px 24px;
			height: 260px;
		}
		.standoff,
		.signal,
		.outcome,
		.close {
			margin-top: 56px;
		}
		.standoff__cols {
			font-size: 17px;
		}
		.signal :global(.row) {
			grid-template-columns: 1fr 84px;
		}
		.sees {
			padding: 22px 20px 24px;
		}
		.outcome__canvas {
			height: 280px;
			padding: 30px 12px 0 20px;
		}
		.close {
			padding: 30px 22px 32px;
		}
		.close__title {
			font-size: 26px;
		}
	}
</style>
