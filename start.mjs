// Schema setup happens inside hooks.server.ts on first request (works
// regardless of how the process is started). This file exists only so
// hosting panels that want an explicit "startup file" have a stable one to
// point at.
await import('./build/index.js');
