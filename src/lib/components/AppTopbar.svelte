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

	// "Make Icon" (install to home screen). Only shown where it can
	// actually do something:
	//  - Chromium (desktop Chrome/Edge, Android Chrome): fires
	//    beforeinstallprompt when the page qualifies as installable — we
	//    capture that event and re-trigger it on click.
	//  - iOS Safari: never fires beforeinstallprompt, no JS API exists to
	//    trigger "Add to Home Screen" there at all — the only thing
	//    possible is showing the manual steps, so the button is shown but
	//    behaves differently.
	//  - Everything else (TV browsers — Tizen, webOS, most Android TV/Fire
	//    TV browsers, and any other browser that doesn't support install):
	//    hidden entirely rather than showing a button that can't do
	//    anything. This is a positive allowlist (only show where support
	//    is confirmed or well-known), not a blocklist of every TV
	//    platform's user-agent string, since that list is impossible to
	//    keep complete/accurate.
	let installPrompt = $state<Event | null>(null);
	let isIOS = $state(false);
	let isStandalone = $state(false);
	let showIOSInstructions = $state(false);

	$effect(() => {
		const nav = navigator as Navigator & { standalone?: boolean };
		isStandalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
		// iPadOS reports as "Macintosh" in the UA but is touch-capable,
		// unlike a real Mac — the standard way to tell them apart.
		isIOS =
			/iphone|ipad|ipod/i.test(navigator.userAgent) ||
			(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

		function onBeforeInstallPrompt(e: Event) {
			e.preventDefault();
			installPrompt = e;
		}
		function onInstalled() {
			installPrompt = null;
			isStandalone = true;
		}
		window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	let showInstallButton = $derived(!isStandalone && (installPrompt !== null || isIOS));

	async function handleInstallClick() {
		if (installPrompt) {
			const prompt = installPrompt as Event & {
				prompt: () => Promise<void>;
				userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
			};
			installPrompt = null;
			await prompt.prompt();
			await prompt.userChoice;
		} else if (isIOS) {
			showIOSInstructions = true;
		}
	}

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

	<a href="/live" class="topbar-action" class:active={activePage === 'live'} title="Live TV">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 3 4-3"/><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/></svg>
		Live TV
	</a>
	<a href="/epg" class="topbar-action" class:active={activePage === 'epg'} title="TV Guide (Yellow)" bind:this={tvGuideLinkEl}>
		<span class="remote-dot remote-dot-yellow"></span>
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
		<button class="topbar-action" disabled={refreshing} type="submit" title="Refresh playlist (Green)">
			<span class="remote-dot remote-dot-green"></span>
			{refreshing ? 'Refreshing…' : 'Refresh'}
		</button>
	</form>
	<form method="POST" action="?/logout" bind:this={logoutFormEl}>
		<button class="topbar-action" type="submit" title="Log out (Red)">
			<span class="remote-dot remote-dot-red"></span>
			Logout
		</button>
	</form>
	<button
		class="topbar-action"
		title={(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode') + ' (Blue)'}
		onclick={toggleTheme}
	>
		<span class="remote-dot remote-dot-blue"></span>
		{theme === 'light' ? 'Dark' : 'Light'}
	</button>
	{#if showInstallButton}
		<div class="install-wrap">
			<button class="topbar-action" title="Add an icon for this app to your device" onclick={handleInstallClick}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 8v6M9 11h6"/></svg>
				Make Icon
			</button>
			{#if showIOSInstructions}
				<div class="ios-instructions">
					<p>Tap the <b>Share</b> icon in Safari's toolbar, then choose <b>Add to Home Screen</b>.</p>
					<button class="ios-instructions-close" onclick={() => (showIOSInstructions = false)}>Got it</button>
				</div>
			{/if}
		</div>
	{/if}
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
	.topbar-action {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--veil-a);
		color: var(--text-dim);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.topbar-action svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}
	.topbar-action:hover {
		color: var(--accent-ui);
		border-color: var(--accent-ui);
	}
	.topbar-action:disabled {
		cursor: progress;
		opacity: 0.7;
	}
	.topbar-action.active {
		color: var(--accent-ui);
		border-color: var(--accent-ui);
	}

	/* TV remote colored-button indicators — a solid circle standing in for
	   an icon on whichever header button that color activates, so the
	   mapping is visible instead of something the user has to be told or
	   guess at. */
	.remote-dot {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		flex-shrink: 0;
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

	.install-wrap {
		position: relative;
	}
	.ios-instructions {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		z-index: 10;
		width: 15rem;
		padding: 0.85rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		background: var(--panel-strong);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}
	.ios-instructions p {
		margin: 0 0 0.6rem;
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--text);
	}
	.ios-instructions-close {
		width: 100%;
		padding: 0.4rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--veil-a);
		color: var(--accent-ui);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.78rem;
		cursor: pointer;
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
