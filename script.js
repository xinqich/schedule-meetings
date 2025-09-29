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

const COLORS = ['#008000',
    '#d9af70',
    '#9f191b',
    '#7cb1c3',
    '#ef9b02',
    '#b503b5',
    '#808080',
    '#5e92f1',
    '#5700ff',
    '#ff5a00',
    '#333'
]

// Period: 2025-09-01 .. 2026-12-31 (inclusive)
const START_DATE = new Date(2025, 8, 1);
const END_DATE = new Date(2026, 11, 31);

const STORAGE_KEY = 'meetings_v1';
const DAY_MS = 24*60*60*1000;
const DAY_WIDTH_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--day-width')) || 28;
const BAR_WIDTH_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bar-width')) || 20;

// Firebase configuration - you need to replace this with your actual Firebase config
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBA54A85RET3qp58uxzJjSBzf9YNDcmMrY",
    authDomain: "gantt-diagramm.firebaseapp.com",
    projectId: "gantt-diagramm",
    storageBucket: "gantt-diagramm.firebasestorage.app",
    messagingSenderId: "669157571776",
    appId: "1:669157571776:web:19a850e02123be2c0d0125"
};

// Firebase variables
let firebaseApp = null;
let firestore = null;
let firebaseEnabled = false;
const FIREBASE_DOC_ID = 'schedule-meetings-data';

// Initialize Firebase when modules are ready
function initFirebase() {
    if (!window.firebaseModules) return;

    try {
        const { initializeApp, getFirestore } = window.firebaseModules;
        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firestore = getFirestore(firebaseApp);
        firebaseEnabled = true;
        updateFirebaseStatus('✅ Подключено к Firebase');

        // Load data from Firebase on initialization
        loadFromFirebase();
    } catch (error) {
        console.warn('Firebase initialization failed:', error);
        updateFirebaseStatus('❌ Firebase недоступен');
        firebaseEnabled = false;
    }
}

// Update Firebase status in UI
function updateFirebaseStatus(status) {
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl) {
        statusEl.textContent = status;
    }
}

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

// Firebase storage helpers
async function saveToFirebase(meetings) {
    if (!firebaseEnabled || !firestore || !window.firebaseModules) return;

    try {
        const { doc, setDoc } = window.firebaseModules;
        const docRef = doc(firestore, 'meetings', FIREBASE_DOC_ID);
        await setDoc(docRef, {
            meetings: meetings,
            lastUpdated: new Date().toISOString()
        });
        updateFirebaseStatus('✅ Сохранено в Firebase');
    } catch (error) {
        console.warn('Firebase save error:', error);
        updateFirebaseStatus('⚠️ Ошибка сохранения');
    }
}

async function loadFromFirebase() {
    if (!firebaseEnabled || !firestore || !window.firebaseModules) return null;

    try {
        const { doc, getDoc } = window.firebaseModules;
        const docRef = doc(firestore, 'meetings', FIREBASE_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const firebaseMeetings = validateMeetings(data.meetings || []);

            // Update the global meetings variable and re-render
            meetings = firebaseMeetings;
            renderGrid(meetings);

            // Also save to localStorage as backup
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseMeetings));
            } catch(e) {
                console.warn('localStorage backup failed:', e);
            }

            updateFirebaseStatus('✅ Загружено из Firebase');
            return firebaseMeetings;
        } else {
            updateFirebaseStatus('📄 Новый документ');
            return null;
        }
    } catch (error) {
        console.warn('Firebase load error:', error);
        updateFirebaseStatus('⚠️ Ошибка загрузки');
        return null;
    }
}

// storage helpers - now with Firebase integration
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
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        // Also save to Firebase asynchronously
        if (firebaseEnabled) {
            saveToFirebase(arr);
        }
    } catch(e) { console.warn('save error', e); }
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

// Edit modal refs
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editGroupSelect = document.getElementById('editGroupSelect');
const editTypeSelect = document.getElementById('editTypeSelect');
const editDateInput = document.getElementById('editDateInput');
const editDeleteBtn = document.getElementById('editDelete');
const editCancelBtn = document.getElementById('editCancel');
let editingMeetingId = null;

// fill group selects
GROUPS.forEach((g,i) => {
    const opt1 = document.createElement('option');
    opt1.value = i; opt1.textContent = g;
    groupSelect.appendChild(opt1);
    if (editGroupSelect) {
        const opt2 = document.createElement('option');
        opt2.value = i; opt2.textContent = g;
        editGroupSelect.appendChild(opt2);
    }
});

