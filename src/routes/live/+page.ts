// This route is disabled for client-side rendering on purpose: old TV
// browsers (pre-~2021 Chromium/WebKit) can't run SvelteKit's ES-module
// client bundle at all (dynamic import(), optional chaining, etc. — see
// src/routes/live/+page.svelte and static/legacy/live.js for the real
// player logic, hand-written in ES5 and loaded as a classic script instead).
// Disabling csr means SvelteKit never ships or tries to hydrate that bundle
// here, so there's nothing for those engines to silently fail on.
export const csr = false;
