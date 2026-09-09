<script lang="ts">
	import { resolve } from '$app/paths';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import CasualFlow from '$lib/client/casual/CasualFlow.svelte';
	import { formatMoney, niceAxis, type CasualState } from '$lib/client/casual/casualClient';
	import { sideToDirection } from '$lib/domain/terms';
	import {
		CASUAL_SCENARIOS,
		CUSTOM_SCENARIO,
		DEFAULT_SCENARIO,
		withCustomTitle,
		type CasualScenario
	} from '$lib/casual/casualTemplate';
	import type { CasualResultPayload } from '$lib/server/casual/casualPayload';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let scenario = $state<CasualScenario>(DEFAULT_SCENARIO);
	let customTitle = $state('');
	const isCustom = $derived(scenario.id === CUSTOM_SCENARIO.id);
	// The custom scenario carries the pair's own title; the picker and the
	// meters read the same object.
	const activeScenario = $derived(isCustom ? withCustomTitle(customTitle) : scenario);
	let phase = $state<CasualState>('entry');
	// Which of the three steps the pair is on (the row lights up as they go).
	const step = $derived(
		phase === 'entry' ? 1 : phase === 'buyer-sealed' || phase === 'seller-sealed' ? 2 : 3
	);
	let flow = $state<CasualFlow | null>(null);
	let stepsEl = $state<HTMLElement | null>(null);

	// The hero's reveal shows the scenario's example until a real
	// reconciliation lands, then the pair's own result (casual is the
	// full-detail mode, so both ranges are permitted here).
	const exampleHero = (s: CasualScenario) => ({
		axis: niceAxis([...s.buyer.example, ...s.seller.example, s.exampleOutcome.fair]),
		yours: { lo: s.buyer.example[0], hi: s.buyer.example[3] },
		theirs: { lo: s.seller.example[0], hi: s.seller.example[3] },
		zone: s.exampleOutcome.zone as { lo: number; hi: number } | null,
		fair: s.exampleOutcome.fair,
		fairLabel: null as string | null,
		live: false
	});
	let hero = $state(exampleHero(DEFAULT_SCENARIO));

	function pickScenario(s: CasualScenario) {
		if (!(flow?.untouched() ?? true)) return;
		scenario = s;
		hero = exampleHero(s);
	}

	function onreveal(r: CasualResultPayload) {
		const buyer = r.input[sideToDirection.buyer].tuple.map(Number);
		const seller = r.input[sideToDirection.seller].tuple.map(Number);
		hero = {
			axis: niceAxis([...buyer, ...seller, r.fairPrice.float]),
			yours: { lo: buyer[0], hi: buyer[3] },
			theirs: { lo: seller[0], hi: seller[3] },
			zone:
				r.zone === 'comfort'
					? { lo: r.overlapLow.float, hi: r.overlapHigh.float }
					: r.zone === 'deal'
						? { lo: r.dealLow.float, hi: r.dealHigh.float }
						: null,
			fair: r.fairPrice.float,
			fairLabel: formatMoney(r.fairPrice.decimal),
			live: true
		};
	}

	function startFromHero(e: Event) {
		e.preventDefault();
		// Land with the step row at the top so both meters are in view.
		stepsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		setTimeout(() => flow?.start(), 450);
	}
</script>

<svelte:head>
	<title>Fair Price Broker — watch two prices become one fair one</title>
	<meta
		name="description"
		content="You each set your meter in private. The instrument finds the number fair to you both. Free, sixty seconds, nothing stored."
	/>
</svelte:head>

