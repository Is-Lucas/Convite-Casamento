import {spawnSync} from 'node:child_process';
import {access,mkdir,writeFile} from 'node:fs/promises';
for(const file of ['app.js','guest-features.js','admin.js','server/index.js','server/api.js','server/db.js','server/auth.js','server/postgres.js','api/index.js']){const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(r.status)process.exit(r.status)}
for(const file of ['site.html','styles.css','server/initial-config.js'])await access(file);
console.log('Código e arquivos de publicação verificados. O convite é servido diretamente pelo Node.js.');

await mkdir('public',{recursive:true});await writeFile('public/.keep','');
