/** Measure off-screen: never collapse the focused field or scroll its caret. */
export function resizeTextarea(element: HTMLTextAreaElement, minimum = 38) {
  if (getComputedStyle(element).display === 'none') return;
  const css=getComputedStyle(element);
  const width=element.getBoundingClientRect().width;
  if (!width) return;
  const measure=document.createElement('textarea');
  measure.dataset.noSlash='true';
  measure.tabIndex=-1;
  measure.setAttribute('aria-hidden','true');
  Object.assign(measure.style,{
    position:'fixed',left:'-10000px',top:'0',visibility:'hidden',pointerEvents:'none',
    width:`${width}px`,height:'0',minHeight:'0',maxHeight:'none',boxSizing:'border-box',
    overflow:'hidden',whiteSpace:css.whiteSpace,overflowWrap:css.overflowWrap,
    font:css.font,lineHeight:css.lineHeight,letterSpacing:css.letterSpacing,
    padding:css.padding,border:css.border,wordBreak:css.wordBreak,
  });
  measure.value=element.value;
  document.body.append(measure);
  const borders=parseFloat(css.borderTopWidth||'0')+parseFloat(css.borderBottomWidth||'0');
  const padding=parseFloat(css.paddingTop||'0')+parseFloat(css.paddingBottom||'0');
  const height=Math.max(minimum,measure.scrollHeight+borders);
  measure.remove();
  element.style.height=`${css.boxSizing==='border-box'?height:Math.max(0,height-padding-borders)}px`;
}
