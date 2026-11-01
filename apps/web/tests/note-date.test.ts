import {it,expect} from 'vitest';
import {noteDate} from '../src/lib/note-date';
import {sessionClipboard} from '../src/lib/session-clipboard';
it('formats local note dates with uppercase weekday, capitalized month and no time',()=>{
 expect(noteDate('2026-10-05T12:00:00Z')).toBe('ПН 5 Октября 2026');
 expect(noteDate('2026-10-05T21:00:00Z')).toBe('ВТ 6 Октября 2026');
 const content=sessionClipboard('2026-10-05T12:00:00Z',[{id:'text',kind:'text',text:'Weekly thought'}],'http://localhost',true);
 expect(content.text).toContain('ПН 5 Октября 2026');expect(content.text).not.toContain('17:00');
});
