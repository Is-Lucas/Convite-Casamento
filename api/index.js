import {createApp} from '../server/index.js';
let initialization;
export default async function handler(req,res){
 try{
  if(!initialization)initialization=createApp({env:process.env}).catch(error=>{initialization=undefined;throw error});
  const app=await initialization;
  await new Promise((resolve,reject)=>{res.once('finish',resolve);res.once('close',resolve);res.once('error',reject);app.server.emit('request',req,res)});
 }catch(error){console.error('Initialization failed:',error.code||error.message);if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:'O convite ainda está sendo configurado. Tente novamente em alguns instantes.'}));}
}
