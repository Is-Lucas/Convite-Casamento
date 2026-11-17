# Luisa & Gabriel

Site do nosso casamento, em 10 de abril de 2027.

Convites individuais, confirma??o de presen?a e lista de presentes. O painel permite administrar convidados, pagamentos e at? tr?s acessos dos noivos.

## Executar

Requer Node.js 24 ou superior.

```sh
npm ci
npm start
```

- Convite: http://localhost:4173
- Painel: http://localhost:4173/admin

No primeiro acesso local, consulte `data/setup-key.txt` e cadastre um usu?rio e senha.

## Verificar

```sh
npm run build
npm test
```

O banco local ? SQLite. Para PostgreSQL, configure `DATABASE_URL` no servidor; a conex?o pode ser a do Supabase. Senhas, banco local e vari?veis privadas n?o entram no reposit?rio.

Instru??es de configura??o, hospedagem e backup em [CONFIGURACAO.md](CONFIGURACAO.md).
