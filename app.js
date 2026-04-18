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

// Global State
let students = [];
let totalClassesHeld = 1;
let gradeConfig = {};
let isEditing = false;

// --- 2. REALTIME DATA SYNC ---
const startRealtimeSync = () => {
    db.collection('students').onSnapshot(snapshot => {
        students = snapshot.docs.map(doc => doc.data());
        refreshAllDataViews();
    }, err => console.error("Sync Error:", err));

    db.collection('grades').onSnapshot(snapshot => {
        gradeConfig = {};
        snapshot.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        refreshAllDataViews();
    });

    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            refreshAllDataViews();
        }
    });
};

const syncStudent = (s) => db.collection('students').doc(s.id).set(s);
const syncGrade = (id, data) => db.collection('grades').doc(id).set(data);
const syncGlobal = (val) => db.collection('settings').doc('global').set({ totalClassesHeld: val });

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

// --- 4. STUDENT MODAL (ADD / EDIT) ---
window.openStudentModal = (studentId = null) => {
    const modal = document.getElementById('student-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (studentId) {
        isEditing = true;
        document.getElementById('modal-title').innerHTML = 'EDIT <span class="text-blue-500">STUDENT</span>';
        const s = students.find(x => x.id === studentId);
        document.getElementById('m-id').value = s.id;
        document.getElementById('m-id').disabled = true; 
        document.getElementById('m-name').value = s.name;
        document.getElementById('m-grade').value = s.grade;
        document.getElementById('m-phone').value = s.phone;
        document.getElementById('m-f-email').value = s.fatherEmail;
        document.getElementById('m-m-email').value = s.motherEmail;
    } else {
        isEditing = false;
        document.getElementById('modal-title').innerHTML = 'ADD <span class="text-blue-500">STUDENT</span>';
        document.getElementById('m-id').disabled = false;
        ['m-id', 'm-name', 'm-grade', 'm-phone', 'm-f-email', 'm-m-email'].forEach(id => {
            document.getElementById(id).value = '';
        });
    }
};

window.closeStudentModal = () => {
    document.getElementById('student-modal').classList.add('hidden');
    document.getElementById('student-modal').classList.remove('flex');
};

window.saveStudent = async () => {
    const id = document.getElementById('m-id').value.trim();
    if (!id) return alert("Student ID is required!");

    const existingStudent = students.find(x => x.id === id);
    const s = {
        id: id,
        name: document.getElementById('m-name').value.trim(),
        grade: document.getElementById('m-grade').value.trim().toLowerCase(),
        phone: document.getElementById('m-phone').value.trim(),
        fatherEmail: document.getElementById('m-f-email').value.trim(),
        motherEmail: document.getElementById('m-m-email').value.trim(),
        attendance: isEditing ? (existingStudent?.attendance || 0) : 0,
        homework: isEditing ? (existingStudent?.homework || new Array(30).fill(0)) : new Array(30).fill(0)
    };

    await syncStudent(s);
    closeStudentModal();
};

// --- 5. DATA RENDERING ---
const refreshAllDataViews = () => {
    renderStudentTable();
    renderDatabaseTable();
    renderGradeSettings();
    renderHomework();
    renderAttendanceTab(); // New: Dedicated attendance view renderer
    updateDashboardStats();
    if(document.getElementById('global-classes-input')) 
        document.getElementById('global-classes-input').value = totalClassesHeld;
};

