/** The stored textarea is never the visual anchor or focus destination. */
export function activeEditorField(target:HTMLTextAreaElement|HTMLInputElement){
 const active=document.activeElement;
 return active instanceof HTMLTextAreaElement&&target.previousElementSibling?.contains(active)?active:target;
}
export function caretRect(field:HTMLTextAreaElement|HTMLInputElement){
 const box=field.getBoundingClientRect(),css=getComputedStyle(field);
 const mirror=document.createElement('div'),mark=document.createElement('span');
 Object.assign(mirror.style,{position:'fixed',left:`${box.left}px`,top:`${box.top}px`,visibility:'hidden',pointerEvents:'none',width:`${box.width}px`,boxSizing:css.boxSizing,whiteSpace:'pre-wrap',overflowWrap:'break-word',font:css.font,lineHeight:css.lineHeight,letterSpacing:css.letterSpacing,padding:css.padding,border:css.border,tabSize:css.tabSize});
 mirror.textContent=field.value.slice(0,field.selectionStart??field.value.length);mark.textContent='\u200b';mirror.append(mark);document.body.append(mirror);
 const measured=mark.getBoundingClientRect();
 const rect={left:measured.left-field.scrollLeft,top:measured.top-field.scrollTop,bottom:measured.top-field.scrollTop+(measured.height||parseFloat(css.lineHeight)||20)};mirror.remove();return rect;
}
export function focusEditorOffset(target:HTMLTextAreaElement|HTMLInputElement,position:number){
 const fields=target.previousElementSibling?.querySelectorAll<HTMLTextAreaElement>('textarea[data-source-start]');
 const field=fields&&[...fields].reverse().find(el=>Number(el.dataset.sourceStart)<=position);
 if(!field){target.focus({preventScroll:true});target.setSelectionRange(position,position);return;}
 let offset=0,raw=Number(field.dataset.sourceStart);
 while(offset<field.value.length&&raw<position){raw+=field.value[offset]==='\n'&&field.dataset.sourceIndented==='true'?2:1;offset++;}
 field.focus({preventScroll:true});field.setSelectionRange(offset,offset);
}
