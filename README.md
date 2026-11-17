# Luisa & Gabriel

Convite original com jardim secreto e abertura preservados. Backend Node.js 24+ com SQLite real; painel com usuário/senha; convidados nominais, RSVP por lugares e presentes por links do Mercado Pago com conferência manual.

```sh
npm start
```

Convite: http://localhost:4173 · Painel: http://localhost:4173/admin

Primeiro acesso local: código em `data/setup-key.txt`; escolha seu usuário e senha no painel. Produção: código na variável secreta `SETUP_KEY`.

Instruções completas de primeiro acesso, publicação, Mercado Pago e backup: [CONFIGURACAO.md](CONFIGURACAO.md).

```sh
npm run build
npm test
```

Nenhuma credencial deve ser incluída no repositório. A aplicação ainda não foi publicada online.
