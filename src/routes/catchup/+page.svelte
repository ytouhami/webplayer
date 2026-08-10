<script lang="ts">
	import Hls from 'hls.js';
	import AppTopbar from '$lib/components/AppTopbar.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let debouncedQuery = $state('');
	$effect(() => {
		const q = searchQuery;
		const timer = setTimeout(() => (debouncedQuery = q), 150);
		return () => clearTimeout(timer);
	});

	let brokenIcons = $state(new Set<number>());
	function handleIconError(id: number) {
		brokenIcons = new Set(brokenIcons).add(id);
	}

	function matches(name: string, query: string) {
		return !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
	}
	let shownCount = $derived(data.channels.filter((c) => matches(c.name, debouncedQuery)).length);

	let activeIndex = $state(-1);
	let activeChannel = $derived(activeIndex >= 0 ? data.channels[activeIndex] : undefined);

	type CatchupEntry = {
		title: string;
		description: string;
		startLabel: string;
		endLabel: string;
		start: number;
		durationMinutes: number;
	};
	let entries = $state<CatchupEntry[]>([]);
	let entriesLoading = $state(false);
	let entriesRequestId = 0;
	let watching = $state<CatchupEntry | null>(null);

	async function selectChannel(i: number) {
		activeIndex = i;
		watching = null;
		const channel = data.channels[i];
		if (!channel) return;

		const requestId = ++entriesRequestId;
		entriesLoading = true;
		try {
			const res = await fetch(`/api/catchup/${channel.id}`);
			const body = res.ok ? await res.json() : { entries: [] };
			if (requestId === entriesRequestId) {
				entries = Array.isArray(body.entries) ? body.entries : [];
			}
		} catch {
			if (requestId === entriesRequestId) entries = [];
		} finally {
			if (requestId === entriesRequestId) entriesLoading = false;
		}
	}

	function watch(entry: CatchupEntry) {
		watching = entry;
	}
	function backToList() {
		watching = null;
	}

	let videoEl: HTMLVideoElement | undefined = $state();
	let hls: Hls | undefined;

	$effect(() => {
		const entry = watching;
		const channel = activeChannel;
		if (!entry || !channel || !videoEl) return;

		const src = `/api/stream/catchup/${channel.id}?start=${entry.start}&duration=${entry.durationMinutes}`;

		if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
			videoEl.src = src;
		} else if (Hls.isSupported()) {
			hls = new Hls();
			hls.loadSource(src);
			hls.attachMedia(videoEl);
		}
		videoEl.play().catch(() => {});

		return () => {
			if (hls) {
				hls.destroy();
				hls = undefined;
			}
		};
	});
</script>

<svelte:head>
	<title>{data.appName} · Catch Up</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="page-shell">
	<AppTopbar title="Catch Up" expiryLabel={data.expiryLabel} activePage="catchup" />

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
								<span class="ch-meta">{channel.archiveDays}-DAY ARCHIVE</span>
							</div>
						</li>
					{/if}
				{/each}
			</ul>
			{#if data.channels.length === 0}
				<p class="no-results">No channels support catch-up on this account.</p>
			{:else if shownCount === 0}
				<p class="no-results">No channels match your search.</p>
			{/if}
		</aside>

		<main class="catchup-main">
			{#if !activeChannel}
				<p class="catchup-placeholder">Select a channel to view its catch-up programs.</p>
			{:else if watching}
				<div class="player-wrap">
					<button class="back-link" onclick={backToList}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
						Back to programs
					</button>
					<div class="video-shell">
						<!-- svelte-ignore a11y_media_has_caption -->
						<video bind:this={videoEl} controls playsinline></video>
					</div>
					<div class="watching-info">
						<h2>{watching.title}</h2>
						<span class="watching-time">{watching.startLabel}{watching.endLabel ? ` – ${watching.endLabel}` : ''}</span>
						{#if watching.description}
							<p>{watching.description}</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="catchup-header">
					<h2>{activeChannel.name}</h2>
					<span class="catchup-category">{activeChannel.category}</span>
				</div>

				{#if entriesLoading}
					<p class="catchup-placeholder">Loading…</p>
				{:else if entries.length === 0}
					<p class="catchup-placeholder">No catch-up programs available.</p>
				{:else}
					<ul class="catchup-list">
						{#each entries as entry}
							<li class="catchup-entry">
								<div class="catchup-entry-info">
									<span class="catchup-time">{entry.startLabel}{entry.endLabel ? ` – ${entry.endLabel}` : ''}</span>
									<h3>{entry.title}</h3>
									{#if entry.description}
										<p>{entry.description}</p>
									{/if}
								</div>
								<button class="watch-btn" onclick={() => watch(entry)}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4l14 8-14 8V4z"/></svg>
									Watch
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
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
	.no-results {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.82rem;
	}

	.catchup-main {
		padding: 1.75rem 2rem;
		overflow-y: auto;
		min-height: 0;
		min-width: 0;
	}
	.catchup-placeholder {
		color: var(--text-faint);
		font-size: 0.88rem;
		text-align: center;
		padding: 3rem 1rem;
	}
	.catchup-header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.catchup-header h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
		margin: 0;
	}
	.catchup-category {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-faint);
	}

	.catchup-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.catchup-entry {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--bg-soft);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 1rem 1.1rem;
	}
	.catchup-entry-info {
		flex: 1;
		min-width: 0;
	}
	.catchup-time {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--accent-ui);
		margin-bottom: 0.35rem;
	}
	.catchup-entry h3 {
		font-size: 0.92rem;
		font-weight: 600;
		margin: 0 0 0.3rem;
	}
	.catchup-entry p {
		font-size: 0.82rem;
		color: var(--text-dim);
		margin: 0;
		line-height: 1.5;
	}
	.watch-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--accent-ui) 30%, transparent);
		background: color-mix(in srgb, var(--accent-ui) 12%, transparent);
		color: var(--accent-ui);
		font-family: inherit;
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	.watch-btn svg {
		width: 1rem;
		height: 1rem;
	}
	.watch-btn:hover {
		background: color-mix(in srgb, var(--accent-ui) 20%, transparent);
		border-color: var(--accent-ui);
	}

	.player-wrap {
		max-width: 56rem;
	}
	.back-link {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--text-dim);
		padding: 0.4rem 0.6rem;
		margin: 0 0 1rem -0.6rem;
		border-radius: var(--radius-sm);
		background: none;
		border: 0;
		cursor: pointer;
		font-family: inherit;
	}
	.back-link svg {
		width: 1rem;
		height: 1rem;
	}
	.back-link:hover {
		color: var(--accent-ui);
		background: var(--veil-a);
	}
	.video-shell {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	.video-shell video {
		width: 100%;
		height: 100%;
	}
	.watching-info {
		margin-top: 1.25rem;
	}
	.watching-info h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
		margin: 0 0 0.3rem;
	}
	.watching-time {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--accent-ui);
		margin-bottom: 0.6rem;
	}
	.watching-info p {
		font-size: 0.85rem;
		color: var(--text-dim);
		line-height: 1.6;
		margin: 0;
	}

	@media (max-width: 880px) {
		.body-shell {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 50vh;
			grid-template-rows: 1fr 50dvh;
			min-height: 0;
		}
		.catchup-main {
			grid-row: 1;
			padding: 1.25rem;
		}
		.channel-sidebar {
			grid-row: 2;
			border-right: 0;
			border-top: 1px solid var(--border);
		}
	}
</style>
