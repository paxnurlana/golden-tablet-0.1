// A SQLite-only backup is not complete once video files live outside the database.
const {resolve,join}=require('node:path');
const {mkdirSync,existsSync,copyFileSync,constants,writeFileSync}=require('node:fs');
const Database=require(require.resolve('better-sqlite3',{paths:[resolve(__dirname,'../apps/web')]}));
async function main(){
 const data=process.env.NODE_ENV==='test'&&process.env.JOURNAL_DATA_DIR?resolve(process.env.JOURNAL_DATA_DIR):resolve(__dirname,'../apps/web/data');
 const target=join(data,'backups','complete-'+new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(target,{recursive:true});
 const source=new Database(join(data,'journal.db'),{readonly:true});try{await source.backup(join(target,'journal.db'));}finally{source.close();}
 const snapshot=new Database(join(target,'journal.db'),{readonly:true});let files=0;
 try{
  const records=snapshot.prepare("SELECT id,size,length(data) bytes FROM attachments").all();
  for(const record of records){
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(record.id))throw Error('Invalid attachment ID');
   const file=join(data,'media',record.id+'.media');
   if(!existsSync(file)){if(record.bytes===0&&record.size>0)throw Error('Missing media: '+record.id);continue;}
   mkdirSync(join(target,'media'),{recursive:true});
   copyFileSync(file,join(target,'media',record.id+'.media'),constants.COPYFILE_EXCL);
   const meta=join(data,'media',record.id+'.json');if(existsSync(meta))copyFileSync(meta,join(target,'media',record.id+'.json'),constants.COPYFILE_EXCL);files++;
  }
  writeFileSync(join(target,'COMPLETE.json'),JSON.stringify({createdAt:new Date().toISOString(),externalMedia:files},null,2),{flag:'wx'});
 }finally{snapshot.close();}
 console.log(JSON.stringify({backup:target,externalMedia:files}));
}
main().catch(error=>{console.error('Backup incomplete:',error.message);process.exitCode=1;});
