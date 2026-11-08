
# 🧊 Como explicar o chatbot (Gelinho) do zero

Roteiro para o grupo (Matheus, Hanael e Fábio) explicar ao professor **como o chatbot foi criado, quais ferramentas foram usadas e quais conceitos foram implementados**, que é o que o edital pede (seção 6).

> **Dica de ouro:** cada um do grupo deve saber explicar **todas** as partes. O professor pode perguntar a qualquer um.

---

## 1. Explicação em 30 segundos (para começar)

> "O Gelinho é o atendente virtual da ICE BLLUH Barbearia. Ele usa o **Gemini**, uma IA do Google, mas não é um chatbot genérico: nós demos a ele uma **persona** (nome, jeito de falar) e um **contexto** (serviços, preços, barbeiros, horários). Ele só fala da barbearia e consegue **agendar horário conversando**. A chave da IA fica só no **servidor**, nunca no navegador."

---

## 2. Os conceitos, do zero

### 2.1 O que é um chatbot com IA?
É um programa que recebe uma mensagem de texto, envia para um **modelo de linguagem** (LLM) e mostra a resposta. O modelo foi treinado com muito texto e sabe "continuar" uma conversa de forma coerente.

### 2.2 O que é uma API?
É uma "porta" para usar um serviço de outra empresa pelo código. Em vez de abrir o site do Gemini, o nosso servidor **envia o texto pela internet** e **recebe a resposta**. Para isso usa uma **chave de API**, que funciona como uma senha que identifica quem está usando.

**Analogia:** o garçom (nosso servidor) leva o pedido do cliente (o navegador) até a cozinha (o Gemini) e traz o prato (a resposta).

### 2.3 O que é uma persona? (o coração do trabalho)
É o "manual de personalidade" do atendente. No Gemini isso se chama **system instruction** (instrução de sistema): um texto enviado **antes da conversa** dizendo quem ele é e como deve agir. Fica no arquivo [persona.js](persona.js).

Nossa persona define:
| Parte | O que diz |
|-------|-----------|
| **Quem é** | Gelinho, atendente da ICE BLLUH, em Teresina - PI |
| **Tom de voz** | Descontraído, gíria leve ("e aí, mano", "fechou"), respostas curtas, emojis 🧊✂️, combina com o slogan "Gelo no nome e revolução no estilo" |
| **Dados reais** | Endereço, WhatsApp, Instagram, horário, programa de indicação |
| **Barbeiros** | **Ice**, o **barbeiro chefe**, principal e o melhor (corte em 30 min), e **Alisson** (corte em 60 min) |
| **Serviços** | Lista completa com preços e durações |
| **Regras** | Só fala da barbearia, não inventa nada, recomenda o Ice quando o cliente não sabe quem escolher |

### 2.4 Como o chatbot "lembra" da conversa?
O modelo **não tem memória**. A cada mensagem, o navegador reenvia **todo o histórico** da conversa (lista de mensagens do usuário e do modelo). É isso que dá a sensação de memória. Está em [public/js/chat-gelinho.js](public/js/chat-gelinho.js), na variável `historico`.

### 2.5 Como evitamos que ele "invente" ou fuja do assunto?
Na persona há regras explícitas: "Responda SOMENTE sobre a ICE BLLUH", "NÃO invente informação". O que a barbearia ainda não sabe está marcado com `TODO:` e o Gelinho é orientado a dizer que não tem a informação e indicar o WhatsApp. Resultado testado: perguntado sobre a capital da França, ele recusa com educação e volta ao assunto da barbearia.

### 2.6 O que é *function calling*? (o conceito mais avançado)
É quando a IA, em vez de só responder texto, **pede para o nosso código executar uma função**. Nós declaramos a função `registrar_pedido` (nome, telefone, serviço, barbeiro, data e hora). Quando o cliente confirma o agendamento, o Gemini devolve um "pedido de chamada" com esses dados em vez de texto. Nosso servidor:

1. **valida** (barbeiro atende nesse dia? o horário já passou? está livre? cabe a duração do serviço?);
2. **grava** em `pedidos.json`;
3. **responde ao Gemini** dizendo se deu certo (ou o erro);
4. o Gemini **escreve a mensagem final** para o cliente ("Fechado! Agendei seu corte com o Ice às 15h").

Se o horário estiver ocupado, o erro volta para o Gemini e ele **sugere outro horário**.

### 2.7 Por que a chave fica no servidor?
Tudo que está no navegador (HTML, JavaScript) qualquer pessoa consegue ver. Se a chave estivesse lá, qualquer um poderia copiar e gastar a cota. Por isso o navegador só fala com **o nosso servidor** (`/api/chat`), e só o servidor conhece a chave, guardada no arquivo `.env` (que não vai para o GitHub).

---

## 3. O caminho de uma mensagem (desenho para o quadro)

```
[Cliente digita]
      │
      ▼
 chat-gelinho.js (navegador)  ── envia o histórico ──►  POST /api/chat
                                                       │
                                                       ▼
                                              server.js (Node + Express)
                                              • limita abuso (20 msg/min)
                                              • valida tamanho do histórico
                                              • monta: persona + preços atualizados
                                                       │
                                                       ▼
                                                API do Gemini (Google)
                                                       │
                                 ┌─────────────────────┴───────────────────┐
                                 ▼                                         ▼
                        resposta em texto                      pede a função registrar_pedido
                                 │                                         │
                                 │                         servidor valida e grava em pedidos.json
                                 │                         devolve o resultado ao Gemini
                                 │                         Gemini escreve a confirmação
                                 ▼                                         ▼
                              server.js devolve o texto para o navegador
                                                       │
                                                       ▼
                                   chat-gelinho.js mostra a resposta no chat
                          (enquanto espera, três pontinhos animados "..." aparecem)
```

