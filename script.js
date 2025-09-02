/* global Gantt */

// --- Утилиты
function ensureStyleTag() {
    const ID = 'dynamic-task-colors';
    let tag = document.getElementById(ID);
    if (!tag) {
        tag = document.createElement('style');
        tag.id = ID;
        document.head.appendChild(tag);
    }
    return tag;
}
function addOrReplaceColorRule(className, barColor, textColor) {
    const tag = ensureStyleTag();
    const css = `
/* dynamic: ${className} */
.bar-wrapper.${className} rect.bar, .bar-wrapper.${className} .bar { fill: ${barColor} !important; }
.bar-wrapper.${className} .bar-label { fill: ${textColor} !important; }
`;
    // Простая замена: если блок с комментарием dynamic: <className> найден — заменим, иначе добавим
    const marker = `/* dynamic: ${className} */`;
    if (tag.textContent.includes(marker)) {
        // заменим блок целиком (находим начало маркера и следующий перенос строки)
        const idx = tag.textContent.indexOf(marker);
        // ищем следующий маркер или конец строки — достаточно удалить от idx до следующего "/* dynamic:" или конца
        const nextMarkerIdx = tag.textContent.indexOf('/* dynamic:', idx + 1);
        if (nextMarkerIdx === -1) {
            tag.textContent = tag.textContent.slice(0, idx) + css;
        } else {
            tag.textContent = tag.textContent.slice(0, idx) + css + tag.textContent.slice(nextMarkerIdx);
        }
    } else {
        tag.appendChild(document.createTextNode(css));
    }
}

// --- localStorage
const STORAGE_KEY = 'gantt_tasks_v1';
function saveTasksToStorage(tasksArray) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksArray));
    } catch (e) {
        console.warn('Не удалось сохранить задачи в localStorage', e);
    }
}
function loadTasksFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed;
    } catch (e) {
        console.warn('Ошибка при чтении localStorage', e);
        return null;
    }
}

// --- Начальные задачи (включая "якоря" для диапазона)
const tasks = [
    { id: 'anchor-start', name: 'anchor-start', start: '2025-09-01', end: '2025-09-01', custom_class: 'anchor' },
    { id: 'anchor-end',   name: 'anchor-end',   start: '2026-12-31', end: '2026-12-31', custom_class: 'anchor' },

    { id: 't1', name: 'Проект: инициация', start: '2025-09-10', end: '2025-09-20', custom_class: 'color-blue' },
    { id: 't2', name: 'Этап: дизайн', start: '2025-10-01', end: '2025-11-05', custom_class: 'color-green' },
    { id: 't3', name: 'Этап: разработка', start: '2025-11-10', end: '2026-02-15', custom_class: 'color-rose' }
];

let gantt = null;
const VIEW_MODES = ['Year','Month','Week','Day'];
let currentViewIndex = 2; // start with 'Week'

// --- Рендер (очищает контейнер и создаёт новый Gantt)
function render() {
    const container = document.querySelector('#gantt');
    if (!container) return;
    container.innerHTML = ''; // **важно** — удаляем старый SVG/DOM перед перерисовкой

    const options = {
        view_mode: VIEW_MODES[currentViewIndex],
        date_format: 'YYYY-MM-DD',
        bar_height: 28,
        padding: 10,
        column_width: 30,
        container_height: 720,
        view_mode_select: false,
        popup_on: 'click',
        auto_move_label: true
    };

    gantt = new Gantt('#gantt', tasks, options);
}

// --- При загрузке страницы: пытаемся восстановить задачи
function ensureAnchorsPresent() {
    if (!tasks.some(t => t.id === 'anchor-start')) {
        tasks.unshift({ id: 'anchor-start', name: 'anchor-start', start: '2025-09-01', end: '2025-09-01', custom_class: 'anchor' });
    }
    if (!tasks.some(t => t.id === 'anchor-end')) {
        tasks.push({ id: 'anchor-end', name: 'anchor-end', start: '2026-12-31', end: '2026-12-31', custom_class: 'anchor' });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Попытка загрузить из localStorage
    const stored = loadTasksFromStorage();
    if (stored && Array.isArray(stored) && stored.length > 0) {
        // Заменяем содержимое tasks на сохранённый массив (мутируем существующий массив)
        tasks.splice(0, tasks.length, ...stored);
        // Гарантируем наличие якорей диапазона
        ensureAnchorsPresent();

        // Восстанавливаем CSS-правила для задач, где есть сохранённые цвета
        tasks.forEach(t => {
            if (t.custom_class && t.barColor && t.textColor) {
                addOrReplaceColorRule(t.custom_class, t.barColor, t.textColor);
            }
        });
    } else {
        // Нет сохранений — сохраняем исходный набор
        saveTasksToStorage(tasks);
    }

    // Первый рендер
    render();
    document.getElementById('zoomLabel').textContent = VIEW_MODES[currentViewIndex];

    // Форма добавления задач
    const form = document.getElementById('taskForm');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = (fd.get('name') || '').toString().trim();
        const startRaw = fd.get('start');
        let endRaw = fd.get('end');
        const barColor = (fd.get('barColor') || '#4e79a7').toString();
        const textColor = (fd.get('textColor') || '#ffffff').toString();

        if (!name || !startRaw) return alert('Укажите название и дату начала');

        if (!endRaw || !endRaw.toString().trim()) endRaw = startRaw;

        const id = 't_' + Date.now();
        const cls = 'c_' + id.replace(/[^a-zA-Z0-9_-]/g, '');

        // создаём CSS правило (и сохраняем цвета в объект задачи)
        addOrReplaceColorRule(cls, barColor, textColor);

        const newTask = {
            id,
            name,
            start: ('' + startRaw),
            end: ('' + endRaw),
            custom_class: cls,
            barColor,    // сохраняем цвет, чтобы восстановить при загрузке
            textColor    // сохраняем цвет текста
        };

        tasks.push(newTask);

        // Сохраняем в localStorage сразу после добавления
        saveTasksToStorage(tasks);

        // Перерисуем (контейнер очищается внутри render)
        render();

        form.reset();
    });

    // Zoom in/out
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomLabel = document.getElementById('zoomLabel');

    zoomIn.addEventListener('click', () => {
        if (currentViewIndex > 0) currentViewIndex--;
        zoomLabel.textContent = VIEW_MODES[currentViewIndex];
        if (gantt && gantt.change_view_mode) gantt.change_view_mode(VIEW_MODES[currentViewIndex], true);
        else render();
    });

    zoomOut.addEventListener('click', () => {
        if (currentViewIndex < VIEW_MODES.length - 1) currentViewIndex++;
        zoomLabel.textContent = VIEW_MODES[currentViewIndex];
        if (gantt && gantt.change_view_mode) gantt.change_view_mode(VIEW_MODES[currentViewIndex], true);
        else render();
    });

    // Клик по задаче — (пока не изменяем логику, но можно будет дополнять)
    document.querySelector('#gantt').addEventListener('click', (ev) => {
        const target = ev.target;
        const wrapper = target.closest && target.closest('.bar-wrapper');
        if (wrapper && wrapper.dataset && wrapper.dataset.taskId) {
            const tid = wrapper.dataset.taskId;
            const task = tasks.find(t => t.id === tid);
            if (task) {
                // заглушка — ничего не делаем, оставляем поведение как было
            }
        }
    });
});
