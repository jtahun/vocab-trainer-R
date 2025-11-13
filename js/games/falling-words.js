import { getLessonWordsForGame, setHome, gotoLessons } from '../app.js';

/** Конфиг игры */
const CFG = {
  roundsMax:  Math.min(20, 999), // или возьмём все слова, если их < 20
  options:    4,                 // 4 варианта
  baseSecs:   4.0,               // базовое время падения (сек)
  minSecs:    1.8,               // минимально возможная длительность
  accelStep:  0.10               // на сколько ускоряемся каждый раунд (в x)
};

let words = [];          // [['heavy','тяжелый'], ...] из текущего урока
let round = 0;
let totalRounds = 0;
let errors = 0;
let t0 = 0;
let timerId = null;
let speedX = 1.0;        // множитель скорости (1.0 → нормально, 1.2 → быстрее)
let pendingStart = false;

function gotoFallingScreen() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('screen-game'), false);
  show($('screen-falling'), true);
  show($('btn-menu'), true);
  setHome('К меню', () => {
    show($('screen-falling'), false);
    show($('screen-menu'), true);
    stopTimer();
  });
  $('fw-errors').textContent = errors;
  $('fw-speed').textContent  = speedX.toFixed(1) + 'x';
}

/** Старт игры извне */
export function startGame(extWords) {
  words = Array.isArray(extWords) ? extWords.filter(p => Array.isArray(p) && p.length >= 2) : [];
  if (!words.length) return;

  // Подготовка
  errors = 0;
  round = 0;
  totalRounds = Math.min(CFG.roundsMax, words.length);
  speedX = 1.0;

  gotoFallingScreen();
  $('fw-round').textContent = `0/${totalRounds}`;
  clearArea();
  startTimer();

  nextRound();
}

/** Внутренний старт (кнопка из меню) */
function requestLessonThenStart() {
  pendingStart = true;
  gotoLessons();
}
document.addEventListener('lesson-selected', () => {
  if (!pendingStart) return;
  const w = getLessonWordsForGame();
  if (w?.length) { pendingStart = false; startGame(w); }
});

/** Кнопки управления */
$('game-falling-start')?.addEventListener('click', () => {
  const w = getLessonWordsForGame();
  if (!w?.length) { requestLessonThenStart(); return; }
  startGame(w);
});

$('fw-exit')?.addEventListener('click', () => {
  pendingStart = false;
  stopTimer();
  show($('screen-falling'), false);
  show($('screen-menu'), true);
});
$('fw-restart')?.addEventListener('click', () => {
  const w = getLessonWordsForGame();
  if (w?.length) startGame(w);
});

/** Таймер времени выполнения */
function startTimer() {
  t0 = performance.now();
  stopTimer();
  timerId = setInterval(() => {
    const dt = (performance.now() - t0) / 1000;
    $('fw-time').textContent = dt.toFixed(1) + 's';
  }, 100);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

/** Раунд */
function nextRound() {
  if (round >= totalRounds) return finish();

  round++;
  $('fw-round').textContent = `${round}/${totalRounds}`;

  // Подготовить цель + отвлекающие
  const { target, options } = pickQuestion(words, CFG.options);

  // UI: варианты
  renderOptions(options, target);

  // UI: падающее слово
  spawnFallingWord(target.en);
}

/** Спавн падающего слова */
function spawnFallingWord(text) {
  const area = $('fw-area');
  clearArea();

  const el = document.createElement('div');
  el.className = 'falling-word';
  el.textContent = text;

  // Длительность падения: быстрее с каждым раундом
  const secs = Math.max(CFG.minSecs, CFG.baseSecs / speedX);
  el.style.animationDuration = `${secs}s`;

  // Если долетело — считаем ошибкой
  const onEnd = () => {
    el.removeEventListener('animationend', onEnd);
    // если слово ещё не обработано кликом:
    if (area.contains(el)) {
      errors++;
      $('fw-errors').textContent = errors;
      // Ускоряемся даже при ошибке (или только при верном? выбери стиль)
      speedX += CFG.accelStep;
      $('fw-speed').textContent = speedX.toFixed(1) + 'x';
      nextRound();
    }
    el.remove();
  };

  el.addEventListener('animationend', onEnd);
  area.appendChild(el);
}

/** Генерация вопроса: правильный перевод + 3 отвлекающих */
function pickQuestion(pairs, nOptions) {
  // Выбрать цель
  const idx = Math.floor(Math.random() * pairs.length);
  const [en, ru] = pairs[idx];

  // Собрать отвлекающие
  const pool = pairs.map(p => p[1]);
  const distractors = [];
  while (distractors.length < nOptions - 1) {
    const alt = pool[Math.floor(Math.random() * pool.length)];
    if (alt !== ru && !distractors.includes(alt)) distractors.push(alt);
  }

  // Перемешать варианты
  const all = [ru, ...distractors].map(text => ({ text, correct: text === ru }));
  window.shuffle?.(all) || all.sort(() => Math.random() - 0.5);

  return { target: { en, ru }, options: all };
}

/** Рендер вариантов и обработка выбора */
function renderOptions(opts, target) {
  const box = $('fw-options');
  box.innerHTML = '';
  opts.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = o.text;
    btn.addEventListener('click', () => {
      // Проверяем, что слово ещё не «упало»
      const area = $('fw-area');
      const falling = area.querySelector('.falling-word');
      if (!falling) return; // уже упало и раунд завершён

      if (o.correct) {
        // верно → удаляем падающее слово, ускоряемся сильнее
        falling.remove();
        speedX += CFG.accelStep;
        $('fw-speed').textContent = speedX.toFixed(1) + 'x';
      } else {
        // ошибка и переходим дальше
        errors++;
        $('fw-errors').textContent = errors;
        // лёгкая «тряска» неверной кнопки
        btn.animate(
          [{ transform:'translateX(0)'},{ transform:'translateX(-4px)'},{ transform:'translateX(4px)'},{ transform:'translateX(0)'}],
          { duration:150, iterations:1 }
        );
        // слово продолжит падать; если хочется — можно сразу завершать раунд:
        // falling.remove();
      }
      // Следующий раунд:
      nextRound();
    });
    box.appendChild(btn);
  });
}

/** Утилиты */
function clearArea() {
  const area = $('fw-area');
  while (area.firstChild) area.removeChild(area.firstChild);
}

function finish() {
  stopTimer();
  // Итоги
  const timeTxt = $('fw-time').textContent;
  const msg = `Готово!\nВремя: ${timeTxt}\nОшибок: ${errors}\nСкорость: ${speedX.toFixed(1)}x`;
  alert(msg);
  // Возврат в меню
  show($('screen-falling'), false);
  show($('screen-menu'), true);
}
