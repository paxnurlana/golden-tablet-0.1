import {it,expect,vi,beforeAll,afterAll} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,basename} from 'node:path';
let directory='';vi.mock('@/db',()=>({dataDir:()=>directory}));
import {listProcessReports,patchProcessReport} from '../src/server/process-progress';
import {reviewConnection} from '../src/server/trading-review';
import {emptyProcessReport,LEGACY_PROCESS_CRITERIA} from '../src/lib/process-equity';
beforeAll(()=>{directory=mkdtempSync(join(tmpdir(),'process-equity-test-'));vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));});
afterAll(()=>{vi.useRealTimers();if(resolve(directory).startsWith(resolve(tmpdir())+'\\')&&basename(directory).startsWith('process-equity-test-'))rmSync(directory,{recursive:true,force:true});});
it('patches only the requested field, persists explanations and ratings, and retains revision history',()=>{
 patchProcessReport({date:'2026-10-19',op:'item',id:'preparation',text:'Prepared'});
 const first=patchProcessReport({date:'2026-10-19',op:'item',id:'preparation',score:1});
 const second=patchProcessReport({date:'2026-10-19',op:'item',id:'risk',score:0});
 expect(second.items[0]).toMatchObject({text:'Prepared',score:1});expect(second.items[1]!.score).toBe(0);expect(second.revision).toBe(first.revision+1);
 expect(listProcessReports().find(r=>r.date==='2026-10-19')?.items[0]?.text).toBe('Prepared');
 const db=reviewConnection();try{expect(db.prepare('SELECT count(*) n FROM personal_process_report_history WHERE date=?').get('2026-10-19')).toEqual({n:3});}finally{db.close();}
});
it('supports removable extra items but protects core items and validates every score',()=>{
 const added=patchProcessReport({date:'2026-10-20',op:'add',name:'Focus'}),extra=added.items.at(-1)!;expect(extra.name).toBe('Focus');
 patchProcessReport({date:added.date,op:'item',id:extra.id,score:-2,text:'Distracted'});
 expect(patchProcessReport({date:added.date,op:'remove',id:extra.id}).items).toHaveLength(4);
 expect(()=>patchProcessReport({date:added.date,op:'remove',id:'risk'})).toThrow();
 for(const score of [2,1.2,'1',-4])expect(()=>patchProcessReport({date:added.date,op:'item',id:'risk',score})).toThrow();
 expect(()=>patchProcessReport({date:'2026-10-26',op:'item',id:'risk',score:1})).toThrow();
});
it('allows weekend +/-3 improvement and never permits demos through a write endpoint',()=>{
 expect(patchProcessReport({date:'2026-10-24',op:'weekly',score:3,text:'Studied'}).weekly).toEqual({score:3,text:'Studied'});
 expect(()=>patchProcessReport({date:'2026-10-23',op:'weekly',score:3})).toThrow();expect(listProcessReports().some(r=>r.demo)).toBe(false);
});
it('retains old labels, meaning, scores and protected core fields while new reports use v2',()=>{
 patchProcessReport({date:'2026-10-21',op:'item',id:'preparation',score:1});
 const old={...emptyProcessReport('2026-10-21'),criteriaVersion:undefined,items:LEGACY_PROCESS_CRITERIA.map(c=>({...c,text:'Original answer',score:1}))};
 const db=reviewConnection();try{db.prepare('UPDATE personal_process_reports SET content=? WHERE date=?').run(JSON.stringify(old),old.date);}finally{db.close();}
 const edited=patchProcessReport({date:old.date,op:'item',id:'improvement',text:'Updated old day review'});
 expect(edited.items.at(-1)).toMatchObject({id:'improvement',name:'Daily Improvement',score:1,text:'Updated old day review'});
 expect(()=>patchProcessReport({date:old.date,op:'remove',id:'improvement'})).toThrow();
 const current=patchProcessReport({date:'2026-10-22',op:'item',id:'management',text:'Held to plan',score:1});
 expect(current.criteriaVersion).toBe(2);expect(current.items.at(-1)).toMatchObject({name:'Сопровождение и выход',text:'Held to plan',score:1});
 expect(()=>patchProcessReport({date:current.date,op:'remove',id:'management'})).toThrow();
});
