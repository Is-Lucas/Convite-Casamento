import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import initial from './initial-config.js';
const {Pool}=pg;
export function sqlParameters(sql){let index=0;return sql.replace(/\?/g,()=>'$'+(++index))}
export function createPostgresAdapter(pool){
 const context=new AsyncLocalStorage();
 const query=(sql,values=[])=> (context.getStore()||pool).query(sqlParameters(sql),values);
 return {remote:true,
  prepare(sql){return {async get(...values){return (await query(sql,values)).rows[0]},async all(...values){return (await query(sql,values)).rows},async run(...values){const result=await query(sql,values);return {changes:result.rowCount}}}},
  async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(30302027)');const result=await context.run(client,fn);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}},
  async putUpload(name,type,bytes){await query('INSERT INTO uploads(name,type,bytes) VALUES(?,?,?)',[name,type,bytes])},
  async getUpload(name){return (await query('SELECT type,bytes FROM uploads WHERE name=?',[name])).rows[0]},
  async close(){await pool.end()}
 };
}
export async function openPostgres(connectionString,root){
 const pool=new Pool({connectionString,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:15000});
 pool.on('error',error=>console.error('PostgreSQL: connection unavailable',error.code||''));
 try{
  const schema=await readFile(new URL('./postgres-schema.sql',import.meta.url),'utf8');await pool.query(schema);
  const config=structuredClone(initial);
  for(const folder of ['casal','rancho']){let names=[];try{names=await readdir(join(root,'imagens',folder))}catch{}const photos=names.filter(n=>/\.(jpe?g|png|webp)$/i.test(n)&&!/(logo|assinatura|signature|brasao|referencia)/i.test(n)).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true})).map(name=>({url:'/imagens/'+folder+'/'+encodeURIComponent(name),alt:folder==='casal'?'Luisa e Gabriel':'Ambiente do Rancho Sempre Viva'}));if(photos.length){if(folder==='casal'){config.heroPhoto=photos[0].url;config.couplePhotos=photos}else config.photos=photos}}
  config.gifts=config.gifts.map(g=>({...g,id:randomUUID(),description:g.description||'',status:'available',free:false}));config.gifts.push({id:randomUUID(),name:'Contribuir com o valor que quiser',description:'Um carinho para a nossa vida a dois.',value:0,emoji:'💚',photo:'',link:'',free:true,status:'available'});
  await pool.query('INSERT INTO settings(id,json) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',[JSON.stringify(config)]);
  return createPostgresAdapter(pool);
 }catch(error){await pool.end();throw error}
}
