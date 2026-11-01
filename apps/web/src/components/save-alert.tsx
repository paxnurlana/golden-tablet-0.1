import {CircleAlert} from 'lucide-react';
export function SaveAlert({message,onRetry}:{message:string;onRetry:()=>void}){
 return <div role="alert" className="fixed bottom-5 right-5 z-[110] flex w-[520px] max-w-[calc(100vw-40px)] gap-4 rounded-2xl border border-amber-400/30 bg-popover p-5 text-foreground shadow-2xl">
 <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400"><CircleAlert className="size-7"/></span>
 <div className="min-w-0"><p className="text-base font-semibold">Workflow не сохранён</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Черновик сохранён на этом устройстве. {message}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-amber-400/25 px-3 py-2 text-sm font-medium hover:bg-accent">Повторить сохранение</button></div>
 </div>;
}
