import {it,expect} from 'vitest';
import {normalizeWorkflowSource} from '../src/lib/workflow-source';
import {SaveAlert} from '../src/components/save-alert';
import {renderToStaticMarkup} from 'react-dom/server';
it('keeps a fixed review-field identity even when old payloads contain long body text',()=>{
 const raw={source:'review:day:2026-10-16:postText:Итоги'+ 'body'.repeat(1000),label:'body'.repeat(100),url:'/journal?review=day&date=2026-10-16',text:'/закон Keep text'};
 const normalized=normalizeWorkflowSource(raw);
 expect(normalized.source).toBe('review:day:2026-10-16:postText');expect(normalized.text).toBe(raw.text);
 expect(String(normalized.label)).toContain('Итоги и выводы');expect(String(normalized.label)).not.toContain('body');
});
it('renders a large warning with a round icon and retry control',()=>{
 const html=renderToStaticMarkup(<SaveAlert message="Некорректный источник" onRetry={()=>{}}/>);
 expect(html).toContain('role="alert"');expect(html).toContain('rounded-full');expect(html).toContain('w-[520px]');expect(html).toContain('Повторить сохранение');
});
