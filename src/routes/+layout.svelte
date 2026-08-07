<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
	let accentColor = $derived(HEX_COLOR.test(data.accentColor) ? data.accentColor : '#4FE3D3');

	// Set as an inline style on <html> rather than relying on a stylesheet's
	// cascade position — inline styles always win over any stylesheet rule
	// (short of !important), so this is guaranteed to override app.css's
	// static --accent/--accent-ui regardless of injection order.
	$effect(() => {
		document.documentElement.style.setProperty('--accent', accentColor);
		document.documentElement.style.setProperty('--accent-ui', accentColor);
	});
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
