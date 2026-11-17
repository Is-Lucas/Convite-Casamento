import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresAdapter,sqlParameters} from '../server/postgres.js';
import {createApp} from '../server/index.js';
import initial from '../server/initial-config.js';

test('PostgreSQL adapter: actual SQL, login, RSVP, gifts, uploads and transactions',async t=>{
 const pg=new PGlite();await pg.exec(await readFile(new URL('../server/postgres-schema.sql',import.meta.url),'utf8'));
 await pg.query('INSERT INTO settings VALUES(1,$1)',[JSON.stringify(initial)]);
 // PGlite has no competing server connections: replace only the advisory-lock call.
 const query=(sql,values=[])=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):pg.query(sql,values);
 const client={query,release(){}};const pool={query,connect:async()=>client,end:()=>pg.close()};const db=createPostgresAdapter(pool);
 const directory=await mkdtemp(join(tmpdir(),'wedding-pg-test-'));const app=await createApp({db,directory,env:{SETUP_KEY:'pg-test-setup-key'}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let cookie='';
 t.after(async()=>{await new Promise(r=>app.server.close(r));await db.close();await rm(directory,{recursive:true,force:true})});
 async function call(path,body,method){const r=await fetch(base+'/api/'+path,{method:method||(body?'POST':'GET'),headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data}}
 assert.equal(sqlParameters('SELECT * FROM guests WHERE slug=? AND seats=?'),'SELECT * FROM guests WHERE slug=$1 AND seats=$2');
 assert.equal((await call('admin')).status,401);assert.equal((await call('auth/setup',{setupKey:'pg-test-setup-key',username:'noivos',password:'senha-segura-postgres'})).status,200);
 const guest=(await call('admin/guests',{name:'Maria e familia',seats:4,phone:''})).data;
 assert.equal((await call('rsvp',{slug:guest.slug,answer:'yes',people:5,note:''})).status,400);
 assert.equal((await call('rsvp',{slug:guest.slug,answer:'yes',people:3,note:'Sem gluten'})).status,200);
 let state=(await call('admin')).data;assert.equal(state.summary.people,3);assert.equal(state.responses[0].note,'Sem gluten');
 const c=state.config;c.gifts=[{id:'pg-gift',name:'Jantar',value:150,description:'Um momento juntos',emoji:'🎁',link:'https://mpago.la/teste',free:false,status:'available'}];assert.equal((await call('admin',{config:c})).status,200);
 const intent=await call('contributions',{giftId:'pg-gift',slug:guest.slug});assert.equal(intent.status,200);
 assert.equal((await call('admin/contributions/'+intent.data.id,{status:'approved',amount:150},'PUT')).status,200);
 state=(await call('admin')).data;assert.equal(state.summary.received,150);assert.equal(state.config.gifts[0].status,'received');
 assert.equal((await call('contributions',{giftId:'pg-gift',slug:guest.slug})).status,409);
 await assert.rejects(db.transaction(async()=>{await db.prepare('UPDATE guests SET name=? WHERE slug=?').run('Changed',guest.slug);throw Error('rollback test')}));assert.equal((await call('guest/'+guest.slug)).data.name,'Maria e familia');
 const bytes=Buffer.from([255,216,255,217]);const upload=await fetch(base+'/api/upload',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'image/jpeg'},body:bytes});assert.equal(upload.status,200);const image=await upload.json();const response=await fetch(base+image.url);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 assert.equal((await call('auth/logout',{})).status,200);assert.equal((await call('admin')).status,401);assert.equal((await call('auth/login',{username:'noivos',password:'senha-segura-postgres'})).status,200);
});
