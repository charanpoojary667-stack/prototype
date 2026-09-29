import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] === 'start' ? 'start' : 'dev';
const args = process.argv.slice(3);
async function availablePort(start) {
  for (let port = start; port < start + 100; port += 1) {
    const server = createServer();
    const available = await new Promise(resolvePort => {
      server.once('error', () => resolvePort(false));
      server.listen(port, '0.0.0.0', () => server.close(() => resolvePort(true)));
    });
    if (available) return port;
  }
  throw new Error('No available local port found for Next.js.');
}
async function healthyApi(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return false;
    return (await response.json()).status === 'ok';
  } catch {
    return false;
  }
}
const apiPort = process.env.API_PORT || '4000';
const apiEnv = {
  ...process.env,
  HOST: '0.0.0.0',
  PORT: apiPort,
  DATA_FILE: process.env.DATA_FILE || resolve(root, 'backend/data/hackforge.sqlite'),
  JWT_SECRET: process.env.JWT_SECRET || 'hackforge-local-development-secret-change-before-sharing',
};
delete apiEnv.DATABASE_URL;

const reuseApi = command === 'dev' && await healthyApi(apiPort);
if (reuseApi) console.log(`Reusing the existing local API at http://127.0.0.1:${apiPort}.`);
const api = reuseApi ? null : spawn(process.execPath, ['src/server.js'], {
  cwd: resolve(root, 'backend'),
  env: apiEnv,
  stdio: 'inherit',
});
const hasPort = args.some(arg => arg === '-p' || arg === '--port' || arg.startsWith('--port='));
const nextPort = hasPort ? null : await availablePort(Number(process.env.PORT || 3000));
const nextArgs = hasPort ? args : [...args, '--port', String(nextPort)];
let reuseNext = false;
if (command === 'dev' && existsSync(resolve(root, '.next/dev/lock'))) {
  try { reuseNext = (await fetch(`http://127.0.0.1:${process.env.PORT || '3000'}`, { signal: AbortSignal.timeout(4000) })).ok; } catch { /* no server to reuse */ }
}
if (reuseNext) console.log(`Reusing the existing Next.js dev server at http://localhost:${process.env.PORT || '3000'}.`);
const next = reuseNext ? null : spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), command, ...nextArgs], {
  cwd: root,
  env: { ...process.env, HOST: '0.0.0.0', PORT: process.env.PORT || '3000', API_PORT: process.env.API_PORT || '4000' },
  stdio: 'inherit',
});

const keepAlive = reuseApi && reuseNext ? setInterval(() => {}, 60_000) : null;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (keepAlive) clearInterval(keepAlive);
  if (next && next.exitCode === null) next.kill();
  if (api && api.exitCode === null) api.kill();
  setTimeout(() => process.exit(code), 100).unref();
}
next?.on('exit', code => stop(code ?? 1));
api?.on('exit', code => {
  if (!stopping && code !== 0) {
    console.error(`Local API exited with code ${code ?? 'unknown'}.`);
    stop(code ?? 1);
  }
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

