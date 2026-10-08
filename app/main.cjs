const {app,BrowserWindow,ipcMain,Tray,Menu,Notification,dialog,shell,nativeTheme,nativeImage}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {Store}=require('./store.cjs');
const {normalizeEvent,normalizeStore,normalizeSettings,reminderCandidates,attention,localDay,sampleEvents}=require('./domain.cjs');
const APP_ID='com.xevent.desktop';
const TOAST_CLSID='{C9155F20-274A-4CDA-9AEF-6E62D9285F0B}';
app.setName('XEvent');
app.setAppUserModelId(APP_ID);
app.setToastActivatorCLSID(TOAST_CLSID);
if(process.env.XEVENT_DATA_DIR)app.setPath('userData',path.resolve(process.env.XEVENT_DATA_DIR));
let win,tray,store,quitting=false,timer;
const locked=app.requestSingleInstanceLock();
if(!locked)app.quit();
const iconPath=path.join(__dirname,'..','assets','icon.ico');
function show(id){if(!win)return;win.show();if(win.isMinimized())win.restore();win.focus();if(id)win.webContents.send('xevent:select',id);}
function broadcast(){if(win&&!win.isDestroyed())win.webContents.send('xevent:change',store.snapshot());}
function mutate(action){const before=store.snapshot();try{const result=action();store.save();broadcast();return result;}catch(error){store.data=before;throw error;}}
function notify(title,body,eventId,keys=[]){
  if(!Notification.isSupported())return false;
  const n=new Notification({title,body,icon:iconPath,timeoutType:'default'});
  n.on('click',()=>show(eventId));
  n.on('failed',(_event,error)=>{for(const key of keys)delete store.data.notificationHistory[key];try{store.save();}catch{}console.error('Notification failed:',error);});
  n.show();return true;
}
function checkReminders(){
  if(!store||!store.data.settings.notifications)return;
  const now=new Date(),items=reminderCandidates(store.data,now);
  const settings=store.data.settings;
  let changed=false;
  if(items.length){
    // A resumed session sends one summary rather than a stack of old reminders.
    const groups=new Map();for(const item of items)groups.set(item.eventId,[...(groups.get(item.eventId)||[]),item]);
    const grouped=groups.size>2;
    const sent=grouped?notify('有 '+groups.size+' 件事项需要关注',[...groups.keys()].slice(0,3).map(id=>store.data.events.find(e=>e.id===id)?.title).filter(Boolean).join('、'),items[0].eventId,items.map(i=>i.key)):false;
    for(const list of groups.values()){if(sent||(!grouped&&notify(list[0].title,list[0].body,list[0].eventId,list.map(i=>i.key)))){for(const item of list)store.data.notificationHistory[item.key]=now.toISOString();changed=true;}}
  }
  const digestKey='digest:'+localDay(now),digestAt=new Date(`${localDay(now)}T${settings.digestTime}`);
  if(settings.dailyDigest&&now>=digestAt&&!store.data.notificationHistory[digestKey]){
    const needs=store.data.events.filter(e=>attention(e,now,settings.reminderLeadDays));
    if(needs.length&&!items.length&&notify('今天的重大事项',`${needs.length} 件需要关注 · ${needs.slice(0,3).map(e=>e.title).join('、')}`,needs[0].id,[digestKey])){store.data.notificationHistory[digestKey]=now.toISOString();changed=true;}
    else if(items.length||!needs.length){store.data.notificationHistory[digestKey]=now.toISOString();changed=true;}
  }
  if(changed){const history=Object.entries(store.data.notificationHistory).sort((a,b)=>a[1].localeCompare(b[1])).slice(-2000);store.data.notificationHistory=Object.fromEntries(history);try{store.save();broadcast();}catch(error){console.error(error);}}
}
function registerIPC(){
  const handlers={
    load:()=>({...store.snapshot(),runtime:{desktop:true,dataPath:store.dir,version:app.getVersion(),notificationSupported:Notification.isSupported(),packaged:app.isPackaged}}),
    upsert:(_event,value)=>mutate(()=>{const now=new Date().toISOString(),old=store.data.events.find(e=>e.id===value?.id),next=normalizeEvent({...value,createdAt:old?.createdAt||now,updatedAt:now});if(old&&old.deletedAt)throw new Error('请先从回收站恢复这个事项。');if(old)store.data.events[store.data.events.indexOf(old)]=next;else store.data.events.unshift(next);return next;}),
    trash:(_event,id)=>mutate(()=>{const e=store.data.events.find(e=>e.id===id);if(!e)throw new Error('找不到这个事项。');e.deletedAt=new Date().toISOString();e.updatedAt=e.deletedAt;return e;}),
    restore:(_event,id)=>mutate(()=>{const e=store.data.events.find(e=>e.id===id);if(!e)throw new Error('找不到这个事项。');e.deletedAt='';e.updatedAt=new Date().toISOString();return e;}),
    settings:(_event,settings)=>{
      const next=normalizeSettings({...store.data.settings,...settings});
      if(next.launchAtLogin!==store.data.settings.launchAtLogin){if(!app.isPackaged)throw new Error('请在打包后的 EXE 中设置开机启动。');app.setLoginItemSettings({openAtLogin:next.launchAtLogin,path:process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe'),args:['--hidden']});}
      return mutate(()=>{store.data.settings=next;nativeTheme.themeSource=next.theme;return next;});
    },
    export:async()=>{
      const result=await dialog.showSaveDialog(win,{title:'导出 XEvent 备份',defaultPath:`XEvent-备份-${localDay()}.json`,filters:[{name:'XEvent 备份',extensions:['json']}]});
      if(result.canceled)return null;fs.writeFileSync(result.filePath,JSON.stringify(store.snapshot(),null,2),'utf8');return result.filePath;
    },
    import:async()=>{
      const result=await dialog.showOpenDialog(win,{title:'导入 XEvent 备份',properties:['openFile'],filters:[{name:'XEvent 备份',extensions:['json']}]});if(result.canceled)return null;
      const filename=result.filePaths[0];if(fs.statSync(filename).size>20*1024*1024)throw new Error('备份文件超过 20 MB，请检查文件。');
      const incoming=normalizeStore(JSON.parse(fs.readFileSync(filename,'utf8')));
      return mutate(()=>{store.backup();let added=0,updated=0;for(const e of incoming.events){const i=store.data.events.findIndex(old=>old.id===e.id);if(i<0){store.data.events.push(e);added++;}else if(e.updatedAt>store.data.events[i].updatedAt){store.data.events[i]=e;updated++;}}return {added,updated};});
    },
    showData:()=>shell.openPath(store.dir).then(error=>{if(error)throw new Error(error);return true;}),
    testNotification:()=>{if(!notify('XEvent · 提醒已就绪','这是测试通知。点击后会打开你的重大事项工作台。'))throw new Error('当前系统不支持通知。');return true;},
    sample:()=>mutate(()=>{if(store.data.events.some(e=>e.demo&&!e.deletedAt))throw new Error('示例事项已经载入。');store.data.events.push(...sampleEvents());return true;}),
    clearSample:()=>mutate(()=>{for(const event of store.data.events){if(event.demo&&!event.deletedAt){event.deletedAt=new Date().toISOString();event.updatedAt=event.deletedAt;}}return true;}),
    snooze:(_event,id,minutes)=>mutate(()=>{const e=store.data.events.find(e=>e.id===id);if(!e)throw new Error('找不到这个事项。');const n=[30,60,180,1440].includes(minutes)?minutes:60;e.snoozeUntil=new Date(Date.now()+n*60000).toISOString();return e;}),
    openLink:(_event,url)=>{if(typeof url!=='string'||!/^https?:\/\//i.test(url))throw new Error('仅支持打开 HTTP 或 HTTPS 链接。');return shell.openExternal(url);},
    window:(_event,action)=>{if(action==='minimize')win.minimize();else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize();}else if(action==='close')win.close();return true;}
  };
  for(const [name,handler]of Object.entries(handlers))ipcMain.handle('xevent:'+name,async(event,...args)=>{
    if(event.sender!==win.webContents||!event.senderFrame?.url.startsWith('file://'))return {ok:false,error:'无法处理这个请求。'};
    try{return {ok:true,value:await handler(event,...args)};}catch(error){console.error(name,error.message);return {ok:false,error:error.message||'操作失败，请稍后重试。'};}
  });
}
function registerWindowsIntegration(){
  if(process.platform!=='win32'||!app.isPackaged||process.env.XEVENT_DATA_DIR)return;
  const programs=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs');
  fs.mkdirSync(programs,{recursive:true});
  const executable=process.env.PORTABLE_EXECUTABLE_FILE||app.getPath('exe');
  const permanentIcon=path.join(store.dir,'icon.ico');fs.copyFileSync(iconPath,permanentIcon);
  shell.writeShortcutLink(path.join(programs,'XEvent.lnk'),'create',{target:executable,cwd:path.dirname(executable),description:'XEvent · 重大事项工作台',icon:permanentIcon,iconIndex:0,appUserModelId:APP_ID,toastActivatorClsid:TOAST_CLSID});
}
function createWindow(){
  win=new BrowserWindow({width:1440,height:940,minWidth:1000,minHeight:680,title:'XEvent · 重大事项',icon:iconPath,frame:false,show:false,backgroundColor:'#f6f7f4',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
  win.on('close',event=>{if(!quitting&&store.data.settings.closeToTray&&tray){event.preventDefault();win.hide();}});
  win.once('ready-to-show',()=>{if(!process.argv.includes('--hidden'))win.show();});
  // Some Windows GPU/occlusion states delay the first paint; never leave a normal launch invisible.
  setTimeout(()=>{if(win&&!win.isDestroyed()&&!process.argv.includes('--hidden')&&!win.isVisible())win.show();},2000);
  win.webContents.on('did-fail-load',(_event,code,description)=>console.error('Page load failed:',code,description));
  win.webContents.on('render-process-gone',(_event,details)=>console.error('Renderer stopped:',details.reason));
  win.loadFile(path.join(__dirname,'index.html'));
}
if(locked){
 app.on('second-instance',()=>show());
 app.whenReady().then(()=>{
   try{store=new Store(app.getPath('userData'));}catch(error){dialog.showErrorBox('XEvent 无法读取数据','原文件已保留，没有覆盖。请检查数据文件或从备份恢复。\n\n'+error.message);quitting=true;return app.quit();}
   nativeTheme.themeSource=store.data.settings.theme;
   try{registerWindowsIntegration();}catch(error){console.error('Windows integration:',error.message);}
   registerIPC();createWindow();
   tray=new Tray(nativeImage.createFromPath(iconPath));tray.setToolTip('XEvent · 重大事项');tray.on('double-click',()=>show());tray.on('click',()=>show());
   tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 XEvent',click:()=>show()},{label:'查看待跟进事项',click:()=>{show();win.webContents.send('xevent:select','attention');}},{type:'separator'},{label:'退出 XEvent',click:()=>{quitting=true;app.quit();}}]));
   timer=setInterval(checkReminders,30000);setTimeout(checkReminders,5000);
 }).catch(error=>{dialog.showErrorBox('XEvent 启动失败',error.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;clearInterval(timer);});
 app.on('window-all-closed',()=>{if(!tray)app.quit();});
}
