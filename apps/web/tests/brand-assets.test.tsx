import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {GoldenTabletMark} from '../src/components/golden-tablet-mark';
it('uses the approved Fehu brand and correctly sized PNG / multi-size ICO assets',()=>{
  const html=renderToStaticMarkup(<GoldenTabletMark className="size-7"/>);
  expect(html).toContain('/brand/golden-fehu-v5-128.png');expect(html).toContain('Логотип журнала');
  for(const size of [16,32,48,64,128,180]){
    const png=readFileSync(resolve('apps/web/public/brand',`golden-fehu-v5-${size}.png`));
    expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);
  }
  const ico=readFileSync(resolve('apps/web/public/brand/golden-fehu-v5.ico'));
  expect(ico.readUInt16LE(2)).toBe(1);expect(ico.readUInt16LE(4)).toBe(4);
});
