// meetings_v1 saved as array of { id, groupIndex, date: 'YYYY-MM-DD', type: 'О'|'В' }
// Groups list (order important)
const GROUPS = [
    "Животноводство и корма",
    "Хлебобулочные изделия",
    "Мясопереработка",
    "Алкогольная продукция",
    "Переработка зерновых",
    "Трейдинг зерновых",
    "Агроматериалы",
    "Управляющая компания",
    "Ревизионная комиссия",
    "Ролиф",
    "Deep Core"
];

// Period: 2025-09-01 .. 2026-12-31 (inclusive)
const START_DATE = new Date(2025, 8, 1);
const END_DATE = new Date(2026, 11, 31);

const STORAGE_KEY = 'meetings_v1';
const DAY_MS = 24*60*60*1000;
const DAY_WIDTH_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--day-width')) || 28;
const DAY_SEP_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--day-sep')) || 1; // separator width from CSS
const UNIT = DAY_WIDTH_PX + DAY_SEP_PX; // unit width for one day including separator
const BAR_WIDTH_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-width')) || 20;

function dateToISO(d) {
    if (typeof d === 'string') return d;
    const mm = String(d.getMonth() + 1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
function isoToDate(iso) {
    const [y,m,d] = iso.split('-').map(Number);
    return new Date(y, m-1, d);
}
function daysBetween(start, end) {
    return Math.round((end - start) / DAY_MS);
}

// generate DAYS
const TOTAL_DAYS = daysBetween(START_DATE, END_DATE) + 1;
const DAYS = new Array(TOTAL_DAYS).fill(0).map((_,i) => {
    const dt = new Date(START_DATE.getTime() + i*DAY_MS);
    return { date: dt, iso: dateToISO(dt), index: i };
});

// storage helpers
function loadMeetings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch(e) { console.warn('load error', e); return []; }
}
function saveMeetings(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch(e) { console.warn('save error', e); }
}

function clampDateToRange(iso) {
    const d = isoToDate(iso);
    if (d < START_DATE) return dateToISO(START_DATE);
    if (d > END_DATE) return dateToISO(END_DATE);
    return iso;
}
function isDateInRange(iso) {
    const d = isoToDate(iso);
    return d >= START_DATE && d <= END_DATE;
}

// DOM refs
const groupSelect = document.getElementById('groupSelect');
const typeSelect = document.getElementById('typeSelect');
const dateInput = document.getElementById('dateInput');
const meetingForm = document.getElementById('meetingForm');
const timelineHeader = document.getElementById('timelineHeader');
const monthsRow = document.getElementById('monthsRow');
const daysRow = document.getElementById('daysRow');
const timelineGrid = document.getElementById('timelineGrid');
const groupsColumn = document.getElementById('groupsColumn');
const clearBtn = document.getElementById('clearStorage');

// fill group select
GROUPS.forEach((g,i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = g;
    groupSelect.appendChild(opt);
});

// date input constraints
dateInput.min = dateToISO(START_DATE);
dateInput.max = dateToISO(END_DATE);
dateInput.value = dateToISO(START_DATE);

// RENDER HEADER (months + days)
function renderHeader() {
    monthsRow.innerHTML = '';
    daysRow.innerHTML = '';

    // Months: group DAYS by year-month
    let i = 0;
    while (i < DAYS.length) {
        const d = DAYS[i].date;
        const year = d.getFullYear(), month = d.getMonth();
        // count days in this month within our range
        let count = 0;
        while (i + count < DAYS.length) {
            const dd = DAYS[i+count].date;
            if (dd.getFullYear() === year && dd.getMonth() === month) count++;
            else break;
        }
        const label = new Date(year, month, 1).toLocaleString('ru', { month: 'long', year: 'numeric' });
        const block = document.createElement('div');
        block.className = 'month-block';
        // width = count * (dayWidth + separator) to account for borders between days
        block.style.width = (count * UNIT) + 'px';
        block.textContent = label;
        monthsRow.appendChild(block);
        i += count;
    }

    // Days row: each day a cell with day number
    for (let k=0;k<DAYS.length;k++) {
        const dObj = DAYS[k];
        const cell = document.createElement('div');
        cell.className = 'day-cell-header';
        cell.style.width = DAY_WIDTH_PX + 'px';
        cell.style.minWidth = DAY_WIDTH_PX + 'px';
        cell.textContent = dObj.date.getDate();
        // bold first of month
        if (dObj.date.getDate() === 1) {
            cell.style.fontWeight = 700;
            cell.style.color = '#0f172a';
        }
        daysRow.appendChild(cell);
    }
}

// RENDER GRID and groups (groups column is LEFT now)
function renderGrid(meetings) {
    timelineGrid.innerHTML = '';
    groupsColumn.innerHTML = '';

    const gridInner = document.createElement('div');
    gridInner.className = 'grid-inner';

    // for each group create a row with inner width = DAYS.length * UNIT
    GROUPS.forEach((name, gi) => {
        const row = document.createElement('div');
        row.className = 'group-row';
        row.dataset.groupIndex = gi;

        const rowInner = document.createElement('div');
        rowInner.className = 'row-inner';
        rowInner.style.width = (DAYS.length * UNIT) + 'px';
        rowInner.style.height = '100%';
        rowInner.style.position = 'relative';
        row.appendChild(rowInner);
        gridInner.appendChild(row);

        const gLabel = document.createElement('div');
        gLabel.className = 'group-label';
        gLabel.textContent = name;
        groupsColumn.appendChild(gLabel);
    });

    timelineGrid.appendChild(gridInner);

    // add meetings (bars)
    meetings.forEach(m => {
        const { id, groupIndex, date, type } = m;
        const gidx = Number(groupIndex);
        if (!Number.isInteger(gidx) || gidx < 0 || gidx >= GROUPS.length) return;
        if (!isDateInRange(date)) return;

        const dayObj = DAYS.find(d => d.iso === date);
        if (!dayObj) return;
        const idx = dayObj.index;

        const row = timelineGrid.querySelector(`.group-row[data-group-index="${gidx}"]`);
        if (!row) return;
        const rowInner = row.firstElementChild;

        const bar = document.createElement('div');
        bar.className = 'meeting-bar ' + (type === 'В' ? 'meeting-V' : 'meeting-O');
        bar.dataset.id = id;
        bar.textContent = (type === 'В' ? 'В' : 'О');

        // compute left position using UNIT (day width + separator)
        const left = idx * UNIT + Math.max(0, Math.floor((DAY_WIDTH_PX - BAR_WIDTH_PX) / 2));
        bar.style.left = left + 'px';

        rowInner.appendChild(bar);
    });
}

// load meetings and validate
let meetings = loadMeetings();
if (!Array.isArray(meetings)) meetings = [];
meetings = meetings.filter(m => {
    const okGroup = Number.isInteger(Number(m.groupIndex)) && m.groupIndex >= 0 && m.groupIndex < GROUPS.length;
    const okDate = typeof m.date === 'string' && isDateInRange(m.date);
    const okType = m.type === 'О' || m.type === 'В';
    return okGroup && okDate && okType;
});

// initial render
renderHeader();
renderGrid(meetings);

// Sync scrolling: grid <-> header horizontally, grid <-> groups vertically
timelineGrid.addEventListener('scroll', () => {
    timelineHeader.scrollLeft = timelineGrid.scrollLeft;
    groupsColumn.scrollTop = timelineGrid.scrollTop;
});
timelineHeader.addEventListener('scroll', () => {
    timelineGrid.scrollLeft = timelineHeader.scrollLeft;
});
groupsColumn.addEventListener('scroll', () => {
    timelineGrid.scrollTop = groupsColumn.scrollTop;
});

// form submit
meetingForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const groupIndex = Number(groupSelect.value);
    const type = typeSelect.value === 'В' ? 'В' : 'О';
    const date = dateInput.value;
    if (!isDateInRange(date)) {
        alert(`Дата должна быть в диапазоне ${dateToISO(START_DATE)} — ${dateToISO(END_DATE)}`);
        return;
    }
    const id = 'm_' + Date.now();
    const newMeeting = { id, groupIndex, date, type };
    meetings.push(newMeeting);
    saveMeetings(meetings);
    renderGrid(meetings);
    scrollToMeeting(newMeeting);
    // reset date to START_DATE for predictability
    dateInput.value = dateToISO(START_DATE);
});

// clear storage
clearBtn.addEventListener('click', () => {
    if (!confirm('Удалить все сохранённые заседания?')) return;
    meetings = [];
    saveMeetings(meetings);
    renderGrid(meetings);
});

// scroll helper
function scrollToMeeting(meeting) {
    const dayObj = DAYS.find(d => d.iso === meeting.date);
    if (!dayObj) return;
    const left = dayObj.index * UNIT;
    timelineGrid.scrollLeft = Math.max(0, left - 80);
    timelineHeader.scrollLeft = timelineGrid.scrollLeft;
    const rowH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-height')) || 56;
    const top = meeting.groupIndex * rowH;
    groupsColumn.scrollTop = top;
    timelineGrid.scrollTop = top;
}

// keep header aligned on resize (re-render header widths)
window.addEventListener('resize', () => {
    renderHeader();
    renderGrid(meetings);
});
