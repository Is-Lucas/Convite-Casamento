import {DatabaseSync} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {hashPassword} from '../server/auth.js';
const db=new DatabaseSync(join(resolve(process.env.DATA_DIR||'data'),'wedding.sqlite'));
const users=db.prepare('SELECT username FROM admin_users').all();const user=process.argv[2]?users.find(u=>u.username===process.argv[2]):users.length===1?users[0]:null;if(users.length>1&&!user){console.error('Informe o usu?rio: npm run reset-password -- NOME_DO_USUARIO');process.exit(1)}
if(!user){console.error('Primeiro configure o painel em /admin.');process.exit(1)}
const silent=new Writable({write(chunk,encoding,callback){callback()}});
const rl=createInterface({input:process.stdin,output:silent,terminal:!!process.stdin.isTTY});
process.stdout.write('Nova senha para '+user.username+' (mínimo 12 caracteres, entrada oculta): ');
const password=await rl.question('');process.stdout.write('\nRepita a senha: ');const confirm=await rl.question('');process.stdout.write('\n');rl.close();
if(password.length<12||password.length>200||password!==confirm){console.error('Senhas diferentes ou fora do limite de 12 a 200 caracteres.');db.close();process.exit(1)}
db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE admin_users SET password_hash=? WHERE username=?').run(hashPassword(password),user.username);db.exec('DELETE FROM sessions; COMMIT');console.log('Senha alterada. Entre novamente no painel.')}catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
