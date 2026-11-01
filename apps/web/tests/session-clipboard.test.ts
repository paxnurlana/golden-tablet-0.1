// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {sessionClipboardWithImages} from '../src/lib/session-clipboard';
it('copies timestamps, current text and embedded screenshots including slash images',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,blob:async()=>new Blob(['image'],{type:'image/png'})})));
  try {
    const content=await sessionClipboardWithImages('2026-10-13T12:00:00Z',[{id:'a',kind:'text',text:'Current <text>\n/мысль Inline\n\t[[image:inline]]'},{id:'b',kind:'image',attachmentId:'picture',name:'chart.png'}],'http://127.0.0.1:3001');
    expect(content.text).toContain('17:00');expect(content.text).toContain('13.10.2026');
    expect(content.html).toContain('Current &lt;text&gt;');
    expect(content.html.match(/data:image\/png;base64/g)).toHaveLength(2);
    expect(content.html).not.toContain('127.0.0.1');
  }finally{vi.unstubAllGlobals();}
});
