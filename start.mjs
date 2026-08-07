import { spawnSync } from 'node:child_process';

const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit' });
if (migrate.status !== 0) {
	process.exit(migrate.status ?? 1);
}

await import('./build/index.js');
