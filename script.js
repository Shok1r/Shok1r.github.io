const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');

const spinBtn = document.getElementById('spinBtn');
const countInput = document.getElementById('countInput');
const genBtn = document.getElementById('genBtn');
const namesInput = document.getElementById('namesInput');
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const listEl = document.getElementById('list');
const countEl = document.getElementById('count');
const resultEl = document.getElementById('result');
const resultText = document.getElementById('resultText');
const removeBtn = document.getElementById('removeBtn');
const keepBtn = document.getElementById('keepBtn');
const titleEl = document.getElementById('title');
const presetDefaultBtn = document.getElementById('presetDefault');
const presetChgkBtn = document.getElementById('presetChgk');

const STORAGE_KEY = 'wheel-of-fortune';
const TWO_PI = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2; // указатель сверху
const DEFAULT_TITLE = 'Колесо фортуны';
const SEO_TITLE = document.title; // заголовок вкладки из index.html
const BLACK_BOX = 'Черный ящик';

// Готовые конфигурации
const PRESETS = {
  default: {
    title: DEFAULT_TITLE,
    sectors: Array.from({ length: 8 }, (_, i) => String(i + 1)),
  },
  chgk: {
    title: 'Что? Где? Когда?',
    sectors: [
      ...Array.from({ length: 11 }, (_, i) => `Вопрос №${i + 1}`),
      BLACK_BOX,
    ],
  },
};

let title = DEFAULT_TITLE;
let original = [];  // полный набор секторов (для «Вернуть удалённые»)
let sectors = [];   // текущие секторы в колесе
let rotation = 0;   // текущий угол поворота колеса
let spinning = false;
let winnerIndex = -1; // индекс выпавшего сектора

// ---------- Утилиты ----------

function sectorColor(i) {
  if (sectors[i] === BLACK_BOX) return '#111';
  return `hsl(${Math.round((i * 360) / sectors.length)}, 70%, 52%)`;
}

function renderTitle() {
  titleEl.textContent = title;
  document.title = title === DEFAULT_TITLE ? SEO_TITLE : `${title} — колесо фортуны онлайн`;
}

function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

function fitText(text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, original, sectors }));
  } catch (e) { /* хранилище недоступно — не критично */ }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.original) && Array.isArray(data.sectors)) {
      original = data.original;
      sectors = data.sectors;
      title = typeof data.title === 'string' ? data.title : DEFAULT_TITLE;
      return true;
    }
  } catch (e) { /* игнорируем */ }
  return false;
}

// ---------- Отрисовка ----------

function resizeCanvas() {
  const size = canvas.clientWidth;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  const size = canvas.clientWidth;
  const c = size / 2;
  const r = c;
  const n = sectors.length;

  ctx.clearRect(0, 0, size, size);

  if (n === 0) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TWO_PI);
    ctx.fillStyle = '#2a2d4d';
    ctx.fill();
    ctx.fillStyle = '#8a8fb3';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Секторов нет', c, c - 70);
    return;
  }

  const arc = TWO_PI / n;
  const fontSize = Math.max(10, Math.min(26, arc * r * 0.4));

  for (let i = 0; i < n; i++) {
    const start = rotation + i * arc;
    const isWinner = !spinning && i === winnerIndex;

    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = sectorColor(i);
    ctx.fill();
    if (isWinner) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Подпись сектора
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + arc / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 3;
    ctx.fillText(fitText(sectors[i], r * 0.6), r - 16, 0);
    ctx.restore();
  }
}

function renderList() {
  listEl.innerHTML = '';
  countEl.textContent = sectors.length;

  if (sectors.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Колесо пустое';
    listEl.appendChild(li);
  }

  sectors.forEach((name, i) => {
    const li = document.createElement('li');

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = sectorColor(i);

    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = name;
    label.title = name;

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Удалить сектор';
    del.disabled = spinning;
    del.addEventListener('click', () => removeSector(i));

    li.append(swatch, label, del);
    listEl.appendChild(li);
  });

  resetBtn.disabled = spinning || sectors.length === original.length;
  spinBtn.disabled = spinning || sectors.length === 0;
}

function update() {
  renderList();
  draw();
  save();
}

// ---------- Управление секторами ----------

function setSectors(names, newTitle = DEFAULT_TITLE) {
  original = names.slice();
  sectors = names.slice();
  title = newTitle;
  renderTitle();
  hideResult();
  update();
}

function applyPreset(preset) {
  namesInput.value = preset.sectors.join('\n');
  countInput.value = preset.sectors.length;
  setSectors(preset.sectors, preset.title);
}

function removeSector(index) {
  if (spinning) return;
  sectors.splice(index, 1);
  hideResult();
  update();
}

function hideResult() {
  winnerIndex = -1;
  resultEl.classList.add('hidden');
}

function showResult(index) {
  winnerIndex = index;
  resultText.textContent = sectors[index];
  resultEl.classList.remove('hidden');
  // Перезапуск анимации появления
  resultEl.style.animation = 'none';
  void resultEl.offsetWidth;
  resultEl.style.animation = '';
}

// ---------- Вращение ----------

function getWinnerIndex() {
  const n = sectors.length;
  const arc = TWO_PI / n;
  // Угол указателя относительно начала первого сектора
  const a = (((POINTER_ANGLE - rotation) % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.floor(a / arc) % n;
}

function setControlsDisabled(disabled) {
  [genBtn, applyBtn, countInput, namesInput, presetDefaultBtn, presetChgkBtn].forEach(el => (el.disabled = disabled));
}

function spin() {
  if (spinning || sectors.length === 0) return;

  hideResult();
  spinning = true;
  setControlsDisabled(true);
  renderList();

  const startRotation = rotation;
  const fullTurns = 5 + Math.floor(Math.random() * 4);
  const delta = fullTurns * TWO_PI + Math.random() * TWO_PI;
  const duration = 4500 + Math.random() * 1500;
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    rotation = startRotation + delta * easeOutQuart(t);
    draw();

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      rotation %= TWO_PI;
      spinning = false;
      setControlsDisabled(false);
      showResult(getWinnerIndex());
      renderList();
      draw();
    }
  }

  requestAnimationFrame(frame);
}

// ---------- События ----------

spinBtn.addEventListener('click', spin);

presetDefaultBtn.addEventListener('click', () => applyPreset(PRESETS.default));
presetChgkBtn.addEventListener('click', () => applyPreset(PRESETS.chgk));

genBtn.addEventListener('click', () => {
  const n = Math.max(1, Math.min(100, parseInt(countInput.value, 10) || 0));
  countInput.value = n;
  const names = Array.from({ length: n }, (_, i) => String(i + 1));
  namesInput.value = names.join('\n');
  setSectors(names);
});

applyBtn.addEventListener('click', () => {
  const names = namesInput.value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
  if (names.length === 0) {
    namesInput.focus();
    return;
  }
  countInput.value = names.length;
  setSectors(names);
});

resetBtn.addEventListener('click', () => {
  if (spinning) return;
  sectors = original.slice();
  hideResult();
  update();
});

removeBtn.addEventListener('click', () => {
  if (winnerIndex !== -1) removeSector(winnerIndex);
});

keepBtn.addEventListener('click', () => {
  hideResult();
  draw();
});

// Пробел — крутить (если фокус не в поле ввода)
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') {
    e.preventDefault();
    spin();
  }
});

window.addEventListener('resize', resizeCanvas);

// ---------- Старт ----------

if (load()) {
  namesInput.value = original.join('\n');
  countInput.value = original.length;
  renderTitle();
  renderList();
} else {
  applyPreset(PRESETS.default);
}
resizeCanvas();
