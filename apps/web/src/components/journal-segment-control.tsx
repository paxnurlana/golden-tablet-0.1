"use client";
export function JournalSegmentControl<T extends string>({label,value,options,onChange}:{label:string;value:T;options:{value:T;label:string}[];onChange:(value:T)=>void}){
 return <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/[0.06] bg-accent/30 p-1">
 {options.map((option,index)=><button key={option.value} type="button" role="radio" aria-checked={value===option.value} tabIndex={value===option.value?0:-1}
 className={`rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${value===option.value?'bg-accent font-medium text-foreground shadow-sm':'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
 onClick={()=>onChange(option.value)} onKeyDown={event=>{
  const next=event.key==='ArrowRight'||event.key==='ArrowDown'?(index+1)%options.length:event.key==='ArrowLeft'||event.key==='ArrowUp'?(index+options.length-1)%options.length:event.key==='Home'?0:event.key==='End'?options.length-1:null;
  if(next!==null){event.preventDefault();onChange(options[next]!.value);(event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus({preventScroll:true});}
 }}>{option.label}</button>)}
 </div>;
}
