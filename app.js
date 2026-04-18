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

// --- 2. DATA SYNC FUNCTIONS (REALTIME) ---

// This replaces loadFromCloud to ensure UI stays synced with Firestore automatically
const startRealtimeSync = () => {
    // Listen for Students
    db.collection('students').onSnapshot(snapshot => {
        students = snapshot.docs.map(doc => doc.data());
        refreshAllDataViews();
    }, err => console.error("Student sync error:", err));

    // Listen for Grade Configurations
    db.collection('grades').onSnapshot(snapshot => {
        gradeConfig = {};
        snapshot.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        refreshAllDataViews();
    }, err => console.error("Grade sync error:", err));

    // Listen for Global Settings
    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            refreshAllDataViews();
        }
    }, err => console.error("Global settings error:", err));
};

const syncStudent = (s) => db.collection('students').doc(s.id).set(s);
const syncGrade = (id, data) => db.collection('grades').doc(id).set(data);
const syncGlobal = (val) => db.collection('settings').doc('global').set({ totalClassesHeld: val });

// --- 3. UI HANDLERS ---

window.checkAuth = async () => {
    const passInput = document.getElementById('admin-pass');
    // Using 'Nalanda' as per original logic
    if (passInput && passInput.value === "Nalanda") {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
        startRealtimeSync(); 
    } else { 
        alert("Invalid Password"); 
    }
};

const refreshAllDataViews = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    updateDashboardStats();
    const globalInput = document.getElementById('global-classes-input');
    if(globalInput) globalInput.value = totalClassesHeld;
};

// --- RENDERERS ---

