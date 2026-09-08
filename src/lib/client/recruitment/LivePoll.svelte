<script lang="ts">
	/**
	 * Re-runs the page's load functions every `every` ms while `active`,
	 * so a waiting page follows the other party without a manual reload.
	 */
	import { invalidateAll } from '$app/navigation';

	let { active = true, every = 4000 }: { active?: boolean; every?: number } = $props();

	$effect(() => {
		if (!active) return;
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') void invalidateAll();
		}, every);
		return () => clearInterval(id);
	});
</script>
