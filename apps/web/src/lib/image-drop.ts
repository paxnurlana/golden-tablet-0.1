export const isVisualFile=(file:File)=>file.type.startsWith('image/')||['video/mp4','video/webm'].includes(file.type)||/\.(mp4|webm)$/i.test(file.name);
export const droppedImages=(transfer:DataTransfer)=>Array.from(transfer.files).filter(isVisualFile);
export const isFileDrag=(transfer:DataTransfer)=>Array.from(transfer.types).includes('Files');
/** Reuse the owner's clipboard upload path; never import foreign attachment IDs or fetch URLs. */
export function forwardImageDrop(target:HTMLTextAreaElement,transfer:DataTransfer){
  if(target.readOnly||target.disabled||!droppedImages(transfer).length)return false;
  target.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
  return true;
}