// date input constraints
dateInput.min = dateToISO(START_DATE);
dateInput.max = dateToISO(END_DATE);
dateInput.value = dateToISO(START_DATE);
if (editDateInput) {
    editDateInput.min = dateToISO(START_DATE);
    editDateInput.max = dateToISO(END_DATE);
}

// RENDER HEADER (months + days)
function renderHeader() {
    monthsRow.innerHTML = '';
    daysRow.innerHTML = '';

    // Months: group days by year-month
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
        block.style.width = (count * DAY_WIDTH_PX) + 'px';
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
        // highlight first of month with bolder text
        if (dObj.date.getDate() === 1) {
            cell.style.fontWeight = 700;
            cell.style.color = '#0f172a';
        }
        daysRow.appendChild(cell);
    }
}

// RENDER GRID and groups
function renderGrid(meetings) {
    timelineGrid.innerHTML = '';
    groupsColumn.innerHTML = '';

    const gridInner = document.createElement('div');
    gridInner.className = 'grid-inner';

    // for each group create a row with inner width = DAYS.length * DAY_WIDTH
    GROUPS.forEach((name, gi) => {
        const row = document.createElement('div');
        row.className = 'group-row';
        row.dataset.groupIndex = gi;

        const rowInner = document.createElement('div');
        rowInner.className = 'row-inner';
        rowInner.style.width = (DAYS.length * DAY_WIDTH_PX) + 'px';
        rowInner.style.height = '100%';
        rowInner.style.position = 'relative';
        row.appendChild(rowInner);
        gridInner.appendChild(row);

        const gLabel = document.createElement('div');
        gLabel.className = 'group-label';
        gLabel.textContent = name;
        gLabel.style.color = COLORS[gi]
        groupsColumn.appendChild(gLabel);
    });

    // add vertical grid lines overlay (one set for all rows)
    const lines = document.createElement('div');
    lines.className = 'grid-lines';
    lines.style.width = (DAYS.length * DAY_WIDTH_PX) + 'px';
    for (let k = 0; k <= DAYS.length; k++) {
        const v = document.createElement('div');
        v.className = 'vline';
        // Thicker line at the start of each month (except the last boundary)
        if (k < DAYS.length && DAYS[k].date.getDate() === 1) {
            v.classList.add('month-start');
        }
        v.style.left = (k * DAY_WIDTH_PX) + 'px';
        lines.appendChild(v);
    }
    // horizontal separators between group rows (skip top and bottom outer borders)
    const rowH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-height')) || 56;
    for (let gi = 1; gi < GROUPS.length; gi++) {
        const h = document.createElement('div');
        h.className = 'hline';
        h.style.top = (gi * rowH) + 'px';
        lines.appendChild(h);
    }
    gridInner.appendChild(lines);

    timelineGrid.appendChild(gridInner);

    // add meetings
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

        const left = idx * DAY_WIDTH_PX + Math.max(0, Math.floor((DAY_WIDTH_PX - BAR_WIDTH_PX) / 2));
        bar.style.left = left + 'px';

        // Open edit modal on click
        bar.addEventListener('click', () => {
            const meet = meetings.find(mm => mm.id === id);
            if (meet) openEditModal(meet);
        });

        rowInner.appendChild(bar);
    });
}

// load meetings and validate
let meetings = [];

// Function to validate and filter meetings
function validateMeetings(meetingsArray) {
    if (!Array.isArray(meetingsArray)) return [];
    return meetingsArray.filter(m => {
        const okGroup = Number.isInteger(Number(m.groupIndex)) && m.groupIndex >= 0 && m.groupIndex < GROUPS.length;
        const okDate = typeof m.date === 'string' && isDateInRange(m.date);
        const okType = m.type === 'О' || m.type === 'В';
        return okGroup && okDate && okType;
    });
}

// Load initial data (will be replaced by Firebase data when available)
meetings = validateMeetings(loadMeetings());

// initial render
renderHeader();
renderGrid(meetings);

