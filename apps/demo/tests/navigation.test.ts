// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const push=history.pushState.bind(history),replace=history.replaceState.bind(history);
beforeEach(()=>{vi.resetModules();vi.stubEnv('BASE_URL','/golden-tablet/');replace({},'','/golden-tablet/');});
afterEach(()=>{history.pushState=push;history.replaceState=replace;replace({},'','/');vi.unstubAllEnvs();});
it('keeps native journal, account and workflow navigation inside the repository path',async()=>{
 const {installBrowserHistory,hrefFor}=await import('../src/shims/navigation');installBrowserHistory();
 const listener=vi.fn();window.addEventListener('popstate',listener);
 history.pushState({},'','/journal?review=day&date=2026-10-01');
 expect(location.pathname).toBe('/golden-tablet/journal');expect(location.search).toContain('2026-10-01');
 history.replaceState({},'','/accounts?account=example');expect(location.pathname).toBe('/golden-tablet/accounts');
 history.pushState({},'','/golden-tablet/workflow?card=example');expect(location.pathname).toBe('/golden-tablet/workflow');
 expect(hrefFor('/golden-tablet/trades')).toBe('/golden-tablet/trades');expect(listener).toHaveBeenCalledTimes(3);
 window.removeEventListener('popstate',listener);
});
