import type {JournalEntry} from '@/server/personal-journal';

export type RrBasis = {mode:'stop'|'standard'|'manual';ticks:number};
export const defaultRrBasis=():RrBasis=>({mode:'standard',ticks:50});
export function validateRrBasis(raw:unknown):RrBasis {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Некорректная база R');
 const b=raw as RrBasis;
 if(!['stop','standard','manual'].includes(b.mode)||typeof b.ticks!=='number'||!Number.isFinite(b.ticks)||b.ticks<=0||b.ticks>1e9)throw Error('База R должна быть положительным числом тиков');
 return {mode:b.mode,ticks:b.ticks};
}
export function rrDivisor(e:Pick<JournalEntry,'rrBasis'|'riskTicks'>):number|null {
 if(e.rrBasis?.mode==='manual')return null;
 const ticks=e.rrBasis?.mode==='standard'?e.rrBasis.ticks:e.riskTicks;
 return ticks!=null&&ticks>0?ticks:null;
}
export function realisedRR(e:Pick<JournalEntry,'rrBasis'|'riskTicks'|'realisedTicks'|'realisedR'>):number|null {
 const basis=rrDivisor(e);
 if(e.rrBasis&&e.rrBasis.mode!=='manual')return e.realisedTicks!=null&&basis!=null?Number((e.realisedTicks/basis).toFixed(8)):null;
 return e.realisedR??(!e.rrBasis&&e.realisedTicks!=null&&basis!=null?e.realisedTicks/basis:null);
}
