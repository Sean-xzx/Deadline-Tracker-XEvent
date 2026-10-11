const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {normalizeStore} = require('./domain.cjs');

// Application metadata and portable EXE locations must never select a new database.
function dataDirectoryOptions(appData, legacyUserData, override) {
  const isolated = Boolean(override);
  const dir = isolated ? path.resolve(override) : path.join(appData, 'XEvent');
  const key = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const seen = new Set([key(path.resolve(dir))]);
  const legacyDirs = [];
  if (!isolated) for (const candidate of [legacyUserData, path.join(appData, 'xevent-desktop')]) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (!seen.has(key(resolved))) { seen.add(key(resolved)); legacyDirs.push(resolved); }
  }
  return {dir, legacyDirs, isolated};
}

function readDatabase(file) {
  const bytes = fs.readFileSync(file);
  normalizeStore(JSON.parse(bytes.toString('utf8')));
  return bytes;
}

function prepareDataDirectory({dir, legacyDirs = [], isolated = false}) {
  fs.mkdirSync(dir, {recursive:true});
  const target = path.join(dir, 'events.json');
  const previous = fs.existsSync(target) ? readDatabase(target) : null;
  // A valid current database is authoritative, even if old copies have more records.
  if (isolated || (previous && JSON.parse(previous.toString('utf8')).events.length)) return null;
  const candidates = [];
  for (const sourceDir of legacyDirs) {
    const source = path.join(sourceDir, 'events.json');
    if (!fs.existsSync(source)) continue;
    let bytes;
    try { bytes = readDatabase(source); }
    catch { throw new Error('发现无法读取的旧版数据，已保留原文件。请先检查或恢复：' + source); }
    if (JSON.parse(bytes.toString('utf8')).events.length) candidates.push({source, bytes});
  }
  if (!candidates.length) return null;
  const source = candidates[0];
  if (candidates.some(candidate => !candidate.bytes.equals(source.bytes))) {
    throw new Error('发现多份不同的旧版数据，未自动合并或覆盖。请确认需要恢复的文件：\n' + candidates.map(candidate => candidate.source).join('\n'));
  }
  const recovery = path.join(dir, 'upgrade-recovery', new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID());
  fs.mkdirSync(recovery, {recursive:true});
  fs.writeFileSync(path.join(recovery, 'legacy-events.json'), source.bytes, {flag:'wx'});
  if (previous) fs.writeFileSync(path.join(recovery, 'previous-events.json'), previous, {flag:'wx'});
  fs.writeFileSync(path.join(recovery, 'migration.json'), JSON.stringify({source:source.source, destination:target, copiedAt:new Date().toISOString()}, null, 2), {flag:'wx'});
  const temp = path.join(dir, '.events-upgrade-' + crypto.randomUUID() + '.tmp');
  let created = false;
  try {
    const descriptor = fs.openSync(temp, 'wx');
    created = true;
    try { fs.writeFileSync(descriptor, source.bytes); }
    finally { fs.closeSync(descriptor); }
    const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (previous ? !current || !current.equals(previous) : current !== null) {
      throw new Error('数据在迁移期间发生变化，已停止迁移并保留备份。请关闭其他版本后重试。');
    }
    if (candidates.some(candidate => !fs.readFileSync(candidate.source).equals(candidate.bytes))) {
      throw new Error('旧版数据在迁移期间发生变化，已停止迁移并保留备份。请关闭旧版后重试。');
    }
    fs.renameSync(temp, target);
  } finally {
    if (created && fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  return {source:source.source, recovery, count:JSON.parse(source.bytes.toString('utf8')).events.length};
}

module.exports = {dataDirectoryOptions, prepareDataDirectory};
