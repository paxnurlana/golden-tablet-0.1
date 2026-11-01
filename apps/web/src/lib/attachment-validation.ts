export const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
/** Determine the allowlisted type from bytes, not a filename or browser-supplied MIME type. */
export function attachmentMime(bytes: Uint8Array): string | null {
  const starts = (a: number[]) => a.every((v, i) => bytes[i] === v);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    starts([0x52, 0x49, 0x46, 0x46]) &&
    [0x57, 0x45, 0x42, 0x50].every((v, i) => bytes[i + 8] === v)
  )
    return "image/webp";
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  const ascii=(from:number,to:number)=>String.fromCharCode(...bytes.slice(from,to));
  if(bytes.length>=16&&ascii(4,8)==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V ','dash'].includes(ascii(8,12)))return 'video/mp4';
  if(starts([0x1a,0x45,0xdf,0xa3])&&ascii(0,Math.min(bytes.length,4096)).includes('webm'))return 'video/webm';
  return null;
}
