# Convite Luisa & Gabriel — guia completo

O convite mantém o jardim secreto, fotos distribuídas, cores, textos e animação de abertura. Foram acrescentados campos de RSVP, estados dos presentes e um painel separado.

## O que já está implementado

- Links `/convite/nome-codigoaleatorio` com 80 bits aleatórios, nome no portal e na saudação, lugares por convite e fallback “Querido convidado” para links inválidos.
- RSVP com quantidade limitada pelo servidor, observação opcional, agradecimento nominal e atualização da mesma resposta. Ao voltar ao link, a resposta é recuperada do SQLite.
- Presentes com descrição, foto/emoji, valor, ordem, link Mercado Pago e status “Já ganhamos”. Contribuição de valor livre.
- Painel com usuário e senha: Convidados, Presença, Presentes, Resumo e Conteúdo. Importação CSV, exportação CSV compatível com Excel, lembretes via WhatsApp, registro manual de envio e conferência dos presentes.
- Banco SQLite real e compartilhado por todos os visitantes. Senhas com scrypt, sessões HttpOnly com expiração e proteção de origem nas alterações. Credenciais e banco não são servidos pelo site.

## Stack e arquivos

Node.js 24 ou superior, sem dependências externas; SQLite nativo do Node; HTML/CSS e JavaScript do convite atual.

| Arquivo | Função |
| --- | --- |
| `site.html` | Visual original, abertura e estilos dos novos campos |
| `app.js` | Convite, fotos, música e animações |
| `guest-features.js` | Convites nominais, RSVP e fluxo de presentes |
| `admin.js` | Login e painel dos noivos |
| `server/index.js` | Servidor HTTP e arquivos públicos |
| `server/api.js` | Regras, validações e rotas |
| `server/auth.js` | Senhas, sessões e limites de tentativas |
| `server/db.js` | SQLite, tabelas e migração da prévia anterior |
| `server/initial-config.js` | Conteúdo inicial do convite |
| `imagens/` | Fotos já utilizadas no convite |
| `tests/integration.test.js` | Testes do fluxo completo |
| `render.yaml` | Configuração opcional de hospedagem |
| `.env.example` | Exemplo das variáveis do servidor |
| `scripts/admin-password.mjs` | Recuperação de senha pelo terminal |
| `scripts/backup.mjs` | Cópia consistente do banco e uploads |

O runtime atual é Node.js + SQLite. Os arquivos antigos do Worker/Sites, se ainda estiverem na pasta de trabalho, são históricos e não são usados pelo `npm start`. O ZIP da entrega contém somente a aplicação atual.

## 1. Abrir no seu computador

1. Instale o Node.js 24 LTS ou superior pelo site https://nodejs.org/.
2. Extraia o ZIP e abra um terminal na pasta que contém `package.json`.
3. Execute:

```sh
npm start
```

4. Abra http://localhost:4173 e, para o painel, http://localhost:4173/admin.
5. No primeiro acesso, informe o código existente no arquivo `data/setup-key.txt`. Ele é gerado automaticamente apenas no modo local. Escolha um usuário e uma senha com pelo menos 12 caracteres.
6. Guarde a senha. Os acessos seguintes pedem apenas usuário e senha. A sessão dura até 12 horas.

Não precisa executar `npm install`: o projeto usa somente módulos que já vêm no Node. O primeiro acesso está bloqueado sem o código de configuração. Nenhuma senha é definida no código do navegador.

As informações ficam em `data/wedding.sqlite`; fotos enviadas pelo painel ficam em `data/uploads`. Reiniciar o servidor não apaga respostas. Não apague a pasta `data`.

Links `localhost` só funcionam no computador que está executando o servidor. Cadastre os convidados reais e envie seus links depois de publicar, usando o domínio definitivo. O endereço gerado pelo painel sempre acompanha o domínio em que ele foi aberto.

## 2. Publicar online no Render

Esta aplicação usa um Web Service Node com disco persistente. Não use publicação de site estático, nem Vercel/Netlify com arquivos SQLite temporários. No Render, disco persistente exige um serviço pago; confira as condições na própria plataforma antes de contratar. O disco é necessário para preservar o banco após reinícios e novas publicações.

