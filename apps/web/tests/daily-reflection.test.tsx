// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GrowingText} from '../src/components/trading-review';
import {DAILY_REFLECTION_QUESTIONS,dailyReflectionText} from '../src/lib/daily-reflection';
it('replaces the former third question in existing reports without moving its answer',()=>{
 const text=dailyReflectionText('1) Что я сделал сегодня хорошо\nОтвет 1\n2) Что я сделал сегодня плохо\nОтвет 2\n3) Что я улучу завтра чтобы стать лучше?\nОтвет 3');
 expect(text).not.toContain('Что я улучу завтра');expect(text).toContain('3) Что мне нужно сделать, чтобы стать лучше\nОтвет 3');
 expect(text.split(DAILY_REFLECTION_QUESTIONS[2]!).length).toBe(2);
});
it('adds the fixed scaffold without replacing old notes or duplicating questions',()=>{
 const original='My old notes\n[[image:old-image]]';const text=dailyReflectionText(original);
 expect(text.startsWith(original)).toBe(true);expect(dailyReflectionText(text)).toBe(text);
 for(const prompt of DAILY_REFLECTION_QUESTIONS)expect(text.split(prompt)).toHaveLength(2);
 expect(dailyReflectionText(DAILY_REFLECTION_QUESTIONS.join('\n'))).toBe(DAILY_REFLECTION_QUESTIONS.join('\n\n')+'\n');
});
it('renders one borderless daily editor with protected questions, editable answers and a final placeholder',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 function Fixture(){const[value,setValue]=useState('Existing notes');return <GrowingText source="review:day:2026-10-17:postText" value={value} onChange={setValue} placeholder="Old placeholder"/>;}
 try{
  await act(async()=>root.render(<Fixture/>));
  const prompts=host.querySelectorAll('[data-fixed-prompt]');expect(prompts).toHaveLength(3);
  expect([...prompts].map(p=>p.textContent)).toEqual(DAILY_REFLECTION_QUESTIONS);expect(prompts[0]!.className).toContain('italic');expect(prompts[0]!.getAttribute('contenteditable')).toBe('false');
  expect(host.querySelectorAll('[data-slash-blocks]')).toHaveLength(1);
  const fields=host.querySelectorAll<HTMLTextAreaElement>('[data-slash-blocks] textarea');expect(fields[0]!.value).toBe('Existing notes\n');expect(fields[1]!.placeholder).toBe('');expect(fields[fields.length-1]!.placeholder).toBe('Итоги дня');
  const answer=fields[1]!;const deletion=new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true});
  await act(async()=>answer.dispatchEvent(deletion));expect(deletion.defaultPrevented).toBe(true);expect(host.querySelectorAll('[data-fixed-prompt]')).toHaveLength(3);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(answer,'My answer\n\n');answer.dispatchEvent(new Event('input',{bubbles:true}));});
  const source=host.querySelector<HTMLTextAreaElement>('textarea[data-workflow-source]')!;
  expect(source.value).toContain('My answer\n\n');expect(source.value).toContain('Existing notes');for(const prompt of DAILY_REFLECTION_QUESTIONS)expect(source.value).toContain(prompt);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('does not add daily questions to weekly notes or other daily fields',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{for(const source of ['review:week:2026-10-12:postText','review:day:2026-10-17:preText']){
  await act(async()=>root.render(<GrowingText source={source} value="Keep" onChange={()=>{}} placeholder="Plan"/>));expect(host.querySelector('[data-fixed-prompt]')).toBeNull();
 }}finally{await act(async()=>root.unmount());host.remove();}
});
