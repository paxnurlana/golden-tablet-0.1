export function slashMenuPosition(anchor:{left:number;top:number;bottom:number},viewport:{width:number;height:number},contentHeight:number){
 const margin=8,gap=4,width=Math.min(240,Math.max(0,viewport.width-margin*2));
 const bottom=Math.max(margin,Math.min(anchor.bottom,viewport.height-margin));
 const top=Math.max(margin,Math.min(anchor.top,viewport.height-margin));
 const below=Math.max(0,viewport.height-margin-bottom-gap),above=Math.max(0,top-margin-gap);
 const desired=Math.min(contentHeight,360,viewport.height-margin*2);
 if(Math.max(above,below)<48)return {left:Math.max(margin,Math.min(anchor.left,viewport.width-width-margin)),top:margin,width,maxHeight:Math.max(0,Math.min(360,viewport.height-margin*2))};
 const up=below<desired&&above>below;
 const maxHeight=Math.max(0,Math.min(360,up?above:below));
 const height=Math.min(contentHeight,maxHeight);
 return {left:Math.max(margin,Math.min(anchor.left,viewport.width-width-margin)),top:up?top-gap-height:bottom+gap,width,maxHeight};
}
