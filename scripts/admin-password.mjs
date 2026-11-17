import {DatabaseSync} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {hashPassword} from '../server/auth.js';
const db=new DatabaseSync(join(resolve(process.env.DATA_DIR||'data'),'wedding.sqlite'));
const user=db.prepare('SELECT username FROM administrators WHERE id=1').get();
if(!user){console.error('Primeiro configure o painel em /admin.');process.exit(1)}
const silent=new Writable({write(chunk,encoding,callback){callback()}});
const rl=createInterface({input:process.stdin,output:silent,terminal:!!process.stdin.isTTY});
process.stdout.write('Nova senha para '+user.username+' (mínimo 12 caracteres, entrada oculta): ');
const password=await rl.question('');process.stdout.write('\nRepita a senha: ');const confirm=await rl.question('');process.stdout.write('\n');rl.close();
if(password.length<12||password.length>200||password!==confirm){console.error('Senhas diferentes ou fora do limite de 12 a 200 caracteres.');db.close();process.exit(1)}
db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE administrators SET password_hash=? WHERE id=1').run(hashPassword(password));db.exec('DELETE FROM sessions; COMMIT');console.log('Senha alterada. Entre novamente no painel.')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
