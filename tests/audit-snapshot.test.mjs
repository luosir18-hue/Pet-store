import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyAuditSnapshot } from '../scripts/audit-snapshot.mjs';

test('WAL-mode audit opens an isolated copy and preserves source directory bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-audit-test-'));
  try {
    const source = path.join(root, 'source');
    fs.mkdirSync(source);
    const file = path.join(source, 'salon.db');
    const fixture = new DatabaseSync(file);
    fixture.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER); INSERT INTO sample VALUES(1)');
    fixture.close();
    const inventory = () => fs.readdirSync(source).sort().map(name => [name,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(source, name))).digest('hex')]);
    const before = inventory();
    const copy = copyAuditSnapshot(file, path.join(root, 'work'));
    assert.notEqual(copy, file);
    const audited = new DatabaseSync(copy, { readOnly: true });
    audited.exec('PRAGMA query_only=ON');
    assert.equal(audited.prepare('SELECT COUNT(*) AS n FROM sample').get().n, 1);
    audited.close();
    assert.deepEqual(inventory(), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
