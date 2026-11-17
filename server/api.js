import { randomBytes,randomUUID } from 'node:crypto';
import { getConfig,setConfig,transaction } from './db.js';
import { isAdmin,hashPassword,checkPassword,createSession,cookieToken,digest,limited } from './auth.js';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(message,status=400)=>{throw new HttpError(status,message)};
const text=(v,max=200,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Confira os campos informados.');return v.trim()};
export function paymentLink(value){if(!value)return '';let u;try{u=new URL(value)}catch{fail('Link de pagamento inválido.')};if(u.protocol!=='https:'||u.username||u.password||u.port||!['mpago.la','mercadopago.com','www.mercadopago.com','mercadopago.com.br','www.mercadopago.com.br','link.mercadopago.com.br'].includes(u.hostname))fail('Use um link HTTPS oficial do Mercado Pago.');return u.href}
const image=value=>{if(!value)return '';if(typeof value!=='string'||value.length>12000000)fail('Foto inválida.');if(/^\/(imagens|uploads|photos)\//.test(value)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return value;try{if(new URL(value).protocol==='https:')return value}catch{}fail('Use uma foto HTTPS ou envie uma imagem.')};
function validateConfig(c){if(!c||typeof c!=='object')fail('Configuração inválida.');for(const k of ['names','venue','date'])text(c[k],200,true);if(!Number.isFinite(Date.parse(c.date)))fail('Data inválida.');for(const k of ['story','dress','dressTitle','pixName','pixKey'])if(c[k]!=null)text(c[k],k==='story'?12000:2000);if(c.map){try{if(new URL(c.map).protocol!=='https:')fail('Mapa inválido.')}catch{fail('Mapa inválido.')}}if(c.whatsapp&&!/^\d{8,15}$/.test(c.whatsapp))fail('WhatsApp inválido.');c.payment=paymentLink(c.payment);if(!Array.isArray(c.colors)||c.colors.some(v=>!/^#[a-f\d]{6}$/i.test(v)))fail('Cores inválidas.');if(!Array.isArray(c.photos)||!c.photos.length||c.photos.length>50)fail('Confira as fotos.');c.photos.forEach(p=>image(p.url));if(c.heroPhoto)image(c.heroPhoto);if(c.couplePhotos){if(!Array.isArray(c.couplePhotos)||c.couplePhotos.length>50)fail('Fotos inválidas.');c.couplePhotos.forEach(p=>image(p.url));}if(!Array.isArray(c.gifts)||c.gifts.length>100)fail('Lista de presentes inválida.');const ids=new Set();c.gifts=c.gifts.map(g=>{const id=g.id||randomUUID();if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||ids.has(id))fail('Presente duplicado.');ids.add(id);if(!Number.isFinite(g.value)||g.value<0||g.value>1000000||(!g.free&&g.value<=0))fail('Valor do presente inválido.');if(!['available','received'].includes(g.status||'available'))fail('Status do presente inválido.');return {...g,id,name:text(g.name,120,true),description:text(g.description||'',400),emoji:text(g.emoji||'🎁',30),photo:image(g.photo),link:paymentLink(g.link),status:g.status||'available',free:!!g.free}});return c}
export async function adminState(db){const guests=(await db.prepare('SELECT * FROM guests ORDER BY created_at,slug').all());const responses=(await db.prepare('SELECT r.*,g.name,r.updated_at AS date FROM rsvps r JOIN guests g ON g.slug=r.slug').all());const contributions=(await db.prepare('SELECT id,guest_name,gift_id,gift_name,amount,status,created_at,updated_at FROM contributions ORDER BY created_at DESC').all());const status=new Map(responses.map(r=>[r.slug,r]));return {config:(await getConfig(db)),guests,responses,contributions,summary:{invites:guests.length,sent:guests.filter(g=>g.sent_at).length,yes:responses.filter(r=>r.answer==='yes').length,no:responses.filter(r=>r.answer==='no').length,pending:guests.filter(g=>!status.has(g.slug)).length,people:responses.reduce((n,r)=>n+r.people,0),received:contributions.filter(c=>c.status==='approved').reduce((n,c)=>n+c.amount,0)/100}}}
export async function apiRoute({db,req,res,path,body,origin,secure,ip,env}){
 const method=req.method;
 if(path==='/api/config'&&method==='GET')return (await getConfig(db));
 if(path==='/api/auth/status'&&method==='GET')return {authenticated:isAdmin(db,req),setupRequired:!(await db.prepare('SELECT id FROM administrators').get())};
 if(path==='/api/auth/setup'&&method==='POST'){
  if((await db.prepare('SELECT id FROM administrators').get()))fail('O painel já foi configurado.',409);
  if(await limited(db,'setup:'+ip,5))fail('Muitas tentativas. Aguarde 15 minutos.',429);
  if(!env.SETUP_KEY||digest(String(body.setupKey||''))!==digest(env.SETUP_KEY))fail('Código de configuração inválido.',403);
  const username=text(body.username,100,true).toLowerCase(),password=text(body.password,200,true);if(password.length<12)fail('Use uma senha com pelo menos 12 caracteres.');
  (await db.prepare('INSERT INTO administrators VALUES(1,?,?)').run(username,hashPassword(password)));await createSession(db,res,secure);return {ok:true};
 }
 if(path==='/api/auth/login'&&method==='POST'){
  if(await limited(db,'login:'+ip,10))fail('Muitas tentativas. Aguarde 15 minutos.',429);
  const user=(await db.prepare('SELECT * FROM administrators WHERE id=1').get());const valid=user&&checkPassword(String(body.password||'').slice(0,201),user.password_hash)&&user.username===String(body.username||'').trim().toLowerCase();if(!valid)fail('Usuário ou senha incorretos.',401);await createSession(db,res,secure);return {ok:true};
 }
 if(path==='/api/auth/logout'&&method==='POST'){(await db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(cookieToken(req))));res.setHeader('Set-Cookie',`wedding_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);return {ok:true}}
 if(path.startsWith('/api/guest/')&&method==='GET'){
  const g=(await db.prepare('SELECT slug,name,seats FROM guests WHERE slug=?').get(decodeURIComponent(path.slice(11))));if(!g)return null;
  return {...g,response:(await db.prepare('SELECT answer,people,note,updated_at FROM rsvps WHERE slug=?').get(g.slug))||null};
 }
 if(path==='/api/rsvp'&&method==='POST'){
  if(await limited(db,'rsvp:'+ip,120))fail('Muitas respostas. Tente novamente mais tarde.',429);
  const g=(await db.prepare('SELECT * FROM guests WHERE slug=?').get(String(body.slug||'')));if(!g)fail('Peça aos noivos o seu link personalizado para confirmar presença.');
  if(!['yes','no'].includes(body.answer))fail('Escolha uma resposta.');const people=body.answer==='no'?0:body.people;if(!Number.isInteger(people)||people<0||people>g.seats||(body.answer==='yes'&&people<1))fail('A quantidade deve respeitar os lugares do seu convite.');
  const note=text(body.note||'',1500);const now=new Date().toISOString();(await db.prepare('INSERT INTO rsvps VALUES(?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET answer=excluded.answer,people=excluded.people,note=excluded.note,updated_at=excluded.updated_at').run(g.slug,body.answer,people,note,now));return {ok:true,name:g.name,answer:body.answer,people,note,updated_at:now};
 }
 if(path==='/api/contributions'&&method==='POST'){
  if(await limited(db,'gift:'+ip,50))fail('Muitas solicitações. Aguarde e tente novamente.',429);
  const c=(await getConfig(db)),g=c.gifts.find(g=>g.id===body.giftId);if(!g)fail('Presente não encontrado.',404);if(!g.free&&g.status==='received')fail('Já ganhamos este presente, obrigado!',409);
  const guest=(await db.prepare('SELECT slug,name FROM guests WHERE slug=?').get(String(body.slug||'')));const name=guest?.name||text(body.name||'',120,true);const amount=g.free?body.amount:g.value;
  if(!Number.isFinite(amount)||amount<1||amount>1000000)fail('Informe um valor entre R$ 1 e R$ 1.000.000.');const link=paymentLink(g.link||c.payment);if(!link)fail('Os noivos ainda estão preparando o pagamento deste presente.');
  const id=randomUUID(),token=randomBytes(24).toString('base64url'),now=new Date().toISOString();(await db.prepare('INSERT INTO contributions VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,guest?.slug||null,name,g.id,g.name,Math.round(amount*100),'pending',digest(token),now,now));
  return {id,token,paymentUrl:link,returnUrl:origin+'/obrigado/'+token};
 }
 if(path.startsWith('/api/thanks/')&&method==='GET'){
  const row=(await db.prepare('SELECT guest_name,gift_name,amount,status FROM contributions WHERE return_hash=?').get(digest(path.slice(12))));return row||null;
 }
 if(path.startsWith('/api/admin')){
  if(!await isAdmin(db,req))fail('Entre no painel dos noivos.',401);
  if(path==='/api/admin'&&method==='GET')return adminState(db);
  if(path==='/api/admin'&&method==='POST'){
   const c=validateConfig(body.config);await transaction(db,async()=>{const current=(await getConfig(db));const paidIds=new Set((await db.prepare("SELECT gift_id FROM contributions WHERE status='approved'").all()).map(r=>r.gift_id));for(const gift of c.gifts){if(paidIds.has(gift.id)&&!gift.free)gift.status='received';}await setConfig(db,c)});return {ok:true};
  }
  if(path==='/api/admin/guests'&&method==='POST'){
   const name=text(body.name,120,true),phone=text(body.phone||'',15);if(phone&&!/^\d{8,15}$/.test(phone))fail('Telefone: informe país, DDD e número, sem espaços.');if(!Number.isInteger(body.seats)||body.seats<1||body.seats>50)fail('Use entre 1 e 50 lugares.');
   const slug=(name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'convidado')+'-'+randomBytes(10).toString('hex');(await db.prepare('INSERT INTO guests VALUES(?,?,?,?,NULL,?)').run(slug,name,body.seats,phone,new Date().toISOString()));return {ok:true,slug};
  }
  const guestMatch=path.match(/^\/api\/admin\/guests\/([-a-z0-9]+)(\/sent)?$/);
  if(guestMatch){const slug=guestMatch[1];if(!(await db.prepare('SELECT slug FROM guests WHERE slug=?').get(slug)))fail('Convidado não encontrado.',404);if(method==='DELETE'){(await db.prepare('DELETE FROM guests WHERE slug=?').run(slug));return {ok:true}}if(method==='POST'&&guestMatch[2]){(await db.prepare('UPDATE guests SET sent_at=? WHERE slug=?').run(new Date().toISOString(),slug));return {ok:true}}if(method==='PUT'){const name=text(body.name,120,true),phone=text(body.phone||'',15);if(phone&&!/^\d{8,15}$/.test(phone))fail('Telefone inválido.');const response=(await db.prepare('SELECT people FROM rsvps WHERE slug=?').get(slug));if(!Number.isInteger(body.seats)||body.seats<1||body.seats>50||body.seats<(response?.people||0))fail('Lugares inválidos ou inferiores à confirmação atual.');(await db.prepare('UPDATE guests SET name=?,seats=?,phone=? WHERE slug=?').run(name,body.seats,phone,slug));return {ok:true}}}
  const contributionMatch=path.match(/^\/api\/admin\/contributions\/([a-f0-9-]+)$/);
  if(contributionMatch&&method==='PUT'){
   const row=(await db.prepare('SELECT * FROM contributions WHERE id=?').get(contributionMatch[1]));if(!row)fail('Registro não encontrado.',404);if(!['pending','approved','cancelled'].includes(body.status))fail('Status inválido.');const amount=body.amount??row.amount/100;if(!Number.isFinite(amount)||amount<1||amount>1000000)fail('Valor inválido.');
   await transaction(db,async()=>{const c=(await getConfig(db)),gift=c.gifts.find(g=>g.id===row.gift_id);if(body.status==='approved'&&gift&&!gift.free&&(await db.prepare("SELECT id FROM contributions WHERE gift_id=? AND status='approved' AND id!=?").get(gift.id,row.id)))fail('Este presente já tem um pagamento aprovado.');(await db.prepare('UPDATE contributions SET status=?,amount=?,updated_at=? WHERE id=?').run(body.status,Math.round(amount*100),new Date().toISOString(),row.id));if(gift&&!gift.free){gift.status=(await db.prepare("SELECT id FROM contributions WHERE gift_id=? AND status='approved'").get(gift.id))?'received':'available';await setConfig(db,c);}});return {ok:true};
  }
 }
 fail('Não encontrado.',404);
}
