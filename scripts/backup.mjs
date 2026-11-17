import {DatabaseSync,backup} from 'node:sqlite';
import {resolve,join} from 'node:path';
import {mkdir,cp} from 'node:fs/promises';
const directory=resolve(process.env.DATA_DIR||'data');const destination=join(directory,'backups',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(destination,{recursive:true});
const db=new DatabaseSync(join(directory,'wedding.sqlite'),{readOnly:true});try{await backup(db,join(destination,'wedding.sqlite'));await cp(join(directory,'uploads'),join(destination,'uploads'),{recursive:true});console.log('Backup completo em '+destination)}finally{db.close()}
