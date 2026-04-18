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

let students = [];
let totalClassesHeld = 1;
let gradeConfig = {};

// --- 2. PERSISTENT AUTH ---
window.checkAuth = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Nalanda") {
        localStorage.setItem('cts_auth', 'true');
        showDashboard();
    } else { alert("Wrong Password"); }
};

const showDashboard = () => {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard').classList.remove('hidden');
    startRealtimeSync();
};

// Check if already logged in on reload
if (localStorage.getItem('cts_auth') === 'true') {
    showDashboard();
}

window.logout = () => {
    localStorage.removeItem('cts_auth');
    location.reload();
};

// --- 3. REALTIME SYNC ---
function startRealtimeSync() {
    db.collection('students').onSnapshot(snap => {
        students = snap.docs.map(doc => ({...doc.data(), id: doc.id}));
        renderAll();
    });

    db.collection('grades').onSnapshot(snap => {
        gradeConfig = {};
        snap.forEach(doc => { gradeConfig[doc.id] = doc.data(); });
        renderAll();
    });

    db.collection('settings').doc('global').onSnapshot(doc => {
        if (doc.exists()) {
            totalClassesHeld = doc.data().totalClassesHeld || 1;
            const input = document.getElementById('global-classes-input');
            if(input) input.value = totalClassesHeld;
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

// --- 4. RENDERERS (FIXED SCROLLBARS) ---
window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    if (!container) return;
    const activeGrades = [...new Set(students.map(s => s.grade))];

    container.innerHTML = activeGrades.map(gId => {
        const list = students.filter(s => s.grade === gId);
        const g = gradeConfig[gId] || { name: gId, lessons: 10 };
        return `
            <div class="glass-panel rounded-3xl overflow-hidden mb-6 border border-white/5">
                <div class="p-4 bg-white/5 font-black uppercase text-[10px] text-blue-400 flex justify-between">
                    <span>${g.name}</span>
                    <span class="text-slate-500">${g.lessons} Lessons</span>
                </div>
                ${list.map(s => `
                    <div class="p-4 flex flex-wrap justify-between items-center border-b border-white/5 gap-4">
                        <span class="text-xs font-bold text-white w-32">${s.name}</span>
                        <div class="flex flex-wrap gap-2 flex-1">
                            ${Array.from({length: g.lessons || 10}).map((_, i) => `
                                <select onchange="updateHW('${s.id}', ${i}, this.value)" 
                                        class="bg-black/40 border border-white/10 rounded text-[10px] p-1 text-blue-400 outline-none">
                                    <option value="0" ${s.homework?.[i] == 0 ? 'selected' : ''}>0%</option>
                                    <option value="25" ${s.homework?.[i] == 25 ? 'selected' : ''}>25%</option>
                                    <option value="50" ${s.homework?.[i] == 50 ? 'selected' : ''}>50%</option>
                                    <option value="75" ${s.homework?.[i] == 75 ? 'selected' : ''}>75%</option>
                                    <option value="100" ${s.homework?.[i] == 100 ? 'selected' : ''}>100%</option>
                                </select>
                            `).join('')}
                        </div>
                    </div>`).join('')}
            </div>`;
    }).join('');
};

window.updateHW = async (sId, index, value) => {
    const s = students.find(x => x.id === sId);
    if(s) {
        let hw = s.homework || [];
        hw[index] = parseInt(value);
        await db.collection('students').doc(sId).update({ homework: hw });
    }
};

window.updateGlobalClasses = (v) => db.collection('settings').doc('global').set({ totalClassesHeld: parseInt(v) || 1 });

window.saveStudent = async () => {
    const id = document.getElementById('m-id').value.trim();
    if(!id) return;
    const old = students.find(x => x.id === id);
    const data = {
        id, name: document.getElementById('m-name').value, 
        grade: document.getElementById('m-grade').value.toLowerCase().trim(),
        phone: document.getElementById('m-phone').value,
        fatherEmail: document.getElementById('m-f-email').value,
        motherEmail: document.getElementById('m-m-email').value,
        attendance: isEditing ? (old?.attendance || 0) : 0,
        homework: isEditing ? (old?.homework || new Array(50).fill(0)) : new Array(50).fill(0)
    };
    await db.collection('students').doc(id).set(data);
    closeStudentModal();
};

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
        ['m-id', 'm-name', 'm-grade', 'm-phone', 'm-f-email', 'm-m-email'].forEach(i => document.getElementById(i).value = '');
    }
};

window.closeStudentModal = () => document.getElementById('student-modal').classList.replace('flex', 'hidden');

window.updateGradeProp = async (id, prop, val) => {
    await db.collection('grades').doc(id).update({ [prop]: prop === 'name' ? val : parseInt(val) });
};

window.addNewGrade = async () => {
    const id = prompt("Grade ID (e.g. g1):")?.trim().toLowerCase();
    const name = prompt("Display Name:");
    if(id && name) await db.collection('grades').doc(id).set({ name, lessons: 10, completed: 0 });
};

window.deleteStudent = async (id) => { if(confirm("Delete student?")) await db.collection('students').doc(id).delete(); };
window.removeGrade = async (id) => { if(confirm("Delete grade?")) await db.collection('grades').doc(id).delete(); };

window.switchTab = (tab, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    document.getElementById(`tab-${tab}`).classList.add('active-tab');
    if(el) el.classList.add('active-link');
};

window.handleCSVImport = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = event.target.result.split('\n').slice(1);
        for(let r of rows) {
            const c = r.split(',').map(x => x.trim());
            if(c.length >= 6) await db.collection('students').doc(c[1]).set({
                name: c[0], id: c[1], grade: c[2].toLowerCase(), phone: c[3], 
                fatherEmail: c[4], motherEmail: c[5], attendance: 0, homework: new Array(50).fill(0)
            });
        }
        alert("Imported!");
    };
    reader.readAsText(file);
};

// Barcode Scan Event
document.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        const input = document.getElementById('attendance-scan-input');
        if(document.activeElement === input) markAttendance(input.value);
    }
});

checkSession();
