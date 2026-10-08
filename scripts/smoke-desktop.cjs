// Run with the locked Electron runtime; all writes use a fresh temporary profile.
const {app, BrowserWindow} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xevent-smoke-'));
const output = path.resolve('artifacts/desktop-smoke');
fs.mkdirSync(output, {recursive: true});
process.env.XEVENT_DATA_DIR = profile;
const errors = [];
const watchdog = setTimeout(() => {
  console.error('Desktop smoke timed out');
  app.exit(1);
}, 60000);
require('../app/main.cjs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await app.whenReady();
  let window;
  for (let attempt = 0; attempt < 100; attempt++) {
    window = BrowserWindow.getAllWindows()[0];
    if (window && !window.webContents.isLoading()) break;
    await delay(100);
  }
  assert.ok(window && !window.webContents.isLoading(), 'The real desktop page must load');
  window.webContents.on('render-process-gone', (_event, details) => errors.push(details.reason));
  const evaluate = source => window.webContents.executeJavaScript(source);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('Boolean(window.xevent && document.querySelector(".sidebar"))')) break;
    await delay(100);
  }
  assert.equal(await evaluate('Boolean(window.xevent && document.querySelector(".sidebar"))'), true);
  const initial = await evaluate('window.xevent.load()');
  assert.equal(initial.events.length, 0);
  assert.equal(initial.runtime.desktop, true);
  await evaluate('window.xevent.settings({notifications:false,dailyDigest:false})');
  await evaluate('window.xevent.sample()');
  const sample = await evaluate('window.xevent.load()');
  assert.equal(sample.events.length, 6);
  assert.equal(sample.events.filter(event => event.status !== 'completed').length, 5);
  await delay(500);
  assert.equal(await evaluate('document.body.textContent.includes("推进产品方案交付")'), true);
  fs.writeFileSync(path.join(output, 'overview.png'), (await window.webContents.capturePage()).toPNG());

  const event = await evaluate('window.xevent.upsert({title:"Desktop smoke",steps:[{title:"Persist a step",done:false}]})');
  const updated = await evaluate(`window.xevent.upsert(${JSON.stringify({...event, steps:[{...event.steps[0],done:true}], nextAction:'Verified through real IPC'})})`);
  assert.equal(updated.steps[0].done, true);
  await evaluate(`window.xevent.trash(${JSON.stringify(event.id)})`);
  assert.ok((await evaluate('window.xevent.load()')).events.find(item => item.id === event.id).deletedAt);
  await evaluate(`window.xevent.restore(${JSON.stringify(event.id)})`);
  assert.equal((await evaluate('window.xevent.load()')).events.find(item => item.id === event.id).deletedAt, '');
  assert.equal(await evaluate(`window.xevent.upsert(${JSON.stringify({...updated,deadline:'2026-02-30'})}).then(()=>false,()=>true)`), true);
  const persisted = JSON.parse(fs.readFileSync(path.join(profile, 'events.json'), 'utf8'));
  assert.equal(persisted.events.find(item => item.id === event.id).nextAction, 'Verified through real IPC');
  window.webContents.reload();
  await delay(500);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!window.webContents.isLoading() && await evaluate('Boolean(window.xevent && document.querySelector(".sidebar"))')) break;
    await delay(100);
  }
  assert.equal((await evaluate('window.xevent.load()')).events.find(item => item.id === event.id).steps[0].done, true);
  assert.deepEqual(errors, []);
  const report = {passed:true, electron:process.versions.electron, node:process.versions.node,
    checks:['real renderer and preload', 'six synthetic examples', 'real IPC create/update/trash/restore', 'invalid date rejection', 'JSON persistence', 'renderer reload'],
    notCovered:['native notification delivery', 'login startup', 'tray interaction', 'signed distribution']};
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  clearTimeout(watchdog);
  app.quit();
})().catch(error => {
  console.error(error.stack);
  clearTimeout(watchdog);
  app.exit(1);
});
