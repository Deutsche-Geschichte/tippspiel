import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_rL80NL8dAgo07qC_IU11XL3XL8XaLe0",
  authDomain: "chat-app-db69d.firebaseapp.com",
  projectId: "chat-app-db69d",
  storageBucket: "chat-app-db69d.firebasestorage.app",
  messagingSenderId: "633617598241",
  appId: "1:633617598241:web:d2cc4fe11a2001e84c6060"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
