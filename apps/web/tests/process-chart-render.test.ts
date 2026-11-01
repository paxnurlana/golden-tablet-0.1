import {it,expect} from 'vitest';
import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent,TooltipComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {processChartOption} from '../src/components/process-equity-chart';
import {emptyProcessReport,processLinePoints} from '../src/lib/process-equity';
it('renders all three direction colors in the real chart engine without candles',()=>{
 echarts.use([LineChart,GridComponent,TooltipComponent,SVGRenderer]);
 const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:1000,height:520});
 const report=emptyProcessReport('2026-10-12');report.items.forEach((item,i)=>item.score=[1,-1,0,1][i]!);
 try{chart.setOption(processChartOption(processLinePoints([report],'criteria',0),'criteria'));
  const svg=chart.renderToSVGString();for(const color of ['#10b981','#ef4444','#f4f4f5'])expect(svg).toContain(color);expect(svg).not.toContain('NaN');
 }finally{chart.dispose();}
});
