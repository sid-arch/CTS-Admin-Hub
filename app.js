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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Global State
let students = [];
let totalClassesHeld = 1;
let gradeConfig = {};
let isEditing = false;

// --- 2. REALTIME DATA SYNC ---
const startRealtimeSync = () => {
    // Listen for Students
    db.collection('students').onSnapshot(snapshot => {
        students = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        refreshAllDataViews();
    });

    // Listen for Grades
    db.collection('grades').onSnapshot(snapshot => {
        gradeConfig = {};
        snapshot.forEach(doc => { 
            gradeConfig[doc.id] = doc.data(); 
        });
        refreshAllDataViews(); // Critical: Refresh UI when grade is added
    });

    // Listen for Settings
    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            refreshAllDataViews();
        }
    });
};

// --- 3. AUTH & NAVIGATION ---
window.checkAuth = async () => {
    const passInput = document.getElementById('admin-pass');
    if (passInput && passInput.value === "Nalanda") {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
        startRealtimeSync(); 
    } else { alert("Invalid Password"); }
};

window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};

// --- 4. RENDERERS (THE PIXEL PERFECT UI) ---
const refreshAllDataViews = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    if(document.getElementById('stat-total-students')) document.getElementById('stat-total-students').innerText = students.length;
    if(document.getElementById('global-classes-input')) document.getElementById('global-classes-input').value = totalClassesHeld;
};

