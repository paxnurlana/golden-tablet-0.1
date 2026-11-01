const {readdirSync,mkdirSync,copyFileSync,readFileSync,statSync,writeFileSync,existsSync}=require('node:fs');
const {resolve,relative,join,extname}=require('node:path');
const {createHash}=require('node:crypto');
const source=resolve(__dirname,'..');
if(JSON.parse(readFileSync(join(source,'package.json'),'utf8')).name!=='golden-tablet-portfolio')throw Error('Portfolio source required');
const target=resolve(source,'../golden-tablet-github');
if(existsSync(target))throw Error('Target already exists; not overwriting: '+target);
const skippedDirs=new Set(['node_modules','.git','.next','.next-fast','dist','data','output','outputs','out','coverage','.cache','artifacts']);
const skippedFiles=new Set(['Dockerfile','docker-compose.yml','.dockerignore','next-env.d.ts']);
const blockedFile=name=>skippedFiles.has(name)||(/\.env/.test(name)&&name!=='.env.example')||/\.(db|sqlite|sqlite3|log|zip|tsbuildinfo|key|pem)(?:[.-].*)?$/i.test(name)||name.endsWith('.db-wal')||name.endsWith('.db-shm');
const files=[];
function copy(directory){
 for(const item of readdirSync(directory,{withFileTypes:true})){
  if(item.isSymbolicLink())continue;
  const path=join(directory,item.name),rel=relative(source,path);
  if(item.isDirectory()){if(!skippedDirs.has(item.name))copy(path);continue;}
  if(blockedFile(item.name))continue;
  // Public asset-generation prompts and icon preview pages are not runtime assets.
  if(rel.startsWith(join('apps','web','public'))&&(['.md','.html'].includes(extname(path))))continue;
  const dest=join(target,rel);mkdirSync(resolve(dest,'..'),{recursive:true});copyFileSync(path,dest);
  files.push({path:rel.replaceAll('\\','/'),bytes:statSync(path).size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
 }
}
mkdirSync(target);copy(source);
for(const item of files){if(/(?:^|\/)data\/|node_modules\/|\.db(?:$|-)|(?:^|\/)\.env$/.test(item.path))throw Error('Unsafe file selected: '+item.path);}
writeFileSync(join(target,'PACKAGE-MANIFEST.json'),JSON.stringify({format:'golden-tablet-source-package-v1',files:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),excluded:['runtime databases','credentials and .env','backups','dependencies','build caches','private attachments'],inventory:files},null,2));
console.log(JSON.stringify({target,files:files.length,megabytes:Math.round(files.reduce((n,f)=>n+f.bytes,0)/1024/1024*10)/10},null,2));
