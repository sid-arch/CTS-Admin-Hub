// --- 1. DATA INITIALIZATION ---
let students = JSON.parse(localStorage.getItem('tamilSchoolDB')) || [];
let totalClassesHeld = parseInt(localStorage.getItem('totalClassesHeld')) || 1;
let gradeConfig = JSON.parse(localStorage.getItem('gradeConfig')) || {
    "g1": { name: "Grade 1", lessons: 10, completed: 0, next: null }
};

// Global Save Function
const save = () => {
    localStorage.setItem('tamilSchoolDB', JSON.stringify(students));
    localStorage.setItem('totalClassesHeld', totalClassesHeld.toString());
    localStorage.setItem('gradeConfig', JSON.stringify(gradeConfig));
};

// --- 2. AUTHENTICATION ---
window.checkAuth = () => {
    const passInput = document.getElementById('admin-pass');
    if (passInput.value === "CTS-King") {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').classList.remove('hidden');
        // Initial build of all UI elements
        refreshAllDataViews();
        refreshGradeDropdowns();
    } else {
        alert("Access Denied: Incorrect Password");
        passInput.value = '';
    }
};

// Allow Enter Key to Login
document.getElementById('admin-pass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkAuth();
});

// --- 3. REFRESH & TAB LOGIC ---
// This function ensures all tabs (HW, Exams, Students, Settings) are updated
const refreshAllDataViews = () => {
    try {
        renderStudentTable();
        renderHomework();
        renderExams();
        renderReportsPage();
        updateFilterDropdowns();
        renderGradeSettings(); // This fixes the blank settings tab
        
        const globalInput = document.getElementById('global-classes-input');
        if (globalInput) globalInput.value = totalClassesHeld;
    } catch (err) {
        console.error("Critical Refresh Error:", err);
    }
};

window.switchTab = (tabName, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active-link'));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add('active-tab');
        if (el) el.classList.add('active-link');
    }

    if (tabName === 'attendance') {
        setTimeout(() => document.getElementById('manual-att-search').focus(), 150);
    }
    
    refreshAllDataViews();
};

// --- 4. ATTENDANCE & SCANNER ---
window.handleScannerKey = (e) => {
    if (e.key === 'Enter') {
        markPresent(e.target.value);
        e.target.value = ''; // Clear for next scan
    }
};

window.markPresent = (id) => {
    const s = students.find(x => x.id === id.trim());
    if (s) {
        s.attendance++;
        save();
        logActivity(s.name, false);
        renderStudentTable();
    } else {
        logActivity(`Unknown ID: ${id}`, true);
    }
};

