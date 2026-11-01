import {it,expect} from 'vitest';
import {attachmentMime,MAX_VIDEO_SIZE,MAX_ATTACHMENT_SIZE} from '../src/lib/attachment-validation';
import {attachmentRange} from '../src/lib/attachment-range';
it('allows sniffed MP4/WebM but not renamed arbitrary files, retaining separate image/video size limits',()=>{
 const mp4=new Uint8Array([0,0,0,24,...new TextEncoder().encode('ftypmp42'),0,0,0,0]);
 expect(attachmentMime(mp4)).toBe('video/mp4');expect(attachmentMime(new Uint8Array([0x1a,0x45,0xdf,0xa3,...new TextEncoder().encode('webm')]))).toBe('video/webm');
 expect(attachmentMime(new TextEncoder().encode('not actually a video.mp4'))).toBeNull();
 expect(MAX_VIDEO_SIZE).toBe(500*1024*1024);expect(MAX_ATTACHMENT_SIZE).toBe(8*1024*1024);
});
it('handles video seek byte ranges, suffix and open requests, rejecting invalid ranges',()=>{
 expect(attachmentRange(null,100)).toBeNull();expect(attachmentRange('bytes=10-19',100)).toEqual({start:10,end:19});expect(attachmentRange('bytes=10-',100)).toEqual({start:10,end:99});expect(attachmentRange('bytes=-10',100)).toEqual({start:90,end:99});
 for(const range of ['bytes=100-','bytes=19-10','bytes=0-10,20-30','bytes=-0','bytes=a-b'])expect(attachmentRange(range,100)).toBe(false);
});
