<script lang="ts">
	/** The four stages of a reconciliation; `current` is 1-based, 5 = done. */
	let { current, labels }: { current: number; labels: readonly string[] } = $props();
</script>

<ol class="stages" aria-label="Progress">
	{#each labels as label, i (label)}
		{#if i > 0}
			<li class="stages__line" aria-hidden="true"></li>
		{/if}
		<li
			class="stages__step"
			class:stages__step--done={i + 1 < current}
			class:stages__step--current={i + 1 === current}
			aria-current={i + 1 === current ? 'step' : undefined}
		>
			<span class="stages__num">{i + 1}</span><span>{label}</span>
		</li>
	{/each}
</ol>
