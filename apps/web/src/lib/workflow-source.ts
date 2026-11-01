const fields:Record<string,string>={preText:'План и контекст',mindsetText:'Моё состояние и мысли',sessionText:'Мысли',postText:'Итоги и выводы'};
export function normalizeWorkflowSource(input:Record<string,unknown>){
 if(typeof input.source!=='string')return input;
 const match=input.source.match(/^review:(day|week|month):(\d{4}-\d{2}-\d{2}):(preText|mindsetText|sessionText|postText)(?::.*)?$/s);
 if(!match)return input;
 return {...input,source:`review:${match[1]}:${match[2]}:${match[3]}`,label:`${match[1]==='day'?'Daily Review':match[1]==='week'?'Weekly Review':'Month Review'} · ${match[2]} · ${fields[match[3]!]}`};
}
