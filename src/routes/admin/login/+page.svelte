<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let theme = $state<'light' | 'dark'>('dark');
	let showPassword = $state(false);
	let submitting = $state(false);
	// Server-side validation in settings.ts already filters out anything
	// that isn't a complete, correctly-padded image data URL, but this is
	// a last-resort backstop so a broken image icon can never show
	// regardless — fall back to the default mark the instant the browser
	// itself fails to decode whatever's in logoUrl.
	let logoFailed = $state(false);

	$effect(() => {
		theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'dark';
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('pulse-theme', theme);
	}
</script>

<svelte:head>
	<title>{data.appName} Admin · Sign In</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="auth-shell">
<button
	class="theme-toggle"
	aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	onclick={toggleTheme}
>
	{#if theme === 'light'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
	{/if}
</button>

<form
	class="card"
	method="POST"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	<div class="brand">
		{#if data.logoUrl && !logoFailed}
			<img src={data.logoUrl} alt="Logo" class="brand-logo" onerror={() => (logoFailed = true)} />
		{:else}
			<svg viewBox="0 0 64 64" fill="none">
				<rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="#0C0F14" stroke="#4FE3D3" stroke-opacity="0.35" stroke-width="1.5"/>
				<rect x="13" y="36" width="7" height="12" rx="3" fill="#4FE3D3"/>
				<rect x="24" y="28" width="7" height="20" rx="3" fill="#4FE3D3"/>
				<rect x="35" y="20" width="7" height="28" rx="3" fill="#4FE3D3"/>
				<rect x="46" y="12" width="7" height="36" rx="3" fill="#4FE3D3"/>
			</svg>
		{/if}
		<b>{data.appName}</b>
		<span>ADMIN&nbsp;PANEL</span>
	</div>

	<h1 class="card-title">Admin Sign In</h1>
	<p class="card-sub">Sign in to manage hosts and branding.</p>

	{#if form?.error}
		<p class="form-error">{form.error}</p>
	{/if}

	<label class="field">
		<span class="field-label">USERNAME</span>
		<div class="field-control">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/></svg>
			<input type="text" name="username" autocomplete="username" placeholder="Enter your username" required />
		</div>
	</label>

	<label class="field">
		<span class="field-label">PASSWORD</span>
		<div class="field-control">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>
			<input
				type={showPassword ? 'text' : 'password'}
				name="password"
				autocomplete="current-password"
				placeholder="Enter your password"
				required
			/>
			<button
				type="button"
				class="toggle-pass"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
				onclick={() => (showPassword = !showPassword)}
			>
				{#if showPassword}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.7c.45-.1.9-.15 1.4-.15 6 0 9.5 6.5 9.5 6.5a13.7 13.7 0 0 1-3.15 3.9M6.5 6.7A13.6 13.6 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.65-.35 3.75-.9"/><path d="M9.6 10.2a2.8 2.8 0 0 0 3.9 3.9"/></svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
				{/if}
			</button>
		</div>
	</label>

	<button type="submit" class="submit-btn" class:is-loading={submitting} disabled={submitting}>
		<span class="btn-label">{submitting ? 'Signing in…' : 'Sign In'}</span>
		<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4.5v15l13-7.5-13-7.5Z"/></svg>
	</button>

	<p class="card-footnote">Authorized administrators only.</p>
</form>
</div>

<style>
	.auth-shell {
		background:
			radial-gradient(900px 500px at 50% 20%, var(--glow), transparent 65%),
			transparent;
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		align-items: center;
		/* "safe" keeps the card from being clipped off the top when the
		   on-screen keyboard shrinks the viewport too much for it to fit
		   centered — it falls back to start-aligned only in that case,
		   otherwise the card stays centered. Declared after the plain
		   `center` above so browsers without "safe" support keep that. */
		align-items: safe center;
		justify-content: center;
		padding: 2rem;
	}

	@media (max-width: 480px) {
		.auth-shell {
			padding: 2.5rem 1.25rem;
		}
	}

	.theme-toggle {
		position: fixed;
		top: 1.5rem;
		right: 1.5rem;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: var(--veil-a);
		border: 1px solid var(--border);
		color: var(--text-dim);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.theme-toggle:hover {
		color: var(--accent-ui);
		border-color: var(--accent-ui);
	}
	.theme-toggle:focus-visible {
		outline: 2px solid var(--accent-ui);
		outline-offset: 2px;
	}
	.theme-toggle svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.card {
		position: relative;
		width: 100%;
		max-width: 23rem;
		background: var(--bg-soft);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 2.25rem 2rem 1.75rem;
		overflow: hidden;
		box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.5);
	}
	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
	}

	.brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1.75rem;
	}
	.brand svg,
	.brand-logo {
		width: 3rem;
		height: 3rem;
	}
	.brand-logo {
		border-radius: 28%;
		object-fit: cover;
	}
	.brand b {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
	}
	.brand span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		color: var(--text-faint);
	}

	.card-title {
		text-align: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.3rem;
		margin-bottom: 0.35rem;
	}
	.card-sub {
		text-align: center;
		color: var(--text-dim);
		font-size: 0.85rem;
		margin-bottom: 1.75rem;
	}

	.form-error {
		background: rgba(255, 92, 92, 0.1);
		border: 1px solid rgba(255, 92, 92, 0.3);
		color: #ff8a8a;
		font-size: 0.82rem;
		border-radius: var(--radius-md);
		padding: 0.65rem 0.85rem;
		margin-bottom: 1.1rem;
		text-align: center;
	}

	.field {
		display: block;
		margin-bottom: 1.1rem;
	}
	.field-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.64rem;
		letter-spacing: 0.12em;
		color: var(--text-faint);
		margin-bottom: 0.5rem;
	}
	.field-control {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: var(--veil-a);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0 0.85rem;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.field-control:focus-within {
		border-color: var(--accent-ui);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}
	.field-control svg {
		width: 1.05rem;
		height: 1.05rem;
		color: var(--text-faint);
		flex-shrink: 0;
	}
	.field-control:focus-within svg {
		color: var(--accent-ui);
	}
	.field-control input {
		flex: 1;
		min-width: 0;
		background: none;
		border: 0;
		outline: 0;
		color: var(--text);
		font-size: 0.92rem;
		padding: 0.75rem 0;
		font-family: inherit;
	}
	.field-control input::placeholder {
		color: var(--text-faint);
	}
	.toggle-pass {
		background: none;
		border: 0;
		padding: 0.25rem;
		display: flex;
		color: var(--text-faint);
		cursor: pointer;
		border-radius: 6px;
	}
	.toggle-pass:hover {
		color: var(--text-dim);
	}
	.toggle-pass:focus-visible {
		outline: 2px solid var(--accent-ui);
		outline-offset: 2px;
	}
	.toggle-pass svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.submit-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.85rem 1.2rem;
		background: var(--accent);
		color: var(--accent-contrast);
		border: 0;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 0.92rem;
		cursor: pointer;
		transition: transform 0.15s ease;
	}
	.submit-btn svg {
		width: 0.85rem;
		height: 0.85rem;
	}
	.submit-btn:hover {
		transform: translateY(-1px);
	}
	.submit-btn:focus-visible {
		outline: 2px solid var(--accent-ui);
		outline-offset: 3px;
	}
	.submit-btn.is-loading {
		opacity: 0.75;
		cursor: progress;
		pointer-events: none;
	}

	.card-footnote {
		text-align: center;
		margin-top: 1.35rem;
		font-size: 0.78rem;
		color: var(--text-faint);
	}
</style>