// Roster Table (Attendance button removed here)
window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const search = document.getElementById('roster-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => {
        const g = gradeConfig[s.grade.toLowerCase()] || { name: "Grade " + s.grade.replace(/\D/g,''), completed: 0 };
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
            <td class="p-6 text-right space-x-2">
                <button onclick="openStudentModal('${s.id}')" class="levitate p-2 hover:text-blue-500">✎</button>
                <button onclick="deleteStudent('${s.id}')" class="levitate p-2 hover:text-red-500">🗑</button>
            </td>
        </tr>`;
    }).join('');
};

// Attendance Tab Logic (Assuming you have an element to hold this)
window.renderAttendanceTab = () => {
    const container = document.getElementById('attendance-list-container');
    if (!container) return;
    
    // Sort students by grade then name
    const sorted = [...students].sort((a,b) => a.grade.localeCompare(b.grade) || a.name.localeCompare(b.name));
    
    container.innerHTML = sorted.map(s => `
        <div class="glass-panel p-4 mb-2 rounded-2xl flex justify-between items-center border border-white/5">
            <div>
                <div class="text-white font-bold">${s.name}</div>
                <div class="text-[10px] text-blue-400 font-black uppercase">${gradeConfig[s.grade]?.name || s.grade}</div>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-xs font-mono text-slate-500">TOTAL: ${s.attendance || 0}</span>
                <button onclick="markAttendance('${s.id}')" class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all">MARK PRESENT</button>
            </div>
        </div>
    `).join('');
};

window.renderDatabaseTable = () => {
    const tbody = document.getElementById('database-list-body');
    const search = document.getElementById('db-search')?.value.toLowerCase() || "";
    if (!tbody) return;

    tbody.innerHTML = students.filter(s => s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)).map(s => `
        <tr class="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
            <td class="p-6 font-bold text-white">${s.name}<br><span class="text-[10px] text-slate-500 font-mono">${s.id}</span></td>
            <td class="p-6 text-blue-400 font-black">${(gradeConfig[s.grade]?.name || s.grade)}</td>
            <td class="p-6">${s.phone}</td>
            <td class="p-6 text-slate-400">${s.fatherEmail}</td>
            <td class="p-6 text-slate-400">${s.motherEmail}</td>
            <td class="p-6 text-right space-x-2">
                <button onclick="openStudentModal('${s.id}')" class="levitate hover:text-blue-500">✎ Edit</button>
                <button onclick="deleteStudent('${s.id}')" class="levitate hover:text-red-500">🗑</button>
            </td>
        </tr>`).join('');
};

window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];
    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: "Grade " + gId, lessons: 10 };
        const rows = list.map(s => `
            <div class="p-4 flex justify-between items-center border-b border-white/5">
                <span class="text-sm font-bold text-white">${s.name}</span>
                <div class="flex gap-1 overflow-x-auto max-w-[60%]">
                    ${Array.from({length: g.lessons || 10}).map((_, i) => `
                        <input type="number" value="${s.homework?.[i] || 0}" class="hw-percent-input w-10 flex-shrink-0" onchange="updateHW('${s.id}', ${i}, this.value)">
                    `).join('')}
                </div>
            </div>`).join('');
        return `<div class="glass-panel rounded-3xl overflow-hidden mb-4"><div class="p-4 bg-white/5 font-black uppercase text-[10px] text-blue-400">${g.name}</div>${rows}</div>`;
    }).join('');
};

window.renderGradeSettings = () => {
    const list = document.getElementById('grade-config-list');
    if (!list) return;
    list.innerHTML = Object.keys(gradeConfig).map(id => `
        <div class="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-4">
            <div class="flex justify-between items-center"><span class="font-bold text-white font-mono uppercase text-xs">${id}</span><button onclick="removeGrade('${id}')" class="text-red-500 text-[10px] font-black">DELETE</button></div>
            <input type="text" value="${gradeConfig[id].name}" onchange="updateGradeProp('${id}','name',this.value)" class="w-full bg-white/5 p-2 rounded text-white text-sm outline-none">
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-[8px] font-black text-slate-500 uppercase">Lessons</label><input type="number" value="${gradeConfig[id].lessons}" onchange="updateGradeProp('${id}','lessons',this.value)" class="w-full bg-white/5 p-2 rounded text-blue-400 text-xs text-center"></div>
                <div><label class="text-[8px] font-black text-emerald-500 uppercase">Completed</label><input type="number" value="${gradeConfig[id].completed}" onchange="updateGradeProp('${id}','completed',this.value)" class="w-full bg-white/5 p-2 rounded text-emerald-400 text-xs text-center"></div>
            </div>
        </div>`).join('');
};

window.updateDashboardStats = () => {
    if(document.getElementById('stat-total-students')) document.getElementById('stat-total-students').innerText = students.length;
};

// --- 6. ACTIONS ---
window.markAttendance = async (id) => {
    const s = students.find(x => x.id === id);
    if(s) {
        s.attendance = (s.attendance || 0) + 1;
        await syncStudent(s);
        if(document.getElementById('session-log')) document.getElementById('session-log').prepend(`[${new Date().toLocaleTimeString()}] ${s.name} present.\n`);
    }
};

window.updateHW = async (sId, i, v) => {
    const s = students.find(x => x.id === sId);
    if(s) { 
        if(!s.homework) s.homework = new Array(30).fill(0);
        s.homework[i] = parseInt(v) || 0; 
        await syncStudent(s);
    }
};

window.updateGradeProp = async (id, p, v) => { 
    if(!gradeConfig[id]) gradeConfig[id] = { name: "", lessons: 10, completed: 0 };
    gradeConfig[id][p] = p === 'name' ? v : parseInt(v); 
    await syncGrade(id, gradeConfig[id]);
};

window.handleCSVImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const rows = e.target.result.split('\n').map(r => r.trim()).filter(r => r.length > 0).slice(1);
        for (let row of rows) {
            const cols = row.split(',').map(c => c.trim());
            if (cols.length >= 6) {
                await syncStudent({
                    name: cols[0], id: cols[1], grade: cols[2].toLowerCase(),
                    phone: cols[3], fatherEmail: cols[4], motherEmail: cols[5],
                    attendance: 0, homework: new Array(30).fill(0)
                });
            }
        }
        alert("Import complete!");
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.deleteStudent = async (id) => { 
    if(confirm("Permanently delete student?")) await db.collection('students').doc(id).delete();
};

window.updateGlobalClasses = (v) => syncGlobal(parseInt(v) || 1);
