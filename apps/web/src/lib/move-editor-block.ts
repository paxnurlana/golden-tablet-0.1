import type {JournalBodyBlock} from '@/server/personal-journal';
export function moveEditorBlock(blocks:JournalBodyBlock[],id:string,target:string,after:boolean) {
  const moved=blocks.find(b=>b.id===id);
  if(!moved||id===target||!blocks.some(b=>b.id===target))return blocks;
  const next=blocks.filter(b=>b.id!==id);
  next.splice(next.findIndex(b=>b.id===target)+(after?1:0),0,moved);
  return next;
}