window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    const filtered = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search));

    tbody.innerHTML = filtered.map(s => {
        const gId = s.grade.toLowerCase();
        const g = gradeConfig[gId] || { name: "Grade " + gId.replace(/\D/g,''), completed: 0 };
        
        const attPct = totalClassesHeld > 0 ? ((s.attendance / totalClassesHeld) * 100).toFixed(0) : 0;
        const comp = parseInt(g.completed) || 0;
        const hwSum = s.homework ? s.homework.slice(0, comp).reduce((a, b) => a + (parseInt(b) || 0), 0) : 0;
        const hwPct = comp > 0 ? (hwSum / comp).toFixed(0) : 0;

        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td class="p-6">
                <div class="font-bold text-white">${s.name}</div>
                <div class="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">${s.id}</div>
            </td>
            <td class="p-6 text-xs uppercase text-blue-400 font-black">${g.name}</td>
            <td class="p-6 text-center">${attPct}%</td>
            <td class="p-6 text-center font-bold text-emerald-500">${hwPct}%</td>
            <td class="p-6 text-right"><button onclick="deleteStudent('${s.id}')" class="levitate p-2 hover:text-red-500 transition-transform">🗑</button></td>
        </tr>`;
    }).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];
    
    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: "Grade " + gId.replace(/\D/g,''), lessons: 10 };
        const rows = list.map(s => `
            <div class="p-4 flex justify-between items-center border-b border-white/5">
                <span class="text-sm font-bold text-white">${s.name}</span>
                <div class="flex gap-1 overflow-x-auto max-w-[60%]">
                    ${Array.from({length: g.lessons || 10}).map((_, i) => `
                        <input type="number" value="${(s.homework && s.homework[i]) || 0}" class="hw-percent-input w-10 flex-shrink-0" 
                        onchange="updateHW('${s.id}', ${i}, this.value)">
                    `).join('')}
                </div>
            </div>`).join('');
        return `<div class="glass-panel rounded-3xl overflow-hidden mb-4"><div class="p-4 bg-white/5 font-black uppercase text-[10px] text-blue-400">${g.name}</div>${rows}</div>`;
    }).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    const search = document.getElementById('db-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    const filtered = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search));

    tbody.innerHTML = filtered.map(s => `
        <tr class="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
            <td class="p-6 font-bold text-white">${s.name}<br><span class="text-[10px] text-slate-500 font-mono">${s.id}</span></td>
            <td class="p-6 text-blue-400 font-black">${(gradeConfig[s.grade]?.name || "Grade " + s.grade.replace(/\D/g,''))}</td>
            <td class="p-6">${s.phone}</td>
            <td class="p-6 text-slate-400">${s.fatherEmail}</td>
            <td class="p-6 text-slate-400">${s.motherEmail}</td>
            <td class="p-6 text-right"><button onclick="deleteStudent('${s.id}')" class="levitate hover:text-red-500">🗑</button></td>
        </tr>`).join('');
};

window.renderGradeSettings = () => {
    const list = document.getElementById('grade-config-list');
    if (!list) return;
    list.innerHTML = Object.keys(gradeConfig).map(id => `
        <div class="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-4">
            <div class="flex justify-between items-center">
                <span class="font-bold text-white font-mono uppercase text-xs">${id}</span>
                <button onclick="removeGrade('${id}')" class="text-red-500 text-[10px] font-black">DELETE</button>
            </div>
            <input type="text" value="${gradeConfig[id].name}" onchange="updateGradeProp('${id}','name',this.value)" class="w-full bg-white/5 p-2 rounded text-white text-sm outline-none">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[8px] font-black text-slate-500">LESSONS</label>
                <input type="number" value="${gradeConfig[id].lessons}" onchange="updateGradeProp('${id}','lessons',this.value)" class="w-full bg-white/5 p-2 rounded text-blue-400 text-xs text-center"></div>
                <div><label class="text-[8px] font-black text-emerald-500">COMPLETED</label>
                <input type="number" value="${gradeConfig[id].completed}" onchange="updateGradeProp('${id}','completed',this.value)" class="w-full bg-white/5 p-2 rounded text-emerald-400 text-xs text-center"></div>
            </div>
        </div>`).join('');
};

window.updateDashboardStats = () => {
    const totalEl = document.getElementById('stat-total-students');
    if(totalEl) totalEl.innerText = students.length;
    
    const container = document.getElementById('grade-stats-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];
    container.innerHTML = activeGrades.map(gId => {
        const count = students.filter(s => s.grade === gId).length;
        const name = gradeConfig[gId]?.name || "Grade " + gId.replace(/\D/g,'');
        return `<div class="glass-panel p-6 rounded-3xl border border-white/5 min-w-[160px]"><p class="text-[9px] font-black text-blue-500 uppercase mb-1">${name}</p><h2 class="text-2xl font-black text-white">${count}</h2></div>`;
    }).join('');
};

// --- ACTIONS ---

window.markAttendance = (id) => {
    const s = students.find(x => x.id === id);
    if(s) {
        s.attendance = (s.attendance || 0) + 1;
        syncStudent(s);
        const log = document.getElementById('session-log');
        if(log) log.prepend(`[${new Date().toLocaleTimeString()}] ${s.name} present.\n`);
    }
};

window.updateHW = (sId, i, v) => {
    const s = students.find(x => x.id === sId);
    if(s) { 
        if(!s.homework) s.homework = new Array(30).fill(0);
        s.homework[i] = parseInt(v) || 0; 
        syncStudent(s);
    }
};

window.updateGradeProp = (id, p, v) => { 
    if(!gradeConfig[id]) gradeConfig[id] = { name: "", lessons: 10, completed: 0 };
    gradeConfig[id][p] = p === 'name' ? v : parseInt(v); 
    syncGrade(id, gradeConfig[id]);
};

window.handleCSVImport = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        const rows = e.target.result.split('\n').filter(row => row.trim() !== '').slice(1);
        for (let row of rows) {
            const cols = row.split(',');
            if (cols.length >= 6) {
                const s = {
                    name: cols[0].trim(), 
                    id: cols[1].trim(), 
                    grade: cols[2].trim().toLowerCase(),
                    phone: cols[3].trim(), 
                    fatherEmail: cols[4].trim(), 
                    motherEmail: cols[5].trim(),
                    attendance: 0, 
                    homework: new Array(30).fill(0)
                };
                // syncStudent handles the creation/update in Firestore
                await syncStudent(s);
            }
        }
        alert("Import complete. Data will sync automatically.");
    };
    reader.readAsText(file);
};

window.addNewGrade = () => {
    const id = prompt("Enter Grade ID (e.g., g1):");
    if(!id) return;
    const name = prompt("Enter Display Name (e.g., Grade 1):");
    if(!name) return;
    const data = { name, lessons: 10, completed: 0 };
    syncGrade(id.toLowerCase(), data);
};

window.removeGrade = async (id) => { 
    if(confirm("Delete Grade Level?")) { 
        await db.collection('grades').doc(id).delete();
    } 
};

window.deleteStudent = async (id) => { 
    if(confirm("Delete student?")) { 
        await db.collection('students').doc(id).delete();
    } 
};

window.updateGlobalClasses = (v) => { 
    totalClassesHeld = parseInt(v) || 1; 
    syncGlobal(totalClassesHeld);
};

window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};
