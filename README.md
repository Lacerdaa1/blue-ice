# 🧊 ICE BLLUH Barbearia — site com atendente de IA

Trabalho da disciplina do **professor Martins**, desenvolvido pelos alunos:

- **Matheus Lacerda**
- **Hanael**
- **Fábio Henrique**

O projeto é o site de uma barbearia de Teresina - PI (a **ICE BLLUH**). Ele mostra os serviços e preços, permite **agendar um horário**, tem um **atendente virtual com IA** (o *Gelinho*, que usa o Gemini do Google) e uma **área Admin** para a barbearia ver os agendamentos e ajustar os valores.

## 🎯 Tema e público-alvo

- **Tema (cenário):** site de uma barbearia que **vende serviços** de cabelo, barba e estética (corte, barboterapia, hidratação, design de sobrancelha etc.), com preços, agendamento online e atendimento por IA.
- **Público-alvo:** homens e jovens adultos de Teresina - PI que querem cuidar do visual e preferem **agendar rápido pelo celular**, sem precisar ligar. O Gelinho atende também fora do horário comercial, tirando dúvidas e marcando o horário.
- **Quem usa o sistema:** o **cliente** (site e chat) e a **barbearia** (área Admin).

---

## 🔑 LEIA PRIMEIRO: crie sua chave do Gemini (uma única vez)

> ### ⚠️ O chat com IA (Gelinho) **só funciona com a chave do Gemini**.
> Por segurança, a chave dos autores **não está no GitHub**. Quem for rodar o projeto precisa criar a **própria chave, grátis, uma única vez**, e colar no arquivo `.env`. Leva cerca de 2 minutos. Sem a chave, o site abre normalmente, mas o chat avisa que está desligado.

### Passo a passo

**1. Criar a chave (grátis)**
1. Acesse **https://aistudio.google.com/apikey** e entre com uma conta Google.
2. Clique em **"Criar chave de API"** (*Create API key*).
3. **Copie** a chave gerada (um texto longo que costuma começar com `AIza`).

**2. Colar a chave no projeto**
1. Na pasta do projeto, **copie** o arquivo `.env.exemplo` e dê o nome **`.env`** à cópia.
   - Windows (PowerShell): `copy .env.exemplo .env`
2. Abra o arquivo `.env` e coloque a chave no lugar de `COLE_SUA_CHAVE_AQUI`:
   ```
   GEMINI_API_KEY=AIza...sua_chave_aqui...
   ```
3. Salve o arquivo.

**3. Ligar e desligar o servidor** (o servidor roda **no seu próprio computador**)

| Ação | Como fazer |
|------|-----------|
| ▶️ **Ligar** | No terminal, dentro da pasta do projeto: `npm install` (só na 1ª vez) e depois `npm start` |
| 🌐 **Abrir o site** | Quando aparecer `🧊 ICE BLLUH rodando em http://localhost:3000`, abra **http://localhost:3000** no navegador (Admin: `/admin.html`) |
| ⏹️ **Desligar** | Clique no terminal e aperte **`Ctrl + C`** (se perguntar "Finalizar arquivo em lotes?", digite `S`) |

> O terminal fica "parado" depois do `npm start`: é normal, o servidor está rodando. **Não feche a janela** enquanto usar o site; fechou, ele sai do ar. Ao desligar, os agendamentos e preços continuam salvos.

### Pontos importantes
- ✅ **É só uma vez:** depois de salvar a chave no `.env`, é só rodar `npm start` sempre que quiser. Não precisa criar outra.
- ✅ **Grátis:** o uso normal da chave gratuita do Google AI Studio é suficiente para testar o projeto.
- 🔒 **Não compartilhe nem publique a chave.** O `.env` já está no `.gitignore`, então não sobe para o GitHub. Nunca cole a chave no código, no `index.html` nem no `chat-gelinho.js`.
- ❌ **Se aparecer** `GEMINI_API_KEY não definida` ao rodar `npm start` (ou o chat disser que está desligado): o `.env` não existe, está com outro nome (precisa ser exatamente `.env`) ou a chave não foi colada. Refaça o passo 2 e reinicie o servidor.
- ℹ️ A senha do Admin (`ADMIN_SENHA`) é **opcional** para testar no próprio computador. Veja a seção "Admin" abaixo.

