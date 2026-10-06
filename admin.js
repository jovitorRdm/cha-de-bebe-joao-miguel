import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/* ---------- Elementos ---------- */
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logoutBtn");

const tableBody = document.getElementById("rsvpTableBody");
const emptyRow = document.getElementById("emptyRow");
const searchInput = document.getElementById("searchInput");

const sumConfirmedPeople = document.getElementById("sumConfirmedPeople");
const sumConfirmedGuests = document.getElementById("sumConfirmedGuests");
const sumDeclined = document.getElementById("sumDeclined");
const sumTotal = document.getElementById("sumTotal");

const editOverlay = document.getElementById("editOverlay");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editCompanions = document.getElementById("editCompanions");
const editMessage = document.getElementById("editMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let allRsvps = [];
let unsubscribeSnapshot = null;
let editingId = null;

/* ---------- Autenticação ---------- */
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "E-mail ou senha incorretos.";
    loginError.hidden = false;
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Entrar";
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    subscribeToRsvps();
  } else {
    dashboard.hidden = true;
    loginScreen.hidden = false;
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
  }
});

/* ---------- Escuta em tempo real dos RSVPs ---------- */
function subscribeToRsvps() {
  const q = query(collection(db, "rsvps"), orderBy("createdAt", "desc"));
  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    allRsvps = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSummary(allRsvps);
    renderTable(allRsvps);
  }, (err) => {
    console.error("Erro ao carregar confirmações:", err);
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="7">Erro ao carregar os dados. Verifique as regras do Firestore.</td></tr>`;
  });
}

/* ---------- Resumo ---------- */
function renderSummary(rsvps) {
  const confirmed = rsvps.filter((r) => r.attendance === "sim");
  const declined = rsvps.filter((r) => r.attendance === "nao");
  const totalPeople = confirmed.reduce((sum, r) => sum + (Number(r.totalPeople) || 0), 0);

  sumConfirmedPeople.textContent = totalPeople;
  sumConfirmedGuests.textContent = confirmed.length;
  sumDeclined.textContent = declined.length;
  sumTotal.textContent = rsvps.length;
}

/* ---------- Tabela ---------- */
function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  const d = timestamp.toDate();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function renderTable(rsvps) {
  const filterText = searchInput.value.trim().toLowerCase();
  const filtered = filterText
    ? rsvps.filter((r) => (r.guestName || "").toLowerCase().includes(filterText))
    : rsvps;

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="7">${
      rsvps.length === 0 ? "Nenhuma confirmação ainda." : "Nenhum resultado para essa busca."
    }</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map((r) => {
    const statusClass = r.attendance === "sim" ? "sim" : "nao";
    const statusLabel = r.attendance === "sim" ? "Vai" : "Não vai";
    const companions = Array.isArray(r.companions) && r.companions.length
      ? r.companions.map((c) => `<span>${escapeHtml(c)}</span>`).join("")
      : "<span>—</span>";

    return `
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.guestName || "—")}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td><div class="companions-cell">${companions}</div></td>
        <td>${r.attendance === "sim" ? (r.totalPeople ?? 1) : 0}</td>
        <td><div class="message-cell">${escapeHtml(r.message || "—")}</div></td>
        <td><div class="date-cell">${formatDate(r.createdAt)}</div></td>
        <td>
          <div class="row-actions">
            <button type="button" class="edit-btn" data-action="edit" data-id="${r.id}">Editar</button>
            <button type="button" class="delete-btn" data-action="delete" data-id="${r.id}">Excluir</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", () => renderTable(allRsvps));

/* ---------- Ações da tabela (editar / excluir) ---------- */
tableBody.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const record = allRsvps.find((r) => r.id === id);
  if (!record) return;

  if (btn.dataset.action === "edit") {
    openEditModal(record);
  } else if (btn.dataset.action === "delete") {
    const ok = confirm(`Excluir a confirmação de "${record.guestName}"? Essa ação não pode ser desfeita.`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "rsvps", id));
    } catch (err) {
      console.error("Erro ao excluir:", err);
      alert("Não foi possível excluir. Tente novamente.");
    }
  }
});

/* ---------- Modal de edição ---------- */
function openEditModal(record) {
  editingId = record.id;
  editName.value = record.guestName || "";
  editForm.querySelector(`input[name="editAttendance"][value="${record.attendance === "nao" ? "nao" : "sim"}"]`).checked = true;
  editCompanions.value = Array.isArray(record.companions) ? record.companions.join("\n") : "";
  editMessage.value = record.message || "";
  editOverlay.hidden = false;
}

function closeEditModal() {
  editOverlay.hidden = true;
  editingId = null;
  editForm.reset();
}

cancelEditBtn.addEventListener("click", closeEditModal);
editOverlay.addEventListener("click", (event) => {
  if (event.target === editOverlay) closeEditModal();
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingId) return;

  const saveBtn = document.getElementById("saveEditBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";

  const attendance = editForm.querySelector('input[name="editAttendance"]:checked').value;
  const companions = editCompanions.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const totalPeople = attendance === "sim" ? 1 + companions.length : 0;

  try {
    await updateDoc(doc(db, "rsvps", editingId), {
      guestName: editName.value.trim(),
      attendance,
      companions,
      totalPeople,
      message: editMessage.value.trim(),
    });
    closeEditModal();
  } catch (err) {
    console.error("Erro ao salvar edição:", err);
    alert("Não foi possível salvar as alterações. Tente novamente.");
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "Salvar alterações";
});
