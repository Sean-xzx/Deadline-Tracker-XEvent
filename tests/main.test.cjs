const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createRequire}=require('node:module');
const {normalizeEvent,DEFAULT_SETTINGS}=require('../app/domain.cjs');
// Run the actual main-process handlers against real files, with the OS window/dialog boundary stubbed.
async function harness(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xevent-ipc-')),handlers=new Map(),notifications=[];
  let window,openPath,savePath,loginSettings;
  class FakeWindow{
    constructor(){window=this;this.webContents={send(){},setWindowOpenHandler(){},on(){}};}
    on(){}once(){}setMenuBarVisibility(){}loadFile(){}show(){}hide(){}focus(){}isMinimized(){return false;}isDestroyed(){return false;}isVisible(){return true;}isMaximized(){return false;}
  }
  class FakeNotification{constructor(options){notifications.push(options);}static isSupported(){return true;}on(){}show(){}}
  const electron={
    app:{setName(){},setAppUserModelId(){},setToastActivatorCLSID(){},setPath(){},requestSingleInstanceLock:()=>true,on(){},whenReady:()=>Promise.resolve(),getPath:key=>key==='userData'?dir:path.join(dir,'XEvent.exe'),getVersion:()=> '1.0.0',isPackaged:true,setLoginItemSettings:value=>loginSettings=value,quit(){}},
    BrowserWindow:FakeWindow,ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},Notification:FakeNotification,
    Tray:class{setToolTip(){}on(){}setContextMenu(){}},Menu:{buildFromTemplate:v=>v},nativeImage:{createFromPath:()=>({})},nativeTheme:{themeSource:'light'},
    dialog:{showErrorBox:(_title,message)=>{throw new Error(message);},showSaveDialog:async()=>({canceled:false,filePath:savePath}),showOpenDialog:async()=>({canceled:false,filePaths:[openPath]})},
    shell:{openPath:async()=>'',openExternal:async()=>{},writeShortcutLink(){}}
  };
  const appFile=path.resolve('app/main.cjs'),nativeRequire=createRequire(appFile);
  const context={require:name=>name==='electron'?electron:nativeRequire(name),__dirname:path.dirname(appFile),process:{env:{XEVENT_DATA_DIR:dir},argv:[],platform:'win32'},console,setInterval:()=>1,clearInterval(){},setTimeout:()=>1,structuredClone};
  vm.runInNewContext(fs.readFileSync(appFile,'utf8'),context,{filename:appFile});await Promise.resolve();await Promise.resolve();
  const sender=()=>({sender:window.webContents,senderFrame:{url:'file:///test/index.html'}});
  async function call(name,...args){const result=await handlers.get('xevent:'+name)(sender(),...args);if(!result.ok)throw new Error(result.error);return result.value;}
  return {dir,call,handlers,sender,notifications,setSavePath:v=>savePath=v,setOpenPath:v=>openPath=v,getLogin:()=>loginSettings,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('桌面 API 新增、更新、移入回收站和恢复都写入实际数据文件',async()=>{const h=await harness();try{let e=await h.call('upsert',{title:'桌面保存验证',steps:[{title:'确认内容',done:false}]});assert.equal(JSON.parse(fs.readFileSync(path.join(h.dir,'events.json'))).events[0].title,e.title);e=await h.call('upsert',{...e,nextAction:'完成下一步'});assert.equal((await h.call('load')).events[0].nextAction,'完成下一步');await h.call('trash',e.id);assert.ok((await h.call('load')).events[0].deletedAt);await h.call('restore',e.id);assert.equal((await h.call('load')).events[0].deletedAt,'');await assert.rejects(()=>h.call('upsert',{...e,deadline:'2026-02-30'}));assert.equal((await h.call('load')).events[0].deadline,'');}finally{h.cleanup();}});
test('桌面导出与导入备份正确合并，并保留当前偏好和自动备份',async()=>{const h=await harness();try{const e=await h.call('upsert',{title:'原来的事项'}),exportPath=path.join(h.dir,'export.json');h.setSavePath(exportPath);assert.equal(await h.call('export'),exportPath);const exported=JSON.parse(fs.readFileSync(exportPath,'utf8'));assert.equal(exported.events[0].id,e.id);const incoming={version:1,settings:{...DEFAULT_SETTINGS,theme:'dark'},events:[normalizeEvent({title:'导入的事项'})],notificationHistory:{}};const importPath=path.join(h.dir,'import.json');fs.writeFileSync(importPath,JSON.stringify(incoming));h.setOpenPath(importPath);const result=await h.call('import');assert.equal(result.added,1);const loaded=await h.call('load');assert.equal(loaded.events.length,2);assert.equal(loaded.settings.theme,'light');assert.ok(fs.readdirSync(path.join(h.dir,'backups')).length);}finally{h.cleanup();}});
test('偏好、开机启动和稍后提醒通过桌面 API 保存；仅 HTTP 链接可打开',async()=>{const h=await harness();try{await h.call('settings',{theme:'dark',launchAtLogin:true});assert.equal(h.getLogin().openAtLogin,true);assert.equal((await h.call('load')).settings.theme,'dark');const e=await h.call('upsert',{title:'稍后跟进'});const updated=await h.call('snooze',e.id,60);assert.ok(new Date(updated.snoozeUntil)>new Date());assert.equal(await h.call('testNotification'),true);assert.equal(h.notifications.length,1);await assert.rejects(()=>h.call('openLink','file:///private'));await assert.rejects(()=>h.call('openLink','javascript:alert(1)'));}finally{h.cleanup();}});
test('桌面 API 拒绝来自其他页面的请求',async()=>{const h=await harness();try{const result=await h.handlers.get('xevent:load')({sender:{},senderFrame:{url:'https://example.com'}});assert.equal(result.ok,false);}finally{h.cleanup();}});
