import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ReactNode} from 'react';
vi.mock('next/navigation',()=>({usePathname:()=>'/trades',useSearchParams:()=>new URLSearchParams()}));
vi.mock('../src/components/global-slash',()=>({GlobalSlash:()=>null}));
vi.mock('../src/components/page-transition',()=>({PageTransition:({children}:{children:ReactNode})=><>{children}</>}));
vi.mock('../src/components/ui/tooltip',()=>({HoverHint:({children}:{children:ReactNode})=><>{children}</>}));
import {Shell} from '../src/components/shell';
import {MonetaryValue,MonetaryField,usePrivacy} from '../src/components/privacy';
it('puts accounts in the main menu and exposes no removed controls or sections',()=>{
 const html=renderToStaticMarkup(<Shell><p>Portfolio</p></Shell>);
 expect(html).toContain('href="/accounts"');
 expect(html.indexOf('href="/accounts"')).toBeGreaterThan(html.indexOf('href="/trades"'));
 expect(html.indexOf('href="/accounts"')).toBeLessThan(html.indexOf('href="/catalogs"'));
 for(const text of ['href="/settings"','href="/import"','Privacy mode','Switch to light mode'])expect(html).not.toContain(text);
 expect(html).toContain('Демо · вымышленные данные');
});
it('always displays demo money and editable monetary fields',()=>{
 function Values(){return <><span>{String(usePrivacy())}</span><MonetaryValue>10000 USD</MonetaryValue><MonetaryField><input aria-label="Amount"/></MonetaryField></>;}
 const html=renderToStaticMarkup(<Values/>);
 expect(html).toContain('false');expect(html).toContain('10000 USD');expect(html).toContain('aria-label="Amount"');expect(html).not.toContain('••••');
});
