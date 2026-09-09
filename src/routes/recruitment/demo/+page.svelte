<script lang="ts">
	/**
	 * The recruiter walkthrough (T3-m1-recruitment-demo §1): a client-driven
	 * state machine over the seed spec's five stages. One visitor plays both
	 * hats. Each Continue POSTs that stage's answers before advancing
	 * (best effort); stage 4 reconciles both tuples server-side.
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import { recruitmentTemplate, RECRUITMENT_DIRECTION } from '$lib/templates/recruitment';
	import type { DemoAnswerValue, DemoStage } from '$lib/server/demo/demoAnswers';
	import type { DemoReconcileView } from '$lib/server/demo/demoReconcile';
	import {
		asRawTuple,
		engineErrorMessage,
		formatSalary,
		mintUuid,
		niceAxis,
		reconcileDemo,
		submitStage,
		usableRef,
		validateSalaryTuple
	} from '$lib/client/demo/demoClient';
	import { OVERLAP_LABEL, stageContent } from '$lib/client/demo/demoStages';
	import StageRail from '$lib/client/demo/StageRail.svelte';
	import DirectedQuestions from '$lib/client/demo/DirectedQuestions.svelte';

	let { data }: { data: { ref: string | null } } = $props();

	const budgetRows = recruitmentTemplate.questions[RECRUITMENT_DIRECTION.budget].map((q) => ({
		key: q.key,
		label: q.label,
		help: q.prompt
	}));
	const candidateRows = recruitmentTemplate.questions[RECRUITMENT_DIRECTION.candidate].map((q) => ({
		key: q.key,
		label: q.label,
		help: q.prompt
	}));

	// identity ----------------------------------------------------------------
	let demoId = $state('');
	const ref = $derived(usableRef(data.ref));
	let reducedMotion = $state(false);
	let narrow = $state(false);
	onMount(() => {
		demoId = mintUuid();
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const width = window.matchMedia('(max-width: 640px)');
		reducedMotion = motion.matches;
		narrow = width.matches;
		const onMotion = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
		const onWidth = (e: MediaQueryListEvent) => (narrow = e.matches);
		motion.addEventListener('change', onMotion);
		width.addEventListener('change', onWidth);
		return () => {
			motion.removeEventListener('change', onMotion);
			width.removeEventListener('change', onWidth);
		};
	});

	// machine -----------------------------------------------------------------
	let stage = $state<DemoStage>(1);
	let done = $state(false);
	let busy = $state(false);
	const content = $derived(stageContent(stage));

	let budgetValues = $state<(string | null)[]>([null, null, null, null]);
	let candidateValues = $state<(string | null)[]>([null, null, null, null]);
	let budgetAttempted = $state(false);
	let candidateAttempted = $state(false);
	let candidateServerError = $state<string | null>(null);

	const budgetValidation = $derived(validateSalaryTuple(budgetValues));
	const candidateValidation = $derived(validateSalaryTuple(candidateValues));
	const budgetError = $derived(
		budgetAttempted && !budgetValidation.ok ? budgetValidation.message : null
	);
	const candidateError = $derived(
		candidateServerError ??
			(candidateAttempted && !candidateValidation.ok ? candidateValidation.message : null)
	);

	const meterMax = (values: (string | null)[]) => {
		const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
		const top = nums.length ? Math.max(...nums) : 0;
		return Math.max(100000, Math.ceil((top * 1.25) / 5000) * 5000);
	};

	let answers = $state<Record<number, Record<string, DemoAnswerValue>>>({
		1: {},
		2: {},
		3: {},
		4: {},
		5: {}
	});
	let comments = $state<Record<number, string>>({ 1: '', 2: '', 3: '', 4: '', 5: '' });

	let reveal = $state<DemoReconcileView | null>(null);

	// reveal geometry ---------------------------------------------------------
	const revealAxis = $derived.by(() => {
		if (!reveal) return { min: 0, max: 100000, step: 20000 };
		const nums = [...reveal.budgetTuple, ...reveal.candidateTuple].map(Number);
		const a = niceAxis([...nums, reveal.fairPrice.float]);
		// The shared canvas draws every tick; on a phone six labels collide.
		return narrow ? { ...a, step: a.step * 2 } : a;
	});
	const budgetRange = $derived(
		reveal ? { lo: Number(reveal.budgetTuple[0]), hi: Number(reveal.budgetTuple[3]) } : null
	);
	const candidateRange = $derived(
		reveal ? { lo: Number(reveal.candidateTuple[0]), hi: Number(reveal.candidateTuple[3]) } : null
	);
	const zoneRange = $derived(
		reveal && reveal.zone !== 'no-deal'
			? { lo: reveal.overlapLow.float, hi: reveal.overlapHigh.float }
			: null
	);

	// submission --------------------------------------------------------------
	function record(s: DemoStage) {
		const c = comments[s].trim();
		return submitStage({
			demoId,
			stage: s,
			answers: { ...answers[s] },
			comment: c === '' ? null : c,
			ref,
			idempotencyKey: mintUuid()
		});
	}

	function advance(next: DemoStage | 'done') {
		if (next === 'done') done = true;
		else stage = next;
		window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
	}

	async function onContinue(e: Event) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		try {
			if (stage === 1) {
				budgetAttempted = true;
				if (!budgetValidation.ok) return;
				await record(1);
				advance(2);
			} else if (stage === 2) {
				await record(2);
				advance(3);
			} else if (stage === 3) {
				candidateAttempted = true;
				candidateServerError = null;
				if (!candidateValidation.ok) return;
				const out = await reconcileDemo(asRawTuple(budgetValues), asRawTuple(candidateValues));
				if (!out.ok) {
					candidateServerError = engineErrorMessage(out.error.kind);
					return;
				}
				reveal = out.view;
				await record(3);
				advance(4);
			} else if (stage === 4) {
				await record(4);
				advance(5);
			} else {
				await record(5);
				advance('done');
			}
		} finally {
			busy = false;
		}
	}

	const continueLabel = $derived(
		(
			{
				1: 'Send the candidate link',
				2: 'Now you’re the candidate',
				3: 'See what the recruiter sees',
				4: 'Continue',
				5: 'Finish'
			} as const
		)[stage]
	);
</script>

<svelte:head>
	<title>Try it as a recruiter — Fair Price Broker</title>
	<meta
		name="description"
		content="Play both sides of a salary alignment: enter a client budget, switch hats, answer as the candidate, then see the overlap the recruiter gets."
	/>
</svelte:head>

<main
	class="demo demo--{content.hat}"
	data-demo-id={demoId}
	data-demo-stage={done ? 'done' : stage}
	data-demo-hat={content.hat}
>
	<div class="demo__rail">
		<StageRail current={stage} {done} />
		{#if !done}
			<span class="demo__hat inset caps" data-demo-hat-label>
				{content.hat === 'recruiter' ? 'Recruiter hat' : 'Candidate hat'}
			</span>
		{/if}
	</div>

	{#if done}
		<section class="stage stage--done" aria-labelledby="done-title">
			<h1 id="done-title" class="stage__title">Thank you. That was the whole thing.</h1>
			<p class="stage__lede">
				Everything you answered has been kept, marked as demo data, and will shape what gets built
				next. Nothing you entered counts as a real placement.
			</p>
			<div class="stage__actions">
				<a class="pill pill--gold stage__continue" href={resolve('/signin')}>Start free</a>
				<a class="stage__back" href={resolve('/recruitment')}>Back to the recruiters page</a>
			</div>
		</section>
	{:else}
		<form class="stage" onsubmit={onContinue} aria-labelledby="stage-title">
			<h1 id="stage-title" class="stage__title">{content.heading}</h1>

			{#if stage === 2}
				<p class="stage__lede">{content.framing[0]}</p>
			{:else}
				{#each content.framing as para, i (i)}
					<p class="stage__lede">{para}</p>
				{/each}
			{/if}

			<!-- stage 1: employer budget, blue ------------------------------------ -->
			{#if stage === 1}
				<div class="entry entry--blue">
					<MeterPanel
						title="Employer budget"
						rows={budgetRows}
						bind:values={budgetValues}
						mode="entry"
						accent="blue"
						min={0}
						max={meterMax(budgetValues)}
						step={500}
						example={[40000, 48000, 58000, 65000]}
						error={budgetError}
					/>
					<p class="entry__note">
						These are the client’s figures, not the candidate’s. Drag, turn, or tap to type.
					</p>
				</div>

				<!-- stage 2: the link, then the hand-off -------------------------------- -->
			{:else if stage === 2}
				<div class="link raised" aria-label="What the candidate receives">
					<p class="link__from">A message from you to the candidate</p>
					<p class="link__body">
						Before we talk numbers, could you answer four quick questions about salary? It takes a
						minute, and it means neither of us has to guess.
					</p>
					<span class="link__url inset">
						<svg viewBox="0 0 12 14" aria-hidden="true"
							><rect x="1" y="6" width="10" height="7" rx="1.6" fill="currentColor" /><path
								d="M3 6V4a3 3 0 0 1 6 0v2"
								fill="none"
								stroke="currentColor"
								stroke-width="1.6"
							/></svg
						>
						fairprice.broker/s/…
					</span>
					<p class="link__note">
						Private to the candidate. Opens their side of the instrument; your figures never travel
						with it.
					</p>
				</div>

				<div class="handoff">
					<p class="stage__lede">{content.framing[1]}</p>
				</div>

				<!-- stage 3: disclosure and incentive first, then the candidate meter --- -->
			{:else if stage === 3}
				<div class="candidate raised" data-candidate-preamble>
					<h2 class="candidate__title">Read first, as the candidate does</h2>
					<h3 class="candidate__heading">{recruitmentTemplate.disclosure.heading}</h3>
					<p class="candidate__body">{recruitmentTemplate.disclosure.body}</p>
					<h3 class="candidate__heading">{recruitmentTemplate.incentive.heading}</h3>
					<p class="candidate__body">{recruitmentTemplate.incentive.body}</p>
				</div>

				<div class="entry entry--terracotta">
					<MeterPanel
						title="Your expectations"
						rows={candidateRows}
						bind:values={candidateValues}
						mode="entry"
						accent="terracotta"
						min={0}
						max={meterMax(candidateValues)}
						step={500}
						example={[45000, 52000, 60000, 75000]}
						error={candidateError}
					/>
					<p class="entry__note">
						Your own figures, for the role you imagine. Drag, turn, or tap to type.
					</p>
				</div>

				<!-- stage 4: the recruiter's result, and the candidate's beside it ------ -->
			{:else if stage === 4 && reveal && budgetRange && candidateRange}
				<div class="result" data-demo-result>
					<div class="result__canvas">
						<RevealCanvas
							axis={revealAxis}
							yours={budgetRange}
							theirs={candidateRange}
							zone={zoneRange}
							fair={reveal.fairPrice.float}
							fairLabel={formatSalary(reveal.fairPrice.float)}
							yourLabel="Employer budget"
							theirLabel="Candidate"
							zoneLabel="Overlap"
							variant="both"
							compact
							animate={!reducedMotion}
						/>
					</div>

					<div class="result__read">
						<section class="read read--host raised" aria-labelledby="host-read">
							<h2 id="host-read" class="read__title">What the recruiter sees</h2>
							<dl class="read__facts">
								<div>
									<dt>Fair salary</dt>
									<dd class="read__fair">{formatSalary(reveal.fairPrice.float)}</dd>
								</div>
								<div>
									<dt>Overlap</dt>
									<dd data-overlap-level>{OVERLAP_LABEL[reveal.guidance.overlap]}</dd>
								</div>
								<div>
									<dt>Non-salary factors</dt>
									<dd data-non-remuneration>
										{reveal.guidance.nonRemunerationInPlay
											? 'Need to be in play'
											: 'Not needed to close'}
									</dd>
								</div>
							</dl>
							<p class="read__copy" data-host-copy>{reveal.guidance.hostCopy}</p>
							<p class="read__figures">
								Budget {formatSalary(budgetRange.lo)}–{formatSalary(budgetRange.hi)} · Candidate
								{formatSalary(candidateRange.lo)}–{formatSalary(candidateRange.hi)}
							</p>
						</section>

						<section class="read read--party raised" aria-labelledby="party-read">
							<h2 id="party-read" class="read__title">What the candidate sees</h2>
							<dl class="read__facts">
								<div>
									<dt>Fair salary</dt>
									<dd class="read__fair">{formatSalary(reveal.fairPrice.float)}</dd>
								</div>
								<div>
									<dt>Overlap</dt>
									<dd>{OVERLAP_LABEL[reveal.guidance.overlap]}</dd>
								</div>
							</dl>
							<p class="read__copy" data-party-copy>{reveal.guidance.partyCopy}</p>
							<p class="read__figures">The employer’s budget is never shown here.</p>
						</section>
					</div>
				</div>
			{/if}

			<div class="stage__questions">
				<DirectedQuestions
					{stage}
					questions={content.questions}
					bind:answers={answers[stage]}
					bind:comment={comments[stage]}
				/>
			</div>

			<div class="stage__actions">
				<button class="pill pill--gold stage__continue" type="submit" disabled={busy}>
					{busy ? 'One moment…' : continueLabel}
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
				</button>
				<span class="stage__count">Stage {stage} of 5</span>
			</div>
		</form>
	{/if}
</main>

<style>
	.demo {
		max-width: 1040px;
		margin: 0 auto;
		padding: 14px 20px 80px;
	}

	.demo__rail {
		margin-bottom: 36px;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 24px;
	}

	.demo__hat {
		font-size: 12px;
		letter-spacing: 0.18em;
		color: var(--blue);
		padding: 9px 16px;
		border-radius: var(--radius-pill);
	}

	.demo--candidate .demo__hat {
		color: var(--terracotta);
	}

	.stage {
		display: grid;
		gap: 22px;
		animation: stage-in 420ms var(--ease-out) both;
	}

	@keyframes stage-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.stage__title {
		font-size: 40px;
		line-height: 1.02;
		letter-spacing: -0.03em;
	}

	.stage__lede {
		font-size: 19px;
		line-height: 1.5;
		color: var(--slate);
		max-width: 66ch;
	}

	/* meter entry --------------------------------------------------------- */
	.entry {
		margin-top: 8px;
		display: grid;
		gap: 12px;
	}

	.entry__note {
		font-size: 14px;
		color: var(--slate);
		padding-left: 6px;
	}

	/* stage 2: the link ---------------------------------------------------- */
	.link {
		padding: 26px 30px 24px;
		display: grid;
		gap: 12px;
		max-width: 560px;
	}

	.link__from {
		font-size: 13px;
		color: var(--slate);
	}

	.link__body {
		font-size: 17px;
		line-height: 1.5;
		color: var(--ink);
	}

	.link__url {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		justify-self: start;
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 15px;
		color: var(--terracotta);
	}

	.link__url svg {
		width: 12px;
		height: 14px;
	}

	.link__note {
		font-size: 14px;
		color: var(--slate);
	}

	.handoff {
		margin-top: 8px;
		padding-top: 24px;
		border-top: 1px solid var(--hairline);
	}

	/* stage 3: what the candidate reads first ------------------------------ */
	.candidate {
		padding: 28px 32px 30px;
		display: grid;
		gap: 10px;
	}

	.candidate__title {
		font-size: 20px;
		letter-spacing: -0.01em;
		color: var(--terracotta);
		margin-bottom: 6px;
	}

	.candidate__heading {
		font-size: 22px;
		letter-spacing: -0.01em;
		margin-top: 8px;
	}

	.candidate__body {
		font-size: 17px;
		line-height: 1.55;
		color: var(--ink);
		max-width: 66ch;
	}

	/* stage 4: the result -------------------------------------------------- */
	.result {
		display: grid;
		gap: 22px;
	}

	.result__canvas {
		position: relative;
		height: 380px;
		padding: 36px 24px 36px 28px;
		background: var(--navy);
		border-radius: 20px;
		box-shadow: var(--lift-navy);
		overflow: hidden;
	}

	.result__read {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 22px;
		align-items: start;
	}

	.read {
		padding: 26px 28px 28px;
		display: grid;
		gap: 16px;
	}

	.read__title {
		font-size: 20px;
		letter-spacing: -0.01em;
	}

	.read--host .read__title {
		color: var(--blue);
	}

	.read--party .read__title {
		color: var(--terracotta);
	}

	.read__facts {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 18px 28px;
	}

	.read__facts div {
		display: grid;
		gap: 4px;
	}

	.read__facts dt {
		font-size: 13px;
		color: var(--slate);
	}

	.read__facts dd {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 19px;
		color: var(--navy);
	}

	.read__fair {
		color: var(--navy);
		background: var(--gold-2);
		padding: 2px 10px;
		border-radius: 8px;
		justify-self: start;
	}

	.read__copy {
		font-size: 16px;
		line-height: 1.55;
		color: var(--ink);
	}

	.read__figures {
		font-size: 14px;
		color: var(--slate);
	}

	/* questions and actions ----------------------------------------------- */
	.stage__questions {
		margin-top: 10px;
		padding-top: 26px;
		border-top: 1px solid var(--hairline);
	}

	.stage__actions {
		margin-top: 10px;
		display: flex;
		align-items: center;
		gap: 22px;
		flex-wrap: wrap;
	}

	.stage__continue {
		height: 54px;
		padding: 0 30px;
		font-size: 20px;
		text-decoration: none;
	}

	.stage__continue[disabled] {
		opacity: 0.7;
		cursor: progress;
	}

	.stage__continue svg {
		width: 22px;
		height: 22px;
	}

	.stage__count {
		font-size: 15px;
		color: var(--slate);
	}

	.stage__back {
		font-size: 16px;
		color: var(--slate);
	}

	@media (max-width: 860px) {
		.result__read {
			grid-template-columns: 1fr;
		}
		.result__canvas {
			height: 300px;
			padding: 30px 12px 0 20px;
		}
	}

	@media (max-width: 640px) {
		.demo {
			padding: 10px 14px 60px;
		}
		.demo__rail {
			grid-template-columns: 1fr;
			gap: 14px;
		}
		.demo__hat {
			justify-self: start;
		}
		.stage__title {
			font-size: 30px;
		}
		.stage__lede {
			font-size: 17px;
		}
		.entry :global(.row) {
			grid-template-columns: 1fr 100px;
		}
		.link,
		.candidate,
		.read {
			padding: 20px 20px 22px;
		}
		.result__canvas {
			height: 280px;
		}
		.stage__continue {
			height: 50px;
			font-size: 18px;
			padding: 0 24px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage {
			animation: none;
		}
	}
</style>
