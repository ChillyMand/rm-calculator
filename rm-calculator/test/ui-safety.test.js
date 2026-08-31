import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
