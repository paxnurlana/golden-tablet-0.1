import type {JournalEntry} from '@/server/personal-journal';
export type ReviewAccountScope={id:string;name:string;firmId:string|null};
export function filterReviewAccounts(entries:JournalEntry[],selection:string[],accounts:ReviewAccountScope[]){
  if(!selection.length)return entries;
  const ids=new Set(selection.filter(v=>v.startsWith('account:')).map(v=>v.slice(8)));
  const firms=new Set(selection.filter(v=>v.startsWith('firm:')).map(v=>v.slice(5)));
  for(const account of accounts)if(account.firmId&&firms.has(account.firmId))ids.add(account.id);
  return entries.flatMap(entry=>{const selected=entry.accounts.filter(a=>ids.has(a.accountId));return selected.length?[{...entry,accounts:selected}]:[];});
}
