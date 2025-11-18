import { getLessonWordsForGame, gotoLessons } from '../app.js';

let words = [];
let idx = 0;
let errors = 0;
let attempts = 2;
let wordHadError = false;
let pendingStart = false;

function gotoScreen() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('screen-game'), false);
  show($('screen-falling'), false);
  show($('screen-unscr'), true);
  show($('btn-menu'), true);
}

export function startGame(list) {
  words = list.map(p => ({ en: p[0], ru: p[1] }));
  idx = 0;
  errors = 0;
  $('un-errors').textContent = errors;
  $('un-round').textContent = `0/${words.length}`;
  gotoScreen();
  nextWord();
}

function nextWord() {
  if (idx >= words.length) {
    alert(`Готово!\nОшибок: ${errors}`);
    show($('screen-unscr'), false);
    show($('screen-menu'), true);
    return;
  }

  const w = words[idx];
  attempts = 2;
  wordHadError = false;

  $('un-round').textContent = `${idx+1}/${words.length}`;

  const scrambled = scramble(w.en);
  $('un-word').textContent = scrambled;
  $('un-input').value = '';
  $('un-input').focus();
}

function scramble(s) {
  return s.split('').sort(() => Math.random() - 0.5).join('');
}

// проверка ввода
$('un-submit')?.addEventListener('click', () => {
  const input = $('un-input').value.trim().toLowerCase();
  const target = words[idx].en.toLowerCase();

  if (input === target) {
    idx++;
    nextWord();
    return;
  }

  // ошибка
  attempts--;
  if (!wordHadError) {
    errors++;
    wordHadError = true;
    $('un-errors').textContent = errors;
  }

  // shake эффект
  const el = $('screen-unscr');
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 350);

  if (attempts <= 0) {
    // пропуск
    idx++;
    nextWord();
  }
});

// выход
$('un-exit')?.addEventListener('click', () => {
  pendingStart = false;
  show($('screen-unscr'), false);
  show($('screen-menu'), true);
});

// запуск через выбор игры
$('game-select')?.addEventListener('change', async (e) => {
  if (e.target.value !== 'unscr') return;

  const w = getLessonWordsForGame();
  if (!w?.length) {
    pendingStart = true;
    gotoLessons();
    e.target.selectedIndex = 0;
    return;
  }
  startGame(w);
  e.target.selectedIndex = 0;
});

// автостарт после выбора урока
document.addEventListener('lesson-selected', () => {
  if (!pendingStart) return;
  const w = getLessonWordsForGame();
  if (w?.length) {
    pendingStart = false;
    startGame(w);
  }
});
