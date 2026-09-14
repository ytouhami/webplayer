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

	// "Make Icon" (install to home screen). Only shown where it can
	// actually do something:
	//  - Chromium (desktop Chrome/Edge, Android Chrome): fires
	//    beforeinstallprompt when the page qualifies as installable — we
	//    capture that event and re-trigger it on click.
	//  - iOS Safari: never fires beforeinstallprompt, no JS API exists to
	//    trigger "Add to Home Screen" there at all — the only thing
	//    possible is showing the manual steps, so the button is shown but
	//    behaves differently.
	//  - Everything else (any browser that doesn't support install):
	//    hidden entirely rather than showing a button that can't do
	//    anything. This is a positive allowlist (only show where support
	//    is confirmed or well-known), not a blocklist of every unsupported
	//    browser, since that list is impossible to keep complete/accurate.
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
</script>

<header class="topbar">
	<span class="topbar-title">{title}</span>
	<span class="expiry">Subscription: <b>{expiryLabel}</b></span>
	<div class="topbar-spacer"></div>

	<a href="/live" class="topbar-action" class:active={activePage === 'live'} title="Live TV">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 3 4-3"/><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/></svg>
		Live TV
	</a>
	<a href="/epg" class="topbar-action" class:active={activePage === 'epg'} title="TV Guide">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>
		TV Guide
	</a>
	<form
		method="POST"
		action="?/refresh"
		use:enhance={() => {
			refreshing = true;
			return async ({ update }) => {
				await update();
				refreshing = false;
			};
		}}
	>
		<button class="topbar-action" disabled={refreshing} type="submit" title="Refresh playlist">
			{refreshing ? 'Refreshing…' : 'Refresh'}
		</button>
	</form>
	<form method="POST" action="?/logout">
		<button class="topbar-action" type="submit" title="Log out">
			Logout
		</button>
	</form>
	<button
		class="topbar-action"
		title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
		onclick={toggleTheme}
	>
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
		.topbar-action {
			padding: 0.45rem 0.7rem;
			font-size: 0.75rem;
		}
	}
</style>