1. Crie um repositório privado no GitHub e envie os arquivos extraídos do ZIP. Se preferir a interface do site, use “Add file” → “Upload files”. Inclua as pastas `server`, `scripts`, `tests` e `imagens`. Não envie `.env`, `data`, bancos SQLite, backups ou o código de configuração.
2. Entre em https://dashboard.render.com/ e escolha **New → Web Service**, conectando esse repositório.
3. Se o repositório contém a pasta `luisa-gabriel` e não o conteúdo dela na raiz, configure **Root Directory** como `luisa-gabriel`. Se enviou diretamente os arquivos do ZIP, deixe vazio.
4. Escolha Node como runtime e um plano que aceite disco persistente. Configure:

```text
Build Command: npm run build
Start Command: npm start
Health Check Path: /health
```

5. Adicione um disco persistente de 1 GB com **Mount Path** `/var/data`.
6. Em **Environment**, defina:

```text
NODE_VERSION=24
NODE_ENV=production
HOST=0.0.0.0
DATA_DIR=/var/data
APP_URL=https://ENDERECO-REAL-DO-SEU-SERVICO.onrender.com
SETUP_KEY=UM-CODIGO-SECRETO-LONGO-CRIADO-POR-VOCES
```

Use o endereço real atribuído ao serviço, mostrado no painel do Render. Se ele só aparecer após criar o serviço, atualize `APP_URL` e publique novamente antes de tentar o login. Não use barra no final nem o caminho `/admin` em `APP_URL`.

Para gerar um código secreto no terminal local:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copie o resultado para `SETUP_KEY` nas configurações do Render. Não publique nem envie esse código aos convidados.

7. Clique em **Deploy**. Aguarde o status de serviço ativo.
8. Abra `https://SEU-ENDERECO/admin`, informe o `SETUP_KEY`, crie seu usuário e sua senha.
9. Depois de cadastrar o administrador, você pode remover `SETUP_KEY` das variáveis e publicar novamente. O usuário fica salvo no banco. O código não permite recriar um usuário quando já existe um administrador.
10. Cadastre um convidado de teste, com 2 lugares, abra seu link no celular e confirme. Volte ao painel e clique em atualizar: a resposta deve aparecer. Teste novamente após reiniciar o serviço para verificar o disco.
11. Se usar domínio próprio, configure-o no Render e altere `APP_URL` para a URL HTTPS desse domínio. Copie os links novamente no painel para compartilhar o domínio definitivo.

O `render.yaml` também permite criar o serviço por **New → Blueprint**. Nesse caso, ele cria um `SETUP_KEY` automaticamente; consulte-o nas variáveis do serviço para fazer o primeiro acesso. Configure o `APP_URL` real antes de usar o painel.

Execute apenas uma instância deste serviço, usando o disco do SQLite. Para um convite de casamento essa arquitetura é suficiente. Não publique o mesmo banco em instâncias independentes.

## 3. Conectar a conta dos noivos ao Mercado Pago

Foi escolhida a modalidade simples de **links oficiais de pagamento**, permitida no pedido. Não há Access Token, SDK, webhook ou credencial bancária no código. O site nunca pede a senha do Mercado Pago.

1. Os noivos entram na própria conta Mercado Pago no aplicativo ou no site oficial.
2. Acessem **Ferramentas para vender → Link de pagamento → Criar novo** (o nome pode variar conforme a versão do app).
3. Criem uma cobrança para cada presente, com o nome e o mesmo valor usado no convite.
4. Nas opções da cobrança, habilitem os meios de pagamento disponíveis na conta. Pix e cartão são escolhidos e processados na página do Mercado Pago; a disponibilidade depende da conta e da configuração do link.
5. Copiem o link HTTPS gerado. No painel do convite, entrem em **Presentes → Editar**, colem em **Link Mercado Pago específico** e salvem o rascunho. Depois cliquem em **Salvar conteúdo e presentes**.
6. O **Link padrão** é usado quando um presente não tem link específico. Use-o somente se o valor exibido pelo destino estiver coerente com o presente; o convite não altera valores de links fixos.
7. Para **Contribuir com o valor que quiser**, configure o recurso **Seu Link** da conta Mercado Pago, no qual o pagador informa o valor, e cole esse endereço no presente marcado como **Contribuição de valor livre**. O convidado informa o valor no site para registro e repete o mesmo valor no Mercado Pago. Se esse recurso não estiver disponível para a conta, deixe esse presente sem compartilhar até obter um link oficial que aceite valor livre, ou remova-o no painel.
8. Façam uma contribuição pequena de teste e confiram diretamente na conta Mercado Pago. Confirmem se o destinatário está correto antes de compartilhar com todos.

