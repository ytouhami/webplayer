<script lang="ts">
	import Hls from 'hls.js';
	import AppTopbar from '$lib/components/AppTopbar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	// The input itself binds to searchQuery directly so typing always feels
	// instant; filtering (which re-renders the whole channel list — this
	// list can run into the hundreds/thousands for a real provider) is
	// debounced off of it so a heavy re-render doesn't happen on every
	// keystroke.
	let debouncedQuery = $state('');
	$effect(() => {
		const q = searchQuery;
		const timer = setTimeout(() => (debouncedQuery = q), 150);
		return () => clearTimeout(timer);
	});

	// Channel logos come from the provider and are frequently broken/dead
	// links — falls back to the generated badge per-channel rather than
	// showing a broken-image icon.
	let brokenIcons = $state(new Set<number>());
	function handleIconError(id: number) {
		brokenIcons = new Set(brokenIcons).add(id);
	}

	let activeIndex = $state(0);
	let isPlaying = $state(false);
	let isBuffering = $state(true);
	let isMuted = $state(true);
	let volume = $state(100);

	let videoEl: HTMLVideoElement;
	let playerShellEl: HTMLDivElement;
	let hls: Hls | null = null;

	function matches(name: string, query: string) {
		return !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
	}
	let shownCount = $derived(data.channels.filter((c) => matches(c.name, debouncedQuery)).length);

	let activeChannel = $derived(data.channels[activeIndex] as (typeof data.channels)[number] | undefined);

	function loadChannel(channelId: number) {
		const url = `/api/stream/${channelId}`;
		if (Hls.isSupported()) {
			if (!hls) {
				hls = new Hls({ lowLatencyMode: true });
				hls.attachMedia(videoEl);
				hls.on(Hls.Events.MANIFEST_PARSED, () => {
					videoEl.play().catch(() => {});
				});
				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (!data.fatal) return;
					console.error('[hls]', data.type, data.details);
					if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
					else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
				});
			}
			hls.loadSource(url);
		} else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			videoEl.src = url;
			videoEl.play().catch(() => {});
		}
	}

	function selectChannel(i: number) {
		activeIndex = i;
		isBuffering = true;
		const channel = data.channels[i];
		if (channel) loadChannel(channel.id);
	}

	$effect(() => {
		if (videoEl && data.channels.length > 0) {
			videoEl.muted = true;
			selectChannel(0);
		}
		return () => {
			hls?.destroy();
			hls = null;
		};
	});

	$effect(() => {
		if (!videoEl) return;
		const onPlay = () => (isPlaying = true);
		const onPause = () => (isPlaying = false);
		// "playing" fires once frames are actually rendering — that's the real
		// signal to hide the loading visualizer, not "play" (which just means
		// playback was requested, before the buffer is ready).
		const onPlaying = () => (isBuffering = false);
		const onWaiting = () => (isBuffering = true);
		videoEl.addEventListener('play', onPlay);
		videoEl.addEventListener('pause', onPause);
		videoEl.addEventListener('playing', onPlaying);
		videoEl.addEventListener('waiting', onWaiting);
		return () => {
			videoEl.removeEventListener('play', onPlay);
			videoEl.removeEventListener('pause', onPause);
			videoEl.removeEventListener('playing', onPlaying);
			videoEl.removeEventListener('waiting', onWaiting);
		};
	});

	function togglePlay() {
		if (isPlaying) videoEl.pause();
		else videoEl.play().catch(() => {});
	}

	function toggleMute() {
		isMuted = !isMuted;
		videoEl.muted = isMuted;
	}

	function handleVolumeInput(v: number) {
		volume = v;
		videoEl.volume = v / 100;
		if (v === 0) {
			isMuted = true;
			videoEl.muted = true;
		} else if (isMuted) {
			isMuted = false;
			videoEl.muted = false;
		}
	}

	function toggleFullscreen() {
		// iOS Safari doesn't support the standard Fullscreen API on a plain
		// element at all — only <video> itself, via the non-standard
		// webkitEnterFullscreen, which hands off to the native iOS player UI
		// (our custom overlay controls aren't available in that mode; that's
		// a real platform limitation, not something we can style around).
		// Falling straight through to that when the standard API is missing
		// or rejects is what makes the button do *something* on mobile
		// instead of silently no-oping.
		const doc = document as Document & {
			webkitFullscreenElement?: Element | null;
			webkitExitFullscreen?: () => void;
		};
		const video = videoEl as HTMLVideoElement & {
			webkitEnterFullscreen?: () => void;
			webkitDisplayingFullscreen?: boolean;
		};
		const shell = playerShellEl as HTMLDivElement & { webkitRequestFullscreen?: () => void };

		const isFullscreen = Boolean(
			document.fullscreenElement || doc.webkitFullscreenElement || video.webkitDisplayingFullscreen
		);

		if (isFullscreen) {
			if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
			else doc.webkitExitFullscreen?.();
			return;
		}

		if (shell.requestFullscreen) {
			shell.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
		} else if (shell.webkitRequestFullscreen) {
			shell.webkitRequestFullscreen();
		} else {
			video.webkitEnterFullscreen?.();
		}
	}

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
</svelte:head>

