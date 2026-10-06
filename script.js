import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ======================================================
   CONFIGURAÇÃO DO CONVITE
   Edite os valores abaixo com os dados reais do evento.
   ====================================================== */
const CONFIG = {
  babyName: "João Miguel",
  eventTitle: "Chá de Bebê",
  dateISO: "2026-10-31T19:30:00", // usado para o contador de dias
  displayDay: "31",
  displayMonth: "Outubro",
  displayDate: "Sábado, 31 de Outubro de 2026",
  displayTime: "19:30",
  addressLine1: "Rua 23, nº 22",
  addressLine2: "Bairro Dona Fiica",
  addressLine3: "entre a 46 e a 48",
  giftSuggestion: "Fralda M, G, GG e Mimo",
  // Número de WhatsApp que vai RECEBER as confirmações.
  // Formato: código do país + DDD + número, só dígitos. Brasil = 55.
  whatsappNumber: "556285403135",
};

/* ---------- Firebase ---------- */
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

/* ---------- Preenche os textos a partir da configuração ---------- */
function applyConfig() {
  document.title = `${CONFIG.eventTitle} do ${CONFIG.babyName}`;

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("babyName", `do ${CONFIG.babyName}`);
  set("cardDay", CONFIG.displayDay);
  set("cardMonth", CONFIG.displayMonth);
  set("cardTime", CONFIG.displayTime);
  set("addressLine1", CONFIG.addressLine1);
  set("addressLine2", CONFIG.addressLine2);
  set("addressLine3", CONFIG.addressLine3);
  set("giftSuggestion", CONFIG.giftSuggestion);
  set("detailDate", CONFIG.displayDate);
  set("detailTime", `Às ${CONFIG.displayTime}`);
  set("detailAddress", `${CONFIG.addressLine1} — ${CONFIG.addressLine2}, ${CONFIG.addressLine3}`);
  set("detailGift", CONFIG.giftSuggestion);
  set("footerNames", CONFIG.babyName);
}

/* ---------- Ajusta a altura do envelope ao conteúdo real do cartão ---------- */
function sizeEnvelopeToCard() {
  const envelope = document.getElementById("envelope");
  const card = document.getElementById("card");
  if (!envelope || !card) return;
  const topOffset = 16;
  const bottomMargin = 16;
  envelope.style.height = `${topOffset + card.offsetHeight + bottomMargin}px`;
}

/* ---------- Contador de dias até o evento ---------- */
function updateCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const target = new Date(CONFIG.dateISO).getTime();
  if (isNaN(target)) { el.textContent = ""; return; }
  const diffDays = Math.ceil((target - Date.now()) / 86400000);
  if (diffDays > 1) el.textContent = `Faltam ${diffDays} dias`;
  else if (diffDays === 1) el.textContent = "É amanhã!";
  else if (diffDays === 0) el.textContent = "É hoje!";
  else el.textContent = "";
}

/* ---------- Abertura do envelope ---------- */
function initEnvelope() {
  const envelope = document.getElementById("envelope");
  const sealButton = document.getElementById("sealButton");
  const content = document.getElementById("content");

  function openEnvelope() {
    if (envelope.classList.contains("is-open")) return;
    envelope.classList.add("is-open");
    content.hidden = false;
    sealButton.setAttribute("aria-hidden", "true");
    sealButton.disabled = true;
  }

  sealButton.addEventListener("click", openEnvelope);

  document.getElementById("scrollToRsvp").addEventListener("click", () => {
    openEnvelope();
    setTimeout(() => {
      document.getElementById("rsvp").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 950);
  });
}

/* ---------- Lista dinâmica de acompanhantes ---------- */
function initCompanions() {
  const list = document.getElementById("companionsList");
  const addBtn = document.getElementById("addCompanion");

  function addRow(value = "") {
    const row = document.createElement("div");
    row.className = "companion-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nome do acompanhante";
    input.value = value;
    input.className = "companion-input";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-companion";
    removeBtn.setAttribute("aria-label", "Remover acompanhante");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => row.remove());

    row.appendChild(input);
    row.appendChild(removeBtn);
    list.appendChild(row);
    input.focus();
  }

  addBtn.addEventListener("click", () => addRow());
}