function logActivity(msg, err) {
    const log = document.getElementById('session-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = `p-3 rounded-xl ${err ? 'bg-red-500/10 border-red-500' : 'bg-white/5 border-blue-500'} border-l-4 flex justify-between items-center text-xs`;
    div.innerHTML = `<span>${msg}</span><span class="text-slate-500">${new Date().toLocaleTimeString()}</span>`;
    log.prepend(div);
    if (log.children.length > 10) log.removeChild(log.lastChild);
}

// --- 5. STUDENT MANAGEMENT ---
document.getElementById('student-form').onsubmit = function(e) {
    e.preventDefault();
    const gId = document.getElementById('reg-grade').value;
    const studentId = document.getElementById('reg-id').value.trim();
    
    // Prevent duplicate IDs
    if (students.find(s => s.id === studentId)) {
        alert("This ID is already registered.");
        return;
    }

    students.push({
        id: studentId,
        name: document.getElementById('reg-name').value.trim(),
        grade: gId,
        attendance: 0,
        homework: new Array(parseInt(gradeConfig[gId].lessons || 10)).fill(0),
        exams: [0, 0, 0]
    });

    save();
    this.reset();
    refreshAllDataViews(); // Updates HW and Exam tabs immediately
};

window.renderStudentTable = () => {
    const tbody = document.getElementById('student-list-body');
    const filter = document.getElementById('filter-students')?.value || 'all';
    if (!tbody) return;

    const filtered = filter === 'all' ? students : students.filter(s => s.grade === filter);

    tbody.innerHTML = filtered.map(s => {
        const g = gradeConfig[s.grade] || { name: '?', completed: 0 };
        const attPct = totalClassesHeld > 0 ? ((s.attendance / totalClassesHeld) * 100).toFixed(0) : 0;
        const comp = parseInt(g.completed) || 0;
        const hwAvg = comp > 0 ? (s.homework.slice(0, comp).reduce((a,b)=>a+(parseInt(b)||0),0) / comp).toFixed(0) : 0;
        const exAvg = (s.exams.reduce((a,b)=>a+(parseInt(b)||0),0)/3).toFixed(0);
        const color = (v) => v >= 90 ? 'text-emerald-500' : (v >= 75 ? 'text-amber-500' : 'text-red-500');

        return `<tr class="hover:bg-white/[0.02] border-b border-white/5">
            <td class="p-6"><p class="text-white font-bold">${s.name}</p><p class="text-[9px] font-mono text-slate-500">${s.id}</p></td>
            <td class="p-6 text-blue-400 font-black text-xs uppercase">${g.name}</td>
            <td class="p-6 text-center"><span class="${color(attPct)} font-black">${attPct}%</span></td>
            <td class="p-6 text-center"><span class="${color(hwAvg)} font-black">${hwAvg}%</span></td>
            <td class="p-6 text-center"><span class="${color(exAvg)} font-black">${exAvg}%</span></td>
            <td class="p-6 text-right"><button onclick="deleteStudent('${s.id}')" class="text-slate-600 hover:text-red-500">🗑</button></td>
        </tr>`;
    }).join('');
};

// --- 6. HOMEWORK & EXAMS (BATCH VIEWS) ---
window.renderHomework = () => {
    const container = document.getElementById('hw-grade-container');
    const filter = document.getElementById('filter-hw')?.value || 'all';
    if (!container) return;
    container.innerHTML = '';
    
    Object.keys(gradeConfig).forEach(gId => {
        if (filter !== 'all' && filter !== gId) return;
        const list = students.filter(s => s.grade === gId);
        if (!list.length) return;

        let rows = list.map(s => {
            const sIdx = students.indexOf(s);
            let inputs = s.homework.map((v, h) => `
                <div class="flex flex-col items-center gap-1">
                    <input type="number" value="${v}" onchange="updateHW(${sIdx}, ${h}, this.value)" class="hw-percent-input w-12 text-xs">
                    <span class="text-[7px] font-bold text-slate-600">L${h+1}</span>
                </div>`).join('');
            return `<div class="p-6 border-b border-white/5 flex justify-between items-center"><span class="text-white font-bold text-sm w-48">${s.name}</span><div class="flex flex-wrap gap-4">${inputs}</div></div>`;
        }).join('');

        container.innerHTML += `<div class="glass-panel rounded-2xl border border-white/5 mb-6">
            <div class="bg-white/5 p-4 text-[10px] font-black uppercase text-slate-500">${gradeConfig[gId].name}</div>
            ${rows}</div>`;
    });
};

window.renderExams = () => {
    const container = document.getElementById('exam-grade-container');
    const filter = document.getElementById('filter-exams')?.value || 'all';
    if (!container) return;
    container.innerHTML = '';
    Object.keys(gradeConfig).forEach(gId => {
        if (filter !== 'all' && filter !== gId) return;
        const list = students.filter(s => s.grade == gId);
        if (!list.length) return;
        let rows = list.map(s => {
            const sIdx = students.indexOf(s);
            let inputs = s.exams.map((v, e) => `<div class="flex flex-col items-center mx-2"><span class="text-[7px] text-slate-600 font-bold uppercase">TERM ${e+1}</span><input type="number" value="${v}" onchange="updateExam(${sIdx}, ${e}, this.value)" class="exam-input w-16 text-sm"></div>`).join('');
            return `<div class="p-6 border-b border-white/5 flex justify-between items-center"><span class="text-white font-bold text-sm w-48">${s.name}</span><div class="flex">${inputs}</div></div>`;
        }).join('');
        container.innerHTML += `<div class="glass-panel rounded-2xl border border-white/5 mb-6"><div class="bg-white/5 p-4 text-[10px] font-black uppercase text-slate-500">${gradeConfig[gId].name}</div>${rows}</div>`;
    });
};

// --- 7. SETTINGS & MAINTENANCE ---
window.renderGradeSettings = () => {
    const container = document.getElementById('grade-config-list');
    if (!container) return;
    container.innerHTML = '';
    
    Object.keys(gradeConfig).forEach(id => {
        const g = gradeConfig[id];
        container.innerHTML += `
            <div class="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-3">
                <div class="flex justify-between items-center">
                    <input type="text" value="${g.name}" onchange="updateGradeProperty('${id}', 'name', this.value)" class="bg-transparent text-white font-bold outline-none border-b border-white/10">
                    <button onclick="removeGrade('${id}')" class="text-red-500 text-[9px] font-black uppercase">Delete</button>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col"><span class="text-[8px] font-black text-slate-500">TOTAL LESSONS</span><input type="number" value="${g.lessons}" onchange="updateGradeProperty('${id}', 'lessons', this.value)" class="bg-white/5 p-2 text-xs text-blue-400"></div>
                    <div class="flex flex-col"><span class="text-[8px] font-black text-emerald-500">COMPLETED</span><input type="number" value="${g.completed||0}" onchange="updateGradeProperty('${id}', 'completed', this.value)" class="bg-white/5 p-2 text-xs text-emerald-400"></div>
                </div>
            </div>`;
    });
};

window.fullSystemClear = () => {
    if (confirm("⚠️ PERMANENT ACTION: Delete all student data and settings?")) {
        if (confirm("FINAL WARNING: This cannot be undone. Proceed?")) {
            localStorage.clear();
            alert("System Purged. Restarting...");
            location.reload();
        }
    }
};

// --- 8. HELPER FUNCTIONS ---
window.updateGradeProperty = (id, prop, val) => { gradeConfig[id][prop] = val; save(); refreshAllDataViews(); };
window.updateHW = (sIdx, hIdx, val) => { students[sIdx].homework[hIdx] = parseInt(val)||0; save(); renderStudentTable(); };
window.updateExam = (sIdx, eIdx, val) => { students[sIdx].exams[eIdx] = parseInt(val)||0; save(); renderStudentTable(); };
window.updateGlobalClasses = (v) => { totalClassesHeld = parseInt(v)||1; save(); renderStudentTable(); };
window.addNewGrade = () => { const id = 'g'+Date.now(); gradeConfig[id] = {name:"New Level", lessons:10, completed:0}; save(); refreshAllDataViews(); refreshGradeDropdowns(); };
window.removeGrade = (id) => { if(confirm("Delete grade?")) { delete gradeConfig[id]; save(); refreshAllDataViews(); refreshGradeDropdowns(); } };
window.deleteStudent = (id) => { if(confirm("Delete student?")) { students = students.filter(s => s.id !== id); save(); renderStudentTable(); } };

window.updateFilterDropdowns = () => {
    const ids = ['filter-hw', 'filter-exams', 'filter-students'];
    const opts = `<option value="all">ALL GRADES</option>` + Object.keys(gradeConfig).map(id => `<option value="${id}">${gradeConfig[id].name.toUpperCase()}</option>`).join('');
    ids.forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = opts; });
};

