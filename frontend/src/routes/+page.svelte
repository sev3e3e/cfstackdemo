<!-- +page.svelte -->
<script lang="ts">
	export let data;
</script>

{#each data.streamed.chars as charPromise}
	{#await charPromise}
		<span>…</span>
	{:then c}
		<span>{c}</span>
	{/await}
{/each}
