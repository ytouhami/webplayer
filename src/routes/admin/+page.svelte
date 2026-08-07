<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const SWATCHES = ['#4FE3D3', '#8B7CF6', '#FFB454', '#F76E9C', '#56B6F0'];

	type HostRow = { key: string; name: string; url: string };

	function buildHosts(list: { name: string; url: string }[]): HostRow[] {
		return list.map((h) => ({ key: crypto.randomUUID(), name: h.name, url: h.url }));
	}

	let hostsState = $state<HostRow[]>(untrack(() => buildHosts(data.hosts)));
	let appName = $state(untrack(() => data.settings.appName || 'Pulse'));
	let currentAccent = $state(untrack(() => data.settings.accentColor || '#4FE3D3'));
	let logoAction = $state<'keep' | 'new' | 'remove'>('keep');
	let pendingLogoPreviewUrl = $state<string | null>(null);
	let savedVisible = $state(false);
	let logoFileInputEl: HTMLInputElement;

	let logoDisplayUrl = $derived(
		logoAction === 'new' && pendingLogoPreviewUrl
			? pendingLogoPreviewUrl
			: logoAction === 'remove'
				? null
				: data.settings.logoUrl
	);

	let theme = $state<'light' | 'dark'>('dark');
	$effect(() => {
		theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'dark';
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('pulse-theme', theme);
	}

	function resetToLoaded() {
		hostsState = buildHosts(data.hosts);
		appName = data.settings.appName || 'Pulse';
		currentAccent = data.settings.accentColor || '#4FE3D3';
		logoAction = 'keep';
		pendingLogoPreviewUrl = null;
		if (logoFileInputEl) logoFileInputEl.value = '';
	}

	function addHost() {
		hostsState.push({ key: crypto.randomUUID(), name: '', url: '' });
	}

	function removeHost(key: string) {
		hostsState = hostsState.filter((h) => h.key !== key);
	}

	function handleLogoChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
		pendingLogoPreviewUrl = URL.createObjectURL(file);
		logoAction = 'new';
	}

	function resetLogo() {
		if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
		pendingLogoPreviewUrl = null;
		logoAction = 'remove';
		if (logoFileInputEl) logoFileInputEl.value = '';
	}
</script>

<svelte:head>
	<title>{data.appName} · Admin</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<header class="topbar">
	<span class="admin-brand">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-1.5-2.6-2.2.7a7.7 7.7 0 0 0-2.6-1.5L14.5 3h-3l-.5 2.7a7.7 7.7 0 0 0-2.6 1.5l-2.2-.7-1.5 2.6L6.6 10.5a7.6 7.6 0 0 0 0 3L4.7 15l1.5 2.6 2.2-.7c.75.65 1.63 1.15 2.6 1.5L11.5 21h3l.5-2.6c.97-.35 1.85-.85 2.6-1.5l2.2.7 1.5-2.6-1.9-1.4Z"/></svg>
		{data.appName} Admin
	</span>
	<div class="topbar-spacer"></div>
	<div class="topbar-actions">
		<form method="POST" action="?/logout">
			<button class="icon-btn" type="submit" aria-label="Log out">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
			</button>
		</form>
		<button class="icon-btn" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onclick={toggleTheme}>
			{#if theme === 'light'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
			{/if}
		</button>
	</div>
</header>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance={() => {
		return async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				resetToLoaded();
				savedVisible = true;
				setTimeout(() => (savedVisible = false), 1800);
			}
		};
	}}
