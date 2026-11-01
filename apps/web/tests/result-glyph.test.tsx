import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {existsSync,readFileSync} from 'node:fs';
import {JournalResultIcon} from '../src/components/journal-icons';
import {RESULT_ARTWORK,RESULT_SPRITES} from '../src/components/result-glyph';

it('uses the approved raster artwork without changing the icon footprint',()=>{
  for(const name of ['Win','Loss','Breakeven','Missed','Hypothesis','Неопознанный трейд']) {
    const html=renderToStaticMarkup(<JournalResultIcon name={name}/>);
    expect(html).toContain('data-result-symbol="artwork"');
    expect(html).toContain(`href="${RESULT_ARTWORK}"`);
    expect(html).toContain('size-7');
    expect(html).toContain('viewBox="0 0 100 100"');
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(html).not.toContain('data-result-ring');
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('rounded-md');
    expect(html).not.toContain('background-color');
  }
  const path=new URL('../public'+RESULT_ARTWORK,import.meta.url);
  expect(existsSync(path)).toBe(true);
  const png=readFileSync(path);
  expect(png.readUInt32BE(16)).toBe(2172);
  expect(png.readUInt32BE(20)).toBe(724);
  expect(png[25]).toBe(6);
});

it('colors the entire artwork by scenario without a split or duplicate layer',()=>{
  const html=renderToStaticMarkup(<><JournalResultIcon name="Win" detail="win-small"/><JournalResultIcon name="Breakeven" detail="be-saved"/></>);
  expect(html).toContain('data-result-color="#fb7185"');
  expect(html).toContain('data-result-color="#a78bfa"');
  expect(html).toContain('data-color-mode="whole"');
  expect(html).not.toContain('clipPath');
  expect((html.match(/<use /g)??[]).length).toBe(2);
  expect(html).toContain('feComponentTransfer');
  const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(renderToStaticMarkup(<JournalResultIcon name="Win"/>)).toContain('data-result-color="#34d399"');
  expect(renderToStaticMarkup(<JournalResultIcon name="Win" detail="be-saved"/>)).toContain('data-result-color="#34d399"');
});

it('uses tight individual crops and preserves aliases and explicit sizes',()=>{
  for(const [name,crop] of Object.entries(RESULT_SPRITES)) {
    expect(renderToStaticMarkup(<JournalResultIcon name={name}/>)).toContain(`viewBox="${crop.join(' ')}"`);
  }
  expect(renderToStaticMarkup(<JournalResultIcon name="BE"/>)).toContain(`viewBox="${RESULT_SPRITES.Breakeven.join(' ')}"`);
  expect(renderToStaticMarkup(<JournalResultIcon name="Неопознанный трейд"/>)).toContain(`viewBox="${RESULT_SPRITES.Unknown.join(' ')}"`);
  expect(renderToStaticMarkup(<JournalResultIcon name="Loss" className="size-6"/>)).toContain('leading-none size-6');
  expect(renderToStaticMarkup(<JournalResultIcon name="Breakeven" missed={1.5}/>)).toContain('data-result-color="#facc15"');
});