---

## O que o site faz

### Para o cliente
- **Página única com 6 seções no menu:** **Início** (apresentação), **Sobre** (a barbearia, em cards), **Serviços** (cada serviço é um card com preço), **Barbeiros** (cards), **Agendar** (formulário) e **Contato**. O menu fixo no topo leva a cada seção.
- **Formulário de agendamento:** o cliente escolhe o serviço (ou clica em um card de serviço, que já o seleciona) e preenche **nome, telefone, barbeiro, dia e horário** (e uma observação, se quiser). O site só mostra os horários **livres** para aquele serviço (levando em conta a duração dele) e dentro do expediente do barbeiro escolhido, então não existem dois clientes no mesmo horário.
- **Fotos reais da equipe:** a seção Barbeiros mostra o **Ice** (barbeiro chefe) e o **Alisson** com suas fotos.
- **Responsivo:** o layout se adapta a celular, tablet e computador.
- **Gelinho, o atendente virtual:** um chat no canto da tela que responde dúvidas sobre serviços, preços, horários e endereço, e também consegue **registrar um agendamento** conversando. Ele só fala de assuntos da barbearia e não inventa informações. Ao abrir o chat aparece o aviso *"Faça seu atendimento por aqui ou tire suas dúvidas..."*, e enquanto ele responde aparecem **três pontinhos animados** na conversa.

### Para a barbearia (página `/admin.html`)
O link do Admin **não aparece no menu do site** (os clientes não o veem). A barbearia acessa digitando `/admin.html` no endereço.

- **Aba Agendamentos:** lista dos pedidos agrupados por dia, com filtros (Próximos, Hoje, Passados, Todos) e por barbeiro. Mostra o horário, serviço, cliente, telefone (com link para o WhatsApp) e observação. Dá para **Concluir**, **Cancelar** (o horário volta a ficar livre) e **Reativar** um pedido.
- **Aba Preços:** altera o valor de cada serviço. O novo preço aparece no site e o Gelinho também passa a informá-lo.

---

## 🤖 Integração com Inteligência Artificial (o Gelinho)

O chat do site é um assistente com **persona e contexto próprios**, não um chatbot genérico.

| Item | Descrição |
|------|-----------|
| **Persona** | **Gelinho**, atendente virtual da ICE BLLUH. Fala de forma descontraída, com gíria leve e o slogan da casa ("Gelo no nome e revolução no estilo"), respostas curtas e com emojis 🧊✂️. |
| **IA usada** | API do **Gemini** (Google), pela biblioteca `@google/genai`. O modelo padrão é `gemini-3.5-flash-lite` e pode ser trocado com `GEMINI_MODEL` no `.env`. |
| **Contexto** | Definido em [persona.js](persona.js) e enviado ao modelo a cada conversa como *system instruction*: endereço, contatos, programa de indicação, barbeiros e horários, lista completa de serviços com preços e durações. |
| **Limites (sem fugir do assunto)** | Só responde sobre a barbearia. Perguntas fora do tema são recusadas com educação. Não inventa dados: o que o site não sabe está marcado com `TODO:` na persona e ele encaminha para o WhatsApp. |
| **Preços sempre atuais** | Quando o Admin altera um preço, o servidor avisa o Gelinho na próxima conversa, então ele nunca fala um valor desatualizado. |
| **Agendar conversando** | O Gemini usa **function calling**: depois de ter nome, telefone, serviço, barbeiro, data e hora e a confirmação do cliente, ele chama a função `registrar_pedido`. O servidor valida (expediente, horário passado, horário já ocupado) e grava o pedido. Se algo não bater, o Gelinho recebe o erro e sugere outro horário. |
| **Onde roda** | No **servidor** (`server.js`). A chave do Gemini nunca vai para o navegador. |
| **Proteções** | Limite de 20 mensagens por minuto por pessoa, histórico de até 40 mensagens e 1000 caracteres por mensagem (evita abuso e gasto da cota). |

