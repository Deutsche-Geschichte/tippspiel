import { auth, db } from "./firebase.js";
import { isMatchLocked } from "./points.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let unsubMatches = null;
let unsubUserTips = null;
let unsubMyTips = null;
let matchesCache = [];
let userTipsMap = new Map();

export function initMatchViews(){
  window.saveTip = saveTip;
}

async function fetchUserTipsMap(){
  userTipsMap = new Map();
  const user = auth.currentUser;
  if (!user) return;

  const tipSnap = await getDocs(query(collection(db, "tips"), where("userId", "==", user.uid)));
  tipSnap.forEach((d) => {
    const tip = d.data();
    userTipsMap.set(tip.matchId, { id: d.id, ...tip });
  });
}

export async function loadMatches(){
  const container = document.getElementById("matchesContainer");
  if (!container) return;

  if (unsubMatches) unsubMatches();
  if (unsubUserTips) unsubUserTips();

  await fetchUserTipsMap();

  unsubMatches = onSnapshot(query(collection(db, "matches")), async (snapshot) => {
    matchesCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => {
        const ad = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const bd = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return ad - bd;
      });

    await fetchUserTipsMap();
    renderMatches(container);
  });

  if (auth.currentUser) {
    const tipsQuery = query(collection(db, "tips"), where("userId", "==", auth.currentUser.uid));
    unsubUserTips = onSnapshot(tipsQuery, async () => {
      await fetchUserTipsMap();
      renderMatches(container);
    });
  } else {
    renderMatches(container);
  }
}

function renderMatches(container){
  if (!container) return;

  if (!auth.currentUser) {
    container.innerHTML = `<div class="panel"><p>Bitte zuerst anmelden.</p></div>`;
    return;
  }

  if (!matchesCache.length) {
    container.innerHTML = `<div class="panel"><p>Noch keine Spiele angelegt.</p></div>`;
    return;
  }

  container.innerHTML = matchesCache.map((match) => {
    const matchDate = match.date?.toDate ? match.date.toDate() : new Date(match.date);
    const locked = isMatchLocked(match);
    const tip = userTipsMap.get(match.id);
    const tipHome = tip?.homeTip ?? "";
    const tipAway = tip?.awayTip ?? "";
    const resultText = match.finished ? `${match.homeGoals} : ${match.awayGoals}` : "Noch kein Ergebnis";
    return `
      <article class="match-card">
        <div class="match-head">
          <div>
            <div class="match-title">${escapeHtml(match.homeTeam)} – ${escapeHtml(match.awayTeam)}</div>
            <div class="match-meta">${formatDate(matchDate)}</div>
          </div>
          <div class="badge-row">
            ${locked ? `<span class="badge red">Gesperrt</span>` : `<span class="badge green">Offen</span>`}
            <span class="badge gray">Ergebnis: ${resultText}</span>
          </div>
        </div>

        <div class="tip-row">
          <input class="score-input" type="number" min="0" inputmode="numeric" id="homeTip-${match.id}" value="${tipHome}" ${locked ? "disabled" : ""} placeholder="0" />
          <span class="tip-sep">:</span>
          <input class="score-input" type="number" min="0" inputmode="numeric" id="awayTip-${match.id}" value="${tipAway}" ${locked ? "disabled" : ""} placeholder="0" />
          <button class="primary save-btn" onclick="saveTip('${match.id}')" ${locked ? "disabled" : ""}>Tipp speichern</button>
        </div>

        ${locked && !match.finished ? `<div class="locked-note">Tipps sind seit Anpfiff gesperrt.</div>` : ""}
        ${match.finished ? `<div class="finished-note">Spiel beendet. Tipp ist fix und nicht mehr änderbar.</div>` : ""}
      </article>
    `;
  }).join("");
}

export async function saveTip(matchId){
  const user = auth.currentUser;
  if (!user) return;

  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists()) {
    alert("Spiel nicht gefunden.");
    return;
  }

  const match = matchSnap.data();
  if (isMatchLocked(match)) {
    alert("Tipps können für dieses Spiel nicht mehr geändert werden.");
    return;
  }

  const homeTip = Number(document.getElementById(`homeTip-${matchId}`).value);
  const awayTip = Number(document.getElementById(`awayTip-${matchId}`).value);

  if (Number.isNaN(homeTip) || Number.isNaN(awayTip) || homeTip < 0 || awayTip < 0) {
    alert("Bitte gültige Tipp-Ergebnisse eingeben.");
    return;
  }

  const existing = await getDocs(query(collection(db, "tips"), where("userId", "==", user.uid), where("matchId", "==", matchId)));
  const payload = {
    userId: user.uid,
    matchId,
    homeTip,
    awayTip,
    points: 0
  };

  try {
    if (existing.empty) {
      await addDoc(collection(db, "tips"), payload);
    } else {
      const tipId = existing.docs[0].id;
      await updateDoc(doc(db, "tips", tipId), {
        homeTip: payload.homeTip,
        awayTip: payload.awayTip
      });
    }
    await fetchUserTipsMap();
    renderMatches(document.getElementById("matchesContainer"));
    alert("Tipp gespeichert.");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

export async function loadMyTips(){
  const container = document.getElementById("myTipsContainer");
  if (!container) return;

  if (unsubMyTips) unsubMyTips();

  if (!auth.currentUser) {
    container.innerHTML = `<div class="panel"><p>Bitte zuerst anmelden.</p></div>`;
    return;
  }

  const tipsQuery = query(collection(db, "tips"), where("userId", "==", auth.currentUser.uid));
  unsubMyTips = onSnapshot(tipsQuery, async (snapshot) => {
    const tips = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (!tips.length) {
      container.innerHTML = `<div class="panel"><p>Noch keine Tipps abgegeben.</p></div>`;
      return;
    }

    const html = [];
    for (const tip of tips) {
      const matchSnap = await getDoc(doc(db, "matches", tip.matchId));
      if (!matchSnap.exists()) continue;

      const match = matchSnap.data();
      const locked = isMatchLocked(match);
      const matchDate = match.date?.toDate ? match.date.toDate() : new Date(match.date);

      html.push(`
        <article class="match-card">
          <div class="match-head">
            <div>
              <div class="match-title">${escapeHtml(match.homeTeam)} – ${escapeHtml(match.awayTeam)}</div>
              <div class="match-meta">${formatDate(matchDate)}</div>
            </div>
            <div class="badge-row">
              <span class="badge gray">Mein Tipp: ${tip.homeTip} : ${tip.awayTip}</span>
              ${match.finished ? `<span class="badge green">Punkte: ${Number(tip.points || 0)}</span>` : locked ? `<span class="badge red">Gesperrt</span>` : `<span class="badge green">Offen</span>`}
            </div>
          </div>

          ${match.finished ? `
            <div class="badge-row">
              <span class="badge gold">Ergebnis: ${match.homeGoals} : ${match.awayGoals}</span>
            </div>
          ` : locked ? `<div class="locked-note">Spiel ist gestartet. Tipp ist nicht mehr änderbar.</div>` : ""}
        </article>
      `);
    }

    container.innerHTML = html.join("") || `<div class="panel"><p>Noch keine Tipps abgegeben.</p></div>`;
  });
}

function formatDate(date){
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
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

window.saveTip = saveTip;
