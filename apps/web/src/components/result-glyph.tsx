import {useId} from 'react';
import {resultIconColor} from '@/lib/trade-classification';

export const RESULT_ARTWORK = '/icons/results/refined-materials-v2.png';

// Tight bounds of the approved artwork, not the cells of the presentation sheet.
// Keep the approved images centered inside the existing icon footprint.
export const RESULT_SPRITES = {
  Win: [35, 205, 347, 326],
  Loss: [411, 214, 320, 315],
  Breakeven: [775, 276, 309, 183],
  Missed: [1109, 246, 408, 239],
  Hypothesis: [1540, 165, 295, 370],
  Unknown: [1896, 185, 230, 344],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export function ResultGlyph({name,detail,missed}:{name:string;detail?:string;missed?:number|null}) {
  const type=name==='BE'?'Breakeven':name;
  const sprite=RESULT_SPRITES[type as keyof typeof RESULT_SPRITES]??RESULT_SPRITES.Unknown;
  const base=resultIconColor(name);
  const color=resultIconColor(name,detail,missed);
  const tinted=base!==color;
  const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const channel=(offset:number)=>parseInt(color.slice(offset,offset+2),16)/255;
  const rgb:[number,number,number]=[channel(1),channel(3),channel(5)];

  return <svg aria-hidden="true" viewBox="0 0 100 100" className="size-full" data-result-symbol-type={type} data-result-symbol="artwork">
    <defs>
      {tinted&&<filter id={`${id}-tint`} x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/>
        {/* Recolor the material, retaining its shadows and bright highlights. */}
        <feComponentTransfer>
          <feFuncR type="table" tableValues={`0 ${rgb[0]*.55} ${rgb[0]} 1`}/>
          <feFuncG type="table" tableValues={`0 ${rgb[1]*.55} ${rgb[1]} 1`}/>
          <feFuncB type="table" tableValues={`0 ${rgb[2]*.55} ${rgb[2]} 1`}/>
        </feComponentTransfer>
      </filter>}
      <svg id={`${id}-art`} x="4" y="4" width="92" height="92" viewBox={sprite.join(' ')} preserveAspectRatio="xMidYMid meet">
        <image href={RESULT_ARTWORK} width="2172" height="724"/>
      </svg>
    </defs>
    <use href={`#${id}-art`} filter={tinted?`url(#${id}-tint)`:undefined} data-result-color={color} data-color-mode="whole"/>
  </svg>;
}
