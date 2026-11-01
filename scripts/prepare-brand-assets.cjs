const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.env.JOURNAL_SHARP_MODULE||'sharp');
async function main(){
  const dir=path.resolve(__dirname,'../apps/web/public/brand');
  const source=path.join(dir,'golden-fehu-medallion-v5.png');
  for(const size of [16,32,48,64,128,180]) {
    const target=path.join(dir,`golden-fehu-v5-${size}.png`);
    if(fs.existsSync(target))throw Error(`Refusing overwrite: ${target}`);
    await sharp(source).resize(size,size,{fit:'contain',kernel:'lanczos3'}).png({compressionLevel:9}).toFile(target);
  }
  const sizes=[16,32,48,64];const frames=sizes.map(s=>fs.readFileSync(path.join(dir,`golden-fehu-v5-${s}.png`)));
  const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
  let offset=header.length;
  frames.forEach((frame,i)=>{const p=6+16*i;header[p]=sizes[i];header[p+1]=sizes[i];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(frame.length,p+8);header.writeUInt32LE(offset,p+12);offset+=frame.length;});
  const icon=path.join(dir,'golden-fehu-v5.ico');if(fs.existsSync(icon))throw Error('Refusing overwrite');
  fs.writeFileSync(icon,Buffer.concat([header,...frames]));
  console.log(JSON.stringify({created:7,logoBytes:fs.statSync(path.join(dir,'golden-fehu-v5-128.png')).size,iconBytes:fs.statSync(icon).size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