window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    if (!tbody) return;
    tbody.innerHTML = students.map(s => {
        const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
        const attPct = totalClassesHeld > 0 ? ((s.attendance / totalClassesHeld) * 100).toFixed(0) : 0;
        const comp = parseInt(g.completed) || 0;
        const hwSum = s.homework ? s.homework.slice(0, comp).reduce((a, b) => a + (parseInt(b) || 0), 0) : 0;
        
        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td class="p-8"><div class="font-bold text-white text-lg">${s.name}</div><div class="text-[10px] text-slate-500 font-mono uppercase tracking-widest">${s.id}</div></td>
            <td class="p-8 text-xs uppercase text-blue-400 font-black tracking-widest">${g.name}</td>
            <td class="p-8 text-center font-bold text-white text-xl">${attPct}%</td>
            <td class="p-8 text-center font-bold text-emerald-500 text-xl">${comp > 0 ? (hwSum/comp).toFixed(0) : 0}%</td>
            <td class="p-8 text-right space-x-4">
                <button onclick="openStudentModal('${s.id}')" class="text-slate-500 hover:text-blue-400 text-xl transition-all">✎</button>
            </td>
        </tr>`;
    }).join('');
};

window.renderGradeSettings = () => {
    const list = document.getElementById('grade-config-list');
    if (!list) return;
    const ids = Object.keys(gradeConfig);
    
    if (ids.length === 0) {
        list.innerHTML = `<div class="col-span-2 text-center p-12 border-2 border-dashed border-white/5 rounded-3xl text-slate-600 font-bold uppercase text-[10px] tracking-[0.3em]">No Grades Configured</div>`;
        return;
    }

    list.innerHTML = ids.map(id => `
        <div class="glass-panel p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            <div class="flex justify-between items-center">
                <span class="font-black text-blue-500 font-mono uppercase text-[10px] tracking-widest">${id}</span>
                <button onclick="removeGrade('${id}')" class="text-rose-500 hover:bg-rose-500/10 px-3 py-1 rounded-lg text-[10px] font-black transition-all">DELETE</button>
            </div>
            <input type="text" value="${gradeConfig[id].name}" onchange="updateGradeProp('${id}','name',this.value)" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white text-sm outline-none focus:border-blue-500">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[9px] font-black text-slate-500 uppercase block mb-2">Lessons</label><input type="number" value="${gradeConfig[id].lessons}" onchange="updateGradeProp('${id}','lessons',this.value)" class="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-blue-400 text-xs text-center font-bold"></div>
                <div><label class="text-[9px] font-black text-emerald-500 uppercase block mb-2">Current</label><input type="number" value="${gradeConfig[id].completed}" onchange="updateGradeProp('${id}','completed',this.value)" class="w-full bg-black/40 border border-white/10 p-3 rounded-xl text-emerald-400 text-xs text-center font-bold"></div>
            </div>
        </div>`).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = Object.keys(gradeConfig);
    
    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId];
        if (list.length === 0) return '';
        
        return `
        <div class="glass-panel rounded-[3rem] overflow-hidden mb-10 border border-white/5">
            <div class="p-6 bg-white/5 flex justify-between items-center border-b border-white/5">
                <span class="font-black text-blue-400 uppercase text-xs tracking-widest">${g.name}</span>
                <span class="text-slate-500 font-black text-[9px] uppercase tracking-widest">${g.lessons} Lessons Total</span>
            </div>
            ${list.map(s => `
                <div class="p-6 flex justify-between items-center border-b border-white/5 last:border-0">
                    <span class="text-sm font-bold text-white w-48">${s.name}</span>
                    <div class="flex gap-2 overflow-x-auto pb-2">
                        ${Array.from({length: g.lessons}).map((_, i) => `
                            <select onchange="updateHW('${s.id}', ${i}, this.value)" class="bg-black/40 border border-white/10 rounded-lg text-[9px] p-2 text-blue-400 outline-none">
                                <option value="0" ${s.homework?.[i] == 0 ? 'selected' : ''}>0</option>
                                <option value="100" ${s.homework?.[i] == 100 ? 'selected' : ''}>100</option>
                            </select>
                        `).join('')}
                    </div>
                </div>`).join('')}
        </div>`;
    }).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    if (!tbody) return;
    tbody.innerHTML = students.map(s => `
        <tr class="border-b border-white/5 text-sm hover:bg-white/[0.01] transition-colors">
            <td class="p-8 font-bold text-white text-lg">${s.name}<br><span class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">${s.id}</span></td>
            <td class="p-8 text-blue-400 font-black uppercase text-xs tracking-widest">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-8 text-slate-300 font-mono text-lg">${s.phone}</td>
            <td class="p-8 text-right space-x-4">
                <button onclick="downloadReportCard('${s.id}')" class="bg-blue-600/10 text-blue-400 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Report</button>
                <button onclick="deleteStudent('${s.id}')" class="text-rose-500/30 hover:text-rose-500 text-xl transition-all">🗑</button>
            </td>
        </tr>`).join('');
};

// --- 5. ACTIONS & DATA MANAGEMENT ---
window.addNewGrade = async () => {
    const rawId = prompt("Enter Grade ID (e.g., g1a) - NO SPACES:");
    if (!rawId) return;
    const id = rawId.trim().toLowerCase().replace(/\s+/g, '');
    const name = prompt("Enter Display Name (e.g., Grade 1 A):");
    if (!name) return;
    await db.collection('grades').doc(id).set({ name, lessons: 10, completed: 0 });
};

window.downloadReportCard = (id) => {
    const s = students.find(x => x.id === id);
    const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
    const attPct = totalClassesHeld > 0 ? ((s.attendance / totalClassesHeld) * 100).toFixed(0) : 0;
    
    const report = window.open('', '_blank');
    report.document.write(`
        <html><head><title>Report - ${s.name}</title>
        <style>
            body { font-family: sans-serif; padding: 50px; text-align: center; color: #1e293b; }
            .card { border: 10px solid #1e293b; padding: 40px; border-radius: 10px; max-width: 600px; margin: auto; }
            h1 { font-size: 50px; margin-bottom: 10px; }
            .stats { display: flex; justify-content: space-around; margin-top: 40px; }
            .val { font-size: 40px; font-weight: bold; color: #3b82f6; }
        </style></head>
        <body><div class="card">
            <p>OFFICIAL STUDENT RECORD</p>
            <h1>${s.name}</h1>
            <p>ID: ${s.id} | Grade: ${g.name}</p>
            <div class="stats">
                <div><div class="val">${attPct}%</div><div>Attendance</div></div>
                <div><div class="val">${s.attendance}</div><div>Total Present</div></div>
            </div>
            <button onclick="window.print()" style="margin-top:40px; padding:10px 20px; cursor:pointer;">Print Report Card</button>
        </div></body></html>
    `);
};

window.downloadFullBackup = () => {
    const data = { students, gradeConfig, totalClassesHeld, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CTS_HUB_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.dangerZoneReset = async () => {
    if (confirm("DANGER: This will wipe EVERYTHING in the cloud. Continue?")) {
        const pass = prompt("Type 'DELETE' to confirm:");
        if (pass === "DELETE") {
            const sSnap = await db.collection('students').get();
            const gSnap = await db.collection('grades').get();
            const batch = db.batch();
            sSnap.forEach(doc => batch.delete(doc.ref));
            gSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            location.reload();
        }
    }
};

window.updateGradeProp = async (id, p, v) => db.collection('grades').doc(id).update({ [p]: p === 'name' ? v : parseInt(v) });
window.removeGrade = async (id) => { if(confirm("Delete Grade Level?")) await db.collection('grades').doc(id).delete(); };
window.updateGlobalClasses = (v) => db.collection('settings').doc('global').set({ totalClassesHeld: parseInt(v) || 1 });
window.updateHW = async (sId, i, v) => {
    const s = students.find(x => x.id === sId);
    if(s) {
        let hwArr = s.homework || new Array(50).fill(0);
        hwArr[i] = parseInt(v);
        await db.collection('students').doc(sId).update({ homework: hwArr });
    }
};

// --- 6. MODAL & ATTENDANCE ---
window.openStudentModal = (id = null) => {
    const modal = document.getElementById('student-modal');
    modal.classList.replace('hidden', 'flex');
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
        ['m-id', 'm-name', 'm-grade', 'm-phone', 'm-f-email', 'm-m-email'].forEach(fid => document.getElementById(fid).value = '');
    }
};

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
    await db.collection('students').doc(id).set(s);
    document.getElementById('student-modal').classList.replace('flex', 'hidden');
};

window.markAttendance = async (barcode) => {
    const s = students.find(x => x.id.toLowerCase() === barcode.toLowerCase().trim());
    if(s) {
        await db.collection('students').doc(s.id).update({ attendance: (s.attendance || 0) + 1 });
        const log = document.getElementById('session-log');
        log.value = `[${new Date().toLocaleTimeString()}] CHECK-IN: ${s.name}\n` + log.value;
    }
    document.getElementById('attendance-scan-input').value = '';
};

document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        const scanner = document.getElementById('attendance-scan-input');
        if(document.activeElement === scanner) markAttendance(scanner.value);
    }
});
