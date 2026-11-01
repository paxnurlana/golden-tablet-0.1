import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
it('backs up a consistent database plus external video bytes and restores them together in an isolated folder',()=>{
 const directory=mkdtempSync(join(tmpdir(),'video-backup-test-'));
 try{
  const db=new Database(join(directory,'journal.db'));db.exec('CREATE TABLE attachments(id TEXT PRIMARY KEY,size INTEGER,data BLOB)');db.prepare('INSERT INTO attachments VALUES (?,?,?)').run('clip',4,Buffer.alloc(0));db.close();
  mkdirSync(join(directory,'media'));writeFileSync(join(directory,'media','clip.media'),Buffer.from([1,2,3,4]));writeFileSync(join(directory,'media','clip.json'),'{}');
  const result=JSON.parse(execFileSync(process.execPath,[resolve('scripts/backup-local-journal.cjs')],{env:{...process.env,JOURNAL_DATA_DIR:directory},windowsHide:true}).toString());
  expect(result.externalMedia).toBe(1);expect(existsSync(join(result.backup,'COMPLETE.json'))).toBe(true);
  const restored=new Database(join(result.backup,'journal.db'),{readonly:true});try{expect(restored.prepare('SELECT size FROM attachments WHERE id=?').get('clip')).toEqual({size:4});}finally{restored.close();}
  expect(readFileSync(join(result.backup,'media','clip.media'))).toEqual(Buffer.from([1,2,3,4]));
 }finally{if(resolve(directory).startsWith(resolve(tmpdir())+'\\')&&directory.includes('video-backup-test-'))rmSync(directory,{recursive:true,force:true});}
});
