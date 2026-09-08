<script lang="ts">
	import { STATE_LABEL } from './format';

	let { state }: { state: string } = $props();
</script>

<span class="badge badge--{state}">{STATE_LABEL[state] ?? state}</span>