/* ---------- Envio da confirmação: salva no Firestore + abre WhatsApp ---------- */
function initRsvpForm() {
  const form = document.getElementById("rsvpForm");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const guestName = document.getElementById("guestName").value.trim();
    const attendance = form.querySelector('input[name="attendance"]:checked').value;
    const guestMessage = document.getElementById("guestMessage").value.trim();
    let companionInputs = Array.from(document.querySelectorAll(".companion-input"))
      .map((input) => input.value.trim())
      .filter((name) => name.length > 0);

    if (!guestName) {
      document.getElementById("guestName").focus();
      return;
    }

    if (attendance === "nao") companionInputs = [];

    const totalPeople = attendance === "sim" ? 1 + companionInputs.length : 0;

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";

    let savedToDatabase = false;
    try {
      await addDoc(collection(db, "rsvps"), {
        guestName,
        attendance,
        companions: companionInputs,
        totalPeople,
        message: guestMessage,
        createdAt: serverTimestamp(),
      });
      savedToDatabase = true;
    } catch (err) {
      console.error("Erro ao salvar confirmação no banco:", err);
      // Mesmo se falhar ao salvar, seguimos para o WhatsApp para não perder a confirmação.
    }

    let message = `Olá! É a confirmação de presença para o ${CONFIG.eventTitle} do ${CONFIG.babyName}. 👶\n\n`;
    message += `Nome: ${guestName}\n`;

    if (attendance === "sim") {
      message += `Presença: Sim, estarei lá!\n`;
      message += `Total de pessoas: ${totalPeople}\n`;
      if (companionInputs.length > 0) {
        message += `Acompanhantes:\n`;
        companionInputs.forEach((name, i) => { message += `  ${i + 1}. ${name}\n`; });
      }
    } else {
      message += `Presença: Infelizmente não poderei ir.\n`;
    }

    if (guestMessage) message += `\nMensagem: ${guestMessage}\n`;

    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener");

    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar confirmação pelo WhatsApp";

    form.reset();
    document.getElementById("companionsList").innerHTML = "";

    showSuccess({
      guestName,
      attendance,
      totalPeople,
      companions: companionInputs,
      whatsappUrl: url,
      savedToDatabase,
    });
  });

  document.getElementById("newRsvpBtn").addEventListener("click", () => {
    document.getElementById("rsvpSuccess").hidden = true;
    document.getElementById("rsvpIntro").hidden = false;
    form.hidden = false;
    document.getElementById("guestName").focus();
  });
}

/* ---------- Tela de confirmação ---------- */
function showSuccess({ guestName, attendance, totalPeople, companions, whatsappUrl, savedToDatabase }) {
  const form = document.getElementById("rsvpForm");
  const intro = document.getElementById("rsvpIntro");
  const success = document.getElementById("rsvpSuccess");
  const firstName = guestName.split(" ")[0];

  document.getElementById("successTitle").textContent =
    attendance === "sim" ? "Presença confirmada!" : "Recebemos sua resposta";

  document.getElementById("successText").textContent =
    attendance === "sim"
      ? `Obrigado, ${firstName}! Ficamos muito felizes em saber que você vai celebrar o ${CONFIG.eventTitle} do ${CONFIG.babyName} com a gente.`
      : `Obrigado por avisar, ${firstName}. Vamos sentir sua falta, mas agradecemos todo o carinho!`;

  const summary = document.getElementById("successSummary");
  summary.innerHTML = "";
  const addItem = (label, value) => {
    const li = document.createElement("li");
    const l = document.createElement("span");
    l.className = "sum-label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "sum-value";
    v.textContent = value;
    li.append(l, v);
    summary.appendChild(li);
  };

  addItem("Nome", guestName);
  if (attendance === "sim") {
    addItem("Pessoas confirmadas", String(totalPeople));
    if (companions.length > 0) addItem("Acompanhantes", companions.join(", "));
    addItem("Data e horário", `${CONFIG.displayDate}, às ${CONFIG.displayTime}`);
    addItem("Local", `${CONFIG.addressLine1} — ${CONFIG.addressLine2}, ${CONFIG.addressLine3}`);
  }

  document.getElementById("successWarning").hidden = savedToDatabase;
  document.getElementById("successWhatsapp").href = whatsappUrl;

  intro.hidden = true;
  form.hidden = true;
  success.hidden = false;
  success.scrollIntoView({ behavior: "smooth", block: "center" });
  success.focus({ preventScroll: true });
}

document.addEventListener("DOMContentLoaded", () => {
  applyConfig();
  updateCountdown();
  initEnvelope();
  initCompanions();
  initRsvpForm();

  sizeEnvelopeToCard();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(sizeEnvelopeToCard);
  }
  window.addEventListener("resize", sizeEnvelopeToCard);
});
