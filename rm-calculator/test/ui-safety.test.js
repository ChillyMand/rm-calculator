import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('calculator and support pages load the shared interaction guard', () => {
  for (const page of ['index.html', 'support/index.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /interaction-guard\.js/);
  }
});

test('interaction guard disables selection, image dragging and context menus', () => {
  const script = fs.readFileSync(path.join(root, 'interaction-guard.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(styles, /user-select\s*:\s*none/);
  assert.match(script, /dragstart/);
  assert.match(script, /contextmenu/);
  assert.match(script, /img/);
});

test('calculator and support pages show the sports sub-brand above the parent brand footer', () => {
  for (const page of ['index.html', 'support/index.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /sports-logo\.webp/);
    assert.match(html, /alt="糯米饭运动"/);
    assert.match(html, />糯米饭运动</);
    assert.match(html, />WZRICE \/ SPORTS</);
    assert.match(html, /rice-king-wordmark\.webp/);
    assert.match(html, /alt="糯米饭大王 WZRICE"/);
  }
});

test('served pages use a versioned favicon URL', async () => {
  const portServer = net.createServer();
  portServer.listen(0, '127.0.0.1');
  await once(portServer, 'listening');
  const { port } = portServer.address();
  portServer.close();
  await once(portServer, 'close');

  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, RM_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await once(server.stdout, 'data');
    for (const page of ['/', '/support/index.html']) {
      const response = await fetch(`http://127.0.0.1:${port}${page}`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /rel="icon" type="image\/png" href="(?:\.\/|\/)favicon\.png\?v=20260926"/);
    }

    const favicon = await fetch(`http://127.0.0.1:${port}/favicon.png?v=20260926`);
    assert.equal(favicon.status, 200);
    assert.equal(favicon.headers.get('content-type'), 'image/png');
    assert.ok((await favicon.arrayBuffer()).byteLength > 0);
  } finally {
    server.kill();
    await once(server, 'exit');
  }
});
