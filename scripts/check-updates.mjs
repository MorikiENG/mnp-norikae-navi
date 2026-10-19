import { spawnSync } from 'node:child_process';
const run = spawnSync('python3', ['scripts/check_sources.py'], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(run.status ?? 1);
