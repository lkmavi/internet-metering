import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

function run(command, url) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`src/${command}.js`, url], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} did not exit`));
    }, 10_000);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

test('CLI and TUI exit after a complete measurement', async () => {
  const server = createServer((_req, res) => res.end('test data'));
  const port = await listen(server);
  try {
    for (const command of ['cli', 'tui']) {
      const result = await run(command, `http://127.0.0.1:${port}/file`);
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /10\/10|10 \/ 10/);
    }
  } finally {
    await close(server);
  }
});

test('CLI and TUI exit with failure status after HTTP rejection', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(403);
    res.end('blocked');
  });
  const port = await listen(server);
  try {
    for (const command of ['cli', 'tui']) {
      const result = await run(command, `http://127.0.0.1:${port}/file`);
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /HTTP 403/);
    }
  } finally {
    await close(server);
  }
});