O site aceita links HTTPS dos domínios oficiais `mpago.la`, `mercadopago.com`, `mercadopago.com.br` e `link.mercadopago.com.br`, incluindo os endereços `www` previstos no servidor. Links de outros provedores são rejeitados.

### Como funciona o presente e o agradecimento

- O convidado escolhe o presente. O site registra o nome, o presente e o valor pretendido com situação **Pendente** e abre o Mercado Pago em outra aba.
- A aba do convite oferece **Voltei do pagamento**, que abre uma mensagem de agradecimento com o nome do convidado. Essa página pode ser revisitada e mostra se os noivos já conferiram o recebimento.
- Voltar, clicar ou fechar a página **não prova pagamento**. Links simples não entregam ao site confirmação automática nem identificação confiável do pagador.
- Os noivos conferem o pagamento na conta Mercado Pago e acessam **Presentes → Registros de quem presenteou → Conferir / alterar**. Informam o valor realmente recebido e selecionam **Recebido e conferido no Mercado Pago**.
- Ao aprovar, o presente de valor fixo passa para **Já ganhamos este presente, obrigado!** e deixa de oferecer o botão de pagamento. O valor entra no Resumo. Presentes de valor livre permanecem disponíveis para outras contribuições.
- Marcar um presente como recebido diretamente na edição oculta o botão, mas não cria um valor financeiro fictício no Resumo. Para somar dinheiro, aprove o registro correspondente após a conferência.
- Pagamentos não são conferidos por webhook nesta modalidade. Duas pessoas podem abrir o mesmo link antes da conferência manual. A marcação evita novas escolhas no site depois de atualizado; ela não bloqueia links do Mercado Pago já abertos ou compartilhados. Para evitar duplicidade, confiram e atualizem os presentes com frequência. O servidor rejeita a aprovação de dois registros para o mesmo presente fixo.
- O agradecimento automático dentro da página do Mercado Pago não é controlado pelo convite. A mensagem personalizada fica na aba do site, pelo botão de retorno. Configurar um retorno estático no Mercado Pago não identifica o convidado; use o retorno individual gerado pelo próprio convite.

## 4. Usar o painel

**Convidados:** cadastre “Maria e família”, por exemplo, com 4 lugares e telefone opcional. O telefone deve ter país + DDD + número. O cadastro já grava no banco; não precisa salvar conteúdo para gerar o link. Copiar o link e abrir o WhatsApp são ações separadas. O botão WhatsApp só abre a mensagem pronta; vocês precisam tocar em enviar. Após enviar de fato, usem **Marcar enviado**, que alimenta o Resumo.

Editar o nome mantém o mesmo código do link. Excluir remove o convite e sua resposta. Um link excluído passa a abrir o convite genérico, com “Querido convidado”. O telefone e a lista de convidados nunca são expostos no endpoint público do convite.

**CSV de convidados:** use o modelo abaixo, em UTF-8. O separador pode ser ponto e vírgula ou vírgula. Aspas em nomes e quebras de linha são reconhecidas. Não importe novamente as mesmas linhas: a importação cria novos convites. Ela mostra quantas linhas foram importadas caso a conexão falhe.

```csv
nome;lugares;telefone
Maria e família;4;5511999999999
João e Ana;2;
```

**Presença:** acompanhe o status de cada convite, quantidade efetiva, observações e horário. Filtre ou busque por nome. CSV abre no Excel. O lembrete fica disponível apenas para quem não respondeu e abre o WhatsApp com o link individual. A pessoa pode mudar sua resposta a qualquer momento, sempre respeitando os lugares do convite. Para reduzir lugares abaixo de uma confirmação existente, peça que o convidado ajuste a resposta primeiro.

