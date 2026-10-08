const CATEGORIES = ['study', 'work', 'life'];
const STATUSES = ['planned', 'active', 'waiting', 'completed'];
const PRIORITIES = ['high', 'normal', 'low'];
const DEFAULT_SETTINGS = Object.freeze({ theme:'light', notifications:true, closeToTray:true, launchAtLogin:false, dailyDigest:true, digestTime:'09:00', reminderLeadDays:3 });
const uid = () => globalThis.crypto.randomUUID();
const text = (value, max = 10000) => typeof value === 'string' ? value.trim().slice(0,max) : '';
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [y,m,d]=value.split('-').map(Number), date=new Date(y,m-1,d);
  return y>=2000 && y<=2200 && date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? value : '';
}
function timeValue(value, fallback='23:59') { return typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback; }
function dateTime(value) { return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && dateValue(value.slice(0,10)) && timeValue(value.slice(11,16),'') && Number.isFinite(Date.parse(value)) ? value.slice(0,40) : ''; }
function normalizeSettings(value = {}) {
  return {
    theme:['light','dark','system'].includes(value.theme)?value.theme:'light',
    notifications:typeof value.notifications==='boolean'?value.notifications:true,
    closeToTray:typeof value.closeToTray==='boolean'?value.closeToTray:true,
    launchAtLogin:value.launchAtLogin===true,
    dailyDigest:typeof value.dailyDigest==='boolean'?value.dailyDigest:true,
    digestTime:timeValue(value.digestTime,'09:00'),
    reminderLeadDays:Math.min(30,Math.max(0,Math.round(Number(value.reminderLeadDays)||0)))
  };
}
function normalizeEvent(value, now = new Date().toISOString()) {
  if (!value || typeof value !== 'object' || !text(value.title,180)) throw new Error('请填写事项名称。');
  const title=text(value.title,180);
  const rawDeadline=text(value.deadline,10);
  if(rawDeadline && !dateValue(rawDeadline))throw new Error('截止日期无效，请重新选择。');
  if(value.followUp && !dateTime(value.followUp))throw new Error('跟进时间无效，请重新选择。');
  return {
    id:typeof value.id==='string'&&/^[\w-]{1,80}$/.test(value.id)?value.id:uid(),title,
    category:CATEGORIES.includes(value.category)?value.category:'work',
    status:STATUSES.includes(value.status)?value.status:'planned',
    priority:PRIORITIES.includes(value.priority)?value.priority:'normal',
    starred:value.starred===true,demo:value.demo===true,deadline:dateValue(rawDeadline),deadlineTime:timeValue(value.deadlineTime),followUp:dateTime(value.followUp),
    goal:text(value.goal),strategy:text(value.strategy),nextAction:text(value.nextAction,500),
    steps:(Array.isArray(value.steps)?value.steps:[]).slice(0,200).filter(s=>s&&text(s.title,300)).map(s=>({id:typeof s.id==='string'?s.id.slice(0,80):uid(),title:text(s.title,300),done:s.done===true})),
    notes:(Array.isArray(value.notes)?value.notes:[]).slice(0,2000).filter(n=>n&&text(n.body)).map(n=>({id:typeof n.id==='string'?n.id.slice(0,80):uid(),body:text(n.body),at:dateTime(n.at)||now})),
    links:(Array.isArray(value.links)?value.links:[]).slice(0,100).filter(l=>l&&/^https?:\/\//i.test(l.url||'')).map(l=>({id:typeof l.id==='string'?l.id.slice(0,80):uid(),label:text(l.label,180)||text(l.url,2000),url:text(l.url,2000)})),
    createdAt:dateTime(value.createdAt)||now,updatedAt:dateTime(value.updatedAt)||now,
    completedAt:value.status==='completed'?(dateTime(value.completedAt)||now):'',deletedAt:dateTime(value.deletedAt),snoozeUntil:dateTime(value.snoozeUntil)
  };
}
function normalizeStore(raw) {
  if(!raw || typeof raw !=='object' || raw.version!==1 || !Array.isArray(raw.events)) throw new Error('这不是有效的 XEvent 备份文件。');
  if(raw.events.length>10000)throw new Error('备份中的事项数量过多。');
  const ids=new Set();
  const events=raw.events.map(e=>normalizeEvent(e));
  for(const event of events){if(ids.has(event.id))throw new Error('备份中存在重复的事项编号。');ids.add(event.id);}
  return {version:1,settings:normalizeSettings({...DEFAULT_SETTINGS,...raw.settings}),events,notificationHistory:raw.notificationHistory&&typeof raw.notificationHistory==='object'&&!Array.isArray(raw.notificationHistory)?Object.fromEntries(Object.entries(raw.notificationHistory).filter(([k,v])=>k.length<200&&dateTime(v)).slice(-2000)): {}};
}
function localDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
function deadlineAt(event){return event.deadline ? new Date(`${event.deadline}T${event.deadlineTime||'23:59'}`) : null;}
function daysUntil(date,now=new Date()){
  if(!date)return null;
  const [y,m,d]=date.split('-').map(Number);
  return Math.round((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000);
}
function attention(event,now=new Date(),lead=3){
  if(event.deletedAt||event.status==='completed')return null;
  const due=deadlineAt(event);
  if(due&&due<=now)return {kind:'overdue',label:'已逾期',rank:0};
  if(event.followUp&&new Date(event.followUp)<=now)return {kind:'follow',label:'待跟进',rank:1};
  const days=daysUntil(event.deadline,now);
  if(days!==null&&days<=lead)return {kind:'soon',label:days===0?'今天截止':`${days} 天后截止`,rank:2};
  return null;
}
function progress(event){const all=event.steps.length;return {done:event.steps.filter(s=>s.done).length,total:all,percent:all?Math.round(event.steps.filter(s=>s.done).length/all*100):(event.status==='completed'?100:0)};}
function smartSort(events,now=new Date(),lead=3){return [...events].sort((a,b)=>{
  const ar=attention(a,now,lead)?.rank??3,br=attention(b,now,lead)?.rank??3;
  if(ar!==br)return ar-br;
  if(a.starred!==b.starred)return a.starred?-1:1;
  const ranks={high:0,normal:1,low:2};if(ranks[a.priority]!==ranks[b.priority])return ranks[a.priority]-ranks[b.priority];
  return (a.deadline||'9999').localeCompare(b.deadline||'9999')||b.updatedAt.localeCompare(a.updatedAt);
});}
function reminderCandidates(store, now=new Date()){
  if(!store.settings.notifications)return [];
  const result=[];
  for(const event of store.events){
    if(event.deletedAt||event.status==='completed'||(event.snoozeUntil&&new Date(event.snoozeUntil)>now))continue;
    if(event.snoozeUntil&&new Date(event.snoozeUntil)<=now)result.push({key:`snooze:${event.id}:${event.snoozeUntil}`,eventId:event.id,title:'稍后提醒 · 时间到了',body:`${event.title}${event.nextAction?' · '+event.nextAction:''}`});
    if(event.followUp&&new Date(event.followUp)<=now){result.push({key:`follow:${event.id}:${event.followUp}`,eventId:event.id,title:'该跟进这件事了',body:`${event.title}${event.nextAction?' · '+event.nextAction:''}`});}
    const due=deadlineAt(event);
    if(due){
      if(due<=now)result.push({key:`overdue:${event.id}:${event.deadline}:${event.deadlineTime}`,eventId:event.id,title:'一件重要事项已经到期',body:`${event.title} · 请检查进展或调整计划`});
      else{const leadAt=new Date(due);leadAt.setDate(leadAt.getDate()-store.settings.reminderLeadDays);leadAt.setHours(9,0,0,0);if(leadAt<=now)result.push({key:`deadline:${event.id}:${event.deadline}:${event.deadlineTime}:${store.settings.reminderLeadDays}`,eventId:event.id,title:'截止日期临近',body:`${event.title} · ${event.deadline} ${event.deadlineTime} 截止`});}
    }
  }
  return result.filter(r=>!store.notificationHistory[r.key]);
}
function sampleEvents(now=new Date()){
  const day=n=>{const d=new Date(now);d.setDate(d.getDate()+n);return localDay(d);};
    const make=(title,category,status,offset,nextAction,goal,strategy,steps,done,starred=false,priority='normal')=>normalizeEvent({title,category,status,deadline:offset===null?'':day(offset),followUp:`${day(status==='waiting'?0:2)}T${status==='waiting'?'08:00':'10:00'}`,nextAction,goal,strategy,starred,priority,steps:steps.map((title,i)=>({title,done:i<done})),notes:[{body:'这是示例事项，可以自由编辑，或在设置中将示例移入回收站。',at:now.toISOString()}]});
  return [
    make('完成年度项目申请','study','active',10,'核对材料清单，修改个人陈述','按时提交完整的申请材料，并留存回执。','从截止日期倒排时间，至少预留两天审核材料。先完成关键内容，再统一检查格式。',['确认申请条件','准备申请材料','审核并提交'],1,true,'high'),
    make('推进产品方案交付','work','active',3,'完善验收清单，确认交付范围','交付经过确认的产品方案和配套说明。','先对齐验收标准，再补齐具体材料。将待确认问题集中发给对方。',['对齐需求范围','完善交付材料','完成验收确认'],1,true,'high'),
    make('跟进合作机会','work','waiting',null,'询问对方是否收到方案','明确合作意向，并确定下一次沟通时间。','先确认意向，再投入进一步准备。如果本周没有回复，安排一次简短跟进。',['发送合作方案','确认合作意向','约定后续安排'],1),
    make('安排新家的搬迁','life','planned',25,'列出物品清单，比较两家报价','完成搬家、旧房交接和新家整理。','先确认日期和预算，再预约服务。按房间分批整理，重要物品单独收纳。',['确定日期与预算','打包并预约服务','搬家和交接'],0),
    make('整理本月学习计划','study','active',7,'完成阅读笔记第一部分','梳理本月学习重点，并完成阶段复盘。','每次安排一个明确的小目标，完成后立即记下问题与下一步。',['梳理学习重点','完成阅读与实践','整理阶段复盘'],1),
    make('完成个人资料归档','life','completed',-2,'','重要文件分类归档，并保留备份。','先分类，再统一命名，最后做一次备份。',['分类文件','统一命名','完成备份'],3)
  ].map(e=>({...e,demo:true}));
}
module.exports={CATEGORIES,STATUSES,PRIORITIES,DEFAULT_SETTINGS,uid,dateValue,timeValue,dateTime,normalizeSettings,normalizeEvent,normalizeStore,localDay,deadlineAt,daysUntil,attention,progress,smartSort,reminderCandidates,sampleEvents};
