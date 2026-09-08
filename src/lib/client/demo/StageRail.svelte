<script lang="ts">
	/**
	 * The progress rail: five stages, each tinted for the hat you wear
	 * (blue recruiter, terracotta candidate). Completed stages fill; the
	 * current one carries a ring. Completion is the reward — no points.
	 */
	import type { DemoStage } from '$lib/server/demo/demoAnswers';
	import { DEMO_STAGE_CONTENT } from './demoStages';

	let { current, done = false }: { current: DemoStage; done?: boolean } = $props();
</script>

<ol class="rail" aria-label="Walkthrough progress">
	{#each DEMO_STAGE_CONTENT as s (s.stage)}
		{@const complete = done || s.stage < current}
		{@const active = !done && s.stage === current}
		<li
			class="rail__stage rail__stage--{s.hat}"
			class:rail__stage--complete={complete}
			class:rail__stage--active={active}
			aria-current={active ? 'step' : undefined}
		>
			<span class="rail__dot" aria-hidden="true">
				{#if complete}
					<svg viewBox="0 0 16 16"
						><path
							d="M3.5 8.5l3 3 6-7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				{:else}
					{s.stage}
				{/if}
			</span>
			<span class="rail__name">{s.name}</span>
			<span class="sr-only">
				{complete ? 'complete' : active ? 'current stage' : 'not yet'}
			</span>
		</li>
	{/each}
</ol>

<style>
	.rail {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}

	.rail__stage {
		--hat: var(--blue);
		--hat-soft: rgba(61, 90, 128, 0.18);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding-top: 4px;
		color: var(--mist);
		border-top: 3px solid var(--hairline);
		transition: border-color var(--dur-fast) var(--ease-out);
	}

	.rail__stage--candidate {
		--hat: var(--terracotta);
		--hat-soft: rgba(183, 105, 82, 0.18);
	}

	.rail__stage--complete,
	.rail__stage--active {
		border-top-color: var(--hat);
		color: var(--ink);
	}

	.rail__dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 14px;
		color: var(--mist);
		background: var(--ground);
		box-shadow: var(--inset-sm);
	}

	.rail__dot svg {
		width: 16px;
		height: 16px;
	}

	.rail__stage--active .rail__dot {
		color: var(--hat);
		box-shadow:
			var(--raise-sm),
			0 0 0 3px var(--hat-soft);
	}

	.rail__stage--complete .rail__dot {
		color: #fff;
		background: var(--hat);
		box-shadow: var(--raise-sm);
	}

	.rail__name {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.02em;
		text-align: center;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		.rail__name {
			font-size: 11px;
		}
		.rail__dot {
			width: 26px;
			height: 26px;
			font-size: 12px;
		}
	}
</style>
