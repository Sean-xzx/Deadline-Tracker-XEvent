const fs=require('node:fs');
const path=require('node:path');
const {DEFAULT_SETTINGS,normalizeStore}=require('./domain.cjs');
class Store{
  constructor(dir){this.dir=dir;this.file=path.join(dir,'events.json');fs.mkdirSync(dir,{recursive:true});this.data=fs.existsSync(this.file)?normalizeStore(JSON.parse(fs.readFileSync(this.file,'utf8'))):{version:1,settings:{...DEFAULT_SETTINGS},events:[],notificationHistory:{}};this.backedUpDay='';}
  save(){
    const day=new Date().toISOString().slice(0,10);
    if(fs.existsSync(this.file)&&day!==this.backedUpDay){this.backup();this.backedUpDay=day;}
    const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.data,null,2),'utf8');fs.renameSync(temp,this.file);
  }
  backup(){
    if(!fs.existsSync(this.file))return;
    const dir=path.join(this.dir,'backups');fs.mkdirSync(dir,{recursive:true});
    const name='xevent-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';fs.copyFileSync(this.file,path.join(dir,name));
    const names=fs.readdirSync(dir).filter(n=>/^xevent-.*\.json$/.test(n)).sort().reverse();for(const old of names.slice(14))fs.unlinkSync(path.join(dir,old));
  }
  snapshot(){return structuredClone(this.data);}
}
module.exports={Store};
