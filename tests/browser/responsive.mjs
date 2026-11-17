import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from '../../server/index.js';
import {getConfig,setConfig} from '../../server/db.js';
import {call,evaluate,pause,ws} from './cdp.mjs';
await mkdir('qa',{recursive:true});
const directory=await mkdtemp(join(tmpdir(),'wedding-responsive-'));const app=await createApp({directory,env:{SETUP_KEY:'isolated-browser-test'}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
const name='Maria Aparecida e familiares com muito carinho de toda a nossa familia Silva e Oliveira';
app.db.prepare('INSERT INTO guests VALUES(?,?,?,?,NULL,?)').run('teste-responsivo-1234567890',name,4,'',new Date().toISOString());const c=await getConfig(app.db);c.gifts[0].description='Um presente especial para celebrar todos os momentos da nossa nova vida juntos.';c.gifts.forEach(g=>g.link='https://mpago.la/teste');await setConfig(app.db,c);
const reports=[];
try{await call('Page.enable');for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});await call('Page.navigate',{url:base+'/convite/teste-responsivo-1234567890'});await pause(600);await evaluate('document.fonts.ready');
 const intro=await evaluate(`(()=>{const intro=document.querySelector('#intro');const all=[...intro.children].filter(e=>e.id!=='enter');const bounds=intro.getBoundingClientRect();return {width:innerWidth,scroll:document.documentElement.scrollWidth,top:Math.min(...all.map(e=>e.getBoundingClientRect().top)),bottom:Math.max(...all.map(e=>e.getBoundingClientRect().bottom)),height:innerHeight,name:document.querySelector('[data-guest]').textContent}})()`);assert.equal(intro.name,name);assert.ok(intro.scroll<=width+1);assert.ok(intro.top>=0,'Intro clipped above at '+width);
 await evaluate("document.querySelector('#seal').click()");await pause(2250);
 const letter=await evaluate(`(()=>{const e=document.querySelector('#intro .letter'),b=e.getBoundingClientRect();return [...e.children].map(p=>{const r=p.getBoundingClientRect();return {text:p.textContent,inside:r.top>=b.top&&r.bottom<=b.bottom}})})()`);assert.ok(letter.every(p=>p.inside),'Long name outside portal at '+width+': '+JSON.stringify(letter));
 const enter=await evaluate("(()=>{const b=document.querySelector('#enter');b.scrollIntoView({block:'nearest',behavior:'instant'});const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom}})()");assert.ok(enter.top>=0&&enter.bottom<=height,'Enter unreachable '+width);
 if(width===360||width===844)await writeFile('qa/portal-'+width+'.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('#enter').click()");await pause(1250);await evaluate("document.querySelectorAll('.reveal').forEach(e=>e.classList.add('visible'));document.querySelector('#presentes').scrollIntoView({behavior:'instant'})");await pause(1100);
 const overflow=await evaluate(`(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,items:[...document.querySelectorAll('.gift h3,.gift .price,.gift-description,.gift button,.rsvp-fields,.rsvp-fields select,.rsvp-fields textarea,.hero h1,.hero .welcome')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>({cls:e.className,sw:e.scrollWidth,cw:e.clientWidth}))}))()`);assert.ok(overflow.scroll<=overflow.width+1);assert.deepEqual(overflow.items,[],'Content overflow at '+width);
 if(width===360)await writeFile('qa/gifts-fixed.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.querySelector('[data-rsvp=\"yes\"]').click()");await pause(150);const dialog=await evaluate("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return {open:document.querySelector('dialog').open,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()");assert.ok(dialog.open);assert.ok(dialog.left>=0&&dialog.right<=width&&dialog.top>=0&&dialog.bottom<=height,'Dialog outside viewport '+width);await evaluate("document.querySelector('.close').click()");
 reports.push({width,height,portal:'OK',longName:'OK',horizontalOverflow:false,gifts:'OK',rsvpDialog:'OK'});console.log(JSON.stringify(reports.at(-1)));
 }
 await writeFile('qa/responsive-results.json',JSON.stringify(reports,null,2));
}finally{ws.close();await new Promise(r=>app.server.close(r));app.db.close();await rm(directory,{recursive:true,force:true})}
