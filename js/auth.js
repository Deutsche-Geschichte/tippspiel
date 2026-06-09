import { auth, db } from "./firebase.js";
import { state } from "./state.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const authContainer = document.getElementById("authContainer");
const appContainer = document.getElementById("appContainer");
const adminTabBtn = document.getElementById("adminTabBtn");
const welcomeText = document.getElementById("welcomeText");

export async function registerUser(){
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  if (!username || !email || !password) {
    alert("Bitte alle Felder ausfüllen.");
    return;
  }

  if (password.length < 6) {
    alert("Passwort muss mindestens 6 Zeichen lang sein.");
    return;
  }

  const usernameCheck = await getDocs(query(collection(db, "users"), where("username", "==", username)));
  if (!usernameCheck.empty) {
    alert("Benutzername bereits vergeben.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      username,
      email,
      role: "user",
      points: 0,
      createdAt: serverTimestamp()
    });
    alert("Registrierung erfolgreich.");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

export async function loginUser(){
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Bitte E-Mail und Passwort eingeben.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

export async function logoutUser(){
  await signOut(auth);
}

export async function saveProfile(){
  if (!auth.currentUser) return;

  const username = document.getElementById("newUsername").value.trim();
  if (!username) {
    alert("Bitte einen Benutzernamen eingeben.");
    return;
  }

  const check = await getDocs(query(collection(db, "users"), where("username", "==", username)));
  const takenByAnotherUser = check.docs.some((d) => d.id !== auth.currentUser.uid);
  if (takenByAnotherUser) {
    alert("Benutzername bereits vergeben.");
    return;
  }

  await updateDoc(doc(db, "users", auth.currentUser.uid), { username });
  state.currentProfile.username = username;
  if (welcomeText) welcomeText.textContent = `Angemeldet als ${username}`;
  alert("Profil gespeichert.");
}

export async function deleteAccount(){
  if (!auth.currentUser) return;

  const ok = confirm("Account wirklich löschen?");
  if (!ok) return;

  const uid = auth.currentUser.uid;

  try {
    await deleteUser(auth.currentUser);
    await deleteDocIfExists(uid);
    alert("Account gelöscht.");
  } catch (error) {
    console.error(error);
    alert("Account konnte nicht gelöscht werden. Bitte erneut anmelden und nochmal versuchen.");
  }
}

async function deleteDocIfExists(uid){
  const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  await deleteDoc(doc(db, "users", uid));
}

async function ensureUserDocument(user){
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      username: user.email?.split("@")[0] || "User",
      email: user.email || "",
      role: "user",
      points: 0,
      createdAt: serverTimestamp()
    });
    return (await getDoc(ref)).data();
  }
  return snap.data();
}

export function initAuth(){
  document.getElementById("registerBtn").addEventListener("click", registerUser);
  document.getElementById("loginBtn").addEventListener("click", loginUser);
  document.getElementById("logoutBtn").addEventListener("click", logoutUser);
  document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
  document.getElementById("deleteAccountBtn").addEventListener("click", deleteAccount);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.currentUser = null;
      state.currentProfile = null;
      state.isAdmin = false;
      authContainer.classList.remove("hidden");
      appContainer.classList.add("hidden");
      if (adminTabBtn) adminTabBtn.classList.add("hidden");
      return;
    }

    const profile = await ensureUserDocument(user);

    state.currentUser = user;
    state.currentProfile = profile;
    state.isAdmin = profile.role === "admin";

    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");

    if (welcomeText) welcomeText.textContent = `Angemeldet als ${profile.username}`;
    document.getElementById("newUsername").value = profile.username || "";

    if (adminTabBtn) {
      adminTabBtn.classList.toggle("hidden", !state.isAdmin);
    }

    document.dispatchEvent(new CustomEvent("auth-changed", {
      detail: { user, profile }
    }));
  });
}
