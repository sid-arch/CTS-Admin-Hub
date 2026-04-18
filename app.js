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

// --- 2. REALTIME DATA SYNC ---
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
const syncGrade = (id, data) => db.collection('grades').doc(id).set(data);
const syncGlobal = (val) => db.collection('settings').doc('global').set({ totalClassesHeld: val });

// --- 3. UI HANDLERS ---
window.checkAuth = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Nalanda") {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        startRealtimeSync();
    } else { alert("Access Denied"); }
};

window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};

const refreshAllDataViews = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    renderAttendanceList();
    if(document.getElementById('stat-total-students')) 
        document.getElementById('stat-total-students').innerText = students.length;
};

// --- 4. RENDERERS ---
window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => {
        const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
        
        // ATTENDANCE MATH
        const attPct = totalClassesHeld > 0 ? Math.min(Math.round((s.attendance / totalClassesHeld) * 100), 100) : 0;
        
        // HOMEWORK MATH
        const comp = parseInt(g.completed) || 0;
        const hwSum = s.homework ? s.homework.slice(0, comp).reduce((a, b) => a + (parseInt(b) || 0), 0) : 0;
        const hwAvg = comp > 0 ? Math.round(hwSum / comp) : 0;

        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-all group">
            <td class="p-6">
                <div class="font-bold text-white group-hover:text-blue-400 transition-colors">${s.name}</div>
                <div class="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">${s.id}</div>
            </td>
            <td class="p-6 text-[10px] uppercase text-blue-400 font-black tracking-widest">${g.name}</td>
            <td class="p-6 text-center">
                <div class="text-sm font-bold text-white">${attPct}%</div>
                <div class="w-16 h-1 bg-white/5 mx-auto rounded-full overflow-hidden mt-1">
                    <div class="h-full bg-emerald-500" style="width: ${attPct}%"></div>
                </div>
            </td>
            <td class="p-6 text-center">
                <div class="text-sm font-bold text-blue-400">${hwAvg}%</div>
            </td>
            <td class="p-6 text-right space-x-2">
                <button onclick="openStudentModal('${s.id}')" class="text-slate-500 hover:text-blue-400 transition-all">✎</button>
                <button onclick="deleteStudent('${s.id}')" class="text-slate-500 hover:text-rose-500 transition-all">🗑</button>
            </td>
        </tr>`;
    }).join('');
};

window.renderAttendanceList = () => {
    const container = document.getElementById('attendance-list-container');
    if (!container) return;
    const sorted = [...students].sort((a,b) => a.name.localeCompare(b.name));
    container.innerHTML = sorted.map(s => `
        <div class="glass-panel p-4 rounded-2xl flex justify-between items-center border border-white/5 hover:border-emerald-500/30 transition-all">
            <div>
                <div class="text-white font-bold text-sm">${s.name}</div>
                <div class="text-[9px] text-slate-500 font-black uppercase tracking-widest">${gradeConfig[s.grade]?.name || s.grade}</div>
            </div>
            <button onclick="markAttendance('${s.id}')" class="bg-emerald-500/10 text-emerald-500 px-6 py-2 rounded-xl text-[10px] font-black hover:bg-emerald-500 hover:text-white transition-all">CHECK IN</button>
        </div>`).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];
    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: gId, lessons: 10 };
        const rows = list.map(s => `
            <div class="p-4 flex justify-between items-center border-b border-white/5 hover:bg-white/[0.01]">
                <span class="text-xs font-bold text-white">${s.name}</span>
                <div class="flex gap-1 overflow-x-auto">
                    ${Array.from({length: g.lessons || 10}).map((_, i) => `
                        <input type="number" value="${s.homework?.[i] || 0}" 
                        class="w-8 h-8 bg-black/40 border border-white/10 rounded text-[10px] text-center text-blue-400 outline-none focus:border-blue-500" 
                        onchange="updateHW('${s.id}', ${i}, this.value)">
                    `).join('')}
                </div>
            </div>`).join('');
        return `
            <div class="glass-panel rounded-[2rem] overflow-hidden border border-white/5">
                <div class="p-4 bg-white/5 font-black uppercase text-[10px] tracking-widest text-blue-400 flex justify-between">
                    <span>${g.name}</span>
                    <span class="text-slate-500">${g.lessons} Lessons</span>
                </div>
                ${rows}
            </div>`;
    }).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    const search = document.getElementById('db-search')?.value.toLowerCase() || "";
    if (!tbody) return;
    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.phone.includes(search)).map(s => `
        <tr class="border-b border-white/5 text-xs hover:bg-white/[0.01]">
            <td class="p-6 font-bold text-white">${s.name}<br><span class="text-[9px] text-slate-500 font-mono">${s.id}</span></td>
            <td class="p-6 text-blue-400 font-black uppercase text-[10px]">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-6 text-slate-300 font-mono">${s.phone}</td>
            <td class="p-6">
                <div class="text-slate-500 italic">F: ${s.fatherEmail}</div>
                <div class="text-slate-500 italic">M: ${s.motherEmail}</div>
            </td>
            <td class="p-6 text-right"><button onclick="deleteStudent('${s.id}')" class="text-rose-500 opacity-50 hover:opacity-100">🗑</button></td>
        </tr>`).join('');
};

window.renderGradeSettings = () => {
    const list = document.getElementById('grade-config-list');
    if (!list) return;
    list.innerHTML = Object.keys(gradeConfig).map(id => `
        <div class="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-4">
            <div class="flex justify-between items-center"><span class="font-black text-blue-500 font-mono uppercase text-[10px]">${id}</span><button onclick="removeGrade('${id}')" class="text-rose-500 text-[10px] font-black opacity-50 hover:opacity-100">REMOVE</button></div>
            <input type="text" value="${gradeConfig[id].name}" onchange="updateGradeProp('${id}','name',this.value)" class="w-full bg-white/5 p-3 rounded-xl text-white text-sm outline-none border border-white/5 focus:border-blue-500">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Lessons</label><input type="number" value="${gradeConfig[id].lessons}" onchange="updateGradeProp('${id}','lessons',this.value)" class="w-full bg-black/40 p-2 rounded-xl text-blue-400 text-center font-bold"></div>
                <div><label class="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Completed</label><input type="number" value="${gradeConfig[id].completed}" onchange="updateGradeProp('${id}','completed',this.value)" class="w-full bg-black/40 p-2 rounded-xl text-emerald-400 text-center font-bold"></div>
            </div>
        </div>`).join('');
};

// --- 5. MODAL ACTIONS ---
window.openStudentModal = (id = null) => {
    const m = document.getElementById('student-modal');
    m.classList.remove('hidden'); m.classList.add('flex');
    if(id) {
        isEditing = true;
        const s = students.find(x => x.id === id);
        document.getElementById('m-id').value = s.id; document.getElementById('m-id').disabled = true;
        document.getElementById('m-name').value = s.name;
        document.getElementById('m-grade').value = s.grade;
        document.getElementById('m-phone').value = s.phone;
        document.getElementById('m-f-email').value = s.fatherEmail;
        document.getElementById('m-m-email').value = s.motherEmail;
    } else {
        isEditing = false;
        document.getElementById('m-id').disabled = false;
        ['m-id', 'm-name', 'm-grade', 'm-phone', 'm-f-email', 'm-m-email'].forEach(i => document.getElementById(i).value = '');
    }
};

window.closeStudentModal = () => document.getElementById('student-modal').classList.replace('flex', 'hidden');

window.saveStudent = async () => {
    const id = document.getElementById('m-id').value.trim();
    if(!id) return;
    const old = students.find(x => x.id === id);
    const s = {
        id, name: document.getElementById('m-name').value, 
        grade: document.getElementById('m-grade').value.toLowerCase().trim(),
        phone: document.getElementById('m-phone').value,
        fatherEmail: document.getElementById('m-f-email').value,
        motherEmail: document.getElementById('m-m-email').value,
        attendance: isEditing ? (old?.attendance || 0) : 0,
        homework: isEditing ? (old?.homework || new Array(50).fill(0)) : new Array(50).fill(0)
    };
    await syncStudent(s);
    closeStudentModal();
};

// --- 6. CORE ACTIONS ---
window.markAttendance = async (id) => {
    const s = students.find(x => x.id.toLowerCase() === id.toLowerCase().trim());
    if(s) {
        s.attendance = (s.attendance || 0) + 1;
        await syncStudent(s);
        const log = document.getElementById('session-log');
        log.value = `[${new Date().toLocaleTimeString()}] CHECK-IN: ${s.name}\n` + log.value;
    }
    const input = document.getElementById('attendance-scan-input');
    if(input) { input.value = ''; input.focus(); }
};

window.updateHW = async (id, i, v) => {
    const s = students.find(x => x.id === id);
    if(s) { s.homework[i] = parseInt(v) || 0; await syncStudent(s); }
};

window.updateGradeProp = async (id, p, v) => {
    gradeConfig[id][p] = p === 'name' ? v : parseInt(v);
    await syncGrade(id, gradeConfig[id]);
};

window.addNewGrade = async () => {
    const id = prompt("Grade ID (e.g. g1):").trim().toLowerCase();
    const name = prompt("Display Name (e.g. Grade 1):");
    if(id && name) await syncGrade(id, { name, lessons: 10, completed: 0 });
};

window.removeGrade = async (id) => { if(confirm("Delete grade?")) await db.collection('grades').doc(id).delete(); };
window.deleteStudent = async (id) => { if(confirm("Delete student?")) await db.collection('students').doc(id).delete(); };
window.updateGlobalClasses = (v) => syncGlobal(parseInt(v) || 1);

// CSV Import
window.handleCSVImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = event.target.result.split('\n').slice(1);
        for(let r of rows) {
            const c = r.split(',').map(x => x.trim());
            if(c.length >= 6) await syncStudent({
                name: c[0], id: c[1], grade: c[2].toLowerCase(), phone: c[3], 
                fatherEmail: c[4], motherEmail: c[5], attendance: 0, homework: new Array(50).fill(0)
            });
        }
        alert("Sync Complete");
    };
    reader.readAsText(file);
};

// Barcode Listener
document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        const input = document.getElementById('attendance-scan-input');
        if(document.activeElement === input) markAttendance(input.value);
    }
});
