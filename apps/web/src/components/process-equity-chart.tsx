"use client";
import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent,TooltipComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import type {EChartsOption} from 'echarts';
import type {ProcessPoint} from '@/lib/process-equity';

echarts.use([LineChart,GridComponent,TooltipComponent,CanvasRenderer]);
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const PROCESS_LINE_COLORS={up:'#10b981',down:'#ef4444',flat:'#f4f4f5'};
const signed=(value:number)=>(value>0?'+':'')+value;
export function processChartOption(points:ProcessPoint[],frame:'criteria'|'days'):EChartsOption{
 const segments:{up:(number[]|null)[];down:(number[]|null)[];flat:(number[]|null)[]}={up:[],down:[],flat:[]};
 for(let i=1;i<points.length;i++){
  const previous=points[i-1]!,current=points[i]!,direction=current.value>previous.value?'up':current.value<previous.value?'down':'flat';
  segments[direction].push([i-1,previous.value],[i,current.value],null);
 }
 const values=points.map(p=>p.value),low=Math.min(0,...values),high=Math.max(0,...values);
 return {animation:false,backgroundColor:'transparent',grid:{left:12,right:62,top:22,bottom:46},
  tooltip:{trigger:'axis',confine:true,backgroundColor:'#18181b',borderColor:'#3f3f46',textStyle:{color:'#f4f4f5'},formatter:raw=>{
   const item=(Array.isArray(raw)?raw:[raw])[0] as {axisValue?:number;dataIndex?:number}|undefined;
   const point=points[Math.round(Number(item?.axisValue??item?.dataIndex??-1))];if(!point)return '';
   const date=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(point.date+'T12:00:00Z'));
   return `<b>${escape(date)}</b><br/>${escape(point.label)} · ${signed(point.change)}<br/>Накоплено: <b>${signed(point.value)}</b> баллов${point.steps.length?'<br/>'+point.steps.map(s=>`${escape(s.name)}: ${signed(s.value)}${s.provisional?' · черновик':''}`).join('<br/>'):''}`;
  }},
  xAxis:{type:'value',min:0,max:Math.max(1,points.length-1),minInterval:1,splitNumber:8,axisLine:{lineStyle:{color:'#52525b'}},axisTick:{show:false},splitLine:{show:false},axisLabel:{color:'#a1a1aa',hideOverlap:true,formatter:value=>{
   if(!Number.isInteger(value))return '';const point=points[value];if(!point)return '';
   return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(point.date+'T12:00:00Z'));
  }}},
  yAxis:{type:'value',position:'right',min:Math.floor(low)-1,max:Math.max(Math.ceil(high)+1,Math.floor(low)+4),interval:1,axisLabel:{color:'#a1a1aa',formatter:value=>String(value)},splitLine:{lineStyle:{color:'rgba(148,163,184,.09)'}}},
  series:[
   {id:'process-points',name:frame==='criteria'?'По критериям':'По дням',type:'line',data:points.map((p,i)=>[i,p.value]),lineStyle:{opacity:0},symbol:'circle',symbolSize:5,itemStyle:{color:PROCESS_LINE_COLORS.flat},emphasis:{scale:1.6},z:3},
   ...(['up','down','flat'] as const).map(direction=>({id:`process-${direction}`,type:'line' as const,data:segments[direction],connectNulls:false,silent:true,showSymbol:false,lineStyle:{color:PROCESS_LINE_COLORS[direction],width:2.5},tooltip:{show:false}})),
  ],
 };
}
export function ProcessEquityChart({points,frame,onDay}:{points:ProcessPoint[];frame:'criteria'|'days';onDay:(date:string)=>void}){
 const host=useRef<HTMLDivElement>(null),chart=useRef<echarts.ECharts|null>(null),latest=useRef({points,onDay});latest.current={points,onDay};
 useEffect(()=>{
  const instance=echarts.init(host.current!);chart.current=instance;
  const observer=new ResizeObserver(()=>instance.resize());observer.observe(host.current!);
  instance.on('click',event=>{if(event.seriesIndex===0&&typeof event.dataIndex==='number'){const point=latest.current.points[event.dataIndex];if(point&&point.key!=='origin')latest.current.onDay(point.date);}});
  return()=>{observer.disconnect();instance.dispose();chart.current=null;};
 },[]);
 useEffect(()=>{chart.current?.setOption(processChartOption(points,frame),{notMerge:true});},[points,frame]);
 return <div>
  <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><span className="text-emerald-400">Рост</span><span className="text-red-400">Снижение</span><span className="text-foreground">Без изменения</span></div>
  <div ref={host} role="img" aria-label={`Накопленные баллы · ${frame==='criteria'?'по критериям':'по дням'} · ${Math.max(0,points.length-1)} точек`} className="h-[520px] min-h-[360px] w-full"/>
  {!points.length&&<p className="pb-4 text-center text-sm text-muted-foreground">Пока нет оценок. Выбери день в календаре и поставь первый балл.</p>}
 </div>;
}
