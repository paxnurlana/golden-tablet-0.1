import {it,expect} from 'vitest';
import {moveEditorBlock} from '../src/lib/move-editor-block';
it('moves existing image blocks around text without changing ids or attachment references',()=>{
  const blocks=[{id:'a',kind:'image' as const,attachmentId:'one',name:'one.png'},{id:'t',kind:'text' as const,text:'Keep'},{id:'b',kind:'image' as const,attachmentId:'two',name:'two.png'}];
  expect(moveEditorBlock(blocks,'b','a',false)).toEqual([blocks[2],blocks[0],blocks[1]]);
  expect(moveEditorBlock(blocks,'a','b',true)).toEqual([blocks[1],blocks[2],blocks[0]]);
  expect(moveEditorBlock(blocks,'a','a',true)).toBe(blocks);
  expect(blocks.map(b=>b.id)).toEqual(['a','t','b']);
});
