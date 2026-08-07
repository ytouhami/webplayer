<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type DisplayState = { contrast: number; bright: number; scale: number };
	const DISPLAY_KEY = 'pulse-display';
	const DEFAULT_DISPLAY: DisplayState = { contrast: 100, bright: 100, scale: 100 };

	let theme = $state<'light' | 'dark'>('dark');
	let display = $state<DisplayState>({ ...DEFAULT_DISPLAY });
	let settingsOpen = $state(false);
	let settingsBtnEl: HTMLButtonElement;
	let settingsPanelEl: HTMLDivElement;

	let clockTime = $state('--:--');
	let clockDate = $state('--');

	$effect(() => {
		theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'dark';
		const saved = localStorage.getItem(DISPLAY_KEY);
		if (saved) {
			try {
				display = { ...DEFAULT_DISPLAY, ...JSON.parse(saved) };
			} catch {
				/* ignore malformed data */
			}
		}
	});

	$effect(() => {
		document.documentElement.style.filter = `contrast(${display.contrast}%) brightness(${display.bright}%)`;
		document.documentElement.style.fontSize = `${display.scale}%`;
	});

	function setTheme(next: 'light' | 'dark') {
		theme = next;
		document.documentElement.setAttribute('data-theme', next);
		localStorage.setItem('pulse-theme', next);
	}

	function updateDisplay(patch: Partial<DisplayState>) {
		display = { ...display, ...patch };
		localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
	}

	function resetDisplay() {
		display = { ...DEFAULT_DISPLAY };
		localStorage.removeItem(DISPLAY_KEY);
		const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
		setTheme(prefersLight ? 'light' : 'dark');
	}

	function toggleSettings(e: MouseEvent) {
		e.stopPropagation();
		settingsOpen = !settingsOpen;
	}

	$effect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (
				settingsOpen &&
				!settingsPanelEl?.contains(e.target as Node) &&
				e.target !== settingsBtnEl
			) {
				settingsOpen = false;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	$effect(() => {
		function updateClock() {
			const now = new Date();
			const h = now.getHours();
			const m = now.getMinutes();
			clockTime = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
			const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			clockDate = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
		}
		updateClock();
		const interval = setInterval(updateClock, 30000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{data.appName} · Home</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page-shell">
	<header class="topbar">
		<div class="topbar-left">
			<div class="brand">
				<svg viewBox="0 0 64 64" fill="none">
					<rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="#0C0F14" stroke="#4FE3D3" stroke-opacity="0.35" stroke-width="1.5"/>
					<rect x="13" y="36" width="7" height="12" rx="3" fill="#4FE3D3"/>
					<rect x="24" y="28" width="7" height="20" rx="3" fill="#4FE3D3"/>
					<rect x="35" y="20" width="7" height="28" rx="3" fill="#4FE3D3"/>
					<rect x="46" y="12" width="7" height="36" rx="3" fill="#4FE3D3"/>
				</svg>
				<span>{data.appName}</span>
			</div>
			<div class="clock"><b>{clockTime}</b><span>{clockDate}</span></div>
		</div>

		<div class="topbar-icons">
			<button class="icon-btn" aria-label="Search">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
			</button>
			<form method="POST" action="?/logout">
				<button class="icon-btn" type="submit" aria-label="Log out">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
				</button>
			</form>
			<button
				class="icon-btn"
				class:active={settingsOpen}
				bind:this={settingsBtnEl}
				aria-label="Display settings"
				aria-expanded={settingsOpen}
				onclick={toggleSettings}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-1.5-2.6-2.2.7a7.7 7.7 0 0 0-2.6-1.5L14.5 3h-3l-.5 2.7a7.7 7.7 0 0 0-2.6 1.5l-2.2-.7-1.5 2.6L6.6 10.5a7.6 7.6 0 0 0 0 3L4.7 15l1.5 2.6 2.2-.7c.75.65 1.63 1.15 2.6 1.5L11.5 21h3l.5-2.6c.97-.35 1.85-.85 2.6-1.5l2.2.7 1.5-2.6-1.9-1.4Z"/></svg>
			</button>

			<div class="settings-panel" class:open={settingsOpen} bind:this={settingsPanelEl}>
				<div class="panel-head">
					<span class="panel-title">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-1.5-2.6-2.2.7a7.7 7.7 0 0 0-2.6-1.5L14.5 3h-3l-.5 2.7a7.7 7.7 0 0 0-2.6 1.5l-2.2-.7-1.5 2.6L6.6 10.5a7.6 7.6 0 0 0 0 3L4.7 15l1.5 2.6 2.2-.7c.75.65 1.63 1.15 2.6 1.5L11.5 21h3l.5-2.6c.97-.35 1.85-.85 2.6-1.5l2.2.7 1.5-2.6-1.9-1.4Z"/></svg>
						DISPLAY
					</span>
					<button class="reset-btn" onclick={resetDisplay}>Reset</button>
				</div>

				<div class="theme-switch" role="group" aria-label="Theme">
					<button type="button" class:active={theme === 'light'} onclick={() => setTheme('light')}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
						Light
					</button>
					<button type="button" class:active={theme === 'dark'} onclick={() => setTheme('dark')}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>
						Dark
					</button>
				</div>

				<div class="slider-row">
					<span class="slider-label"><b>Contrast</b><span class="val">{display.contrast}%</span></span>
					<input
						type="range"
						min="60"
						max="140"
						step="5"
						value={display.contrast}
						oninput={(e) => updateDisplay({ contrast: +e.currentTarget.value })}
					/>
				</div>
				<div class="slider-row">
					<span class="slider-label"><b>Luminosity</b><span class="val">{display.bright}%</span></span>
					<input
						type="range"
						min="60"
						max="140"
						step="5"
						value={display.bright}
						oninput={(e) => updateDisplay({ bright: +e.currentTarget.value })}
					/>
				</div>
				<div class="slider-row">
					<span class="slider-label"><b>Page scale</b><span class="val">{display.scale}%</span></span>
					<input
						type="range"
						min="85"
						max="130"
						step="5"
						value={display.scale}
						oninput={(e) => updateDisplay({ scale: +e.currentTarget.value })}
					/>
				</div>
			</div>
		</div>
	</header>

	<main class="content">
		<div class="primary-tiles">
			<a href="/live" class="tile tile-live">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 3 4-3"/><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="2.6"/></svg>
				<span>LIVE TV</span>
			</a>
			<a href="#" class="tile tile-movies">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5Z" fill="currentColor" stroke="none"/></svg>
				<span>MOVIES</span>
			</a>
			<a href="#" class="tile tile-series">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 4.5 5h15L21 9.5"/><rect x="3" y="9.5" width="18" height="10" rx="1.5"/><path d="M7 5l2 4.5M12 5l2 4.5M17 5l2 4.5"/></svg>
				<span>SERIES</span>
			</a>
		</div>

		<div class="secondary-tiles">
			<a href="#" class="tile-sm">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>
				TV Guide
			</a>
			<a href="#" class="tile-sm">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="7" rx="1"/><rect x="13" y="4" width="8" height="7" rx="1"/><rect x="3" y="13" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/></svg>
				Multi-Screen
			</a>
			<a href="#" class="tile-sm">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 1 1 1 8"/><path d="M4 4v5h5"/><path d="M12 8v4l3 2"/></svg>
				Catch Up
			</a>
		</div>
	</main>

	<footer class="status-bar">
		<span>Subscription: <b>Unlimited</b></span>
		<a href="#">Remove ads</a>
		<span>Connected via <b>provider account</b></span>
	</footer>
</div>

<style>
	.page-shell {
		background:
			radial-gradient(900px 500px at 50% 20%, var(--glow), transparent 65%),
			transparent;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2.5rem;
		border-bottom: 1px solid var(--border);
	}
	.topbar-left {
		display: flex;
		align-items: center;
		gap: 1.75rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.brand svg {
		width: 2rem;
		height: 2rem;
	}
	.brand span {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
	}
	.clock {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-family: var(--font-mono);
		color: var(--text-dim);
		padding-left: 1.75rem;
		border-left: 1px solid var(--border);
	}
	.clock b {
		color: var(--text);
		font-size: 1rem;
	}
	.clock span {
		font-size: 0.72rem;
	}

	.topbar-icons {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		position: relative;
	}
	.icon-btn {
		width: 2.5rem;
		height: 2.5rem;
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
		width: 1.05rem;
		height: 1.05rem;
	}
	.icon-btn:hover,
	.icon-btn.active {
		color: var(--accent-ui);
		border-color: var(--accent-ui);
	}
	.icon-btn:focus-visible {
		outline: 2px solid var(--accent-ui);
		outline-offset: 2px;
	}

	.settings-panel {
		position: absolute;
		top: calc(100% + 0.75rem);
		right: 0;
		width: 17rem;
		z-index: 20;
		background: var(--panel-strong);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		padding: 1.25rem;
		box-shadow: 0 25px 50px -20px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		opacity: 0;
		visibility: hidden;
		transform: translateY(-6px);
		transition: opacity 0.15s ease, transform 0.15s ease;
	}
	.settings-panel.open {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.panel-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.12em;
		color: var(--text-faint);
	}
	.panel-title svg {
		width: 0.95rem;
		height: 0.95rem;
	}
	.reset-btn {
		background: none;
		border: 0;
		color: var(--text-faint);
		font-size: 0.7rem;
		cursor: pointer;
		text-decoration: underline;
	}
	.reset-btn:hover {
		color: var(--accent-ui);
	}

	.theme-switch {
		display: flex;
		gap: 0.4rem;
		padding: 0.25rem;
		background: var(--veil-a);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.theme-switch button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.45rem 0;
		background: transparent;
		border: 0;
		border-radius: 7px;
		color: var(--text-dim);
		font-size: 0.78rem;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.theme-switch svg {
		width: 0.95rem;
		height: 0.95rem;
	}
	.theme-switch button.active {
		background: var(--bg);
		color: var(--accent-ui);
		border: 1px solid var(--border-strong);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.slider-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.slider-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--text-dim);
	}
	.slider-label b {
		color: var(--text);
		font-weight: 600;
	}
	.slider-label .val {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--accent-ui);
	}
	.slider-row :global(input[type='range']) {
		-webkit-appearance: none;
		width: 100%;
		height: 4px;
		border-radius: 2px;
		background: var(--border-strong);
		outline: none;
	}
	.slider-row :global(input[type='range']::-webkit-slider-thumb) {
		-webkit-appearance: none;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--accent-ui);
		cursor: pointer;
		border: 2px solid var(--bg);
	}
	.slider-row :global(input[type='range']::-moz-range-thumb) {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--accent-ui);
		cursor: pointer;
		border: 2px solid var(--bg);
	}
	.slider-row :global(input[type='range']:focus-visible) {
		outline: 2px solid var(--accent-ui);
		outline-offset: 3px;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		padding: 2rem;
	}

	.primary-tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
		width: 100%;
		max-width: 56rem;
	}
	.tile {
		position: relative;
		overflow: hidden;
		min-height: 12rem;
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.9rem;
		color: #fff;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}
	.tile:hover {
		transform: translateY(-3px);
		box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.5);
	}
	.tile svg {
		width: 3rem;
		height: 3rem;
	}
	.tile span {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.03em;
	}
	.tile-live {
		background: linear-gradient(150deg, #20d9c6, #0c6b5f);
	}
	.tile-movies {
		background: linear-gradient(150deg, #ff9459, #c24b23);
	}
	.tile-series {
		background: linear-gradient(150deg, #9c8cfb, #4c3fa8);
	}

	.secondary-tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
		width: 100%;
		max-width: 56rem;
	}
	.tile-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1rem;
		background: var(--bg-soft);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-dim);
		font-weight: 600;
		font-size: 0.85rem;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.tile-sm svg {
		width: 1.2rem;
		height: 1.2rem;
	}
	.tile-sm:hover {
		border-color: var(--accent-ui);
		color: var(--accent-ui);
	}

	.status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2.5rem;
		border-top: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-faint);
	}
	.status-bar a {
		color: var(--text-dim);
		text-decoration: underline;
	}
	.status-bar a:hover {
		color: var(--accent-ui);
	}
	.status-bar b {
		color: var(--text-dim);
	}

	@media (max-width: 820px) {
		.topbar {
			padding: 1.1rem 1.25rem;
		}
		.clock {
			display: none;
		}
		.primary-tiles,
		.secondary-tiles {
			grid-template-columns: 1fr;
			max-width: 26rem;
		}
		.tile {
			min-height: 9rem;
		}
		.status-bar {
			flex-direction: column;
			gap: 0.4rem;
			padding: 1rem 1.25rem;
			text-align: center;
		}
	}
</style>
