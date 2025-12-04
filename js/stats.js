// js/stats.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// 2) ТВОЙ КОНФИГ (скопируй из Firebase → Project settings → Web app)
const firebaseConfig = {
  apiKey: "AIzaSyD1Eima8xlw6LuS_zNNrA8ND6hzTKULCZA",
  authDomain: "vocab-trainer-eng.firebaseapp.com",
  projectId: "vocab-trainer-eng",
  storageBucket:  "vocab-trainer-eng.firebasestorage.app",
  messagingSenderId: "718146572376",
  appId: "1:718146572376:web:c38e437cd22f40eaf37a2d",
  measurementId:  "G-L43ZTX8M86"
};

// 3) ИНИЦИАЛИЗАЦИЯ
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUserId = null;
let currentSession = null; // { id, startedAt }
let currentGame = null;    // { gameName, lessonId, startedAt, errors }

// ---- АВТОРИЗАЦИЯ  ----
export function setCurrentUserId(uid) {
  currentUserId = uid;
}

// ---- АВТОРИЗАЦИЯ (анонимная) ----
signInAnonymously(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  currentUserId = user.uid;
  console.log('Firebase user:', currentUserId);
});

// ---- СЕССИИ ПРИЛОЖЕНИЯ ----
export async function startSession() {
  if (!currentUserId) return; // пользователь ещё не готов

  try {
    const docRef = await addDoc(collection(db, "sessions"), {
      userId: currentUserId,
      startedAt: serverTimestamp(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    });
    currentSession = { id: docRef.id, startedAt: Date.now() };
  } catch (e) {
    console.warn('startSession error:', e);
  }
}

export async function endSession() {
  if (!currentSession || !currentUserId) return;
  const durSec = Math.round((Date.now() - currentSession.startedAt) / 1000);

  try {
    await addDoc(collection(db, "sessionEnds"), {
      sessionId: currentSession.id,
      userId: currentUserId,
      endedAt: serverTimestamp(),
      durationSec: durSec,
    });
  } catch (e) {
    console.warn('endSession error:', e);
  }
}

// ---- УРОКИ ----
export async function onLessonStart(lessonId) {
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "lessonViews"), {
      userId: currentUserId,
      sessionId: currentSession?.id || null,
      lessonId,
      openedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('onLessonStart error:', e);
  }
}

// ---- ПРОСМОТР СПИСКА СЛОВ ----
export async function onListViewStart(lessonId) {
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "listViewStarts"), {
      userId: currentUserId,
      sessionId: currentSession?.id || null,
      lessonId: lessonId ?? null,
      startedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('onListViewStart error:', e);
  }
}

// ---- СТАРТ ПРОВЕРКИ СЛОВ (КАРТОЧКИ) ----
// mode: 'lesson' | 'all' | 'hard'
export async function onSelfCheckStart({ mode = 'lesson', lessonId = null } = {}) {
  if (!currentUserId) return;
  try {
    await addDoc(collection(db, "selfCheckStarts"), {
      userId: currentUserId,
      sessionId: currentSession?.id || null,
      lessonId,
      mode,
      startedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('onSelfCheckStart error:', e);
  }
}


// ---- ИГРЫ ----
export function onGameStart(gameName, lessonId) {
  currentGame = {
    gameName,
    lessonId,
    startedAt: Date.now(),
    errors: 0,
  };
}

export function onGameError() {
  if (!currentGame) return;
  currentGame.errors++;
}

export async function onGameEnd(extra = {}) {
  if (!currentUserId || !currentGame) return;

  const durSec = Math.round((Date.now() - currentGame.startedAt) / 1000);
  const payload = {
    userId:   currentUserId,
    sessionId: currentSession?.id || null,
    gameName: currentGame.gameName,
    lessonId: currentGame.lessonId || null,
    durationSec: durSec,
    errors:   currentGame.errors,
    finishedAt: serverTimestamp(),
    ...extra
  };

  try {
    await addDoc(collection(db, "gameRuns"), payload);
  } catch (e) {
    console.warn('onGameEnd error:', e);
  } finally {
    currentGame = null;
  }
}