<div class="page-shell">
	<AppTopbar title="Live TV" expiryLabel={data.expiryLabel} activePage="live" />

	<div class="body-shell">
		<aside class="channel-sidebar">
			<label class="search">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
				<input type="text" placeholder="Search channels" bind:value={searchQuery} />
			</label>
			<span class="list-count">{shownCount} {shownCount === 1 ? 'CHANNEL' : 'CHANNELS'}</span>
			<ul class="channel-list">
				{#each data.channels as channel, i (channel.id)}
					{#if matches(channel.name, debouncedQuery)}
						<li class="channel-item" class:active={i === activeIndex} onclick={() => selectChannel(i)}>
							{#if channel.icon && !brokenIcons.has(channel.id)}
								<img
									class="ch-badge ch-icon"
									src={channel.icon}
									alt=""
									loading="lazy"
									onerror={() => handleIconError(channel.id)}
								/>
							{:else}
								<div class="ch-badge" style="background:linear-gradient(135deg,{channel.colorA},{channel.colorB})">{channel.badge}</div>
							{/if}
							<div class="ch-info">
								<h3>{channel.name}</h3>
								<span class="ch-meta">CH. {String(i + 1).padStart(2, '0')}</span>
							</div>
							<span class="ch-live"></span>
						</li>
					{/if}
				{/each}
			</ul>
			{#if shownCount === 0}
				<p class="no-results">No channels match your search.</p>
			{/if}
		</aside>

		<main class="player-main">
			<div
				class="player-shell"
				class:is-playing={isPlaying}
				class:is-buffering={isBuffering}
				bind:this={playerShellEl}
				style={activeChannel ? `--ch-a:${activeChannel.colorA}; --ch-b:${activeChannel.colorB};` : ''}
			>
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={videoEl} playsinline autoplay muted></video>

				<div class="player-overlay-top">
					<span class="live-badge"><span class="dot"></span>LIVE</span>
					<span class="ch-number-badge">CH. {String(activeIndex + 1).padStart(2, '0')}</span>
				</div>

				<button class="player-center" aria-label="Play" onclick={() => videoEl.play()}>
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>
				</button>
				<div class="signal-eq">
					{#each eqBars as bar}
						<span class="bar" style="height:{bar.height}rem; animation-duration:{bar.duration}s; animation-delay:{bar.delay}s;"></span>
					{/each}
				</div>

				<div class="player-overlay-bottom">
					<h2 class="now-title">{activeChannel?.name ?? ''}</h2>
					<p class="now-cat">{activeChannel?.category ?? ''}</p>
					<div class="controls">
						<button class="ctrl-btn" aria-label={isPlaying ? 'Pause' : 'Play'} onclick={togglePlay}>
							{#if isPlaying}
								<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>
							{/if}
						</button>
						<button class="ctrl-btn" aria-label={isMuted ? 'Unmute' : 'Mute'} onclick={toggleMute}>
							{#if isMuted}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>
							{/if}
						</button>
						<input
							type="range"
							class="volume-slider"
							min="0"
							max="100"
							value={isMuted ? 0 : volume}
							aria-label="Volume"
							oninput={(e) => handleVolumeInput(+e.currentTarget.value)}
						/>
						<div class="ctrl-spacer"></div>
						<button class="ctrl-btn" aria-label="Fullscreen" onclick={toggleFullscreen}>
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
		/* Player width on desktop = viewport minus the 19rem sidebar minus
		   this element's own 3rem of horizontal padding (box-sizing:
		   border-box, so padding is inside the width already). Deriving
		   height straight from that via 16:9 and reserving it as min-height
		   guarantees the container is always tall enough for the player it's
		   about to contain — no dependence on the aspect-ratio/flex auto-
		   sizing algorithm correctly resolving percentage heights. */
		min-height: calc((100vw - 19rem - 3rem) * 9 / 16 + 3rem);
	}
	.player-shell {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		min-width: 0;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--border);
		background: linear-gradient(150deg, var(--ch-a, #123a34), var(--ch-b, #0b1416));
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.3s ease;
	}
	.player-shell video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		/* Hints the browser to keep this on its own compositor layer so the
		   native Fullscreen API resize doesn't force a full repaint of the
		   decode/render pipeline — reduces (does not fully eliminate) the
		   stall some browsers/GPUs show when a playing video's rendering
		   surface changes size abruptly. */
		will-change: transform;
	}
	.player-center {
		position: relative;
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
		transform: scale(1.06);
	}
	.player-center svg {
		width: 1.7rem;
		height: 1.7rem;
	}

	.signal-eq {
		position: absolute;
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

	.player-overlay-top {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.45), transparent);
	}
	.live-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		color: #fff;
		background: var(--live);
		padding: 0.3rem 0.6rem;
		border-radius: 5px;
	}
	.live-badge .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #fff;
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
		padding: 2.5rem 1.25rem 1rem;
		background: linear-gradient(0deg, rgba(0, 0, 0, 0.55), transparent);
	}
	.now-title {
		color: #fff;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
		margin: 0 0 0.15rem;
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
			/* No sidebar beside it on mobile (stacked layout) — available
			   width is just the viewport minus this element's own 1rem+1rem
			   padding. */
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