<main class="home">
	<section class="hero" class:hero--live={hero.live} aria-labelledby="hero-title">
		<div class="hero__copy">
			<h1 id="hero-title" class="hero__title">Watch two prices<br />become one fair one.</h1>
			<p class="hero__lede">
				You each set your meter in private.<br />The instrument finds the number fair to you both.
			</p>
			<a class="pill pill--gold hero__cta" href="#set-your-meter" onclick={startFromHero}>
				Set your meter
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
			<p class="hero__caption">free · 60 seconds · nothing stored</p>
		</div>

		<div class="hero__reveal">
			<RevealCanvas
				axis={hero.axis}
				yours={hero.yours}
				theirs={hero.theirs}
				zone={hero.zone}
				fair={hero.fair}
				fairLabel={hero.fairLabel}
				variant={hero.live ? 'zone' : 'both'}
				animate
			/>
		</div>
	</section>

	<ol class="steps" aria-label="How it works" data-step={step} bind:this={stepsEl}>
		{#each ['You set yours', 'They set theirs', 'The reveal'] as label, i (label)}
			{#if i > 0}<li
					class="steps__line"
					class:steps__line--done={step > i}
					aria-hidden="true"
				></li>{/if}
			<li
				class="steps__step"
				class:steps__step--current={step === i + 1}
				class:steps__step--done={step > i + 1}
				aria-current={step === i + 1 ? 'step' : undefined}
			>
				<span class="steps__num">{i + 1}</span><span class="steps__label">{label}</span>
			</li>
		{/each}
	</ol>

	<section class="meters" id="set-your-meter" aria-label="The instrument">
		<div class="meters__scenario" role="group" aria-label="Try it on">
			<span class="meters__scenario-label">Try it on</span>
			{#each [...CASUAL_SCENARIOS, CUSTOM_SCENARIO] as s (s.id)}
				<button
					type="button"
					class="pill meters__scenario-opt"
					class:meters__scenario-opt--on={scenario.id === s.id}
					aria-pressed={scenario.id === s.id}
					disabled={phase !== 'entry'}
					onclick={() => pickScenario(s)}
					>{s.id === CUSTOM_SCENARIO.id ? 'Customise your own' : s.name}</button
				>
			{/each}
		</div>
		{#if isCustom}
			<label class="meters__custom">
				<span class="meters__custom-label">What are you pricing?</span>
				<input
					class="meters__custom-input inset"
					type="text"
					maxlength="60"
					placeholder="e.g. a week in the cottage"
					bind:value={customTitle}
					disabled={phase !== 'entry'}
					data-testid="custom-title"
				/>
			</label>
		{/if}
		<p class="meters__context">
			A fair price for <strong data-testid="scenario-name">{activeScenario.name}</strong>
		</p>
		<CasualFlow
			bind:this={flow}
			ref={data.ref}
			scenario={activeScenario}
			onphase={(p) => (phase = p)}
			{onreveal}
		/>
		<p class="meters__note">Two people, one phone. Nothing you type is kept.</p>
	</section>

	<section class="how" aria-labelledby="how-title">
		<h2 id="how-title" class="how__title">Nobody sees the other side’s numbers.</h2>
		<div class="how__cols">
			<p>
				Each of you answers four quick questions: too cheap, a bargain, getting expensive, too much.
				That gives a range, not a single number, so nobody has to name their number first.
			</p>
			<p>
				Your figures stay private, securely and secretly. The instrument finds where the two ranges
				overlap and the price that is fair to both. On this free version nothing you type is kept.
			</p>
			<p><a href={resolve('/method')}>Read the method</a></p>
		</div>
	</section>

	<section class="verticals" aria-labelledby="verticals-title">
		<h2 id="verticals-title" class="verticals__title">Useful everywhere.</h2>
		<div class="verticals__grid">
			<article class="vertical vertical--recruit">
				<h3>Recruiters</h3>
				<p>
					Break the “who names a number first” standoff. Enter the client’s budget, send the
					candidate a private link, and see whether you are in range before the first call.
				</p>
				<a class="pill pill--navy" href={resolve('/recruitment')}>Try it as a recruiter</a>
			</article>
			<article class="vertical vertical--soon">
				<h3>Founders</h3>
				<p>
					Ask your first users the same four questions and get a price your market will actually
					pay.
				</p>
				<span class="vertical__soon caps">Coming next</span>
			</article>
			<article class="vertical vertical--agents">
				<h3>AI assistants</h3>
				<p>
					Let your assistant play your side. It follows the same rules you do: it can never see the
					other person's numbers.
				</p>
				<span class="vertical__soon caps">Coming next</span>
			</article>
		</div>
	</section>

	<footer class="foot">
		<span class="foot__brand">fair price broker</span>
		<nav class="foot__links" aria-label="Footer">
			<a href={resolve('/method')}>Method</a>
			<a href={resolve('/recruitment')}>For recruiters</a>
			<a href={resolve('/signin')}>Sign in</a>
		</nav>
		<span class="foot__note">Your numbers stay private. This free instrument keeps no prices.</span>
	</footer>
</main>

<style>
	.home {
		padding: 2px calc(14 * var(--u)) 60px;
	}

	/* hero ---------------------------------------------------------------- */
	.hero {
		position: relative;
		display: grid;
		grid-template-columns: calc(690 * var(--u)) 1fr;
		height: calc(450 * var(--u));
		background: var(--navy);
		border-radius: 20px;
		box-shadow: var(--lift-navy);
		color: var(--on-navy);
		overflow: hidden;
	}

	.hero__copy {
		padding: calc(77 * var(--u)) 0 0 calc(71 * var(--u));
	}

	.hero__title {
		color: var(--on-navy);
		font-size: calc(60 * var(--u));
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: nowrap;
		white-space: nowrap;
	}

	.hero__lede {
		margin-top: calc(23 * var(--u));
		font-size: calc(26 * var(--u));
		line-height: 1.3;
		color: var(--on-navy-soft);
		white-space: nowrap;
	}

	.hero__cta {
		margin-top: calc(30 * var(--u));
		height: calc(58 * var(--u));
		padding: 0 calc(34 * var(--u));
		font-size: calc(23 * var(--u));
		text-decoration: none;
	}

	.hero__cta svg {
		width: calc(24 * var(--u));
		height: calc(24 * var(--u));
	}

	.hero__caption {
		margin-top: calc(11 * var(--u));
		font-size: calc(18 * var(--u));
		font-weight: 500;
		color: var(--on-navy-soft);
	}

	.hero__reveal {
		position: relative;
		--rs: var(--u);
		margin: calc(70 * var(--u)) calc(36 * var(--u)) 0 calc(20 * var(--u));
		height: calc(301 * var(--u));
	}

	/* steps --------------------------------------------------------------- */
	.steps {
		list-style: none;
		margin: calc(30 * var(--u)) auto 0;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(22 * var(--u));
		height: calc(38 * var(--u));
	}

	.steps__step {
		display: inline-flex;
		align-items: center;
		gap: 16px;
	}

	.steps__num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(38 * var(--u));
		height: calc(38 * var(--u));
		border-radius: 50%;
		border: 2px solid var(--navy);
		color: var(--navy);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: calc(18 * var(--u));
	}

	.steps__step--current .steps__num {
		background: var(--navy);
		color: #fff;
	}

	.steps__step--done .steps__num {
		background: var(--gold);
		color: var(--navy);
	}

	.steps__line--done {
		background: var(--gold);
	}

	.steps__label {
		font-size: calc(20 * var(--u));
		font-weight: 500;
		color: var(--navy);
	}

	.steps__line {
		width: calc(60 * var(--u));
		height: 2px;
		background: var(--hairline);
	}

	/* the instrument ------------------------------------------------------ */
	.meters {
		margin: calc(22 * var(--u)) calc(53 * var(--u)) 0;
	}

	.steps {
		scroll-margin-top: 20px;
	}

	.meters__scenario {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 22px;
	}

	.meters__scenario-label {
		font-size: 15px;
		color: var(--slate);
		margin-right: 6px;
	}

	.meters__scenario-opt {
		height: 40px;
		padding: 0 18px;
		font-size: 15px;
		color: var(--navy);
		background: var(--ground);
		box-shadow: var(--raise-sm);
	}

	.meters__scenario-opt--on {
		box-shadow: var(--inset-sm);
		color: var(--navy);
		font-weight: 700;
	}

	.meters__scenario-opt:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.meters__custom {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
		margin: -6px 0 18px;
	}

	.meters__custom-label {
		font-size: 15px;
		color: var(--slate);
	}

	.meters__custom-input {
		width: min(360px, 100%);
		border: 0;
		border-radius: 12px;
		padding: 11px 14px;
		font: inherit;
		font-size: 16px;
		color: var(--ink);
	}

	.meters__custom-input:focus {
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}

	.meters__context {
		margin: -4px 0 18px;
		text-align: center;
		font-size: 17px;
		color: var(--slate);
	}

	.meters__context strong {
		color: var(--navy);
		font-weight: 700;
	}

	.meters__note {
		margin: 26px 0 0;
		text-align: center;
		color: var(--slate);
		font-size: 15px;
	}

	.hero--live {
		box-shadow:
			var(--lift-navy),
			0 0 0 3px rgba(232, 179, 75, 0.55);
	}

	/* how ----------------------------------------------------------------- */
	.how {
		margin: 110px auto 0;
		max-width: 1180px;
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: 60px;
		align-items: start;
	}

	.how__title {
		font-size: 40px;
		line-height: 1.08;
		letter-spacing: -0.02em;
	}

	.how__cols {
		display: grid;
		gap: 18px;
		font-size: 19px;
		line-height: 1.6;
		color: var(--slate);
		max-width: 62ch;
	}

	.how__cols a {
		font-weight: 600;
	}

	/* verticals ----------------------------------------------------------- */
	.verticals {
		margin: 110px auto 0;
		max-width: 1180px;
	}

	.verticals__title {
		font-size: 34px;
		line-height: 1.1;
		letter-spacing: -0.02em;
		max-width: 22ch;
	}

	.verticals__grid {
		margin-top: 36px;
		display: grid;
		grid-template-columns: 1.4fr 1fr 1fr;
		gap: 24px;
		align-items: stretch;
	}

	.vertical {
		display: grid;
		align-content: start;
		gap: 14px;
		padding: 30px;
		border-radius: 20px;
	}

	.vertical h3 {
		font-size: 24px;
	}

	.vertical p {
		font-size: 17px;
		line-height: 1.55;
		color: var(--slate);
	}

	.vertical .pill {
		justify-self: start;
		height: 48px;
		padding: 0 22px;
		font-size: 17px;
		text-decoration: none;
		margin-top: 6px;
	}

	.vertical--recruit {
		background: var(--ground);
		box-shadow: var(--raise-md);
	}

	.vertical--soon,
	.vertical--agents {
		box-shadow: var(--inset-sm);
	}

	.vertical__soon {
		justify-self: start;
		font-size: 12px;
		color: var(--mist);
		margin-top: 6px;
	}

	/* footer -------------------------------------------------------------- */
	.foot {
		margin: 110px auto 0;
		max-width: 1180px;
		padding-top: 26px;
		border-top: 1px solid var(--hairline);
		display: flex;
		align-items: center;
		gap: 30px;
		flex-wrap: wrap;
		color: var(--slate);
		font-size: 15px;
	}

	.foot__brand {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--navy);
	}

	.foot__links {
		display: flex;
		gap: 22px;
	}

	.foot__links a {
		color: var(--slate);
		text-decoration: none;
	}

	.foot__links a:hover {
		color: var(--navy);
	}

	.foot__note {
		margin-left: auto;
	}

	/* responsive (refined in the responsive phase) ------------------------ */
	@media (max-width: 1024px) {
		.hero {
			grid-template-columns: 1fr;
		}
		.hero__copy {
			padding: 48px 40px 0;
		}
		.hero__reveal {
			margin: 24px 40px 40px;
		}
		.hero {
			height: auto;
		}
		.hero__title {
			font-size: 48px;
			white-space: normal;
		}
		.hero__lede {
			font-size: 22px;
			white-space: normal;
		}
		.hero__reveal {
			--rs: 1px;
		}
		.meters {
			margin: 24px 0 0;
		}
		.how,
		.verticals__grid {
			grid-template-columns: 1fr;
		}
		.how {
			gap: 24px;
			margin-top: 80px;
		}
	}

	@media (max-width: 640px) {
		.home {
			padding: 0 10px 40px;
		}
		.hero__copy {
			padding: 32px 22px 0;
		}
		.hero__title {
			font-size: 38px;
		}
		.hero__lede {
			font-size: 18px;
		}
		.hero__cta {
			height: 52px;
			font-size: 19px;
			padding: 0 26px;
		}
		.hero__caption {
			font-size: 15px;
		}
		.hero__reveal {
			margin: 16px 16px 24px;
			height: 300px;
		}
		.steps {
			gap: 10px;
		}
		.steps__label {
			font-size: 14px;
		}
		.steps__line {
			width: 20px;
		}
		.how__title,
		.verticals__title {
			font-size: 28px;
		}
		.how,
		.verticals,
		.foot {
			margin-top: 64px;
		}
		.foot__note {
			margin-left: 0;
		}
	}
</style>
