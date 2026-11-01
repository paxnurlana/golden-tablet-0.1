import {expect,it} from 'vitest';
import {existsSync} from 'node:fs';
it('does not ship the removed import page',()=>{
 expect(existsSync('apps/web/src/app/import/page.tsx')).toBe(false);
});
it('does not ship the removed settings page',()=>{
 expect(existsSync('apps/web/src/app/settings/page.tsx')).toBe(false);
});
