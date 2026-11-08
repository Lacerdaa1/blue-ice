const botao = document.getElementById("chat-botao");
const painel = document.getElementById("chat-painel");
const fechar = document.getElementById("chat-fechar");
const mensagens = document.getElementById("chat-mensagens");
const form = document.getElementById("chat-form");
const campo = document.getElementById("chat-campo");
const btnEnviar = document.getElementById("chat-enviar");

// Histórico da conversa, enviado ao servidor a cada mensagem.
const historico = [];

function adicionar(texto, quem) {
  const div = document.createElement("div");
  div.className = "msg msg--" + quem;
  div.textContent = texto;
  mensagens.appendChild(div);
  mensagens.scrollTop = mensagens.scrollHeight;
  return div;
}

async function enviar() {
  const texto = campo.value.trim();
  if (!texto) return;

  adicionar(texto, "user");
  historico.push({ role: "user", text: texto });
  campo.value = "";
  btnEnviar.disabled = true;
  const digitando = adicionar("", "bot");
  digitando.classList.add("msg--carregando");
  // Três pontinhos animados enquanto o Gelinho responde.
  digitando.setAttribute("aria-label", "Gelinho está digitando");
  digitando.innerHTML = '<span class="pontos" aria-hidden="true"><i></i><i></i><i></i></span>';

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ historico }),
    });
    const dados = await resp.json();
    if (!resp.ok) throw new Error(dados.erro || "Erro no servidor");
    digitando.textContent = dados.resposta;
    historico.push({ role: "model", text: dados.resposta });
  } catch (erro) {
    const desligado = String(erro.message).includes("desligado");
    digitando.textContent = desligado ? erro.message : "Ops, deu ruim aqui. Tenta de novo em instantes. 🧊";
    historico.pop();
  } finally {
    digitando.classList.remove("msg--carregando");
    btnEnviar.disabled = false;
    campo.focus();
  }
}

botao.addEventListener("click", () => {
  painel.hidden = !painel.hidden;
  if (!painel.hidden) {
    if (mensagens.children.length === 0) {
      adicionar("E aí! Sou o Gelinho, da ICE BLLUH 🧊 Faça seu atendimento por aqui: posso te falar de serviços, preços e horários, ou já agendar teu horário com o Ice ou o Alisson. Bora?", "bot");
    }
    campo.focus();
  }
});

fechar.addEventListener("click", () => {
  painel.hidden = true;
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  enviar();
});
