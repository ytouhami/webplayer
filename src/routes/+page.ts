// This route's load() always redirects server-side (see +page.server.ts),
// so nothing here ever needs client JS. Disabled for consistency with the
// other TV-facing routes — see src/routes/live/+page.ts for the reasoning.
export const csr = false;
