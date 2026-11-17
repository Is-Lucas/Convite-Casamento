import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import initial from './initial-config.js';
export function openDatabase(directory, root) {
 mkdirSync(directory,{recursive:true});
 const db=new DatabaseSync(join(directory,'wedding.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS guests (slug TEXT PRIMARY KEY,name TEXT NOT NULL,seats INTEGER NOT NULL CHECK(seats BETWEEN 1 AND 50),phone TEXT NOT NULL DEFAULT '',sent_at TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS rsvps (slug TEXT PRIMARY KEY REFERENCES guests(slug) ON DELETE CASCADE,answer TEXT NOT NULL CHECK(answer IN ('yes','no')),people INTEGER NOT NULL CHECK(people BETWEEN 0 AND 50),note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS administrators (id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS contributions (id TEXT PRIMARY KEY,guest_slug TEXT,guest_name TEXT NOT NULL,gift_id TEXT NOT NULL,gift_name TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('pending','approved','cancelled')),return_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);`);
 if(!db.prepare('SELECT id FROM settings').get()) {
  let config=structuredClone(initial),old;
  const legacy=join(root,'.preview-data','records.json');
  if(existsSync(legacy))try{old=new Map(JSON.parse(readFileSync(legacy,'utf8')));const state=old.get('state.json');if(state)config=JSON.parse(state).config;}catch{}
  for(const folder of ['casal','rancho']){
   const base=join(root,'imagens',folder);if(!existsSync(base))continue;
   const photos=readdirSync(base).filter(n=>/\.(jpe?g|png|webp)$/i.test(n)&&!/(logo|assinatura|signature|brasao|referencia)/i.test(n)).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(n=>({url:'/imagens/'+folder+'/'+encodeURIComponent(n),alt:folder==='casal'?'Luisa e Gabriel':'Ambiente do Rancho Sempre Viva'}));
   if(photos.length){if(folder==='casal'){config.heroPhoto=photos[0].url;config.couplePhotos=photos;}else config.photos=photos;}
  }
  config.gifts=(config.gifts||[]).map(g=>({...g,id:g.id||randomUUID(),description:g.description||'',status:g.status||'available',free:!!g.free}));
  if(!config.gifts.some(g=>g.free))config.gifts.push({id:randomUUID(),name:'Contribuir com o valor que quiser',description:'Um carinho para a nossa vida a dois.',value:0,emoji:'??',photo:'',link:'',free:true,status:'available'});
  db.prepare('INSERT INTO settings VALUES(1,?)').run(JSON.stringify(config));
  if(old){const state=JSON.parse(old.get('state.json')||'{"guests":[]}');for(const g of state.guests||[]) db.prepare('INSERT OR IGNORE INTO guests VALUES(?,?,?,?,?,?)').run(g.slug,g.name,g.seats||1,g.phone||'',null,new Date().toISOString());for(const [key,value] of old){if(!key.startsWith('rsvp/'))continue;const r=JSON.parse(value);if(r.slug&&db.prepare('SELECT slug FROM guests WHERE slug=?').get(r.slug))db.prepare('INSERT OR REPLACE INTO rsvps VALUES(?,?,?,?,?)').run(r.slug,r.answer,r.answer==='yes'?r.people||1:0,r.note||'',r.date||new Date().toISOString());}}
 }
 return db;
}
export async function getConfig(db){return JSON.parse((await db.prepare('SELECT json FROM settings WHERE id=1').get()).json)}
export async function setConfig(db,c){await db.prepare('UPDATE settings SET json=? WHERE id=1').run(JSON.stringify(c))}
export async function transaction(db,fn){if(db.transaction)return db.transaction(fn);db.exec('BEGIN IMMEDIATE');try{const value=await fn();db.exec('COMMIT');return value}catch(e){db.exec('ROLLBACK');throw e}}

export async function openConfiguredDatabase(directory,root,env){if(env.DATABASE_URL){const {openPostgres}=await import('./postgres.js');return openPostgres(env.DATABASE_URL,root)}if(env.VERCEL)throw Error('Configure DATABASE_URL com um PostgreSQL persistente antes de publicar.');return openDatabase(directory,root)}
