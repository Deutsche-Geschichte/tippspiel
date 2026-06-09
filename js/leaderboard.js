import { db } from "./firebase.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let unsubscribeLeaderboard = null;

export function loadLeaderboard(){
  const body = document.getElementById("leaderboardBody");
  if (!body) return;

  if (unsubscribeLeaderboard) unsubscribeLeaderboard();

  const q = query(collection(db, "users"), orderBy("points", "desc"));
  unsubscribeLeaderboard = onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (Number(b.points || 0) - Number(a.points || 0)) || String(a.username || "").localeCompare(String(b.username || ""), "de"));

    body.innerHTML = rows.map((user, index) => {
      const rank = index + 1;
      const cls = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "";
      return `
        <tr class="${cls}">
          <td data-label="Platz">${rank}</td>
          <td data-label="Spieler">${escapeHtml(user.username || "Unbekannt")}</td>
          <td data-label="Punkte">${Number(user.points || 0)}</td>
        </tr>
      `;
    }).join("");
  });
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[m]);
}
