const {contextBridge,ipcRenderer}=require('electron');
const call=(name,...args)=>ipcRenderer.invoke('xevent:'+name,...args).then(result=>{if(!result.ok)throw new Error(result.error);return result.value;});
contextBridge.exposeInMainWorld('xevent',{
  load:()=>call('load'),upsert:event=>call('upsert',event),trash:id=>call('trash',id),restore:id=>call('restore',id),settings:settings=>call('settings',settings),
  export:()=>call('export'),import:()=>call('import'),showData:()=>call('showData'),testNotification:()=>call('testNotification'),sample:()=>call('sample'),clearSample:()=>call('clearSample'),
  openLink:url=>call('openLink',url),window:action=>call('window',action),snooze:(id,minutes)=>call('snooze',id,minutes),
  onChange:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('xevent:change',listener);return()=>ipcRenderer.removeListener('xevent:change',listener);},
  onSelect:callback=>{const listener=(_event,id)=>callback(id);ipcRenderer.on('xevent:select',listener);return()=>ipcRenderer.removeListener('xevent:select',listener);}
});
