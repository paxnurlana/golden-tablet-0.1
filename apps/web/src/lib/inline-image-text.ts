const markers=/\[\[image:[a-zA-Z0-9_-]+\]\]/g;
export function imageVisibleText(text:string){return text.replace(markers,'');}
export function imageSourceOffset(text:string,position:number){
 let offset=position,removed=0;
 for(const m of text.matchAll(markers)){if(m.index!-removed<position)offset+=m[0].length;removed+=m[0].length;}
 return offset;
}
export function mergeImageText(edited:string,original:string){
 const visible=imageVisibleText(original);let start=0;
 while(start<visible.length&&start<edited.length&&visible[start]===edited[start])start++;
 let oldEnd=visible.length,newEnd=edited.length;
 while(oldEnd>start&&newEnd>start&&visible[oldEnd-1]===edited[newEnd-1]){oldEnd--;newEnd--;}
 const delta=newEnd-oldEnd;
 let removed=0;
 const images=[...original.matchAll(markers)].map(m=>{
  const anchor=m.index!-removed;removed+=m[0].length;
  return {marker:m[0],at:anchor<start?anchor:anchor>=oldEnd?anchor+delta:newEnd};
 });
 let result=edited;
 for(const image of images.reverse()){const at=Math.max(0,Math.min(edited.length,image.at));result=result.slice(0,at)+image.marker+result.slice(at);}
 return result;
}
