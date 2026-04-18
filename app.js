// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAM5deoGXltOAkYs3OQbL3Q-x-CD68bgxU",
  authDomain: "cts-admin-hub-8c1ec.firebaseapp.com",
  projectId: "cts-admin-hub-8c1ec",
  storageBucket: "cts-admin-hub-8c1ec.firebasestorage.app",
  messagingSenderId: "323202681156",
  appId: "1:323202681156:web:1acf1d6f3a150a48e82f11",
  measurementId: "G-N332B7X0W7"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let students = [];
let totalClassesHeld = 1;
let gradeConfig = {};
let isEditing = false;

// --- 2. AUTH & SYNC ---
const initApp = () => {
    if (localStorage.getItem('cts_login') === 'true') {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
        startSync();
    }
};

window.checkAuth = () => {
    if (document.getElementById('admin-pass').value === "Nalanda") {
        localStorage.setItem('cts_login', 'true');
        location.reload();
    } else alert("Invalid Password");
};

window.logout = () => {
    localStorage.removeItem('cts_login');
    location.reload();
};

function startSync() {
    db.collection('students').onSnapshot(s => {
        students = s.docs.map(doc => ({...doc.data(), docId: doc.id}));
        renderAll();
    });
    db.collection('grades').onSnapshot(s => {
        gradeConfig = {};
        s.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        renderAll();
    });
    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            const inp = document.getElementById('global-classes-input');
            if(inp) inp.value = totalClassesHeld;
            renderAll();
        }
    });
}

const renderAll = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    if(document.getElementById('stat-total-students')) 
        document.getElementById('stat-total-students').innerText = students.length;
};

