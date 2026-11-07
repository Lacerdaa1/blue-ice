// Agendamento: formulário da seção "Agendar". Clicar em um serviço escolhe ele no formulário.
const agendaForm = document.getElementById("agenda-form");
const agendaServico = document.getElementById("agenda-servico");
const agendaPreco = document.getElementById("agenda-preco");
const agendaDuracao = document.getElementById("agenda-duracao");
const agendaNome = document.getElementById("agenda-nome");
const agendaTelefone = document.getElementById("agenda-telefone");
const agendaBarbeiro = document.getElementById("agenda-barbeiro");
const agendaData = document.getElementById("agenda-data");
const agendaHora = document.getElementById("agenda-hora");
const agendaObs = document.getElementById("agenda-obs");
const agendaAviso = document.getElementById("agenda-aviso");
const agendaEnviar = document.getElementById("agenda-enviar");

const itensServico = [...document.querySelectorAll(".lista li")];

function avisar(texto, ok = false) {
  agendaAviso.textContent = texto;
  agendaAviso.classList.toggle("agenda__aviso--ok", ok);
}

function hojeISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const nomeDe = (li) => li.querySelector("span").textContent;
const precoDe = (li) => li.querySelector("b").textContent;

// Lista de serviços do formulário, montada a partir dos cards da página.
function montarOpcoes() {
  const escolhido = agendaServico.value;
  agendaServico.innerHTML = "";
  const vazio = new Option("Escolha um serviço", "", true, true);
  vazio.disabled = true;
  agendaServico.add(vazio);
  for (const li of itensServico) {
    const grupo = li.closest("ul").previousElementSibling?.textContent;
    let optgroup = [...agendaServico.querySelectorAll("optgroup")].find((g) => g.label === grupo);
    if (!optgroup) {
      optgroup = document.createElement("optgroup");
      optgroup.label = grupo;
      agendaServico.add(optgroup);
    }
    optgroup.append(new Option(`${nomeDe(li)} — ${precoDe(li)}`, nomeDe(li)));
  }
  agendaServico.value = escolhido || "";
  if (!agendaServico.value) vazio.selected = true;
  mostrarPreco();
}

function mostrarPreco() {
  const li = itensServico.find((x) => nomeDe(x) === agendaServico.value);
  agendaPreco.textContent = li ? precoDe(li) : "—";
}

function somarDia(iso) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Com `avancar`, se o dia não tiver horário, pula para o próximo dia que tiver (até 14 dias).
async function carregarHorarios(avancar = false, tentativas = 0) {
  agendaHora.innerHTML = "";
  agendaHora.disabled = true;
  agendaDuracao.textContent = "—";
  if (!agendaData.value) return;
  const temServico = Boolean(agendaServico.value);
  try {
    const q = new URLSearchParams({ barbeiro: agendaBarbeiro.value, data: agendaData.value });
    if (temServico) q.set("servico", agendaServico.value);
    const dados = await (await fetch("/api/horarios?" + q)).json();
    if (avancar && tentativas < 14 && (!dados.atende || dados.livres.length === 0)) {
      agendaData.value = somarDia(agendaData.value);
      return carregarHorarios(true, tentativas + 1);
    }
    if (temServico) agendaDuracao.textContent = dados.duracao + " min";
    if (!dados.atende) return avisar(agendaBarbeiro.value + " não atende nesse dia. Escolha outra data ou outro barbeiro.");
    if (dados.livres.length === 0) return avisar("Sem horários livres nesse dia. Tente outra data ou outro barbeiro.");
    avisar("");
    agendaHora.innerHTML = dados.livres.map((h) => `<option value="${h}">${h}</option>`).join("");
    agendaHora.disabled = false;
  } catch {
    avisar("Não consegui carregar os horários. Tente de novo.");
  }
}

// Escolhe o serviço no formulário e leva o cliente até ele.
function escolherServico(li) {
  agendaServico.value = nomeDe(li);
  mostrarPreco();
  carregarHorarios();
  document.getElementById("agendar").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => agendaNome.focus({ preventScroll: true }), 500);
}

// Clicar em um barbeiro leva ao formulário com ele escolhido e já mostra os horários livres.
function escolherBarbeiro(nome) {
  agendaBarbeiro.value = nome;
  if (!agendaData.value) agendaData.value = hojeISO();
  carregarHorarios(true);
  document.getElementById("agendar").scrollIntoView({ behavior: "smooth" });
}

document.querySelectorAll("[data-barbeiro]").forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.addEventListener("click", () => escolherBarbeiro(card.dataset.barbeiro));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      escolherBarbeiro(card.dataset.barbeiro);
    }
  });
});

itensServico.forEach((li) => {
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.addEventListener("click", () => escolherServico(li));
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      escolherServico(li);
    }
  });
});

// Mostra os preços ajustados no admin (se a chamada falhar, ficam os do HTML).
fetch("/api/servicos")
  .then((r) => r.json())
  .then((servicos) => {
    const precos = new Map(servicos.map((s) => [s.nome, s.preco]));
    for (const li of itensServico) {
      const preco = precos.get(nomeDe(li));
      if (preco) li.querySelector("b").textContent = preco;
    }
    montarOpcoes();
  })
  .catch(() => {});

agendaData.min = hojeISO();
montarOpcoes();
agendaServico.addEventListener("change", () => {
  mostrarPreco();
  carregarHorarios();
});
agendaBarbeiro.addEventListener("change", () => carregarHorarios());
agendaData.addEventListener("change", () => carregarHorarios());

agendaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  agendaEnviar.disabled = true;
  avisar("Enviando...");
  try {
    const resp = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: agendaNome.value,
        telefone: agendaTelefone.value,
        servico: agendaServico.value,
        preco: agendaPreco.textContent,
        barbeiro: agendaBarbeiro.value,
        data: agendaData.value,
        hora: agendaHora.value,
        observacao: agendaObs.value,
      }),
    });
    const dados = await resp.json();
    if (!resp.ok) {
      avisar(dados.erro || "Não foi possível enviar o pedido.");
      if (resp.status === 409) carregarHorarios();
      return;
    }
    const p = dados.pedido;
    agendaForm.reset();
    montarOpcoes();
    agendaHora.innerHTML = "";
    agendaHora.disabled = true;
    agendaDuracao.textContent = "—";
    avisar(`Pedido #${p.id} confirmado! ${p.servico} com ${p.barbeiro}, ${p.data} às ${p.hora}. 🧊`, true);
  } catch {
    avisar("Sem conexão com o servidor. Tente de novo.");
  } finally {
    agendaEnviar.disabled = false;
  }
});
