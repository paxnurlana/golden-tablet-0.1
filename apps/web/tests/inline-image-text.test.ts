import {it,expect} from 'vitest';
import {imageVisibleText,mergeImageText,imageSourceOffset} from '../src/lib/inline-image-text';
it('keeps typing before an image on the same line without accumulating newlines',()=>{
 let raw='Before\n[[image:screen_1]]\n';
 for(const char of 'тут'){const visible=imageVisibleText(raw);raw=mergeImageText(visible.slice(0,7)+char+visible.slice(7),raw);}
 expect(raw.match(/\n/g)).toHaveLength(2);expect(raw.match(/\[\[image:/g)).toHaveLength(1);
});
it('preserves text after images and stable source caret mapping',()=>{
 const raw='A\n[[image:first]]\nB\n[[image:second]]\nC';
 expect(mergeImageText('A\n\nB typed\n\nC',raw)).toBe('A\n[[image:first]]\nB typed\n[[image:second]]\nC');
 expect(imageVisibleText(mergeImageText('A\n\nB typed\n\nC',raw))).toBe('A\n\nB typed\n\nC');
 expect(imageSourceOffset(raw,imageVisibleText(raw).length)).toBe(raw.length);
 expect(imageSourceOffset('Keep[[image:one]]',4)).toBe(4);
});
