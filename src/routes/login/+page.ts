// See src/routes/live/+page.ts for why. The sign-in form itself is a plain
// <form method="POST"> (use:enhance is progressive enhancement on top of
// that, not required for it to work) so this route degrades to a fully
// functional native form post with no rewrite needed — only the cosmetic
// theme-toggle and show/hide-password buttons need static/legacy/login.js.
export const csr = false;
