// --- 1. FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAM5deoGXltOAkYs3OQbL3Q-x-CD68bgxU",
  authDomain: "cts-admin-hub-8c1ec.firebaseapp.com",
  projectId: "cts-admin-hub-8c1ec",
  storageBucket: "cts-admin-hub-8c1ec.firebasestorage.app",
  messagingSenderId: "323202681156",
  appId: "1:323202681156:web:1acf1d6f3a150a48e82f11",
  measurementId: "G-N332B7X0W7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let students = [];
let totalClassesHeld = 1;
let gradeConfig = {};
let isEditing = false;

// --- 2. PERSISTENCE & AUTH ---
const checkSession = () => {
    if (localStorage.getItem('cts_auth') === 'true') {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        startRealtimeSync();
    }
};

window.checkAuth = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Nalanda") {
        localStorage.setItem('cts_auth', 'true');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        startRealtimeSync();
    } else { alert("Access Denied"); }
};

window.logout = () => {
    localStorage.removeItem('cts_auth');
    location.reload();
};

// --- 3. REALTIME DATA SYNC ---
const startRealtimeSync = () => {
    db.collection('students').onSnapshot(snap => {
        students = snap.docs.map(doc => doc.data());
        refreshAllDataViews();
    });

    db.collection('grades').onSnapshot(snap => {
        gradeConfig = {};
        snap.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        refreshAllDataViews();
    });

    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            const input = document.getElementById('global-classes-input');
            if(input) input.value = totalClassesHeld;
            refreshAllDataViews();
        }
    });
};

const syncStudent = (s) => db.collection('students').doc(s.id).set(s);

// --- 4. RENDERERS ---
const refreshAllDataViews = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    if(document.getElementById('stat-total-students')) 
        document.getElementById('stat-total-students').innerText = students.length;
};

window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => {
        const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
        const attPct = totalClassesHeld > 0 ? Math.min(Math.round((s.attendance / totalClassesHeld) * 100), 100) : 0;
        
        // HW Math for Dropdowns
        const comp = parseInt(g.completed) || 0;
        const hwValues = s.homework ? s.homework.slice(0, comp) : [];
        const hwSum = hwValues.reduce((a, b) => a + (parseInt(b) || 0), 0);
        const hwAvg = comp > 0 ? Math.round(hwSum / comp) : 0;

        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-all">
            <td class="p-6">
                <div class="font-bold text-white">${s.name}</div>
                <div class="text-[10px] text-slate-500 font-mono">${s.id}</div>
            </td>
            <td class="p-6 text-[10px] uppercase text-blue-400 font-black">${g.name}</td>
            <td class="p-6 text-center font-bold text-white">${attPct}%</td>
            <td class="p-6 text-center font-bold text-emerald-500">${hwAvg}%</td>
            <td class="p-6 text-right space-x-2">
                <button onclick="openStudentModal('${s.id}')" class="text-slate-500 hover:text-blue-400 transition-all">✎</button>
                <button onclick="deleteStudent('${s.id}')" class="text-slate-500 hover:text-rose-500 transition-all">🗑</button>
            </td>
        </tr>`;
    }).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];
    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: gId, lessons: 10 };
        const rows = list.map(s => `
            <div class="p-4 flex justify-between items-center border-b border-white/5">
                <span class="text-xs font-bold text-white">${s.name}</span>
                <div class="flex gap-2 overflow-x-auto">
                    ${Array.from({length: g.lessons || 10}).map((_, i) => `
                        <select onchange="updateHW('${s.id}', ${i}, this.value)" class="bg-black/40 border border-white/10 rounded text-[9px] p-1 text-blue-400 outline-none">
                            <option value="0" ${s.homework?.[i] == 0 ? 'selected' : ''}>Not Done</option>
                            <option value="25" ${s.homework?.[i] == 25 ? 'selected' : ''}>25%</option>
                            <option value="50" ${s.homework?.[i] == 50 ? 'selected' : ''}>50%</option>
                            <option value="75" ${s.homework?.[i] == 75 ? 'selected' : ''}>75%</option>
                            <option value="100" ${s.homework?.[i] == 100 ? 'selected' : ''}>100%</option>
                        </select>
                    `).join('')}
                </div>
            </div>`).join('');
        return `<div class="glass-panel rounded-3xl border border-white/5 mb-6"><div class="p-4 bg-white/5 font-black uppercase text-[10px] text-blue-400">${g.name}</div>${rows}</div>`;
    }).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    const search = document.getElementById('db-search')?.value.toLowerCase() || "";
    if (!tbody) return;
    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.phone.includes(search)).map(s => `
        <tr class="border-b border-white/5 hover:bg-white/[0.01]">
            <td class="p-6 font-bold text-white text-base">${s.name}<br><span class="text-[9px] text-slate-500 font-mono">${s.id}</span></td>
            <td class="p-6 text-blue-400 font-black uppercase text-xs">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-6 text-slate-300 font-mono text-sm">${s.phone}</td>
            <td class="p-6 text-slate-500 italic text-xs">F: ${s.fatherEmail}<br>M: ${s.motherEmail}</td>
            <td class="p-6 text-right"><button onclick="deleteStudent('${s.id}')" class="text-rose-500 opacity-50 hover:opacity-100">🗑</button></td>
        </tr>`).join('');
};

// --- 5. CORE ACTIONS ---
window.updateHW = async (id, i, v) => {
    const s = students.find(x => x.id === id);
    if(s) { s.homework[i] = parseInt(v); await syncStudent(s); }
};

window.markAttendance = async (id) => {
    const s = students.find(x => x.id.toLowerCase() === id.toLowerCase().trim());
    if(s) {
        s.attendance = (s.attendance || 0) + 1;
        await syncStudent(s);
        const log = document.getElementById('session-log');
        log.value = `[${new Date().toLocaleTimeString()}] SCAN: ${s.name}\n` + log.value;
    }
    document.getElementById('attendance-scan-input').value = '';
};

window.updateGlobalClasses = (v) => db.collection('settings').doc('global').set({ totalClassesHeld: parseInt(v) || 1 });

// Initialize on load
checkSession();

// Standard Modal/Grade functions remain same as previous version...
