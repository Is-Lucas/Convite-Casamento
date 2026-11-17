import {createApp} from './server/index.js';
const {server}=await createApp();const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log('Convite: http://localhost:'+port+' | Painel: /admin'));
