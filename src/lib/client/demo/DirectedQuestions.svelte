<script lang="ts">
	/**
	 * A stage's directed questions plus its comment box. Closed questions
	 * are pill choices (yes/no, 1–5, or a short list); open ones are text.
	 * Answers are optional: the walkthrough never stalls on a question.
	 */
	import type { DemoAnswerValue } from '$lib/server/demo/demoAnswers';
	import type { DirectedQuestion } from './demoStages';

	let {
		stage,
		questions,
		answers = $bindable<Record<string, DemoAnswerValue>>({}),
		comment = $bindable<string>('')
	}: {
		stage: number;
		questions: readonly DirectedQuestion[];
		answers?: Record<string, DemoAnswerValue>;
		comment?: string;
	} = $props();

	const idFor = (key: string) => `q${stage}-${key}`;
	const scaleSteps = [1, 2, 3, 4, 5];

	function set(key: string, value: DemoAnswerValue) {
		answers = { ...answers, [key]: answers[key] === value ? null : value };
	}
</script>

<div class="questions" data-questions-stage={stage}>
	<h3 class="questions__title">A couple of quick questions</h3>

	{#each questions as q (q.key)}
		<div class="q">
			{#if q.kind === 'text'}
				<label class="q__prompt" for={idFor(q.key)}>{q.prompt}</label>
				<textarea
					id={idFor(q.key)}
					class="q__text inset"
					rows="2"
					value={typeof answers[q.key] === 'string' ? String(answers[q.key]) : ''}
					oninput={(e) => {
						const v = (e.currentTarget as HTMLTextAreaElement).value;
						answers = { ...answers, [q.key]: v.trim() === '' ? null : v };
					}}></textarea>
			{:else}
				<fieldset class="q__set">
					<legend class="q__prompt">{q.prompt}</legend>
					<div class="q__options" role="group">
						{#if q.kind === 'yesno'}
							{#each [true, false] as v (String(v))}
								<button
									type="button"
									class="opt pill"
									class:opt--on={answers[q.key] === v}
									aria-pressed={answers[q.key] === v}
									onclick={() => set(q.key, v)}
								>
									{v ? 'Yes' : 'No'}
								</button>
							{/each}
						{:else if q.kind === 'scale'}
							<span class="q__anchor">{q.low}</span>
							{#each scaleSteps as n (n)}
								<button
									type="button"
									class="opt opt--num pill"
									class:opt--on={answers[q.key] === n}
									aria-pressed={answers[q.key] === n}
									aria-label={`${n} of 5`}
									onclick={() => set(q.key, n)}
								>
									{n}
								</button>
							{/each}
							<span class="q__anchor">{q.high}</span>
						{:else}
							{#each q.options as opt (opt)}
								<button
									type="button"
									class="opt pill"
									class:opt--on={answers[q.key] === opt}
									aria-pressed={answers[q.key] === opt}
									onclick={() => set(q.key, opt)}
								>
									{opt}
								</button>
							{/each}
						{/if}
					</div>
				</fieldset>
			{/if}
		</div>
	{/each}

	<div class="q">
		<label class="q__prompt" for={idFor('comment')}>Anything else about this step?</label>
		<textarea
			id={idFor('comment')}
			class="q__text inset"
			rows="2"
			placeholder="Optional"
			bind:value={comment}></textarea>
	</div>
</div>

<style>
	.questions {
		display: grid;
		gap: 22px;
	}

	.questions__title {
		font-size: 20px;
		letter-spacing: -0.01em;
	}

	.q {
		display: grid;
		gap: 10px;
	}

	.q__set {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	.q__prompt {
		font-size: 17px;
		line-height: 1.4;
		color: var(--ink);
		padding: 0;
	}

	.q__options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.q__anchor {
		font-size: 13px;
		color: var(--slate);
		padding: 0 4px;
	}

	.opt {
		height: 40px;
		padding: 0 18px;
		font-size: 15px;
		color: var(--slate);
		background: var(--ground);
		box-shadow: var(--raise-sm);
	}

	.opt--num {
		width: 40px;
		padding: 0;
	}

	.opt:hover {
		color: var(--navy);
	}

	.opt--on {
		color: var(--navy);
		box-shadow: var(--inset-md);
	}

	.q__text {
		width: 100%;
		border: 0;
		border-radius: var(--radius-md);
		padding: 12px 14px;
		font-size: 16px;
		line-height: 1.45;
		color: var(--ink);
		resize: vertical;
		min-height: 60px;
	}

	.q__text::placeholder {
		color: var(--mist);
	}

	.q__text:focus {
		outline: 3px solid var(--gold);
		outline-offset: 2px;
	}

	@media (max-width: 480px) {
		.opt {
			height: 38px;
			padding: 0 14px;
			font-size: 14px;
		}
		.q__anchor {
			flex-basis: 100%;
		}
	}
</style>
