<script lang="ts">
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import { CASUAL_TEMPLATE } from '$lib/casual/casualTemplate';

	const demoRows = [
		{ key: 'too-cheap', label: 'Too cheap — I’d worry' },
		{ key: 'bargain', label: 'A bargain' },
		{ key: 'expensive', label: 'Getting expensive' },
		{ key: 'too-expensive', label: 'Too much — I’m out' }
	];
	// Illustrative positions for the sealed demo panels (no real figures).
	const yourDemo = ['340', '420', '560', '640'];
	const theirDemo = ['300', '380', '520', '600'];
	void CASUAL_TEMPLATE;
</script>

<svelte:head>
	<title>Fair Price Broker — watch two prices become one fair one</title>
	<meta
		name="description"
		content="You each set your meter in private. The instrument finds the number fair to you both. Free, sixty seconds, nothing stored."
	/>
</svelte:head>

<main class="home">
	<section class="hero" aria-labelledby="hero-title">
		<div class="hero__copy">
			<h1 id="hero-title" class="hero__title">Watch two prices<br />become one fair one.</h1>
			<p class="hero__lede">
				You each set your meter in private.<br />The instrument finds the number fair to you both.
			</p>
			<a class="pill pill--gold hero__cta" href="#set-your-meter">
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
				axis={{ min: 200, max: 800, step: 100 }}
				yours={{ lo: 210, hi: 605 }}
				theirs={{ lo: 275, hi: 785 }}
				zone={{ lo: 467, hi: 580 }}
				fair={512.5}
				variant="both"
				animate
			/>
		</div>
	</section>

	<ol class="steps" aria-label="How it works">
		<li class="steps__step steps__step--current">
			<span class="steps__num">1</span><span class="steps__label">You set yours</span>
		</li>
		<li class="steps__line" aria-hidden="true"></li>
		<li class="steps__step">
			<span class="steps__num">2</span><span class="steps__label">They set theirs</span>
		</li>
		<li class="steps__line" aria-hidden="true"></li>
		<li class="steps__step">
			<span class="steps__num">3</span><span class="steps__label">The reveal</span>
		</li>
	</ol>

	<section class="meters" id="set-your-meter" aria-label="The two meters">
		<MeterPanel title="Your meter" rows={demoRows} values={yourDemo} mode="sealed" accent="blue" />
		<div class="meters__lock" aria-hidden="true">
			<svg viewBox="0 0 34 40"
				><rect x="3" y="17" width="28" height="20" rx="4" fill="currentColor" /><path
					d="M9 17v-5a8 8 0 0 1 16 0v5"
					fill="none"
					stroke="currentColor"
					stroke-width="4"
				/></svg
			>
			<span class="caps">Both set<br />in private<br />Figures hidden<br />until reveal</span>
		</div>
		<MeterPanel
			title="Their meter"
			rows={demoRows}
			values={theirDemo}
			mode="sealed"
			accent="terracotta"
		/>
	</section>
</main>

<style>
	.home {
		padding: 2px 14px 60px;
	}

	/* hero ---------------------------------------------------------------- */
	.hero {
		position: relative;
		display: grid;
		grid-template-columns: 690px 1fr;
		height: 450px;
		background: var(--navy);
		border-radius: 20px;
		box-shadow: var(--lift-navy);
		color: var(--on-navy);
		overflow: hidden;
	}

	.hero__copy {
		padding: 77px 0 0 71px;
	}

	.hero__title {
		color: var(--on-navy);
		font-size: 60px;
		line-height: 0.98;
		letter-spacing: -0.035em;
		text-wrap: nowrap;
		white-space: nowrap;
	}

	.hero__lede {
		margin-top: 23px;
		font-size: 26px;
		line-height: 1.3;
		color: var(--on-navy-soft);
		white-space: nowrap;
	}

	.hero__cta {
		margin-top: 30px;
		height: 58px;
		padding: 0 34px;
		font-size: 23px;
		text-decoration: none;
	}

	.hero__cta svg {
		width: 24px;
		height: 24px;
	}

	.hero__caption {
		margin-top: 11px;
		font-size: 18px;
		font-weight: 500;
		color: var(--on-navy-soft);
	}

	.hero__reveal {
		position: relative;
		margin: 70px 36px 0 20px;
		height: 301px;
	}

	/* steps --------------------------------------------------------------- */
	.steps {
		list-style: none;
		margin: 30px auto 0;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 22px;
		height: 38px;
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
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 2px solid var(--navy);
		color: var(--navy);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 18px;
	}

	.steps__step--current .steps__num {
		background: var(--navy);
		color: #fff;
	}

	.steps__label {
		font-size: 20px;
		font-weight: 500;
		color: var(--navy);
	}

	.steps__line {
		width: 60px;
		height: 2px;
		background: var(--hairline);
	}

	/* meters -------------------------------------------------------------- */
	.meters {
		display: grid;
		grid-template-columns: 1fr 166px 1fr;
		align-items: start;
		margin: 22px 53px 0;
	}

	.meters__lock {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding-top: 62px;
		color: var(--slate);
		text-align: center;
		font-size: 12px;
		letter-spacing: 0.16em;
		line-height: 1.6;
	}

	.meters__lock svg {
		width: 34px;
		height: 40px;
	}

	/* responsive (refined in the responsive phase) ------------------------ */
	@media (max-width: 1280px) {
		.hero {
			grid-template-columns: 1fr;
		}
		.hero__copy {
			padding: 48px 40px 0;
		}
		.hero__reveal {
			margin: 24px 40px 40px;
		}
		.meters {
			grid-template-columns: 1fr;
			gap: 24px;
			margin: 24px 0 0;
		}
		.meters__lock {
			padding-top: 0;
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
			height: 260px;
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
	}
</style>
