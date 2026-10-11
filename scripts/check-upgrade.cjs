// Real Electron sessions, using synthetic data and an isolated appData directory.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {DEFAULT_SETTINGS, normalizeEvent} = require('../app/domain.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

if (!process.versions.electron) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xevent-real-upgrade-'));
  const legacy = path.join(root, 'roaming', 'xevent-desktop');
  fs.mkdirSync(legacy, {recursive:true});
  const data = {version:1, settings:{...DEFAULT_SETTINGS, theme:'dark', notifications:false, dailyDigest:false},
    events:[normalizeEvent({id:'upgrade-active',title:'Synthetic upgrade matter',goal:'Keep goal',strategy:'Keep strategy',nextAction:'Before upgrade',deadline:'2026-12-01',followUp:'2026-11-01T09:00',steps:[{id:'step',title:'Keep stage',done:true}],notes:[{id:'note',body:'Keep **Markdown**',at:'2026-10-10T12:00'}],links:[{id:'link',label:'Resource',url:'https://example.com'}]}),
      normalizeEvent({id:'upgrade-completed',title:'Synthetic completed matter',status:'completed'}),
      normalizeEvent({id:'upgrade-trash',title:'Synthetic trashed matter',deletedAt:'2026-10-10T12:00'})],
    notificationHistory:{'fixture-key':'2026-10-10T12:00'}};
  fs.writeFileSync(path.join(legacy,'events.json'), JSON.stringify(data,null,2));
  const original = fs.readFileSync(path.join(legacy,'events.json'));
  const env = {...process.env, XEVENT_UPGRADE_ROOT:root};
  delete env.XEVENT_DATA_DIR;
  delete env.ELECTRON_RUN_AS_NODE;
  async function session(phase) {
    const child = spawn(require('electron'), [__filename, '--hidden'], {env:{...env,XEVENT_UPGRADE_PHASE:phase},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output=''; child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
    const timeout=setTimeout(()=>child.kill(),90000);
    try { await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Upgrade session '+phase+' failed: '+output)));}); }
    finally { clearTimeout(timeout); }
    assert.ok(fs.existsSync(path.join(root,phase+'.json')), 'Child must complete its assertions');
  }
  (async()=>{
    await session('first');await session('second');
    assert.deepEqual(fs.readFileSync(path.join(legacy,'events.json')),original);
    const result={passed:true,checks:['real Electron legacy recovery','stable directory after metadata changes','notes/stages/links/preferences/completed/trash retained','edits retained across two sessions','legacy original unchanged'],isolatedProfile:root};
    fs.mkdirSync('artifacts/upgrade-smoke',{recursive:true});
    fs.writeFileSync('artifacts/upgrade-smoke/report.json',JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  })().catch(error=>{console.error(error.stack);process.exitCode=1;});
} else {
  const {app,BrowserWindow}=require('electron');
  const root=process.env.XEVENT_UPGRADE_ROOT,phase=process.env.XEVENT_UPGRADE_PHASE;
  assert.ok(root && ['first','second'].includes(phase),'Use the Node parent to create isolated data');
  const roaming=path.join(root,'roaming');
  const cached=path.join(roaming,phase==='first'?'old-app-metadata':'new-app-metadata');
  fs.mkdirSync(cached,{recursive:true});
  app.setPath('appData',roaming);app.setPath('userData',cached);
  app.setName(phase==='first'?'Old build':'New build');
  const watchdog=setTimeout(()=>{console.error('Upgrade child timed out');app.exit(1);},60000);
  require('../app/main.cjs');
  (async()=>{
    await app.whenReady();let window;
    for(let n=0;n<100;n++){window=BrowserWindow.getAllWindows()[0];if(window&&!window.webContents.isLoading())break;await delay(100);}
    assert.ok(window&&!window.webContents.isLoading(),'Desktop must load');
    const evaluate=source=>window.webContents.executeJavaScript(source);
    for(let n=0;n<100;n++){if(await evaluate('Boolean(window.xevent)'))break;await delay(100);}
    const loaded=await evaluate('window.xevent.load()');
    assert.equal(loaded.runtime.dataPath,path.join(roaming,'XEvent'));
    assert.equal(loaded.events.length,3);assert.equal(loaded.settings.theme,'dark');
    const {runtime,...snapshot}=loaded;
    if(phase==='first'){
      const legacy=JSON.parse(fs.readFileSync(path.join(roaming,'xevent-desktop','events.json')));
      assert.deepEqual(snapshot,legacy);
      const updated={...loaded.events[0],nextAction:'After upgrade',notes:[...loaded.events[0].notes,{id:'new-note',body:'Saved in first session',at:'2026-10-11T12:00'}]};
      await evaluate('window.xevent.upsert('+JSON.stringify(updated)+')');
      const {runtime:nextRuntime,...next}=await evaluate('window.xevent.load()');
      fs.writeFileSync(path.join(root,'first.json'),JSON.stringify(next));
    } else {
      assert.deepEqual(snapshot,JSON.parse(fs.readFileSync(path.join(root,'first.json'))));
      fs.writeFileSync(path.join(root,'second.json'),JSON.stringify({passed:true}));
    }
    clearTimeout(watchdog);app.quit();
  })().catch(error=>{console.error(error.stack);clearTimeout(watchdog);app.exit(1);});
}
