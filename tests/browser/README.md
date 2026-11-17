# Testes de responsividade no Chrome

Os testes usam o Chrome DevTools Protocol e módulos nativos do Node, sem dependências de npm. Executam um servidor e banco temporários, com dados fictícios; não alteram os convidados da prévia.

1. Inicie um Chrome de teste com um perfil isolado, modo headless e a porta de depuração 9223. No PowerShell, na raiz do projeto:

```powershell
$profilePath = Join-Path (Get-Location) 'qa/chrome-profile'
New-Item -ItemType Directory -Force $profilePath | Out-Null
Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9223',"--user-data-dir=$profilePath",'about:blank' -WindowStyle Hidden
```

2. Execute:

```sh
node tests/browser/responsive.mjs
node tests/browser/admin.mjs
```

As capturas e os resultados ficam em `qa/`. O arquivo `last-results.json` contém o resultado da verificação entregue. O teste verifica o portal, nomes longos, acesso ao botão de entrada, ausência de transbordamento horizontal do conteúdo, cards e diálogo de RSVP. O segundo verifica as abas do painel e a rolagem interna do editor de presentes.

Esses testes não substituem testes em Safari/iOS ou no navegador interno do WhatsApp.
