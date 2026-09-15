import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const required=['README.md','AGENTS.md','.gitignore','docs/development-plan.md','docs/legacy-audit.md',
  'docs/business-rules.md','docs/architecture.md','docs/migration-plan.md','docs/acceptance.md',
  'docs/progress.md','docs/prototype.md','prototype/index.html','prototype/style.css','prototype/app.mjs','prototype/model.mjs'];
for(const file of required) assert.ok(fs.existsSync(path.join(root,file)),`Missing ${file}`);
const rules=fs.readFileSync(path.join(root,'docs/business-rules.md'),'utf8');
for(let i=1;i<=15;i++) assert.match(rules,new RegExp(`R${String(i).padStart(2,'0')}`));
const acceptance=fs.readFileSync(path.join(root,'docs/acceptance.md'),'utf8');
for(let i=1;i<=30;i++) assert.match(acceptance,new RegExp(`A${String(i).padStart(2,'0')}`));
const ignored=['work/legacy-source/app.js','private/customer-data.json','salon.db','salon.db-wal','.env','uploads/photo.jpg','backups/backup.zip'];
for(const file of ignored) execFileSync('git',['check-ignore','-q','--',file],{cwd:root});
const candidates=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(?:^|\/)(?:work|private|uploads|backups|node_modules)\/|\.(?:db(?:-wal|-shm)?|sqlite3?|asar|bak|pem|key|dump)$|(?:^|\/)\.env(?:\.|$)/i;
assert.deepEqual(candidates.filter(f=>forbidden.test(f)&&!f.endsWith('.env.example')),[],'Sensitive file candidate');
for(const file of candidates.filter(f=>f.endsWith('.md'))) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link=match[1];
    if(/^(https?:|#|<|[A-Za-z]:)/.test(link)) continue;
    const target=path.resolve(path.dirname(path.join(root,file)),link.split('#')[0]);
    assert.ok(fs.existsSync(target),`Broken link ${file}: ${link}`);
  }
}
console.log(`PASS: ${required.length} required files, R01-R15, A01-A30, local documentation links, ignore rules; ${candidates.length} Git candidates checked.`);
console.log('This is a repository hygiene check, not a full secrets scanner or production acceptance.');
