import http from 'node:http';
import { readFile,mkdir,writeFile,stat } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { resolve,join,extname,relative,isAbsolute } from 'node:path';
import { randomBytes,randomUUID } from 'node:crypto';
import { openConfiguredDatabase } from './db.js';
import { apiRoute,HttpError } from './api.js';
import { isAdmin } from './auth.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.css':'text/css; charset=utf-8'};
export async function createApp(options={}){
 const supplied=options.env||process.env;const env={...supplied};if(env.VERCEL&&!env.APP_URL&&env.VERCEL_ENV==='production'&&env.VERCEL_PROJECT_PRODUCTION_URL)env.APP_URL='https://'+env.VERCEL_PROJECT_PRODUCTION_URL;if(env.VERCEL&&!env.APP_URL&&env.VERCEL_URL)env.APP_URL='https://'+env.VERCEL_URL;const production=env.NODE_ENV==='production',directory=resolve(options.directory||env.DATA_DIR||join(ROOT,'data'));
 if(production&&(!env.APP_URL||!env.APP_URL.startsWith('https://')))throw Error('Defina APP_URL com a URL HTTPS pública.');
 const db=options.db||await openConfiguredDatabase(directory,options.root||ROOT,env);if(!db.remote)await mkdir(join(directory,'uploads'),{recursive:true});
 const appEnv={...env};if(!appEnv.SETUP_KEY&&!production){const keyfile=join(directory,'setup-key.txt');try{appEnv.SETUP_KEY=(await readFile(keyfile,'utf8')).trim()}catch{appEnv.SETUP_KEY=randomBytes(24).toString('base64url');await writeFile(keyfile,appEnv.SETUP_KEY,{mode:0o600})}if(!(await db.prepare('SELECT id FROM administrators').get()))console.log('Primeiro acesso: consulte data/setup-key.txt e abra /admin.')}
 if(production&&!appEnv.SETUP_KEY&&!(await db.prepare('SELECT id FROM administrators').get()))throw Error('Defina SETUP_KEY para configurar o primeiro acesso.');
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   const origin=env.APP_URL?new URL(env.APP_URL).origin:'http://'+req.headers.host;const url=new URL(req.url,origin),path=url.pathname;const mutating=['POST','PUT','DELETE','PATCH'].includes(req.method);
   if(mutating&&req.headers.origin!==origin)throw new HttpError(403,'Origem inválida.');
   if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return}
   if(path.startsWith('/api/')){
    if(!['GET','POST','PUT','DELETE'].includes(req.method))throw new HttpError(405,'Método não permitido.');
    let body={};if(mutating){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20000000)throw new HttpError(413,'Arquivo muito grande.');chunks.push(chunk)}const bytes=Buffer.concat(chunks);
     if(path==='/api/upload'){
      if(!await isAdmin(db,req))throw new HttpError(401,'Entre no painel.');const type=req.headers['content-type'],extensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};if(!extensions[type]||bytes.length>4000000)throw new HttpError(400,'Envie uma imagem JPEG, PNG ou WebP de até 4 MB.');const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw new HttpError(400,'Imagem inválida.');const filename=randomUUID()+extensions[type];if(db.remote)await db.putUpload(filename,type,bytes);else await writeFile(join(directory,'uploads',filename),bytes);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({url:'/uploads/'+filename}));return;
     }
     if(bytes.length){if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpError(415,'Envie JSON.');try{body=JSON.parse(bytes.toString('utf8'))}catch{throw new HttpError(400,'JSON inválido.')}if(!body||Array.isArray(body)||typeof body!=='object')throw new HttpError(400,'Dados inválidos.');}
    }
    const result=await apiRoute({db,req,res,path,body,origin,secure:production||origin.startsWith('https:'),ip:req.socket.remoteAddress,env:appEnv});res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(result));return;
   }
   if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Método não permitido.');
   if(path.startsWith('/uploads/')&&db.remote){const name=path.slice(9);if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name))throw new HttpError(404,'N?o encontrado.');const upload=await db.getUpload(name);if(!upload)throw new HttpError(404,'N?o encontrado.');res.writeHead(200,{'Content-Type':upload.type});res.end(req.method==='HEAD'?undefined:upload.bytes);return;}
   let file;
   if(['/', '/admin','/admin/'].includes(path)||/^\/convite\/[-a-z0-9]+$/.test(path)||/^\/obrigado\/[A-Za-z0-9_-]+$/.test(path))file=join(ROOT,'site.html');
   else if(['/app.js','/admin.js','/guest-features.js'].includes(path))file=join(ROOT,path.slice(1));
   else if(path.startsWith('/imagens/')||path.startsWith('/uploads/')){const base=path.startsWith('/uploads/')?join(directory,'uploads'):join(ROOT,'imagens');const sub=decodeURIComponent(path.slice(path.startsWith('/uploads/')?9:9));file=resolve(base,sub);const rel=relative(base,file);if(rel.startsWith('..')||isAbsolute(rel)||!['.jpg','.jpeg','.png','.webp'].includes(extname(file).toLowerCase()))throw new HttpError(404,'Não encontrado.');}
   else throw new HttpError(404,'Não encontrado.');
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){const status=e.status||(e.code==='ENOENT'?404:500);if(status===500)console.error(e);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:status===500?'Erro no servidor. Tente novamente.':e.message}));}
 });
 return {server,db,directory};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const {server}=await createApp();const port=Number(process.env.PORT||4173);server.listen(port,process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),()=>console.log('Convite: http://localhost:'+port+' | Painel: /admin'));}