>
	<div class="content">
		<div class="panel">
			<h2 class="panel-title">Hosts</h2>
			<p class="panel-sub">Add one or more hosts. The active one is used to fetch live channels and VOD.</p>

			<div>
				{#if hostsState.length === 0}
					<p class="empty-hosts">No hosts yet. Add one below.</p>
				{:else}
					{#each hostsState as host (host.key)}
						<div class="host-row">
							<div class="host-fields">
								<input type="text" class="text-input" placeholder="Name" bind:value={host.name} />
								<input type="text" class="text-input" placeholder="M3U / Xtream URL" bind:value={host.url} />
							</div>
							<button type="button" class="host-delete" aria-label="Remove host" onclick={() => removeHost(host.key)}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<button type="button" class="add-host-btn" onclick={addHost}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
				Add Host
			</button>

			<input type="hidden" name="hostsJson" value={JSON.stringify(hostsState.map(({ name, url }) => ({ name, url })))} />
		</div>

		<div class="panel">
			<h2 class="panel-title">Branding</h2>
			<p class="panel-sub">Customize how the app looks for everyone signed in.</p>

			<div class="branding-field">
				<span class="field-label">APP NAME</span>
				<input type="text" class="text-input" name="appName" placeholder="Pulse" maxlength="24" bind:value={appName} />
			</div>

			<div class="branding-field">
				<span class="field-label">LOGO</span>
				<div class="logo-row">
					<div class="logo-preview">
						{#if logoDisplayUrl}
							<img src={logoDisplayUrl} alt="Logo" />
						{:else}
							<svg viewBox="0 0 64 64" fill="none"><rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="#0C0F14" stroke="#4FE3D3" stroke-opacity="0.35" stroke-width="1.5"/><rect x="13" y="36" width="7" height="12" rx="3" fill="#4FE3D3"/><rect x="24" y="28" width="7" height="20" rx="3" fill="#4FE3D3"/><rect x="35" y="20" width="7" height="28" rx="3" fill="#4FE3D3"/><rect x="46" y="12" width="7" height="36" rx="3" fill="#4FE3D3"/></svg>
						{/if}
					</div>
					<div class="logo-actions">
						<button type="button" class="ghost-btn-sm" onclick={() => logoFileInputEl.click()}>Upload</button>
						<button type="button" class="ghost-btn-sm" onclick={resetLogo}>Reset to default</button>
					</div>
					<input
						type="file"
						name="logo"
						accept="image/*"
						style="display:none"
						bind:this={logoFileInputEl}
						onchange={handleLogoChange}
					/>
				</div>
				<input type="hidden" name="logoAction" value={logoAction} />
			</div>

			<div class="branding-field">
				<span class="field-label">ACCENT COLOR</span>
				<div class="accent-row">
					{#each SWATCHES as hex (hex)}
						<button
							type="button"
							class="swatch"
							class:active={hex.toLowerCase() === currentAccent.toLowerCase()}
							style="background:{hex}"
							onclick={() => (currentAccent = hex)}
							aria-label="Use accent color {hex}"
						></button>
					{/each}
					<input type="color" class="color-input" name="accentColor" bind:value={currentAccent} />
				</div>
			</div>
		</div>

		{#if form?.error}
			<p class="form-error">{form.error}</p>
		{/if}

		<div class="save-bar">
			<button class="save-btn" type="submit">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>
				Save Changes
			</button>
			<span class="save-status" class:show={savedVisible}>Saved</span>
			<button type="button" class="reset-link" onclick={resetToLoaded}>Reset everything</button>
		</div>
	</div>
</form>

<style>
	:global(a) {
		text-decoration: none;
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border);
	}
	.admin-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text);
	}
	.admin-brand svg {
		width: 1.1rem;
		height: 1.1rem;
		color: var(--accent-ui);
	}
	.topbar-spacer {
		flex: 1;
	}
	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.icon-btn {
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

	.content {
		max-width: 52rem;
		margin: 0 auto;
		padding: 2.25rem 2.25rem 6rem;
	}

	.panel {
		background: var(--bg-soft);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1.75rem;
		margin-bottom: 1.75rem;
	}
	.panel-title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
		margin-bottom: 0.25rem;
	}
	.panel-sub {
		color: var(--text-dim);
		font-size: 0.85rem;
		margin-bottom: 1.5rem;
	}

	.field-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		color: var(--text-faint);
		margin-bottom: 0.5rem;
	}
	.text-input {
		width: 100%;
		background: var(--veil-a);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0.7rem 0.9rem;
		color: var(--text);
		font-size: 0.88rem;
		outline: 0;
		font-family: inherit;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.text-input::placeholder {
		color: var(--text-faint);
	}
	.text-input:focus {
		border-color: var(--accent-ui);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.host-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		margin-bottom: 0.75rem;
	}
	.host-fields {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.6rem;
		min-width: 0;
	}
	.host-delete {
		width: 2.1rem;
		height: 2.1rem;
		border-radius: var(--radius-sm);
		background: none;
		border: 1px solid var(--border);
		color: var(--text-faint);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.host-delete:hover {
		color: var(--live);
		border-color: var(--live);
	}
	.host-delete svg {
		width: 0.95rem;
		height: 0.95rem;
	}

	.add-host-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 1.1rem;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-md);
		background: none;
		color: var(--text-dim);
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		width: 100%;
		justify-content: center;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.add-host-btn:hover {
		border-color: var(--accent-ui);
		color: var(--accent-ui);
	}
	.add-host-btn svg {
		width: 0.95rem;
		height: 0.95rem;
	}
	.empty-hosts {
		color: var(--text-faint);
		font-size: 0.85rem;
		text-align: center;
		padding: 1.5rem 0;
	}

	.branding-field {
		margin-bottom: 1.4rem;
	}

	.logo-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.logo-preview {
		width: 3.4rem;
		height: 3.4rem;
		border-radius: var(--radius-md);
		background: var(--bg);
		border: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
	}
	.logo-preview svg,
	.logo-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.logo-actions {
		display: flex;
		gap: 0.6rem;
	}
	.ghost-btn-sm {
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--border-strong);
		background: none;
		color: var(--text);
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.8rem;
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease;
	}
	.ghost-btn-sm:hover {
		border-color: var(--accent-ui);
		color: var(--accent-ui);
	}

	.accent-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.swatch {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		flex-shrink: 0;
		padding: 0;
	}
	.swatch.active {
		border-color: var(--text);
	}
	.color-input {
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		border: 1px solid var(--border-strong);
		background: none;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
	}
	.color-input::-webkit-color-swatch-wrapper {
		padding: 0;
	}
	.color-input::-webkit-color-swatch {
		border: 0;
		border-radius: 50%;
	}

	.form-error {
		background: rgba(255, 92, 92, 0.1);
		border: 1px solid rgba(255, 92, 92, 0.3);
		color: #ff8a8a;
		font-size: 0.82rem;
		border-radius: var(--radius-md);
		padding: 0.65rem 0.85rem;
		margin-bottom: 1.25rem;
	}

	.save-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.save-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.8rem 1.4rem;
		background: var(--accent-ui);
		color: var(--accent-contrast);
		border: 0;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.save-btn:hover {
		transform: translateY(-1px);
	}
	.save-btn svg {
		width: 0.9rem;
		height: 0.9rem;
	}
	.save-status {
		font-size: 0.82rem;
		color: var(--accent-ui);
		opacity: 0;
		transition: opacity 0.2s ease;
	}
	.save-status.show {
		opacity: 1;
	}
	.reset-link {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--text-faint);
		text-decoration: underline;
		cursor: pointer;
		background: none;
		border: 0;
	}
	.reset-link:hover {
		color: var(--live);
	}

	@media (max-width: 700px) {
		.content {
			padding: 1.5rem 1.25rem 4rem;
		}
		.host-fields {
			grid-template-columns: 1fr;
		}
	}
</style>
