const login = document.getElementById("login");
const senhaCampo = document.getElementById("login-senha");
const aviso = document.getElementById("admin-aviso");
const painel = document.getElementById("painel");
const lista = document.getElementById("lista-pedidos");
const resumo = document.getElementById("resumo");
const listaPrecos = document.getElementById("lista-precos");
const filtros = document.querySelectorAll(".filtro");
const filtroBarbeiro = document.getElementById("filtro-barbeiro");
const abas = document.querySelectorAll(".aba");

let pedidos = [];
let filtro = "proximos";
let tentouSenha = false;

const ROTULO = { novo: "Novo", concluido: "Concluído", cancelado: "Cancelado" };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function quando(p) {
  const [d, m, a] = p.data.split("/").map(Number);
  const [h, min] = p.hora.split(":").map(Number);
  return new Date(a, m - 1, d, h, min);
}

function esc(t) {
  const div = document.createElement("div");
  div.textContent = t ?? "";
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// "R$ 55" ou "R$ 55,50" -> 55 / 55.5
function valorDe(preco) {
  const n = Number(String(preco ?? "").replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const dinheiro = (n) => "R$ " + n.toFixed(2).replace(".", ",");

function chamar(url, opcoes = {}) {
  const senha = sessionStorage.getItem("senha");
  return fetch(url, {
    ...opcoes,
    headers: { "Content-Type": "application/json", ...(senha ? { "x-senha": senha } : {}) },
  });
}

async function carregar() {
  try {
    const resp = await chamar("/api/pedidos");
    if (resp.status === 401) {
      sessionStorage.removeItem("senha");
      login.hidden = false;
      painel.hidden = true;
      aviso.textContent = tentouSenha ? "Senha incorreta." : "";
      return;
    }
    const dados = await resp.json();
    if (!resp.ok) {
      painel.hidden = true;
      aviso.textContent = dados.erro;
      return;
    }
    login.hidden = true;
    aviso.textContent = "";
    painel.hidden = false;
    pedidos = dados;
    desenhar();
  } catch {
    aviso.textContent = "Sem conexão com o servidor.";
  }
}

// ---------- Agendamentos ----------
function desenhar() {
  const agora = new Date();
  const hoje = agora.toLocaleDateString("pt-BR");
  let itens = pedidos.filter((p) => p.status !== "cancelado" || filtro === "todos");
  if (filtroBarbeiro.value) itens = itens.filter((p) => p.barbeiro === filtroBarbeiro.value);
  if (filtro === "hoje") itens = itens.filter((p) => p.data === hoje);
  if (filtro === "proximos") itens = itens.filter((p) => quando(p) >= agora - 60 * 60 * 1000);
  if (filtro === "passados") itens = itens.filter((p) => quando(p) < agora);
  itens.sort((a, b) => (filtro === "passados" ? quando(b) - quando(a) : quando(a) - quando(b)));

  const validos = itens.filter((p) => p.status !== "cancelado");
  resumo.textContent = itens.length
    ? `${validos.length} agendamento(s) · total estimado ${dinheiro(validos.reduce((s, p) => s + valorDe(p.preco), 0))}`
    : "";

  if (itens.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhum agendamento aqui.</p>';
    return;
  }

  const porDia = new Map();
  for (const p of itens) {
    if (!porDia.has(p.data)) porDia.set(p.data, []);
    porDia.get(p.data).push(p);
  }

  lista.innerHTML = [...porDia.entries()]
    .map(([data, ps]) => {
      const dia = DIAS[quando(ps[0]).getDay()];
      const titulo = data === hoje ? `Hoje · ${data}` : `${dia} · ${data}`;
      const cartoes = ps
        .map((p) => {
          const status = p.status || "novo";
          const fone = String(p.telefone).replace(/\D/g, "");
          const wa = fone ? `https://wa.me/${fone.length <= 11 ? "55" + fone : fone}` : "#";
          return `<article class="pedido pedido--${status}">
            <div class="pedido__hora">${esc(p.hora)}${p.duracao ? `<small>${p.duracao} min</small>` : ""}</div>
            <div class="pedido__info">
              <strong>${esc(p.servico)} ${p.preco ? `<span class="pedido__preco">${esc(p.preco)}</span>` : ""}</strong>
              <span>${esc(p.nome)} · <a href="${wa}" target="_blank" rel="noopener">${esc(p.telefone)}</a></span>
              <span>Barbeiro: ${esc(p.barbeiro)}</span>
              ${p.observacao ? `<span class="pedido__obs">“${esc(p.observacao)}”</span>` : ""}
            </div>
            <div class="pedido__acoes">
              <span class="selo selo--${status}">${ROTULO[status] || "Novo"} · #${p.id}</span>
              ${status !== "concluido" ? `<button data-id="${p.id}" data-status="concluido">Concluir</button>` : ""}
              ${status !== "cancelado" ? `<button data-id="${p.id}" data-status="cancelado">Cancelar</button>` : `<button data-id="${p.id}" data-status="novo">Reativar</button>`}
            </div>
          </article>`;
        })
        .join("");
      return `<section class="dia"><h3>${titulo}</h3>${cartoes}</section>`;
    })
    .join("");
}

lista.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  if (b.dataset.status === "cancelado" && !confirm("Cancelar este agendamento? O horário volta a ficar livre.")) return;
  b.disabled = true;
  await chamar("/api/pedidos/" + b.dataset.id, { method: "PATCH", body: JSON.stringify({ status: b.dataset.status }) });
  carregar();
});

filtros.forEach((f) =>
  f.addEventListener("click", () => {
    filtro = f.dataset.filtro;
    filtros.forEach((x) => x.classList.toggle("filtro--ativo", x === f));
    desenhar();
  })
);
filtroBarbeiro.addEventListener("change", desenhar);

// ---------- Preços ----------
async function carregarPrecos() {
  const servicos = await (await fetch("/api/servicos")).json();
  const porCategoria = new Map();
  for (const s of servicos) {
    if (!porCategoria.has(s.categoria)) porCategoria.set(s.categoria, []);
    porCategoria.get(s.categoria).push(s);
  }
  listaPrecos.innerHTML = [...porCategoria.entries()]
    .map(
      ([cat, itens]) => `<h3>${esc(cat)}</h3>` +
        itens
          .map(
            (s) => `<div class="preco${s.ajustado ? " preco--ajustado" : ""}" data-nome="${esc(s.nome)}">
              <span class="preco__nome">${esc(s.nome)}${s.ajustado ? `<small>original ${esc(s.original)}</small>` : ""}</span>
              <label class="preco__campo">R$
                <input type="number" min="0" max="9999" step="0.01" value="${valorDe(s.preco)}" />
              </label>
              <button type="button" data-acao="salvar">Salvar</button>
              ${s.ajustado ? '<button type="button" data-acao="restaurar">Restaurar</button>' : ""}
            </div>`
          )
          .join("")
    )
    .join("");
}

listaPrecos.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-acao]");
  if (!b) return;
  const linha = b.closest(".preco");
  const valor = b.dataset.acao === "restaurar" ? null : linha.querySelector("input").value;
  if (valor === "") return;
  b.disabled = true;
  const resp = await chamar("/api/servicos", { method: "PUT", body: JSON.stringify({ servico: linha.dataset.nome, valor }) });
  if (!resp.ok) {
    aviso.textContent = (await resp.json()).erro || "Não foi possível salvar.";
    b.disabled = false;
    return;
  }
  aviso.textContent = "";
  await carregarPrecos();
});

// ---------- Abas ----------
abas.forEach((a) =>
  a.addEventListener("click", () => {
    abas.forEach((x) => x.classList.toggle("aba--ativa", x === a));
    document.getElementById("aba-agendamentos").hidden = a.dataset.aba !== "agendamentos";
    document.getElementById("aba-precos").hidden = a.dataset.aba !== "precos";
    if (a.dataset.aba === "precos") carregarPrecos();
  })
);

login.addEventListener("submit", (e) => {
  e.preventDefault();
  sessionStorage.setItem("senha", senhaCampo.value);
  tentouSenha = true;
  carregar();
});

carregar();
setInterval(() => {
  if (!painel.hidden && !document.getElementById("aba-agendamentos").hidden) carregar();
}, 20000);
