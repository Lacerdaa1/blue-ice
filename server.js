import "dotenv/config";
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import { persona } from "./persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_PEDIDOS = path.join(__dirname, "pedidos.json");
const PORTA = process.env.PORT || 3000;
const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Sem chave o site abre normalmente; só o chat do Gelinho fica indisponível.
const TEM_CHAVE = Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_API_KEY !== "COLE_SUA_CHAVE_AQUI";
if (!TEM_CHAVE) {
  console.warn("⚠️  GEMINI_API_KEY não definida: o site abre, mas o chat (Gelinho) fica desligado. Veja o README.");
}

const ai = TEM_CHAVE ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const registrarPedido = {
  name: "registrar_pedido",
  description:
    "Registra o pedido de agendamento. Só chame depois de ter nome, telefone, serviço, barbeiro, data e hora e o cliente ter confirmado.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      nome: { type: Type.STRING, description: "Nome do cliente" },
      telefone: { type: Type.STRING, description: "Telefone do cliente" },
      servico: { type: Type.STRING, description: "Serviço escolhido" },
      barbeiro: { type: Type.STRING, description: "Barbeiro escolhido" },
      data: { type: Type.STRING, description: "Data do atendimento (DD/MM/AAAA)" },
      hora: { type: Type.STRING, description: "Hora do atendimento (HH:MM)" },
    },
    required: ["nome", "telefone", "servico", "barbeiro", "data", "hora"],
  },
};

// Expediente de cada barbeiro (dias: 0=domingo ... 6=sábado; horas em formato 24h).
// TODO: confirmar com a barbearia os dias/horários reais de Ice e Alisson (provisório: seg a sáb, 09h às 20h).
const BARBEIROS = {
  Ice: { dias: [1, 2, 3, 4, 5, 6], inicio: 9, fim: 20 },
  Alisson: { dias: [1, 2, 3, 4, 5, 6], inicio: 9, fim: 20 },
};
const PASSO_MIN = 30;

// Duração (em minutos) de cada serviço. O Corte depende do barbeiro: Ice 30 min, Alisson 60 min.
const DURACAO_CORTE = { Ice: 30, Alisson: 60 };
const DURACAO_SERVICO = {
  "Corte à Máquina": 30, "Pezinho do Cabelo": 30, "Raspagem de Cabelo": 30, Penteado: 30, Lavagem: 10,
  Hidratação: 30, "Botox Capilar": 90, "Realinhamento Capilar": 90, "Corte e Barba": 60, "Barba Completa": 30,
  Barboterapia: 30, "Pezinho de Barba": 30, "Raspagem da Barba": 30, "Pigmentação da Barba": 30,
  "Tintura da Barba": 30, "Design de Sobrancelha": 10, "Depilação de Sobrancelhas com Cera": 10,
  "Depilação de Nariz": 10, "Depilação de Ouvido": 10, "Depilação de Nariz e Ouvido": 10, Manicure: 30,
};

function duracaoDe(servico, barbeiro) {
  const nome = semAcento(servico);
  if (nome === "corte" && DURACAO_CORTE[barbeiro]) return DURACAO_CORTE[barbeiro];
  const achado = Object.keys(DURACAO_SERVICO).find((s) => semAcento(s) === nome);
  return achado ? DURACAO_SERVICO[achado] : PASSO_MIN;
}

class ErroPedido extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

const semAcento = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function acharBarbeiro(nome) {
  return Object.keys(BARBEIROS).find((b) => semAcento(b) === semAcento(nome));
}

// Aceita AAAA-MM-DD (formulário) ou DD/MM/AAAA (chat).
function lerData(texto) {
  const t = String(texto ?? "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let ano, mes, dia;
  if (m) [, ano, mes, dia] = m;
  else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, dia, mes, ano] = m;
  else return null;
  ano = Number(ano);
  mes = Number(mes);
  dia = Number(dia);
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return { dia, mes, ano, data: d, br: `${dd}/${mm}/${ano}` };
}