---

## 4. Onde está cada coisa no código

| Arquivo | Função / trecho | O que faz |
|---------|-----------------|-----------|
| [persona.js](persona.js) | `export const persona` | Texto da personalidade, dados e regras (a *system instruction*) |
| [server.js](server.js) | `const ai = new GoogleGenAI(...)` | Cria o cliente do Gemini com a chave do `.env` |
| [server.js](server.js) | `const registrarPedido = {...}` | **Declara a função** que a IA pode chamar (nome + campos) |
| [server.js](server.js) | `app.post("/api/chat", ...)` | Rota que recebe o histórico, chama o Gemini e devolve a resposta |
| [server.js](server.js) | `systemInstruction: persona + avisoPrecos` | Envia a persona **mais os preços que o Admin alterou** |
| [server.js](server.js) | `resposta.functionCalls?.[0]` | Detecta se o Gemini pediu `registrar_pedido` |
| [server.js](server.js) | `salvarPedido(...)` | Valida (expediente, horário, duração, conflito) e grava |
| [server.js](server.js) | `functionResponse` | Devolve ao Gemini o resultado da função |
| [server.js](server.js) | `limitar(...)` e checagem de `historico` | Limites contra abuso e gasto da cota |
| [public/js/chat-gelinho.js](public/js/chat-gelinho.js) | `enviar()` | Manda a mensagem, guarda o histórico e mostra a resposta |
| [public/js/chat-gelinho.js](public/js/chat-gelinho.js) | `msg--carregando` | Mostra os três pontinhos enquanto a IA responde |
| [public/css/estilos-do-site.css](public/css/estilos-do-site.css) | `@keyframes pontos-pula` | A animação dos pontinhos (feita só com CSS) |

---

## 5. Ferramentas usadas (para citar)

| Ferramenta | Para quê |
|------------|----------|
| **Gemini** (Google AI Studio) | O modelo de IA. Padrão: `gemini-3.5-flash-lite` (rápido e barato) |
| **@google/genai** | Biblioteca oficial para falar com o Gemini em Node |
| **Node.js + Express** | O servidor que entrega o site e a API |
| **dotenv** | Lê o arquivo `.env` com a chave |
| **HTML, CSS e JavaScript puro** | O site e o chat, sem framework |
| **Ferramentas de IA como apoio** | O edital permite. Fale com honestidade o que foi pesquisado e o que foi apoiado por IA |

---

## 6. Roteiro de demonstração (3 minutos)

1. **Abrir o site** e clicar no botão 🤖. Mostrar o aviso *"Faça seu atendimento por aqui..."*.
2. **Pergunta normal:** "Quanto custa corte e barba?" → responde R$ 110, 60 min.
3. **Pergunta sobre os barbeiros:** "Quem é o melhor barbeiro?" → recomenda o **Ice**, o barbeiro chefe, corte em 30 min. O Alisson faz o corte em 60 min.
4. **Pergunta fora do tema:** "Qual a capital da França?" → recusa com educação (prova a **persona e o contexto**).
5. **Agendar conversando:** pedir um horário, dar nome e telefone e confirmar. Mostrar os **três pontinhos** enquanto ele responde.
6. **Mostrar o resultado:** abrir o Admin (`/admin.html`) e ver o pedido aparecer.
7. **Prova da integração:** no Admin, mudar o preço de um serviço e perguntar o preço ao Gelinho de novo: ele já responde o valor novo.

---

## 7. Perguntas que o professor pode fazer (e respostas)

**"Qual a diferença do seu chatbot para um genérico?"**
O nosso tem persona e contexto próprios (a `persona.js`), só responde sobre a barbearia, recusa assuntos fora do tema e executa uma ação real: agenda o horário e grava no sistema.

**"Como ele sabe os preços e horários?"**
Estão escritos na persona e são enviados ao Gemini a cada conversa. Se o Admin muda um preço, o servidor anexa o valor novo à persona.

**"A IA grava o pedido sozinha?"**
Não diretamente. Ela *pede* a função `registrar_pedido` e o **nosso servidor** decide: valida e só então grava. A IA nunca mexe nos arquivos.

**"O que acontece se dois clientes pedirem o mesmo horário?"**
O servidor confere os horários ocupados, considerando a **duração** (corte do Alisson = 60 min bloqueia o horário seguinte). O segundo pedido recebe erro e o Gelinho sugere outro horário.

**"Por que a chave não está no JavaScript do site?"**
Porque o navegador é público. A chave fica no servidor, no `.env`, que está no `.gitignore` e não vai para o GitHub.

**"E se alguém ficar mandando mensagem sem parar?"**
Há um limite de 20 mensagens por minuto por pessoa, 40 mensagens de histórico e 1000 caracteres por mensagem. Isso protege a cota e o custo.

**"O que acontece sem a chave?"**
O site abre normalmente, só o chat avisa que está desligado.

**"O que é o `TODO` na persona?"**
São informações que a barbearia ainda não confirmou (pagamento, cancelamento etc.). Em vez de inventar, o Gelinho diz que não tem e indica o WhatsApp.

**"Por que o Ice é destacado?"**
Porque é o **barbeiro chefe**, o principal e o melhor da casa. A persona manda recomendá-lo quando o cliente não sabe quem escolher.

---

## 8. Como cada integrante pode se preparar

- **Treine a explicação de 30 segundos** (seção 1) em voz alta.
- **Abra o `persona.js` e o `server.js`** e encontre cada item da tabela da seção 4.
- **Faça o roteiro de demonstração** (seção 6) uma vez antes de apresentar.
- Combinem quem fala de cada parte: **persona/conceitos**, **servidor/API/segurança** e **demonstração**. Mas todos devem saber responder tudo.
