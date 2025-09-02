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
    const re = new RegExp(`/\\* dynamic: ${className} \\*/[\\s\\S]*?\\n`, 'm');
    if (re.test(tag.textContent)) {
        tag.textContent = tag.textContent.replace(re, css);
    } else {
        tag.appendChild(document.createTextNode(css));
    }
}

function toISOIfNeeded(s) {
    // input from <input type="date"> is already YYYY-MM-DD; ensure string
    if (!s) return s;
    return ('' + s);
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
        bar_height: 28,        // чуть выше, чтобы текст помещался
        padding: 10,           // меньше вертикальных отступов
        column_width: 30,      // ширина колонки (можно подбирать)
        container_height: 720, // фиксированная высота (можно 'auto')
        view_mode_select: false,
        popup_on: 'click',
        auto_move_label: true
    };

    gantt = new Gantt('#gantt', tasks, options);
}

// --- Инициализация UI
window.addEventListener('DOMContentLoaded', () => {
    // Рендерим первый раз
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

        addOrReplaceColorRule(cls, barColor, textColor);

        tasks.push({
            id,
            name,
            start: toISOIfNeeded(startRaw),
            end: toISOIfNeeded(endRaw),
            custom_class: cls
        });

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

    // Обработчик клика на задаче (пример: открыть alert с инфой)
    // можно заменить на показ формы редактирования
    document.querySelector('#gantt').addEventListener('click', (ev) => {
        const target = ev.target;
        // библиотека содержит data-task-id на bar-wrapper
        const wrapper = target.closest && target.closest('.bar-wrapper');
        if (wrapper && wrapper.dataset && wrapper.dataset.taskId) {
            const tid = wrapper.dataset.taskId;
            // Простейший пример — показываем окно с данными
            const task = tasks.find(t => t.id === tid);
            if (task) {
                // Пока просто демонстрация; заменим на форму редактирования при необходимости
                // alert(`Задача: ${task.name}\n${task.start} → ${task.end}`);
            }
        }
    });
});
