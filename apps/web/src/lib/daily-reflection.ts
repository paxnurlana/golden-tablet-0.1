export const DAILY_REFLECTION_QUESTIONS=[
 '1) Что я сделал сегодня хорошо',
 '2) Что я сделал сегодня плохо',
 '3) Что мне нужно сделать, чтобы стать лучше',
];
/** Old notes stay intact; the scaffold becomes stored text only when the user edits. */
export function dailyReflectionText(text:string){
 let result=text.split('\n').map(line=>line==='3) Что я улучу завтра чтобы стать лучше?'?DAILY_REFLECTION_QUESTIONS[2]!:line).join('\n');
 for(const question of DAILY_REFLECTION_QUESTIONS){
  if(!result.split('\n').includes(question))result+=(result?(result.endsWith('\n')?'\n':'\n\n'):'')+question+'\n';
 }
 const lines=result.split('\n');
 for(let i=0;i<lines.length;i++){
  if(DAILY_REFLECTION_QUESTIONS.includes(lines[i]!)&&(lines[i+1]===undefined||DAILY_REFLECTION_QUESTIONS.includes(lines[i+1]!)))lines.splice(i+1,0,'');
 }
 return lines.join('\n');
}
