// Read only: never executes the legacy application or writes into the backup.
// Raw source copies stay in ignored work/. Output contains schema and counts only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyAuditSnapshot } from './audit-snapshot.mjs';

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/audit-legacy.mjs <backup-directory>');
const repo = path.resolve(import.meta.dirname, '..');
const out = path.join(repo, 'work', 'legacy-source');
const archive = path.join(root, '安装目录', '宠物店', 'pet-salon-records', 'resources', 'app.asar');
const database = path.join(root, '用户数据', 'pet-salon-records', 'salon.db');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const buf = fs.readFileSync(archive);
const header = JSON.parse(buf.subarray(16, 16 + buf.readUInt32LE(12)).toString('utf8'));
const dataOffset = 8 + buf.readUInt32LE(4);
const sourceFiles = [];
for (const [name, entry] of Object.entries(header.files)) {
  if (['node_modules', 'data'].includes(name)) continue;
  walk(entry, name);
}
function walk(entry, relative) {
  if (entry.files) {
    for (const [name, child] of Object.entries(entry.files)) walk(child, `${relative}/${name}`);
    return;
  }
  if (entry.unpacked || entry.link) throw new Error(`Unexpected application entry ${relative}`);
  const target = path.resolve(out, relative);
  if (!target.startsWith(out + path.sep)) throw new Error('Archive path escaped extraction directory');
  const start = dataOffset + Number(entry.offset);
  const bytes = buf.subarray(start, start + entry.size);
  if (bytes.length !== entry.size || hash(bytes) !== entry.integrity.hash) throw new Error(`Integrity mismatch: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  sourceFiles.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
}
const before = hash(fs.readFileSync(database));
const snapshot = copyAuditSnapshot(database, path.join(repo, 'work', 'legacy-audit'));
const db = new DatabaseSync(snapshot, { readOnly: true });
db.exec('PRAGMA query_only = ON');
const objects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
const tables = objects.filter(x => x.type === 'table').map(x => ({
  name: x.name,
  count: db.prepare(`SELECT COUNT(*) AS n FROM "${x.name.replaceAll('"', '""')}"`).get().n,
  columns: db.prepare(`PRAGMA table_info("${x.name.replaceAll('"', '""')}")`).all(),
}));
const integrity = db.prepare('PRAGMA integrity_check').all();
const foreignKeyIssues = db.prepare('PRAGMA foreign_key_check').all().length;
const memberCount = tables.find(x => x.name === 'members')?.count;
let diagnostics = {};
if (memberCount !== undefined) {
  diagnostics = {
    negativeBalanceCount: db.prepare('SELECT COUNT(*) AS n FROM members WHERE balance < 0').get().n,
    blankPhoneCount: db.prepare("SELECT COUNT(*) AS n FROM members WHERE trim(phone) = ''").get().n,
    nonEmptyDuplicatePhoneGroups: db.prepare("SELECT COUNT(*) AS n FROM (SELECT phone FROM members WHERE phone != '' GROUP BY phone HAVING COUNT(*) > 1)").get().n,
    balanceReconstructionMismatchCount: db.prepare(`SELECT COUNT(*) AS n FROM members m
      WHERE ABS(m.balance - (COALESCE((SELECT SUM(amount) FROM recharges r WHERE r.member_id=m.id),0)
      - COALESCE((SELECT SUM(deducted_from_balance) FROM orders o WHERE o.member_id=m.id),0))) > 0.005`).get().n,
    orphanRechargeCount: db.prepare('SELECT COUNT(*) AS n FROM recharges r LEFT JOIN members m ON m.id=r.member_id WHERE m.id IS NULL').get().n,
    orphanMemberOrderCount: db.prepare('SELECT COUNT(*) AS n FROM orders o LEFT JOIN members m ON m.id=o.member_id WHERE o.member_id IS NOT NULL AND m.id IS NULL').get().n,
    malformedServicesCount: db.prepare('SELECT COUNT(*) AS n FROM orders WHERE NOT json_valid(services_json)').get().n,
  };
}
db.close();
const after = hash(fs.readFileSync(database));
if (before !== after) throw new Error('Database content changed during audit');
console.log(JSON.stringify({ archiveSha256: hash(buf), databaseSha256: before,
  sourceFiles, objects, tables, integrity, foreignKeyIssues, diagnostics,
  databaseUnchanged: before === after, classification: 'unverified: row content is never printed',
}, null, 2));
