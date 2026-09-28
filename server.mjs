import http from 'node:http';
import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {createReadStream} from 'node:fs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4173);
const hosted=!!process.env.POCKETBAY_DATA_DIR;
const dataRoot=hosted?path.resolve(process.env.POCKETBAY_DATA_DIR):root;
let adminConfig={};if(hosted){try{adminConfig=JSON.parse(await readFile(path.join(root,'.pocketbay-config.json'),'utf8'))}catch{}await mkdir(dataRoot,{recursive:true});try{await writeFile(path.join(dataRoot,'data.json'),await readFile(path.join(root,'data.json')),{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e}}
function isAdmin(req){if(!hosted)return true;const h=req.headers.authorization||'';if(!h.startsWith('Basic ')||!adminConfig.adminPassword)return false;const received=Buffer.from(h.slice(6),'base64').toString();const expected=(adminConfig.adminUsername||'owner')+':'+adminConfig.adminPassword;return timingSafeEqual(createHash('sha256').update(received).digest(),createHash('sha256').update(expected).digest())}

const mime={'.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm','.svg':'image/svg+xml'};
async function body(req,limit){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(new Error('文件过大'),{status:413});chunks.push(c)}return Buffer.concat(chunks)}
function valid(data){return data&&typeof data.profile?.name==='string'&&Array.isArray(data.profile.skills)&&Array.isArray(data.strengths)&&Array.isArray(data.works)&&data.works.every(w=>typeof w.id==='string'&&typeof w.title==='string'&&Array.isArray(w.media))}
let saving=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host; if(!host||(!hosted&&![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))){res.writeHead(403);return res.end('Forbidden')}
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.origin!==(hosted?`https://${host}`:`http://${host}`)){res.writeHead(403);return res.end('Forbidden')}
  const url=new URL(req.url,`http://${host}`);
  if(url.pathname==='/api/session'){res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});return res.end(JSON.stringify({hosted,canEdit:isAdmin(req)}))}
  if(hosted&&url.pathname==='/admin'&&!isAdmin(req)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Portfolio editor", charset="UTF-8"','Cache-Control':'no-store'});return res.end('Owner login required')}
  if(hosted&&req.method!=='GET'&&req.method!=='HEAD'&&!isAdmin(req)){res.writeHead(403,{'Content-Type':mime['.json']});return res.end(JSON.stringify({error:'请先登录作品集后台'}))}
  if(url.pathname==='/api/content'){

   if(req.method==='GET'){const raw=await readFile(path.join(dataRoot,'data.json'));res.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});return res.end(raw)}
   if(req.method==='PUT'){
    const raw=await body(req,2*1024*1024); const data=JSON.parse(raw.toString());if(!valid(data))throw new Error('内容格式不正确');
    const action=saving.catch(()=>{}).then(async()=>{const file=path.join(dataRoot,'data.json');await writeFile(file+'.tmp',JSON.stringify(data,null,2));await rename(file+'.tmp',file)});saving=action;await action;
    res.writeHead(200,{'Content-Type':mime['.json']});return res.end('{"ok":true}')
   }
  }
  if(url.pathname==='/api/upload'&&req.method==='POST'){
   const types={'font/woff2':'.woff2','font/woff':'.woff','font/ttf':'.ttf','font/otf':'.otf','image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/webm':'.webm'};
   const ext=types[req.headers['content-type']];if(!ext)throw new Error('支持 PNG、JPG、WebP、GIF、MP4 和 WebM');
   const isFont=req.headers['content-type'].startsWith('font/');const bytes=await body(req,(isFont?20:150)*1024*1024);if(isFont){const sig=bytes.subarray(0,4).toString('hex');const signatures={'.woff2':'774f4632','.woff':'774f4646','.ttf':'00010000','.otf':'4f54544f'};if(sig!==signatures[ext])throw new Error('字体文件格式不正确')}const name=randomUUID()+ext;await mkdir(path.join(dataRoot,'assets'),{recursive:true});await writeFile(path.join(dataRoot,'assets',name),bytes);
   res.writeHead(201,{'Content-Type':mime['.json']});return res.end(JSON.stringify({url:'/assets/'+name}));
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
  const route=url.pathname==='/admin'?'/':decodeURIComponent(url.pathname);if(route!=='/'&&!/^\/(?:app\.js|style\.css|daylight\.css|favicon\.svg|assets\/[a-zA-Z0-9_.-]+)$/.test(route)){res.writeHead(404);return res.end('Not found')}
  let file=path.join(root,route==='/'?'index.html':route.slice(1));if(hosted&&route.startsWith('/assets/')){const stored=path.join(dataRoot,route.slice(1));try{await stat(stored);file=stored}catch(e){if(e.code!=='ENOENT')throw e}}const info=await stat(file);
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416);return res.end()}const start=Number(m[1]);const end=Math.min(m[2]?Number(m[2]):info.size-1,info.size-1);if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end()}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();return createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res)}
  res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch(e){res.writeHead(e.code==='ENOENT'?404:e.status||400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:e.message||'操作失败，请重试'}))}
});
server.listen(port,hosted?'0.0.0.0':'127.0.0.1',()=>console.log(`作品集已启动：http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被使用，请关闭已有作品集窗口后重试。`:e.message);process.exitCode=1});
