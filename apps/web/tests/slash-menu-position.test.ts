import {it,expect} from 'vitest';
import {slashMenuPosition} from '../src/lib/slash-menu-position';
it('flips upward at the bottom and constrains the whole scrollable menu to the viewport',()=>{
 const p=slashMenuPosition({left:400,top:430,bottom:720},{width:1200,height:800},460);
 expect(p.top).toBeLessThan(430);expect(p.top+Math.min(460,p.maxHeight)).toBeLessThanOrEqual(800);
 expect(p.maxHeight).toBe(360);
 const narrow=slashMenuPosition({left:350,top:30,bottom:70},{width:380,height:280},450);
 expect(narrow.left+narrow.width).toBeLessThanOrEqual(372);expect(narrow.top+narrow.maxHeight).toBeLessThanOrEqual(272);
 const huge=slashMenuPosition({left:0,top:-20,bottom:1200},{width:320,height:200},400);
 expect(huge.top).toBe(8);expect(huge.maxHeight).toBe(184);
});
