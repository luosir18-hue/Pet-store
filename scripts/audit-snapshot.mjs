import fs from 'node:fs';
import path from 'node:path';

// SQLite readOnly can still create WAL/SHM sidecars. Never open the archive copy.
// The input must be a stable backup, not a database being actively written.
export function copyAuditSnapshot(database, workspace) {
  fs.mkdirSync(workspace, { recursive: true });
  const directory = fs.mkdtempSync(path.join(workspace, 'sqlite-audit-'));
  const target = path.join(directory, 'salon.db');
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(database + suffix)) fs.copyFileSync(database + suffix, target + suffix, fs.constants.COPYFILE_EXCL);
  }
  return target;
}