**Fluxo de uma mensagem:** navegador (`chat-gelinho.js`) → `POST /api/chat` → `server.js` monta a persona + histórico → Gemini responde (ou chama `registrar_pedido`) → o servidor devolve o texto ao navegador.

---

## Como o projeto está organizado

```
trabalho-do-martins/
├── public/                 → tudo que o navegador recebe
│   ├── index.html          → página única (Início, Sobre, Serviços, Barbeiros, Agendar, Contato e chat)
│   ├── admin.html          → página da área Admin
│   ├── css/
│   │   └── estilos-do-site.css      → visual do site inteiro
│   ├── js/
│   │   ├── chat-gelinho.js          → chat do Gelinho
│   │   ├── agendamento-cliente.js   → formulário de agendamento e preços atualizados
│   │   └── painel-admin.js          → agendamentos e preços no Admin
│   └── img/                → logo, favicon e imagens
├── COMO-EXPLICAR-O-CHATBOT.md → roteiro para explicar o chatbot do zero (para a apresentação)
├── persona.js              → personalidade e regras do Gelinho (tom de voz, dados da barbearia)
├── server.js               → servidor: entrega o site, guarda os pedidos e conversa com o Gemini
├── package.json            → dependências e comando de início
├── .env.exemplo            → modelo do arquivo de configuração (sem segredos)
├── .gitignore              → arquivos que não vão para o GitHub
└── README.md               → este arquivo
```

Arquivos criados automaticamente enquanto o site roda (ficam só no computador do servidor, não vão para o GitHub):

- `pedidos.json` — os agendamentos feitos.
- `precos.json` — os preços ajustados no Admin.

### Como as partes se conversam
1. O navegador abre o site (`public/`), entregue pelo `server.js`.
2. Ao agendar, o site chama a API do servidor, que confere o expediente do barbeiro, impede horários repetidos e grava em `pedidos.json`.
3. No chat, o servidor envia a conversa ao **Gemini** junto com a `persona.js`. A chave do Gemini fica **só no servidor** e nunca vai para o navegador.
4. A área Admin lê e altera os pedidos e preços por meio de rotas protegidas por senha.

---

## 🖥️ Sobre o servidor: onde roda e problemas comuns

**Onde fica hospedado?** No seu próprio computador. O site só existe enquanto o servidor estiver ligado e **não fica na internet**: abre no próprio PC (`localhost`) ou em aparelhos da **mesma rede Wi-Fi**. Os agendamentos e preços ficam salvos em `pedidos.json` e `precos.json`.

**Abrir no celular ou outro PC (mesmo Wi-Fi):** com o servidor ligado, rode `ipconfig`, pegue o **Endereço IPv4** (algo como `192.168.x.x`) e abra `http://192.168.x.x:3000` no outro aparelho. Se não abrir, libere a porta 3000 no Firewall do Windows (rede privada). Para usar o Admin nesses aparelhos, defina `ADMIN_SENHA` no `.env`.

**Servidor ficou preso depois de fechar o terminal?** Se der erro de porta em uso (`EADDRINUSE`), rode `netstat -ano | findstr :3000`, veja o número da última coluna (PID) e encerre com `taskkill /PID 1234 /F` (troque `1234` pelo PID). Também dá para finalizar o **Node.js** no Gerenciador de Tarefas.

**Reiniciar:** `Ctrl + C` e `npm start` de novo (necessário ao mudar `server.js` ou `.env`). Mudanças em `public/` só pedem **F5** no navegador.

