const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {dataDirectoryOptions, prepareDataDirectory} = require('../app/data-directory.cjs');
const {DEFAULT_SETTINGS, normalizeEvent} = require('../app/domain.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xevent-upgrade-test-'));
  const dir = path.join(root, 'XEvent'), legacy = path.join(root, 'xevent-desktop');
  const data = {version:1, settings:{...DEFAULT_SETTINGS, theme:'dark', notifications:false},
    events:[normalizeEvent({id:'active', title:'Upgrade fixture', goal:'Keep the goal', strategy:'Keep the plan', nextAction:'Keep the next action', deadline:'2026-12-01', followUp:'2026-11-01T09:00', steps:[{id:'step',title:'Keep the stage',done:true}], notes:[{id:'note',body:'Keep **the note**',at:'2026-10-10T12:00'}], links:[{id:'link',label:'Reference',url:'https://example.com'}],snoozeUntil:'2026-11-01T08:00'}),
      normalizeEvent({id:'completed',title:'Completed',status:'completed'}), normalizeEvent({id:'trash',title:'Trash',deletedAt:'2026-10-10T12:00'})],
    notificationHistory:{'follow:active':'2026-10-10T12:00'}, extraField:'Preserve unknown fields too'};
  const write = (folder, value=data) => {fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'events.json'),JSON.stringify(value,null,2));};
  return {root,dir,legacy,data,write,options:{dir,legacyDirs:[legacy]},cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('updates and renamed application metadata select the same non-versioned directory',()=>{
  const root=path.join(os.tmpdir(),'profile-options');
  for(const name of ['xevent-desktop','XEvent-1.0.2','XEvent-1.0.3']) {
    assert.equal(dataDirectoryOptions(root,path.join(root,name)).dir,path.join(root,'XEvent'));
  }
  const isolated=dataDirectoryOptions(root,path.join(root,'old'),path.join(root,'isolated'));
  assert.equal(isolated.isolated,true);assert.deepEqual(isolated.legacyDirs,[]);
});

test('first upgrade copies every legacy field byte-for-byte and leaves the old file intact',()=>{
  const f=fixture();try{f.write(f.legacy);const bytes=fs.readFileSync(path.join(f.legacy,'events.json'));
    const migrated=prepareDataDirectory(f.options);assert.equal(migrated.count,3);
    assert.deepEqual(fs.readFileSync(path.join(f.dir,'events.json')),bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.legacy,'events.json')),bytes);
    assert.deepEqual(fs.readFileSync(path.join(migrated.recovery,'legacy-events.json')),bytes);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'events.json'))),f.data);
    assert.equal(prepareDataDirectory(f.options),null);
  }finally{f.cleanup();}
});

test('a newly created empty profile can recover old matters with both originals backed up',()=>{
  const f=fixture();try{f.write(f.legacy);f.write(f.dir,{version:1,settings:DEFAULT_SETTINGS,events:[],notificationHistory:{}});
    const before=fs.readFileSync(path.join(f.dir,'events.json')),migrated=prepareDataDirectory(f.options);
    assert.deepEqual(fs.readFileSync(path.join(migrated.recovery,'previous-events.json')),before);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'events.json'))).settings.theme,'dark');
  }finally{f.cleanup();}
});

test('existing current data remains authoritative and does not resurrect old deleted records',()=>{
  const f=fixture();try{f.write(f.legacy);f.write(f.dir,{...f.data,events:[f.data.events[1]]});
    const bytes=fs.readFileSync(path.join(f.dir,'events.json'));assert.equal(prepareDataDirectory(f.options),null);
    assert.deepEqual(fs.readFileSync(path.join(f.dir,'events.json')),bytes);
  }finally{f.cleanup();}
});

test('isolated test profiles never import real or legacy user data',()=>{
  const f=fixture();try{f.write(f.legacy);assert.equal(prepareDataDirectory({...f.options,isolated:true}),null);
    assert.equal(fs.existsSync(path.join(f.dir,'events.json')),false);
  }finally{f.cleanup();}
});

test('invalid current or legacy data stops startup rather than creating an empty replacement',()=>{
  const f=fixture();try{f.write(f.legacy);fs.writeFileSync(path.join(f.legacy,'events.json'),'invalid legacy');
    assert.throws(()=>prepareDataDirectory(f.options),/旧版数据/);assert.equal(fs.existsSync(path.join(f.dir,'events.json')),false);
    f.write(f.legacy);fs.writeFileSync(path.join(f.dir,'events.json'),'invalid current');
    assert.throws(()=>prepareDataDirectory(f.options));assert.equal(fs.readFileSync(path.join(f.dir,'events.json'),'utf8'),'invalid current');
  }finally{f.cleanup();}
});

test('conflicting old profiles require a choice; identical copies are safe to recover',()=>{
  const f=fixture();try{const other=path.join(f.root,'other-old');f.write(f.legacy);f.write(other,{...f.data,events:[]});
    const options={...f.options,legacyDirs:[f.legacy,other]};assert.ok(prepareDataDirectory(options));
    fs.unlinkSync(path.join(f.dir,'events.json'));f.write(other,{...f.data,events:[normalizeEvent({title:'Different matter'})]});
    assert.throws(()=>prepareDataDirectory(options),/多份不同/);assert.equal(fs.existsSync(path.join(f.dir,'events.json')),false);
    f.write(other);assert.ok(prepareDataDirectory(options));
  }finally{f.cleanup();}
});

test('interrupted migration preserves source and recovery copies and can retry',()=>{
  const f=fixture(),rename=fs.renameSync;try{f.write(f.legacy);const original=fs.readFileSync(path.join(f.legacy,'events.json'));
    fs.renameSync=()=>{throw new Error('Simulated interrupted upgrade');};
    assert.throws(()=>prepareDataDirectory(f.options),/interrupted upgrade/);
    assert.deepEqual(fs.readFileSync(path.join(f.legacy,'events.json')),original);
    assert.equal(fs.existsSync(path.join(f.dir,'events.json')),false);
    assert.ok(fs.readdirSync(path.join(f.dir,'upgrade-recovery')).length);
    assert.equal(fs.readdirSync(f.dir).some(name=>name.endsWith('.tmp')),false);
    fs.renameSync=rename;assert.ok(prepareDataDirectory(f.options));
  }finally{fs.renameSync=rename;f.cleanup();}
});

test('concurrent edits to the source or target stop migration without overwriting those edits',()=>{
  for(const location of ['source','target']) {
    const f=fixture(),write=fs.writeFileSync;
    try {f.write(f.legacy);const changed={...f.data,events:[normalizeEvent({title:'Concurrent edit'})]};
      fs.writeFileSync=(destination,...args)=>{const result=write(destination,...args);if(typeof destination==='number')f.write(location==='source'?f.legacy:f.dir,changed);return result;};
      assert.throws(()=>prepareDataDirectory(f.options),/发生变化/);
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(location==='source'?f.legacy:f.dir,'events.json'))),changed);
      if(location==='source')assert.equal(fs.existsSync(path.join(f.dir,'events.json')),false);
    }finally{fs.writeFileSync=write;f.cleanup();}
  }
});
