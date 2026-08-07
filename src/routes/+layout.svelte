<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
	let accentColor = $derived(HEX_COLOR.test(data.accentColor) ? data.accentColor : '#4FE3D3');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<style>
		:root {
			--accent: {accentColor};
			--accent-ui: {accentColor};
		}
	</style>
</svelte:head>

{@render children()}
