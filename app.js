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

// --- 2. PERSISTENCE ---
const checkAuthStatus = () => {
    if (localStorage.getItem('cts_authorized') === 'true') {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
        initSync();
    }
};

window.checkAuth = () => {
    const p = document.getElementById('admin-pass').value;
    if (p === "Nalanda") {
        localStorage.setItem('cts_authorized', 'true');
        location.reload(); 
    } else { alert("Access Denied."); }
};

window.logout = () => {
    localStorage.removeItem('cts_authorized');
    location.reload();
};

// --- 3. CLOUD ENGINE ---
function initSync() {
    db.collection('students').onSnapshot(s => {
        students = s.docs.map(doc => ({...doc.data(), docId: doc.id}));
        refreshUI();
    });

    db.collection('grades').onSnapshot(s => {
        gradeConfig = {};
        s.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        refreshUI();
    });

    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            const input = document.getElementById('global-classes-input');
            if(input) input.value = totalClassesHeld;
            refreshUI();
        }
    });
}

const refreshUI = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    if(document.getElementById('stat-total-students')) 
        document.getElementById('stat-total-students').innerText = students.length;
};

// --- 4. PIXEL PERFECT RENDERING ---
window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => {
        const g = gradeConfig[s.grade] || { name: s.grade, completed: 0 };
        const attPct = totalClassesHeld > 0 ? Math.min(Math.round((s.attendance / totalClassesHeld) * 100), 100) : 0;
        
        const comp = parseInt(g.completed) || 0;
        const hwValues = s.homework ? s.homework.slice(0, comp) : [];
        const hwSum = hwValues.reduce((a, b) => a + (parseInt(b) || 0), 0);
        const hwAvg = comp > 0 ? Math.round(hwSum / comp) : 0;

        return `
        <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-all group">
            <td class="p-8">
                <div class="font-bold text-white text-base">${s.name}</div>
                <div class="text-[10px] text-slate-500 font-mono tracking-widest">${s.id}</div>
            </td>
            <td class="p-8 text-[11px] uppercase text-blue-400 font-black tracking-widest">${g.name}</td>
            <td class="p-8 text-center font-bold text-white text-lg">${attPct}%</td>
            <td class="p-8 text-center font-bold text-emerald-500 text-lg">${hwAvg}%</td>
            <td class="p-8 text-right space-x-3">
                <button onclick="openStudentModal('${s.id}')" class="text-slate-500 hover:text-blue-400 scale-125 transition-all">✎</button>
                <button onclick="deleteStudent('${s.id}')" class="text-slate-500 hover:text-rose-500 scale-125 transition-all">🗑</button>
            </td>
        </tr>`;
    }).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const distinctGrades = [...new Set(students.map(s => s.grade))];

    container.innerHTML = distinctGrades.map(gId => {
        const sList = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: gId, lessons: 10 };
        return `
            <div class="glass-panel rounded-[2.5rem] overflow-hidden border border-white/5 shadow-xl">
                <div class="p-6 bg-white/5 flex justify-between items-center border-b border-white/5">
                    <span class="font-black text-blue-400 uppercase text-xs tracking-widest">${g.name}</span>
                    <span class="text-slate-500 font-bold text-[10px] uppercase tracking-widest">${g.lessons} Weekly Targets</span>
                </div>
                ${sList.map(s => `
                    <div class="p-6 flex flex-wrap justify-between items-center border-b border-white/5 last:border-0 hover:bg-white/[0.01]">
                        <span class="text-sm font-bold text-white w-48">${s.name}</span>
                        <div class="flex flex-wrap gap-2 flex-1 justify-end">
                            ${Array.from({length: g.lessons || 10}).map((_, i) => `
                                <select onchange="updateHW('${s.id}', ${i}, this.value)" 
                                        class="bg-black/40 border border-white/10 rounded-xl text-[10px] p-2 text-blue-400 outline-none focus:border-blue-500">
                                    <option value="0" ${s.homework?.[i] == 0 ? 'selected' : ''}>Not Done</option>
                                    <option value="25" ${s.homework?.[i] == 25 ? 'selected' : ''}>25% Done</option>
                                    <option value="50" ${s.homework?.[i] == 50 ? 'selected' : ''}>50% Done</option>
                                    <option value="75" ${s.homework?.[i] == 75 ? 'selected' : ''}>75% Done</option>
                                    <option value="100" ${s.homework?.[i] == 100 ? 'selected' : ''}>100% Done</option>
                                </select>
                            `).join('')}
                        </div>
                    </div>`).join('')}
            </div>`;
    }).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    const search = document.getElementById('db-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.phone.includes(search)).map(s => `
        <tr class="border-b border-white/5 hover:bg-white/[0.01]">
            <td class="p-8 font-bold text-white text-xl">${s.name}<br><span class="text-[10px] text-slate-500 font-mono tracking-widest">${s.id}</span></td>
            <td class="p-8 text-blue-400 font-black uppercase text-xs">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-8 text-slate-200 font-mono text-lg font-bold">${s.phone}</td>
            <td class="p-8 text-slate-500 italic text-sm">
                <span class="block">Father: ${s.fatherEmail}</span>
                <span class="block">Mother: ${s.motherEmail}</span>
            </td>
            <td class="p-8 text-right"><button onclick="deleteStudent('${s.id}')" class="text-rose-500/30 hover:text-rose-500 scale-150 transition-all">🗑</button></td>
        </tr>`).join('');
};

window.renderGradeSettings = () => {
    const list = document.getElementById('grade-config-list');
    if (!list) return;
    list.innerHTML = Object.keys(gradeConfig).map(id => `
        <div class="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 space-y-5">
            <div class="flex justify-between items-center"><span class="font-black text-blue-500 text-xs tracking-[0.3em] uppercase">${id}</span><button onclick="removeGrade('${id}')" class="text-rose-500 text-[10px] font-black tracking-widest hover:underline">REMOVE</button></div>
            <input type="text" value="${gradeConfig[id].name}" onchange="updateGradeProp('${id}','name',this.value)" class="w-full bg-white/5 p-4 rounded-2xl text-white font-bold outline-none border border-white/5 focus:border-blue-500">
            <div class="grid grid-cols-2 gap-4">
                <div class="text-center"><label class="text-[9px] font-black text-slate-500 uppercase block mb-2">Lessons</label><input type="number" value="${gradeConfig[id].lessons}" onchange="updateGradeProp('${id}','lessons',this.value)" class="w-full bg-black/40 p-3 rounded-xl text-blue-400 font-black text-center"></div>
                <div class="text-center"><label class="text-[9px] font-black text-emerald-500 uppercase block mb-2">Unlocked</label><input type="number" value="${gradeConfig[id].completed}" onchange="updateGradeProp('${id}','completed',this.value)" class="w-full bg-black/40 p-3 rounded-xl text-emerald-400 font-black text-center"></div>
            </div>
        </div>`).join('');
};

// --- 5. LOGIC & ACTIONS ---
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

// CSV Fix
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
        alert("CSV Data Sync Complete!");
    };
    reader.readAsText(file);
});

// KeyListeners
document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        const input = document.getElementById('attendance-scan-input');
        if(document.activeElement === input) markAttendance(input.value);
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
    const id = prompt("Grade Code:")?.toLowerCase();
    const name = prompt("Display Name:");
    if(id && name) await db.collection('grades').doc(id).set({ name, lessons: 10, completed: 0 });
};
window.deleteStudent = async (id) => { if(confirm("Permanently delete student?")) await db.collection('students').doc(id).delete(); };
window.removeGrade = async (id) => { if(confirm("Delete grade level?")) await db.collection('grades').doc(id).delete(); };
window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};

checkAuthStatus();
