<script lang="ts">
	import AppTopbar from '$lib/components/AppTopbar.svelte';
	import type { PageData } from './$types';

	// csr is disabled for this route (see +page.ts) so nothing in this
	// script block ever runs client-side — everything interactive on this
	// page is implemented in plain ES5 in static/legacy/live.js instead,
	// loaded as a classic (non-module) script below. This block only
	// produces the initial server-rendered markup.
	let { data }: { data: PageData } = $props();

	const first = data.channels[0] as (typeof data.channels)[number] | undefined;

	// Baked into the SSR output once per request — purely decorative CSS
	// animation, no JS needed to drive it (see @keyframes eqPulse below).
	const eqBars = Array.from({ length: 14 }, () => ({
		height: Math.random() * 1.4 + 0.8,
		duration: Math.random() * 0.7 + 0.5,
		delay: Math.random() * -1.5
	}));
</script>

<svelte:head>
	<title>{data.appName} · Live TV</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<script src="/vendor/hls.min.js" defer></script>
	<script src="/legacy/topbar.js" defer></script>
	<script src="/legacy/live.js" defer></script>
</svelte:head>

<div class="page-shell">
	<AppTopbar title="Live TV" expiryLabel={data.expiryLabel} activePage="live" />

	<div class="body-shell">
		<aside class="channel-sidebar">
			<label class="search">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
				<input id="search-input" type="text" placeholder="Search channels" />
			</label>
			<span id="list-count" class="list-count">{data.channels.length} {data.channels.length === 1 ? 'CHANNEL' : 'CHANNELS'}</span>
			<ul class="channel-list" id="channel-list">
				{#each data.channels as channel, i (channel.id)}
					<li
						class="channel-item"
						class:active={i === 0}
						class:focused={i === 0}
						data-channel-id={channel.id}
						data-name={channel.name.toLowerCase()}
						data-category={channel.category ?? ''}
						data-color-a={channel.colorA}
						data-color-b={channel.colorB}
					>
						{#if channel.icon}
							<img class="ch-badge ch-icon" src={channel.icon} alt="" loading="lazy" />
							<div class="ch-badge" style="display:none; background:linear-gradient(135deg,{channel.colorA},{channel.colorB})">{channel.badge}</div>
						{:else}
							<div class="ch-badge" style="background:linear-gradient(135deg,{channel.colorA},{channel.colorB})">{channel.badge}</div>
						{/if}
						<div class="ch-info">
							<h3>{channel.name}</h3>
							<span class="ch-meta">CH. {String(i + 1).padStart(2, '0')}</span>
						</div>
						<span class="ch-live"></span>
					</li>
				{/each}
			</ul>
			<p class="no-results" id="no-results" style="display:none">No channels match your search.</p>
		</aside>

		<main class="player-main">
			<div
				class="player-shell is-buffering"
				id="player-shell"
				style={first ? `--ch-a:${first.colorA}; --ch-b:${first.colorB};` : ''}
			>
				<!-- svelte-ignore a11y_media_has_caption -->
				<video id="live-video" playsinline autoplay muted></video>

				<div class="player-overlay-top" id="player-overlay-top">
					<span class="ch-number-badge" id="ch-number-badge">CH. 01</span>
				</div>

				<button class="player-center" id="player-center-btn" aria-label="Play">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>
				</button>
				<div class="signal-eq">
					{#each eqBars as bar}
						<span class="bar" style="height:{bar.height}rem; animation-duration:{bar.duration}s; animation-delay:{bar.delay}s;"></span>
					{/each}
				</div>

				<div class="player-error" id="player-error" style="display:none">
					<p id="player-error-text"></p>
				</div>

				<div class="player-overlay-bottom" id="player-overlay-bottom">
					<p class="now-cat" id="now-cat">{first?.category ?? ''}</p>
					<div class="controls">
						<button class="ctrl-btn" id="prev-btn" aria-label="Previous channel" title="Previous channel">
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14l-11-7z"/></svg>
						</button>
						<button class="ctrl-btn" id="play-pause-btn" aria-label="Pause">
							<svg id="play-pause-icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>
							<svg id="play-pause-icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
						</button>
						<button class="ctrl-btn" id="next-btn" aria-label="Next channel" title="Next channel">
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 5h-2v14h2zM4 5v14l11-7z"/></svg>
						</button>
						<button class="ctrl-btn" id="mute-btn" aria-label="Unmute">
							<svg id="mute-icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>
							<svg id="mute-icon-unmuted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>
						</button>
						<input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="100" aria-label="Volume" />
						<div class="ctrl-spacer"></div>
						<button class="ctrl-btn" id="fullscreen-btn" aria-label="Fullscreen">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4"/></svg>
						</button>
					</div>
				</div>
			</div>
		</main>
	</div>
</div>

<style>
	.page-shell {
		height: 100vh;
		height: 100dvh;
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
	}

	.body-shell {
		flex: 1;
		display: grid;
		grid-template-columns: 19rem 1fr;
		min-height: 0;
		min-width: 0;
	}

	.channel-sidebar {
		border-right: 1px solid var(--border);
		background: var(--bg-soft);
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}
	.search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 1.1rem 1.1rem 0.75rem;
		background: var(--veil-a);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0.6rem 0.85rem;
		flex-shrink: 0;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.search:focus-within {
		border-color: var(--accent-ui);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.search svg {
		width: 0.95rem;
		height: 0.95rem;
		color: var(--text-faint);
		flex-shrink: 0;
	}
	.search input {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
		outline: 0;
		color: var(--text);
		font-size: 0.85rem;
		font-family: inherit;
	}
	.search input::placeholder {
		color: var(--text-faint);
	}

	.list-count {
		padding: 0 1.1rem 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		color: var(--text-faint);
		flex-shrink: 0;
	}

	.channel-list {
		list-style: none;
		overflow-y: auto;
		padding: 0 0.6rem 1rem;
		flex: 1;
		min-height: 0;
		margin: 0;
		scrollbar-width: thin;
		scrollbar-color: var(--border-strong) transparent;
		-webkit-overflow-scrolling: touch;
		transform: translateZ(0);
		will-change: transform;
	}
	.channel-list::-webkit-scrollbar {
		width: 8px;
	}
	.channel-list::-webkit-scrollbar-track {
		background: transparent;
	}
	.channel-list::-webkit-scrollbar-thumb {
		background: var(--border-strong);
		border-radius: 999px;
	}
	.channel-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-faint);
	}
	.channel-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.6rem;
		border-radius: var(--radius-sm);
		border-left: 2px solid transparent;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	.channel-item:hover {
		background: var(--veil-a);
	}
	.channel-item.active {
		background: var(--veil-a);
		border-left-color: var(--accent-ui);
	}
	.channel-item.focused {
		outline: 2px solid var(--accent-ui);
		outline-offset: -2px;
	}
	.ch-badge {
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.68rem;
		color: #fff;
	}
	.ch-icon {
		object-fit: cover;
		background: var(--veil-a);
		border: 1px solid var(--border);
	}
	.ch-info {
		flex: 1;
		min-width: 0;
	}
	.ch-info h3 {
		font-size: 0.82rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
	}
	.ch-meta {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-faint);
	}
	.ch-live {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
		flex-shrink: 0;
	}
	.no-results {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.82rem;
	}

	.player-main {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 0;
		min-width: 0;
		min-height: calc((100vw - 19rem - 3rem) * 9 / 16 + 3rem);
	}
	.player-shell {
		position: relative;
		width: 100%;
		height: 0;
		padding-top: 56.25%; /* 16:9 — see /live rewrite notes: no aspect-ratio dependency */
		min-width: 0;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--border);
		background: linear-gradient(150deg, var(--ch-a, #123a34), var(--ch-b, #0b1416));
		transition: background 0.3s ease;
	}
	.player-shell:fullscreen,
	.player-shell:-webkit-full-screen {
		width: 100vw;
		height: 100vh;
		padding-top: 0;
		border-radius: 0;
		border: 0;
	}
	.player-shell video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		will-change: transform;
	}
	.player-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(6px);
		border: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.player-center:hover {
		transform: translate(-50%, -50%) scale(1.06);
	}
	.player-center svg {
		width: 1.7rem;
		height: 1.7rem;
	}

	.signal-eq {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: flex-end;
		gap: 4px;
		height: 2.4rem;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}
	.player-shell.is-buffering .signal-eq {
		opacity: 0.5;
	}
	.player-shell.is-playing .player-center {
		opacity: 0;
		pointer-events: none;
	}
	.signal-eq .bar {
		width: 4px;
		border-radius: 2px;
		background: #fff;
		animation: eqPulse ease-in-out infinite;
	}
	@keyframes eqPulse {
		0%,
		100% {
			transform: scaleY(0.25);
		}
		50% {
			transform: scaleY(1);
		}
	}

	.player-error {
		position: absolute;
		left: 1.5rem;
		right: 1.5rem;
		bottom: 6.5rem;
		z-index: 5;
		padding: 0.9rem 1.1rem;
		border-radius: var(--radius-md);
		background: rgba(20, 6, 6, 0.85);
		border: 1px solid rgba(255, 92, 92, 0.4);
		backdrop-filter: blur(4px);
	}
	.player-error p {
		margin: 0;
		color: #ffb4b4;
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.player-overlay-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 1rem 1.25rem;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), transparent);
		opacity: 1;
		transition: opacity 0.3s ease;
	}
	.ch-number-badge {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: #fff;
		background: rgba(0, 0, 0, 0.35);
		padding: 0.3rem 0.6rem;
		border-radius: 5px;
	}

	.player-overlay-bottom {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 1.5rem 1.25rem 1rem;
		background: linear-gradient(0deg, rgba(0, 0, 0, 0.55), transparent);
		opacity: 1;
		transition: opacity 0.3s ease;
	}
	.player-overlay-top.chrome-hidden,
	.player-overlay-bottom.chrome-hidden {
		opacity: 0;
		pointer-events: none;
	}
	.now-cat {
		color: rgba(255, 255, 255, 0.75);
		font-size: 0.8rem;
		margin: 0 0 0.9rem;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.ctrl-btn {
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.12);
		border: 0;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.ctrl-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}
	.ctrl-btn:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
		background: rgba(255, 255, 255, 0.25);
	}
	.ctrl-btn svg {
		width: 0.95rem;
		height: 0.95rem;
	}
	.volume-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 5rem;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.25);
		outline: none;
		cursor: pointer;
	}
	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
	}
	.volume-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: 0;
		border-radius: 50%;
		background: #fff;
		cursor: pointer;
	}
	.volume-slider:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
	.ctrl-spacer {
		flex: 1;
	}

	@media (max-width: 880px) {
		.body-shell {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 50vh;
			grid-template-rows: 1fr 50dvh;
			min-height: 0;
		}
		.player-main {
			grid-row: 1;
			padding: 1rem;
			min-height: calc((100vw - 2rem) * 9 / 16 + 2rem);
		}
		.channel-sidebar {
			grid-row: 2;
			border-right: 0;
			border-top: 1px solid var(--border);
			border-bottom: 0;
			height: auto;
		}
	}
</style>