// Sync scrolling: when grid scrolls horizontally, header scrolls; vertical maps to groups column
timelineGrid.addEventListener('scroll', () => {
    timelineHeader.scrollLeft = timelineGrid.scrollLeft;
    groupsColumn.scrollTop = timelineGrid.scrollTop;
});
// allow header scroll to drive grid
timelineHeader.addEventListener('scroll', () => {
    timelineGrid.scrollLeft = timelineHeader.scrollLeft;
});
// vertical sync back (if user scrolls groups list)
groupsColumn.addEventListener('scroll', () => {
    timelineGrid.scrollTop = groupsColumn.scrollTop;
});

// Mouse wheel to pan timeline: default wheel => horizontal pan; Shift+wheel => vertical pan
function handleWheelToPan(target) {
    target.addEventListener('wheel', (e) => {
        // Use non-passive to allow preventDefault; added in options below
        if (e.shiftKey) {
            // Shift => vertical pan between groups
            e.preventDefault();
            timelineGrid.scrollTop += e.deltaY;
            groupsColumn.scrollTop = timelineGrid.scrollTop;
            return;
        }
        const deltaX = e.deltaX || 0;
        const deltaY = e.deltaY || 0;
        // If vertical wheel used, translate to horizontal; also include native horizontal deltas
        const dx = (deltaX !== 0 ? deltaX : deltaY);
        if (dx !== 0) {
            e.preventDefault();
            const newLeft = Math.max(0, timelineGrid.scrollLeft + dx);
            timelineGrid.scrollLeft = newLeft;
            timelineHeader.scrollLeft = newLeft;
        }
    }, { passive: false });
}
handleWheelToPan(timelineGrid);
handleWheelToPan(timelineHeader);

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
    // keep date as next day (optional) — reset to START_DATE for predictability
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
    const left = dayObj.index * DAY_WIDTH_PX;
    // scroll horizontally so day is visible (offset a bit left)
    timelineGrid.scrollLeft = Math.max(0, left - 80);
    timelineHeader.scrollLeft = timelineGrid.scrollLeft;
}

// Edit modal logic
function openEditModal(meeting) {
    editingMeetingId = meeting.id;
    if (!editModal) return;
    if (editGroupSelect) editGroupSelect.value = String(meeting.groupIndex);
    if (editTypeSelect) editTypeSelect.value = meeting.type;
    if (editDateInput) editDateInput.value = meeting.date;
    editModal.classList.remove('hidden');
    setTimeout(() => { if (editDateInput) editDateInput.focus(); }, 0);
}
function closeEditModal() {
    editingMeetingId = null;
    if (editModal) editModal.classList.add('hidden');
}

if (editForm) {
    editForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!editingMeetingId) { closeEditModal(); return; }
        const idx = meetings.findIndex(m => m.id === editingMeetingId);
        if (idx === -1) { closeEditModal(); return; }

        const newGroupIndex = Number(editGroupSelect.value);
        const newType = editTypeSelect.value === 'В' ? 'В' : 'О';
        const newDate = editDateInput.value;

        if (!Number.isInteger(newGroupIndex) || newGroupIndex < 0 || newGroupIndex >= GROUPS.length) {
            alert('Некорректная группа');
            return;
        }
        if (!isDateInRange(newDate)) {
            alert(`Дата должна быть в диапазоне ${dateToISO(START_DATE)} — ${dateToISO(END_DATE)}`);
            return;
        }

        meetings[idx] = { ...meetings[idx], groupIndex: newGroupIndex, type: newType, date: newDate };
        saveMeetings(meetings);
        renderGrid(meetings);
        const updated = meetings[idx];
        closeEditModal();
        scrollToMeeting(updated);
    });
}
if (editDeleteBtn) {
    editDeleteBtn.addEventListener('click', () => {
        if (!editingMeetingId) { closeEditModal(); return; }
        if (!confirm('Удалить это заседание?')) return;
        meetings = meetings.filter(m => m.id !== editingMeetingId);
        saveMeetings(meetings);
        renderGrid(meetings);
        closeEditModal();
    });
}
if (editCancelBtn) {
    editCancelBtn.addEventListener('click', () => {
        closeEditModal();
    });
}
if (editModal) {
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal && !editModal.classList.contains('hidden')) {
        closeEditModal();
    }
});

// keep header aligned on resize (re-render header widths)
window.addEventListener('resize', () => {
    renderHeader();
    renderGrid(meetings);
});

// Firebase initialization hook
window.initFirebase = initFirebase;

// Initialize Firebase if modules are already loaded
if (window.firebaseReady) {
    initFirebase();
}