**Presentes:** edite descrição, valor, emoji/foto, link, estado e posição. As alterações ficam em rascunho até clicar em **Salvar conteúdo e presentes**. Registros financeiros ficam no banco mesmo se o presente ou convidado for removido.

**Resumo:** mostra convites cadastrados, marcados como enviados, confirmados, recusados, pendentes, total de pessoas confirmadas e valor recebido conferido. “Convites confirmados” e “pessoas confirmadas” são números diferentes para famílias/casais.

## 5. Segurança, recuperação e backup

- Compartilhe cada link apenas com o convidado correspondente. O código aleatório torna difícil adivinhar outros convites, mas quem recebe ou encaminha um link tem acesso à confirmação daquele convite.
- Não coloque senha, `SETUP_KEY`, banco ou backups no GitHub. `.gitignore` já exclui esses arquivos.
- Em produção, o cookie da sessão tem `HttpOnly`, `SameSite=Strict` e `Secure`; expira em 12 horas. Alterações exigem o domínio exato de `APP_URL`.
- O login tem limite de tentativas. Para este servidor único atrás do proxy da hospedagem, a contagem é conservadora pelo endereço da conexão; depois de muitas tentativas, aguarde 15 minutos.
- Guarde a senha num lugar seguro. Para recuperar, no terminal do servidor (ou **Shell** do Render), execute `npm run reset-password`. A nova senha é digitada de forma oculta e todas as sessões antigas são encerradas.
- Para criar um backup consistente, execute `npm run backup`. Ele inclui uma cópia SQLite e as fotos enviadas em `DATA_DIR/backups/DATA-HORARIO`.
- Baixe o backup do servidor e guarde em outro lugar privado. Backup no mesmo disco não protege contra perda da conta/disco.
- Para restaurar, pare o servidor, guarde uma cópia do estado atual e restaure `wedding.sqlite` e a pasta `uploads` do backup na pasta de dados. Não misture arquivos antigos `wedding.sqlite-wal` e `wedding.sqlite-shm` com o banco restaurado; remova somente os correspondentes após parar o processo e guardar a cópia atual. Reinicie o serviço e teste o login e as respostas.

A publicação online começa com um banco novo. Cadastros feitos só na prévia local não aparecem online automaticamente. Para levar os dados locais, use o backup com o servidor parado/restauração acima; alternativamente, importe os convidados por CSV no painel online (novos links serão gerados). Não envie links locais previamente aos convidados.

## 6. Verificação técnica

```sh
npm run build
npm test
```

Os testes cobrem autenticação e revogação de sessão, proteção de origem, convite nominal, limites de lugares, edição de RSVP sem duplicação, privacidade das rotas, links Mercado Pago, contribuições livres, conferência manual, totais financeiros, persistência após reinício e importação de CSV com aspas.

A inspeção visual em navegador não foi executada neste ambiente. A marcação e os estilos existentes do convite foram preservados; os estilos novos atendem somente campos funcionais e painel. Recomenda-se realizar o teste no celular descrito no passo de publicação antes do envio geral.

Referências oficiais consultadas: [SQLite no Node.js](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [hospedagem Node no Render](https://render.com/docs/deploy-node-express-app), [disco persistente no Render](https://render.com/docs/disks), [Link de pagamento Mercado Pago](https://www.mercadopago.com.br/ferramentas-para-vender/link-de-pagamento), [Seu Link Mercado Pago](https://www.mercadopago.com.br/blog/seu-link).


## At? tr?s acessos dos noivos

O painel permite at? tr?s usu?rios com senhas independentes, todos com as mesmas permiss?es administrativas. O primeiro ? criado na tela de primeiro acesso. Para cadastrar o segundo ou terceiro, saia do painel e escolha **Criar outro acesso** na tela de login. Cada cadastro exige o c?digo secreto de configura??o, al?m de um nome de usu?rio ?nico e uma senha de pelo menos 12 caracteres. Ao completar tr?s usu?rios, o cadastro ? bloqueado pelo servidor.

Mantenha `SETUP_KEY` configurado at? terminar os cadastros. O limite ? de tr?s acessos no total, incluindo o primeiro. As contas antigas da vers?o anterior s?o migradas automaticamente para o novo formato. Para recuperar uma senha espec?fica, execute `npm run reset-password -- NOME_DO_USUARIO` no terminal do servidor.