| Mensagem / sintoma | O que fazer |
|--------------------|-------------|
| `GEMINI_API_KEY não definida` / chat "desligado" | O `.env` não existe, tem outro nome ou está sem a chave. Refaça o passo 2 da seção "🔑 LEIA PRIMEIRO" e reinicie. |
| Porta 3000 em uso | Desligue o outro servidor (acima) ou use outra porta: no **cmd** `set PORT=3001`, no **PowerShell** `$env:PORT=3001`, e depois `npm start`. |
| `'npm' não é reconhecido` | Instale o [Node.js](https://nodejs.org) e abra um terminal novo. |
| O chat não responde | Chave do Gemini inválida ou sem internet. Confira o `.env` e o erro no terminal. |

**Quero o site online o tempo todo:** é preciso hospedar em um serviço que rode Node.js (como **Render** ou **Railway**), cadastrando `GEMINI_API_KEY`, `ADMIN_SENHA` e `NODE_ENV=production` nas variáveis do painel. O **GitHub Pages não serve**, pois só hospeda páginas estáticas.

---

## Barbeiros, horários e duração dos serviços

A barbearia tem dois barbeiros. O **Ice** é o **barbeiro chefe**, o principal e o melhor da casa. Os horários ficam no topo do `server.js` (constante `BARBEIROS`), em intervalos de 30 minutos:

| Barbeiro | Dias | Horário | Duração do **Corte** |
|----------|------|---------|----------------------|
| **Ice** (barbeiro chefe) | segunda a sábado | 09h às 20h | **30 min** |
| **Alisson** | segunda a sábado | 09h às 20h | **60 min** |

> Os dias e horários de cada barbeiro são provisórios (marcados com `TODO` no `server.js` e na `persona.js`) até a barbearia confirmar os reais.

**O agendamento respeita a duração do serviço.** Um corte de 60 min com o Alisson às 10h bloqueia o barbeiro até 11h, então 10h30 deixa de aparecer como livre. Um serviço também não pode terminar depois do fim do expediente. A duração dos demais serviços vem da tabela `DURACAO_SERVICO` no `server.js` (por exemplo: Botox Capilar 90 min, Corte e Barba 60 min, Lavagem 10 min).

---

## Segurança

- A **chave do Gemini** e a **senha do Admin** ficam no arquivo `.env`, que **não vai para o GitHub** (está no `.gitignore`). Nunca coloque esses dados no código, no HTML ou no `chat-gelinho.js`.
- Os dados dos clientes (`pedidos.json`) também ficam fora do GitHub.
- A área Admin exige senha. Sem `ADMIN_SENHA` definida, ela só abre no próprio computador do servidor.
- O servidor limita a quantidade de mensagens e pedidos por pessoa, bloqueia temporariamente quem erra a senha várias vezes, valida tudo que recebe e envia cabeçalhos de segurança.
- Em produção (`NODE_ENV=production`), o servidor só inicia se `ADMIN_SENHA` estiver configurada. Use HTTPS.

### Antes de subir para o GitHub
1. Rode `git status` e confirme que `.env`, `pedidos.json` e `precos.json` **não** aparecem na lista.
2. Se a chave do Gemini já foi exposta em algum lugar, gere uma nova no site do Google.

> O **GitHub Pages não executa este projeto**, porque ele precisa de um servidor Node. Para publicar online, use uma hospedagem com Node (como Render ou Railway) e cadastre `GEMINI_API_KEY`, `ADMIN_SENHA` e `NODE_ENV=production` nas variáveis de ambiente.

---

## Tecnologias

- **Node.js** e **Express** — servidor e API.
- **Gemini** (biblioteca `@google/genai`) — inteligência do atendente.
- **HTML, CSS e JavaScript puros** — o site, sem framework.
- **dotenv** — leitura das configurações do `.env`.

---

## Entrega (.zip)

Não envie a pasta `node_modules` nem o arquivo `.env`.

## Pendências

Informações que o site ainda não tem estão marcadas com `TODO:` em `persona.js` (por exemplo: formas de pagamento, política de cancelamento e horário aos domingos).