window.refreshGradeDropdowns = () => {
    const el = document.getElementById('reg-grade');
    if(el) el.innerHTML = Object.keys(gradeConfig).map(id => `<option value="${id}">${gradeConfig[id].name}</option>`).join('');
};

window.logout = () => location.reload();

// --- 9. REPORTS ---
window.renderReportsPage = () => {
    const container = document.getElementById('grade-categorized-reports');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(gradeConfig).forEach(gId => {
        const list = students.filter(s => s.grade == gId);
        if(!list.length) return;
        let rows = list.map(s => `<div class="flex items-center justify-between p-4 border-b border-white/5"><span class="text-sm font-bold text-white">${s.name}</span><button onclick="printReport('${s.id}')" class="text-[9px] bg-blue-600 px-3 py-1 rounded font-black">PRINT</button></div>`).join('');
        container.innerHTML += `<div class="glass-panel rounded-3xl border border-white/5 mb-6"><div class="p-4 bg-white/5 text-[10px] font-black uppercase text-slate-500">${gradeConfig[gId].name}</div>${rows}</div>`;
    });
};

window.printReport = (id) => {
    const s = students.find(x => x.id === id); const g = gradeConfig[s.grade];
    const att = ((s.attendance/totalClassesHeld)*100).toFixed(0);
    const comp = parseInt(g.completed) || 0;
    const hw = comp > 0 ? (s.homework.slice(0, comp).reduce((a,b)=>a+(parseInt(b)||0),0)/(comp*100)*100).toFixed(0) : 0;
    const ex = (s.exams.reduce((a,b)=>a+(parseInt(b)||0),0)/3).toFixed(0);
    document.getElementById('print-area').innerHTML = `<div class="p-20 bg-white text-black min-h-screen text-center"><h1 class="text-4xl font-black uppercase mb-12">Progress Report</h1><div class="grid grid-cols-2 gap-10 text-left border-y-2 border-black py-10 mb-12"><p>NAME: <strong>${s.name}</strong></p><p>ID: <strong>${s.id}</strong></p><p>LEVEL: <strong>${g.name}</strong></p></div><div class="grid grid-cols-3 gap-6"><div class="p-8 border-2 border-black"><p>Attendance</p><p class="text-5xl font-black">${att}%</p></div><div class="p-8 border-2 border-black"><p>Homework</p><p class="text-5xl font-black">${hw}%</p></div><div class="p-8 border-2 border-black"><p>Exams</p><p class="text-5xl font-black">${ex}%</p></div></div></div>`;
    window.print();
};