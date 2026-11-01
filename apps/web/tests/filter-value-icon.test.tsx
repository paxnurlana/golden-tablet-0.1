import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FilterValueIcon} from '../src/components/journal-toolbar';
import type {Term} from '../src/server/personal-journal';
it('shows the saved logo in filter values, or the existing journal icon when absent',()=>{
 const term={id:'account-a',kind:'account',name:'YouTrade',logo:'/api/attachments/logo'} as Term;
 expect(renderToStaticMarkup(<FilterValueIcon term={term}/>)).toContain('/api/attachments/logo');
 expect(renderToStaticMarkup(<FilterValueIcon term={{...term,logo:undefined}}/>)).toContain('Y');
 const result=renderToStaticMarkup(<FilterValueIcon term={{...term,kind:'result',name:'Win',logo:undefined}}/>);
 expect(result).toContain('<svg');expect(result).not.toContain('<img');
});
