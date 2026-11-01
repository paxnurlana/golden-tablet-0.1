// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';import {act} from 'react';import {createRoot} from 'react-dom/client';
const mock=vi.hoisted(()=>({setOption:vi.fn(),on:vi.fn(),dispose:vi.fn(),resize:vi.fn()}));
vi.mock('echarts/core',()=>({use:vi.fn(),init:()=>mock}));vi.mock('echarts/charts',()=>({LineChart:{}}));vi.mock('echarts/components',()=>({GridComponent:{},TooltipComponent:{}}));vi.mock('echarts/renderers',()=>({CanvasRenderer:{}}));
import {ProcessEquityChart,processChartOption,PROCESS_LINE_COLORS} from '../src/components/process-equity-chart';
import {processLinePoints,emptyProcessReport} from '../src/lib/process-equity';
it('colors direction rather than sign, uses integer right axis and no zoom or drag controls',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class{observe(){}disconnect(){}}});
 const report=emptyProcessReport('2026-10-12');report.items.forEach((item,i)=>item.score=[-1,1,0,1][i]!);
 const points=processLinePoints([report],'criteria',0),day=vi.fn(),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ProcessEquityChart points={points} frame="criteria" onDay={day}/>));
  const option=mock.setOption.mock.calls.at(-1)![0];expect(option.yAxis.interval).toBe(1);expect(option.yAxis.position).toBe('right');expect(option.dataZoom).toBeUndefined();
  expect(option.series.every((s:{type:string})=>s.type==='line')).toBe(true);
  expect(option.series.find((s:{id:string})=>s.id==='process-up').data).toContainEqual([1,-1]);
  expect(option.series.find((s:{id:string})=>s.id==='process-flat').lineStyle.color).toBe(PROCESS_LINE_COLORS.flat);
  expect(option.tooltip.formatter([{axisValue:2}])).toContain('Накоплено:');
  expect(host.querySelectorAll('button')).toHaveLength(0);
  const click=mock.on.mock.calls.find(c=>c[0]==='click')![1];click({seriesIndex:0,dataIndex:1});expect(day).toHaveBeenCalledWith(report.date);
 }finally{await act(async()=>root.unmount());host.remove();}expect(mock.dispose).toHaveBeenCalled();
});
it('escapes user text in chart tooltips',()=>{
 const report=emptyProcessReport('2026-10-12');report.items[0]!.name='<img src=x>';report.items[0]!.score=1;
 const option=processChartOption(processLinePoints([report],'criteria',0),'criteria') as {tooltip:{formatter:(raw:unknown)=>string}};
 const tip=option.tooltip.formatter([{axisValue:1}]);expect(tip).toContain('&lt;img');expect(tip).not.toContain('<img');
});