// --- 3. UI RENDERERS ---
window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => {
        const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
        const attPct = totalClassesHeld > 0 ? Math.min(Math.round((s.attendance / totalClassesHeld) * 100), 100) : 0;
        const comp = parseInt(g.completed) || 0;
        const hwValues = s.homework ? s.homework.slice(0, comp) : [];
        const hwAvg = comp > 0 ? Math.round(hwValues.reduce((a,b)=>a+(parseInt(b)||0), 0) / comp) : 0;

        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-all group">
            <td class="p-10">
                <div class="font-bold text-white text-lg">${s.name}</div>
                <div class="text-[10px] text-slate-500 font-mono tracking-widest">${s.id}</div>
            </td>
            <td class="p-10 text-[11px] uppercase text-blue-400 font-black tracking-widest">${g.name}</td>
            <td class="p-10 text-center font-bold text-white text-xl">${attPct}%</td>
            <td class="p-10 text-center font-bold text-emerald-500 text-xl">${hwAvg}%</td>
            <td class="p-10 text-right space-x-4">
                <button onclick="openStudentModal('${s.id}')" class="text-slate-500 hover:text-blue-400 text-xl transition-all">✎</button>
                <button onclick="deleteStudent('${s.id}')" class="text-slate-500 hover:text-rose-500 text-xl transition-all">🗑</button>
            </td>
        </tr>`;
    }).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const grades = [...new Set(students.map(s => s.grade))];

    container.innerHTML = grades.map(gId => {
        const sList = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: gId, lessons: 10 };
        return `
            <div class="glass-panel rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
                <div class="p-8 bg-white/5 flex justify-between items-center border-b border-white/5">
                    <span class="font-black text-blue-400 uppercase text-xs tracking-[0.2em]">${g.name}</span>
                    <span class="text-slate-500 font-black text-[10px] uppercase tracking-widest">${g.lessons} Lessons Total</span>
                </div>
                ${sList.map(s => `
                    <div class="p-8 flex flex-wrap justify-between items-center border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                        <span class="text-base font-bold text-white w-64">${s.name}</span>
                        <div class="flex flex-wrap gap-2 flex-1 justify-end">
                            ${Array.from({length: g.lessons || 10}).map((_, i) => `
                                <select onchange="updateHW('${s.id}', ${i}, this.value)" 
                                        class="bg-black/40 border border-white/10 rounded-xl text-[10px] p-2 text-blue-400 outline-none">
                                    <option value="0" ${s.homework?.[i] == 0 ? 'selected' : ''}>0</option>
                                    <option value="25" ${s.homework?.[i] == 25 ? 'selected' : ''}>25</option>
                                    <option value="50" ${s.homework?.[i] == 50 ? 'selected' : ''}>50</option>
                                    <option value="75" ${s.homework?.[i] == 75 ? 'selected' : ''}>75</option>
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
        <tr class="border-b border-white/5 hover:bg-white/[0.01]">
            <td class="p-10 font-bold text-white text-2xl">${s.name}<br><span class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">${s.id}</span></td>
            <td class="p-10 text-blue-400 font-black uppercase text-xs">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-10 text-slate-200 font-mono text-xl font-bold">${s.phone}</td>
            <td class="p-10 text-slate-500 italic text-sm">
                F: ${s.fatherEmail}<br>M: ${s.motherEmail}
            </td>
            <td class="p-10 text-right space-x-6">
                <button onclick="downloadReportCard('${s.id}')" class="bg-blue-600/10 text-blue-400 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all">Report Card</button>
                <button onclick="deleteStudent('${s.id}')" class="text-rose-500/20 hover:text-rose-500 text-xl transition-all">🗑</button>
            </td>
        </tr>`).join('');
};

// --- 4. DATA MANAGEMENT & REPORTS ---
window.downloadReportCard = (id) => {
    const s = students.find(x => x.id === id);
    const g = gradeConfig[s.grade] || { name: s.grade, completed: 0, lessons: 10 };
    const attPct = totalClassesHeld > 0 ? Math.min(Math.round((s.attendance / totalClassesHeld) * 100), 100) : 0;
    const comp = parseInt(g.completed) || 0;
    const hwValues = s.homework ? s.homework.slice(0, comp) : [];
    const hwAvg = comp > 0 ? Math.round(hwValues.reduce((a,b)=>a+(parseInt(b)||0), 0) / comp) : 0;

    const report = window.open('', '_blank');
    report.document.write(`
        <html><head><title>Report - ${s.name}</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;800&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Outfit', sans-serif; padding: 60px; color: #0f172a; text-align: center; }
            .border { border: 15px solid #0f172a; padding: 50px; border-radius: 4px; max-width: 800px; margin: auto; position: relative; }
            h1 { font-size: 70px; margin: 0; letter-spacing: -4px; text-transform: uppercase; }
            .name { font-size: 32px; font-weight: 800; margin: 40px 0 10px; text-transform: uppercase; color: #3b82f6; }
            .grade { font-size: 14px; font-weight: 800; color: #64748b; margin-bottom: 50px; letter-spacing: 2px; }
            .stats { display: flex; justify-content: space-around; border-top: 1px solid #eee; padding-top: 50px; }
            .val { font-size: 80px; font-weight: 800; display: block; line-height: 1; }
            .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
            .print { position: fixed; top: 20px; right: 20px; background: #3b82f6; color: white; padding: 15px 30px; border-radius: 50px; cursor: pointer; font-weight: 800; border: none; }
            @media print { .print { display: none; } }
        </style></head>
        <body><button class="print" onclick="window.print()">PRINT REPORT</button><div class="border">
            <p style="font-weight: 800; letter-spacing: 3px; font-size: 12px; color: #94a3b8; margin:0;">OFFICIAL TRANSCRIPT</p>
            <h1>RECORD</h1>
            <div class="name">${s.name}</div>
            <div class="grade">CLASS: ${g.name} | ID: ${s.id}</div>
            <div class="stats">
                <div><span class="val">${attPct}%</span><span class="lbl">Attendance</span></div>
                <div><span class="val">${hwAvg}%</span><span class="lbl">Homework Score</span></div>
            </div>
            <p style="margin-top: 60px; font-size: 11px; color: #cbd5e1;">Generated on ${new Date().toLocaleDateString()} by CTS Cloud Admin Hub</p>
        </div></body></html>
    `);
};

window.downloadFullBackup = () => {
    const backup = { students, gradeConfig, totalClassesHeld, date: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CTS_Cloud_Backup_${new Date().toLocaleDateString()}.json`;
    a.click();
};

window.dangerZoneReset = async () => {
    if (confirm("DANGER: This will delete ALL data. Are you sure?")) {
        const pass = prompt("Type 'DELETE' to confirm:");
        if (pass === "DELETE") {
            const batch = db.batch();
            const sSnap = await db.collection('students').get();
            sSnap.forEach(d => batch.delete(d.ref));
            const gSnap = await db.collection('grades').get();
            gSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            location.reload();
        }
    }
};

// --- 5. LOGIC HELPERS ---
window.updateHW = async (id, i, val) => {
    const s = students.find(x => x.id === id);
    if(s) {
        let hwArr = s.homework || new Array(50).fill(0);
        hwArr[i] = parseInt(val);
        await db.collection('students').doc(id).update({ homework: hwArr });
    }
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

window.updateGlobalClasses = (v) => db.collection('settings').doc('global').set({ totalClassesHeld: parseInt(v) || 1 });

window.saveStudent = async () => {
    const id = document.getElementById('m-id').value.trim();
    if(!id) return;
    const old = students.find(x => x.id === id);
    const payload = {
        id, name: document.getElementById('m-name').value, 
        grade: document.getElementById('m-grade').value.toLowerCase().trim(),
        phone: document.getElementById('m-phone').value,
        fatherEmail: document.getElementById('m-f-email').value,
        motherEmail: document.getElementById('m-m-email').value,
        attendance: isEditing ? (old?.attendance || 0) : 0,
        homework: isEditing ? (old?.homework || new Array(50).fill(0)) : new Array(50).fill(0)
    };
    await db.collection('students').doc(id).set(payload);
    closeStudentModal();
};

document.getElementById('csv-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const rows = ev.target.result.split('\n').slice(1);
        for(let r of rows) {
            const c = r.split(',').map(x => x.trim());
            if(c.length >= 6) {
                await db.collection('students').doc(c[1]).set({
                    name: c[0], id: c[1], grade: c[2].toLowerCase(), phone: c[3], 
                    fatherEmail: c[4], motherEmail: c[5], attendance: 0, homework: new Array(50).fill(0)
                });
            }
        }
        alert("Imported!");
    };
    reader.readAsText(file);
});

document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        const inp = document.getElementById('attendance-scan-input');
        if(document.activeElement === inp) markAttendance(inp.value);
    }
});

window.openStudentModal = (id = null) => {
    document.getElementById('student-modal').classList.replace('hidden', 'flex');
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
        ['m-id', 'm-name', 'm-grade', 'm-phone', 'm-f-email', 'm-m-email'].forEach(f => document.getElementById(f).value = '');
    }
};

window.closeStudentModal = () => document.getElementById('student-modal').classList.replace('flex', 'hidden');
window.updateGradeProp = async (id, p, v) => db.collection('grades').doc(id).update({ [p]: p === 'name' ? v : parseInt(v) });
window.addNewGrade = async () => {
    const id = prompt("ID:")?.toLowerCase();
    const name = prompt("Name:");
    if(id && name) await db.collection('grades').doc(id).set({ name, lessons: 10, completed: 0 });
};
window.deleteStudent = async (id) => { if(confirm("Delete?")) await db.collection('students').doc(id).delete(); };
window.removeGrade = async (id) => { if(confirm("Delete?")) await db.collection('grades').doc(id).delete(); };
window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};

initApp();
