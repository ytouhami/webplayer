<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		title,
		expiryLabel,
		activePage
	}: { title: string; expiryLabel: string; activePage: 'live' | 'epg' } = $props();

	let theme = $state<'light' | 'dark'>('dark');
	$effect(() => {
		theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'dark';
	});
	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('pulse-theme', theme);
	}

	let refreshing = $state(false);

	let tvGuideLinkEl: HTMLAnchorElement;
	let refreshFormEl: HTMLFormElement;
	let logoutFormEl: HTMLFormElement;

	// TV remote colored buttons — key names/codes for these are inconsistent
	// across platforms (Tizen/webOS use named keys like "ColorF0Red", some
	// Android TV/HbbTV-derived browsers only send the legacy numeric
	// keyCodes 403/404/405/406), so both are checked. Mapping: Red=Logout
	// (the usual "exit/stop" association with red), Green=Refresh,
	// Yellow=TV Guide, Blue=theme toggle.
	const COLOR_KEY_NAMES: Record<string, 'red' | 'green' | 'yellow' | 'blue'> = {
		ColorF0Red: 'red',
		Red: 'red',
		ColorF1Green: 'green',
		Green: 'green',
		ColorF2Yellow: 'yellow',
		Yellow: 'yellow',
		ColorF3Blue: 'blue',
		Blue: 'blue'
	};
	const COLOR_KEY_CODES: Record<number, 'red' | 'green' | 'yellow' | 'blue'> = {
		403: 'red',
		404: 'green',
		405: 'yellow',
		406: 'blue'
	};

	$effect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			// keyCode/which are deprecated on the DOM spec but are still what
			// several TV browsers' embedded WebKit builds actually send for
			// these — event.key alone isn't reliable enough across Tizen/
			// webOS/Fire TV/generic Android TV browsers to trust on its own.
			const color = COLOR_KEY_NAMES[e.key] ?? COLOR_KEY_CODES[e.keyCode] ?? COLOR_KEY_CODES[e.which];
			if (!color) return;
			e.preventDefault();

			if (color === 'red') logoutFormEl.requestSubmit();
			else if (color === 'green') {
				if (!refreshing) refreshFormEl.requestSubmit();
			} else if (color === 'yellow') tvGuideLinkEl.click();
			else if (color === 'blue') toggleTheme();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<header class="topbar">
	<span class="topbar-title">{title}</span>
	<span class="expiry">Subscription: <b>{expiryLabel}</b></span>
	<div class="topbar-spacer"></div>

	<a href="/live" class="topbar-action action-live" class:active={activePage === 'live'} title="Live TV">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 3 4-3"/><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/></svg>
		Live TV
	</a>
	<a href="/epg" class="topbar-action action-guide" class:active={activePage === 'epg'} title="TV Guide (Yellow)" bind:this={tvGuideLinkEl}>
		<span class="remote-dot remote-dot-yellow"></span>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>
		TV Guide
	</a>
	<form
		method="POST"
		action="?/refresh"
		bind:this={refreshFormEl}
		use:enhance={() => {
			refreshing = true;
			return async ({ update }) => {
				await update();
				refreshing = false;
			};
		}}
	>
		<button class="topbar-action action-refresh" class:is-refreshing={refreshing} disabled={refreshing} type="submit" title="Refresh playlist (Green)">
			<span class="remote-dot remote-dot-green"></span>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11A8 8 0 1 0 18.5 16"/><path d="M20 5v6h-6"/></svg>
			Refresh
		</button>
	</form>
	<form method="POST" action="?/logout" bind:this={logoutFormEl}>
		<button class="icon-btn" type="submit" title="Log out (Red)" aria-label="Log out">
			<span class="remote-dot remote-dot-red"></span>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
		</button>
	</form>
	<button
		class="icon-btn"
		title={(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode') + ' (Blue)'}
		aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
		onclick={toggleTheme}
	>
		<span class="remote-dot remote-dot-blue"></span>
		{#if theme === 'light'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
		{/if}
	</button>
</header>

<style>
	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		min-width: 0;
	}
	.topbar-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.95rem;
	}
	.expiry {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-faint);
		padding-left: 1.25rem;
		border-left: 1px solid var(--border);
	}
	.expiry b {
		color: var(--text-dim);
	}
	.topbar-spacer {
		flex: 1;
	}
	.icon-btn {
		position: relative;
		width: 2.3rem;
		height: 2.3rem;
		border-radius: 50%;
		background: var(--veil-a);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-dim);
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.icon-btn svg {
		width: 1rem;
		height: 1rem;
	}
	.icon-btn:hover {
		color: var(--accent-ui);
		border-color: var(--accent-ui);
	}
	.icon-btn:disabled {
		cursor: progress;
		opacity: 0.7;
	}

	.topbar-action {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		border: 1px solid transparent;
		background: color-mix(in srgb, var(--action-color) 12%, transparent);
		border-color: color-mix(in srgb, var(--action-color) 30%, transparent);
		color: var(--action-color);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	.topbar-action svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}
	.topbar-action:hover {
		background: color-mix(in srgb, var(--action-color) 20%, transparent);
		border-color: var(--action-color);
	}
	.topbar-action:disabled {
		cursor: progress;
		opacity: 0.7;
	}
	.topbar-action.active {
		background: color-mix(in srgb, var(--action-color) 28%, transparent);
		border-color: var(--action-color);
	}
	.action-live {
		--action-color: #20d9c6;
	}
	.action-guide {
		--action-color: #9c8cfb;
	}
	.action-refresh {
		--action-color: #5ad1e6;
	}
	.action-refresh.is-refreshing svg {
		animation: iconRefreshSpin 0.9s linear infinite;
	}
	@keyframes iconRefreshSpin {
		to {
			transform: rotate(360deg);
		}
	}

	/* TV remote colored-button indicators — a small dot badge on whichever
	   header button that color activates, so the mapping is visible instead
	   of something the user has to be told or guess at. */
	.remote-dot {
		position: absolute;
		top: -3px;
		right: -3px;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		border: 1.5px solid var(--bg);
		pointer-events: none;
	}
	.remote-dot-red {
		background: #e5484d;
	}
	.remote-dot-green {
		background: #46a758;
	}
	.remote-dot-yellow {
		background: #ffd60a;
	}
	.remote-dot-blue {
		background: #3b82f6;
	}

	@media (max-width: 880px) {
		.topbar {
			padding: 0.85rem 1rem;
			gap: 0.5rem 0.6rem;
		}
		.expiry {
			display: none;
		}
		.topbar-action {
			padding: 0.45rem 0.7rem;
			font-size: 0.75rem;
		}
	}
</style>
