import { db } from "./firebase.js";
import { collection, doc, getDoc, getDocs, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function isMatchLocked(match){
  if(!match) return true;
  const now = new Date();
  const matchDate = match.date?.toDate ? match.date.toDate() : new Date(match.date);
  return Boolean(match.finished) || now >= matchDate;
}

export function calculatePoints(realHome, realAway, tipHome, tipAway){
  if (realHome === tipHome && realAway === tipAway) return 3;

  const realDiff = realHome - realAway;
  const tipDiff = tipHome - tipAway;

  if (realDiff === tipDiff) return 1;

  const realOutcome = realDiff > 0 ? "H" : realDiff < 0 ? "A" : "D";
  const tipOutcome = tipDiff > 0 ? "H" : tipDiff < 0 ? "A" : "D";

  if (realOutcome === tipOutcome) return 2;

  return 0;
}

async function recalcUserPoints(userId){
  const userTipsSnap = await getDocs(query(collection(db, "tips"), where("userId", "==", userId)));
  let total = 0;
  userTipsSnap.forEach((d) => {
    total += Number(d.data().points || 0);
  });
  await updateDoc(doc(db, "users", userId), { points: total });
  return total;
}

export async function recalcMatchPoints(matchId){
  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (!matchSnap.exists()) return;
  const match = matchSnap.data();
  if (!match.finished) return;

  const tipsSnap = await getDocs(query(collection(db, "tips"), where("matchId", "==", matchId)));
  const changedUsers = new Set();

  for (const tipDoc of tipsSnap.docs) {
    const tip = tipDoc.data();
    const points = calculatePoints(match.homeGoals, match.awayGoals, tip.homeTip, tip.awayTip);
    await updateDoc(doc(db, "tips", tipDoc.id), { points });
    changedUsers.add(tip.userId);
  }

  for (const userId of changedUsers) {
    await recalcUserPoints(userId);
  }
}
