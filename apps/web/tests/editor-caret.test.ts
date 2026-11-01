// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {activeEditorField,focusEditorOffset,caretRect} from '../src/lib/editor-caret';
it('focuses the source-mapped field, not the first command with the same category',()=>{
 const wrapper=document.createElement('div'),proxy=document.createElement('div'),source=document.createElement('textarea');wrapper.append(proxy,source);document.body.append(wrapper);
 const first=document.createElement('textarea'),last=document.createElement('textarea');proxy.append(first,last);
 first.dataset.sourceStart='0';first.value='First';last.dataset.sourceStart='50';last.value='Second';
 const focus=vi.spyOn(last,'focus');focusEditorOffset(source,53);
 expect(focus).toHaveBeenCalledWith({preventScroll:true});expect(document.activeElement).toBe(last);expect(last.selectionStart).toBe(3);expect(activeEditorField(source)).toBe(last);wrapper.remove();
});
it('measures the visible caret without focusing or scrolling any element',()=>{
 const field=document.createElement('textarea');field.value='line one\n/';document.body.append(field);field.focus();field.setSelectionRange(field.value.length,field.value.length);
 const focus=vi.spyOn(field,'focus'),scroll=vi.spyOn(field,'scrollIntoView' in field?'scrollIntoView':'focus');
 const count=document.body.childElementCount;caretRect(field);
 expect(document.body.childElementCount).toBe(count);expect(focus).not.toHaveBeenCalled();expect(scroll).not.toHaveBeenCalled();field.remove();
});