function lerHora(texto) {
  const m = String(texto ?? "").trim().match(/^(\d{1,2})(?:[:h](\d{2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function horariosDoDia(nomeBarbeiro, data) {
  const b = BARBEIROS[nomeBarbeiro];
  if (!b || !b.dias.includes(data.data.getDay())) return [];
  const lista = [];
  for (let min = b.inicio * 60; min <= b.fim * 60 - PASSO_MIN; min += PASSO_MIN) {
    lista.push(`${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);
  }
  return lista;
}

function dataHora(data, hora) {
  const [h, min] = hora.split(":").map(Number);
  return new Date(data.ano, data.mes - 1, data.dia, h, min);
}

async function lerPedidos() {
  try {
    return JSON.parse(await readFile(ARQUIVO_PEDIDOS, "utf-8"));
  } catch {
    return [];
  }
}

const emMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

// Intervalos [início, fim) em minutos já ocupados por pedidos ativos do barbeiro naquele dia.
function intervalosOcupados(pedidos, barbeiro, dataBr) {
  return pedidos
    .filter((p) => p.status !== "cancelado" && acharBarbeiro(p.barbeiro) === barbeiro && p.data === dataBr)
    .map((p) => {
      const inicio = emMinutos(lerHora(p.hora));
      return [inicio, inicio + (p.duracao ?? duracaoDe(p.servico, barbeiro))];
    });
}

// O horário [inicio, inicio + duracao) cabe no expediente e não bate com nenhum pedido?
function cabe(barbeiro, inicio, duracao, ocupados) {
  if (inicio + duracao > BARBEIROS[barbeiro].fim * 60) return false;
  return !ocupados.some(([ini, fim]) => inicio < fim && ini < inicio + duracao);
}

// Evita que dois pedidos simultâneos gravem o arquivo ao mesmo tempo.
let fila = Promise.resolve();
function exclusivo(tarefa) {
  const r = fila.then(tarefa);
  fila = r.catch(() => {});
  return r;
}

function salvarPedido(dados) {
  return exclusivo(async () => {
    const nome = String(dados.nome ?? "").trim();
    const telefone = String(dados.telefone ?? "").trim();
    const servico = String(dados.servico ?? "").trim();
    if (nome.length < 2) throw new ErroPedido("Informe o nome.");
    if (telefone.replace(/\D/g, "").length < 10) throw new ErroPedido("Informe um telefone válido com DDD.");
    if (!servico) throw new ErroPedido("Escolha um serviço.");

    const barbeiro = acharBarbeiro(dados.barbeiro);
    if (!barbeiro) throw new ErroPedido("Barbeiro inválido.");
    const data = lerData(dados.data);
    if (!data) throw new ErroPedido("Data inválida.");
    const hora = lerHora(dados.hora);
    if (!hora) throw new ErroPedido("Hora inválida.");

    if (!horariosDoDia(barbeiro, data).includes(hora)) {
      throw new ErroPedido(`${barbeiro} não atende nesse dia/horário.`);
    }
    if (dataHora(data, hora) < new Date()) throw new ErroPedido("Esse horário já passou.");

    const duracao = duracaoDe(servico, barbeiro);
    const pedidos = await lerPedidos();
    const ocupados = intervalosOcupados(pedidos, barbeiro, data.br);
    if (emMinutos(hora) + duracao > BARBEIROS[barbeiro].fim * 60) {
      throw new ErroPedido(`${servico} leva ${duracao} min e passa do fim do expediente de ${barbeiro}. Escolha um horário mais cedo.`);
    }
    if (!cabe(barbeiro, emMinutos(hora), duracao, ocupados)) {
      throw new ErroPedido(`${barbeiro} já tem cliente nesse horário (${servico} leva ${duracao} min). Escolha outro horário.`, 409);
    }

    const pedido = {
      id: pedidos.reduce((maior, p) => Math.max(maior, p.id || 0), 0) + 1,
      criadoEm: new Date().toISOString(),
      status: "novo",
      nome,
      telefone,
      servico,
      preco: dados.preco ? String(dados.preco).trim() : undefined,
      duracao,
      barbeiro,
      data: data.br,
      hora,
      observacao: dados.observacao ? String(dados.observacao).trim().slice(0, 300) : undefined,
    };
    pedidos.push(pedido);
    await writeFile(ARQUIVO_PEDIDOS, JSON.stringify(pedidos, null, 2), "utf-8");
    console.log("📥 NOVO PEDIDO");
    console.log(pedido);
    return pedido;
  });
}

// ---------- Preços ----------
// A lista de serviços vem do public/index.html; os preços ajustados no admin ficam em precos.json.
const ARQUIVO_PRECOS = path.join(__dirname, "precos.json");

async function lerPrecosAjustados() {
  try {
    return JSON.parse(await readFile(ARQUIVO_PRECOS, "utf-8"));
  } catch {
    return {};
  }
}

async function listarServicos() {
  const html = await readFile(path.join(__dirname, "public", "index.html"), "utf-8");
  const secao = html.match(/<section id="servicos"[\s\S]*?<\/section>/)?.[0] ?? "";
  const ajustes = await lerPrecosAjustados();
  const servicos = [];
  let categoria = "";
  for (const m of secao.matchAll(/<h3>(.*?)<\/h3>|<li><span>(.*?)<\/span><b>(.*?)<\/b><\/li>/g)) {
    if (m[1]) categoria = m[1];
    else {
      servicos.push({ categoria, nome: m[2], original: m[3], preco: ajustes[m[2]] ?? m[3], ajustado: m[2] in ajustes });
    }
  }
  return servicos;
}

const formatarPreco = (n) => "R$ " + (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

// ---------- Segurança ----------
const EM_PRODUCAO = process.env.NODE_ENV === "production";
const SENHA_ADMIN = process.env.ADMIN_SENHA || "";

if (SENHA_ADMIN === "TROQUE_POR_UMA_SENHA_FORTE") {
  console.error("❌ Troque o ADMIN_SENHA de exemplo no .env por uma senha sua.");
  process.exit(1);
}
if (EM_PRODUCAO && SENHA_ADMIN.length < 8) {
  console.error("❌ Em produção, defina ADMIN_SENHA (mínimo 8 caracteres) no ambiente.");
  process.exit(1);
}
if (SENHA_ADMIN && SENHA_ADMIN.length < 8) {
  console.warn("⚠️  ADMIN_SENHA curta: use pelo menos 8 caracteres.");
}

// Limitador simples em memória: no máximo `max` chamadas por `janelaMs` para cada IP.
function limitar(max, janelaMs, mensagem) {
  const acessos = new Map();
  setInterval(() => {
    const agora = Date.now();
    for (const [ip, lista] of acessos) {
      const recentes = lista.filter((t) => agora - t < janelaMs);
      if (recentes.length) acessos.set(ip, recentes);
      else acessos.delete(ip);
    }
  }, janelaMs).unref();

  return (req, res, next) => {
    const ip = req.socket.remoteAddress;
    const agora = Date.now();
    const recentes = (acessos.get(ip) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= max) {
      res.set("Retry-After", String(Math.ceil(janelaMs / 1000)));
      return res.status(429).json({ erro: mensagem });
    }
    recentes.push(agora);
    acessos.set(ip, recentes);
    next();
  };
}

const limiteChat = limitar(20, 60_000, "Muitas mensagens seguidas. Aguarde um minuto.");
const limitePedidos = limitar(10, 10 * 60_000, "Muitos pedidos enviados. Tente de novo em alguns minutos.");
const falhasLogin = new Map();
const MAX_FALHAS_LOGIN = 10;
const JANELA_LOGIN_MS = 15 * 60_000;

function senhaConfere(informada) {
  const a = crypto.createHash("sha256").update(String(informada ?? "")).digest();
  const b = crypto.createHash("sha256").update(SENHA_ADMIN).digest();
  return crypto.timingSafeEqual(a, b);
}

// A lista de pedidos tem dados de clientes: exige ADMIN_SENHA (no .env) ou acesso pelo próprio PC.
function soDono(req, res, next) {
  if (SENHA_ADMIN) {
    const ip = req.socket.remoteAddress;
    const agora = Date.now();
    const erros = (falhasLogin.get(ip) ?? []).filter((t) => agora - t < JANELA_LOGIN_MS);
    if (erros.length >= MAX_FALHAS_LOGIN) {
      return res.status(429).json({ erro: "Muitas tentativas erradas. Aguarde 15 minutos." });
    }
    if (senhaConfere(req.get("x-senha"))) return next();
    // Só senha errada conta; a página do admin enviada com a senha certa não é limitada.
    if (req.get("x-senha")) erros.push(agora);
    falhasLogin.set(ip, erros);
    return res.status(401).json({ erro: "Senha incorreta.", pedeSenha: true });
  }
  // Sem senha: só vale no próprio PC. Pedido que passou por proxy não conta como "próprio PC".
  const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  if (local && !req.get("x-forwarded-for")) return next();
  res.status(403).json({
    erro: "Abra esta página no computador da barbearia ou defina ADMIN_SENHA no .env.",
  });
}

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy":
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
      "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", limiteChat, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ erro: "O atendente virtual está desligado: falta a GEMINI_API_KEY no .env do servidor." });
  }
  const { historico } = req.body ?? {};
  if (!Array.isArray(historico) || historico.length === 0 || historico.length > 40) {
    return res.status(400).json({ erro: "Histórico da conversa inválido." });
  }
  if (historico.some((m) => String(m?.text ?? "").length > 1000)) {
    return res.status(400).json({ erro: "Mensagem muito longa." });
  }

  const contents = historico.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.text ?? "") }],
  }));

  try {
    // Preços ajustados no admin valem mais do que os escritos na persona.
    const ajustados = (await listarServicos()).filter((s) => s.ajustado);
    const avisoPrecos = ajustados.length
      ? "\n\nPREÇOS ATUALIZADOS (valem no lugar dos preços acima):\n" + ajustados.map((s) => `- ${s.nome}: ${s.preco}`).join("\n")
      : "";
    const config = {
      systemInstruction: persona + avisoPrecos,
      tools: [{ functionDeclarations: [registrarPedido] }],
    };
    let resposta = await ai.models.generateContent({ model: MODELO, contents, config });

    const chamada = resposta.functionCalls?.[0];
    if (chamada?.name === "registrar_pedido") {
      let retorno;
      try {
        const pedido = await salvarPedido(chamada.args);
        retorno = { ok: true, numeroDoPedido: pedido.id };
      } catch (e) {
        if (!(e instanceof ErroPedido)) throw e;
        retorno = { ok: false, erro: e.message };
      }
      // Reenvia o conteúdo original do modelo (inclui a thoughtSignature exigida).
      contents.push(resposta.candidates[0].content);
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: chamada.name, response: retorno } }],
      });
      resposta = await ai.models.generateContent({ model: MODELO, contents, config });
    }

    res.json({ resposta: resposta.text || "Opa, não consegui responder agora. Tenta de novo?" });
  } catch (erro) {
    console.error("Erro no Gemini:", erro.message);
    res.status(500).json({ erro: "O atendente está indisponível no momento." });
  }
});

// Serviços com o preço atual (público: o site usa para mostrar os valores).
app.get("/api/servicos", async (req, res) => {
  res.json(await listarServicos());
});

// Ajusta o preço de um serviço. { servico, valor } — valor null volta ao preço original.
app.put("/api/servicos", soDono, (req, res) => {
  const { servico, valor } = req.body ?? {};
  exclusivo(async () => {
    const servicos = await listarServicos();
    if (!servicos.some((s) => s.nome === servico)) return res.status(404).json({ erro: "Serviço não encontrado." });
    const ajustes = await lerPrecosAjustados();
    if (valor === null) delete ajustes[servico];
    else {
      const n = Number(String(valor).replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 9999) return res.status(400).json({ erro: "Valor inválido." });
      ajustes[servico] = formatarPreco(Math.round(n * 100) / 100);
    }
    await writeFile(ARQUIVO_PRECOS, JSON.stringify(ajustes, null, 2), "utf-8");
    res.json((await listarServicos()).find((s) => s.nome === servico));
  }).catch(() => res.status(500).json({ erro: "Falha ao salvar o preço." }));
});

// Horários livres de um barbeiro em um dia para um serviço (sem dados de clientes).
app.get("/api/horarios", async (req, res) => {
  const barbeiro = acharBarbeiro(req.query.barbeiro);
  const data = lerData(req.query.data);
  if (!barbeiro || !data) return res.status(400).json({ erro: "Informe barbeiro e data." });

  const duracao = duracaoDe(req.query.servico, barbeiro);
  const todos = horariosDoDia(barbeiro, data);
  const ocupados = intervalosOcupados(await lerPedidos(), barbeiro, data.br);
  const agora = new Date();
  const livres = todos.filter((hora) => cabe(barbeiro, emMinutos(hora), duracao, ocupados) && dataHora(data, hora) > agora);
  res.json({ atende: todos.length > 0, livres, duracao });
});

// Pedido feito pelo formulário do site.
app.post("/api/pedidos", limitePedidos, async (req, res) => {
  try {
    const p = await salvarPedido(req.body ?? {});
    res.status(201).json({ ok: true, pedido: { id: p.id, servico: p.servico, barbeiro: p.barbeiro, data: p.data, hora: p.hora } });
  } catch (e) {
    if (!(e instanceof ErroPedido)) {
      console.error("Erro ao salvar pedido:", e.message);
      return res.status(500).json({ erro: "Não foi possível salvar o pedido." });
    }
    res.status(e.status).json({ erro: e.message });
  }
});

// Área da barbearia (aba Pedidos).
app.get("/api/pedidos", soDono, async (req, res) => {
  res.json(await lerPedidos());
});

app.patch("/api/pedidos/:id", soDono, (req, res) => {
  const status = req.body?.status;
  if (!["novo", "concluido", "cancelado"].includes(status)) {
    return res.status(400).json({ erro: "Status inválido." });
  }
  exclusivo(async () => {
    const pedidos = await lerPedidos();
    const pedido = pedidos.find((p) => p.id === Number(req.params.id));
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
    pedido.status = status;
    await writeFile(ARQUIVO_PEDIDOS, JSON.stringify(pedidos, null, 2), "utf-8");
    res.json(pedido);
  }).catch(() => res.status(500).json({ erro: "Falha ao atualizar." }));
});

// Erros inesperados (ex.: JSON quebrado) não devem vazar detalhes internos.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status === 413 ? 413 : 400;
  res.status(status).json({ erro: status === 413 ? "Conteúdo grande demais." : "Requisição inválida." });
});

app.listen(PORTA, () => {
  console.log(`🧊 ICE BLLUH rodando em http://localhost:${PORTA}`);
});
