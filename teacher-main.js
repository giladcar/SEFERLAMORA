import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { buildBookHTML } from "./teacher-book.js";

const TEACHER_SECRET_PASSWORD = "mora#20#26";

let tempSelectedGrade = "";
let currentClassId = "";
let currentClassData = null;
let currentEditingStudentId = "";
let unsubscribeStudents = null;
let greetingsSaveTimeout = null;
let greetingsVisibility = new Array(11).fill(true);

// אימות סיסמת מורה
window.verifyTeacherPassword = () => {
    const input = document.getElementById('teacher-password-input').value;
    const errorMsg = document.getElementById('login-error-msg');
    
    if (input === TEACHER_SECRET_PASSWORD) {
        errorMsg.style.display = 'none';
        document.getElementById('teacher-login-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        loadClasses();
    } else {
        errorMsg.style.display = 'block';
    }
};

window.teacherLogout = () => {
    if (unsubscribeStudents) unsubscribeStudents();
    document.getElementById('teacher-password-input').value = "";
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('student-detail-screen').classList.add('hidden');
    document.getElementById('greetings-screen').classList.add('hidden');
    document.getElementById('book-view').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('teacher-login-screen').classList.remove('hidden');
};

// יצירת 10 תיבות נוספות לברכות
const extraContainer = document.getElementById('extra-greetings-container');
const defaultTitles = ["דבר המנהל/ת", "דבר היועצת", "דבר הרכזת", "ברכה נוספת 4", "ברכה נוספת 5", "ברכה נוספת 6", "ברכה נוספת 7", "ברכה נוספת 8", "ברכה נוספת 9", "ברכה נוספת 10"];
for (let i = 1; i <= 10; i++) {
    extraContainer.innerHTML += `
        <div id="greeting-box-${i}" class="sub-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0;">${i + 1}. קטע פתיחה נוסף</h3>
                <button type="button" id="toggle-btn-${i}" class="toggle-visible" onclick="toggleGreetingVisibility(${i})">👁️ להראות בספר (מוצג)</button>
            </div>
            <label>כותרת הקטע</label>
            <input type="text" id="greeting-title-${i}" value="${defaultTitles[i-1]}" oninput="triggerGreetingsAutoSave()">
            <label>תוכן הדברים</label>
            <textarea id="greeting-text-${i}" rows="4" placeholder="הזן תוכן כאן..." oninput="triggerGreetingsAutoSave()"></textarea>
        </div>
    `;
}

window.toggleGreetingVisibility = (index) => {
    greetingsVisibility[index] = !greetingsVisibility[index];
    updateToggleUI(index);
    triggerGreetingsAutoSave();
};

function updateToggleUI(index) {
    const btn = document.getElementById(`toggle-btn-${index}`);
    const box = document.getElementById(`greeting-box-${index}`);
    if (greetingsVisibility[index]) {
        btn.className = "toggle-visible";
        btn.innerText = "👁️ להראות בספר (מוצג)";
        box.classList.remove("dimmed");
    } else {
        btn.className = "toggle-hidden";
        btn.innerText = "🚫 לא להראות בספר (מוסתר)";
        box.classList.add("dimmed");
    }
}

// יצירת כיתה
window.showCreateClassStep1 = () => {
    document.getElementById('create-class-step1').classList.remove('hidden');
    document.getElementById('create-class-step2').classList.add('hidden');
};

window.selectGrade = (grade) => {
    if (!grade) return;
    tempSelectedGrade = grade;
    document.getElementById('selected-grade-display').innerText = grade;
    document.getElementById('class-number-select').value = "";
    document.getElementById('create-class-step1').classList.add('hidden');
    document.getElementById('create-class-step2').classList.remove('hidden');
};

window.cancelCreateClass = () => {
    tempSelectedGrade = "";
    document.getElementById('create-class-step1').classList.add('hidden');
    document.getElementById('create-class-step2').classList.add('hidden');
};

window.finishCreateClass = async () => {
    const classNumber = document.getElementById('class-number-select').value;
    const year = document.getElementById('hebrew-year-select').value;

    if (!tempSelectedGrade || classNumber === "" || !year) {
        alert("כל השדות הם חובה! יש לבחור שכבה, מספר כיתה (0-10) ושנה עברית.");
        return;
    }

    const shortGradeAndNum = `${tempSelectedGrade.replace('כיתה ', '')} ${classNumber}`;
    const fullClassName = `${tempSelectedGrade} ${classNumber} - ${year}`;

    try {
        await addDoc(collection(db, "classes"), {
            grade: tempSelectedGrade,
            classNumber: classNumber,
            shortLabel: shortGradeAndNum,
            year: year,
            name: fullClassName,
            greetings: []
        });
        cancelCreateClass();
        loadClasses();
    } catch (e) {
        alert("שגיאה ביצירת כיתה.");
        console.error(e);
    }
};

// מחיקת כיתה + פרופילים
window.deleteCurrentClass = async () => {
    if (!currentClassId) return;
    const confirmed = confirm(`האם אתה בטוח שברצונך למחוק את "${currentClassData.name}"?\nפעולה זו תמחק לצמיתות גם את הכיתה וגם את כל פרופילי התלמידים והסיפורים שבתוכה.`);
    if (!confirmed) return;

    try {
        if (unsubscribeStudents) unsubscribeStudents();
        const studentsQuery = query(collection(db, "students"), where("classId", "==", currentClassId));
        const studentsSnapshot = await getDocs(studentsQuery);
        const deletePromises = [];
        studentsSnapshot.forEach((studentDoc) => {
            deletePromises.push(deleteDoc(doc(db, "students", studentDoc.id)));
        });
        await Promise.all(deletePromises);
        await deleteDoc(doc(db, "classes", currentClassId));

        alert("הכיתה וכל פרופילי התלמידים שבתוכה נמחקו בהצלחה.");
        backToMain();
    } catch (e) {
        alert("שגיאה במחיקת הכיתה.");
        console.error(e);
    }
};

async function loadClasses() {
    const listDiv = document.getElementById('classes-list');
    listDiv.innerHTML = "";
    const querySnapshot = await getDocs(collection(db, "classes"));
    if (querySnapshot.empty) {
        listDiv.innerHTML = "<p style='color: var(--text-muted);'>לא נמצאו כיתות במערכת. לחץ על 'יצירת כיתה חדשה' כדי להתחיל.</p>";
        return;
    }
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-card-title">${data.name}</div>
            <div class="item-card-meta">לחץ לניהול הכיתה וצפייה בתלמידים</div>
        `;
        card.onclick = () => openClass(docSnap.id, data);
        listDiv.appendChild(card);
    });
}

window.openClass = (classId, classData) => {
    currentClassId = classId;
    currentClassData = classData;
    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('class-screen').classList.remove('hidden');
    document.getElementById('class-title').innerText = classData.name;

    if (unsubscribeStudents) unsubscribeStudents();
    const q = query(collection(db, "students"), where("classId", "==", classId));
    unsubscribeStudents = onSnapshot(q, (snapshot) => {
        const studentsDiv = document.getElementById('students-list');
        studentsDiv.innerHTML = "";
        if (snapshot.empty) {
            studentsDiv.innerHTML = "<p style='color: var(--text-muted);'>טרם נרשמו תלמידים לכיתה זו.</p>";
            return;
        }
        snapshot.forEach((docSnap) => {
            const st = docSnap.data();
            const card = document.createElement('div');
            card.className = 'item-card';
            const storiesCount = st.stories ? st.stories.length : 0;
            const hasPhotoText = st.photo ? " | 📷 יש תמונה" : "";
            card.innerHTML = `
                <div class="item-card-title">${st.firstName} ${st.lastName}</div>
                <div class="item-card-meta">סיפורים: ${storiesCount} מתוך 5${hasPhotoText}</div>
            `;
            card.onclick = () => openStudentDetail(docSnap.id, st);
            studentsDiv.appendChild(card);
        });
    });
};

window.openStudentDetail = (studentId, student) => {
    currentEditingStudentId = studentId;
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('student-detail-screen').classList.remove('hidden');
    document.getElementById('student-detail-name').innerText = `${student.firstName} ${student.lastName}`;
    document.getElementById('student-detail-code').innerText = student.code;
    document.getElementById('student-photo-upload').value = "";
    document.getElementById('photo-upload-status').innerText = "";

    const previewImg = document.getElementById('student-photo-preview');
    const noPhotoBox = document.getElementById('student-no-photo-box');

    if (student.photo) {
        previewImg.src = student.photo;
        previewImg.style.display = "block";
        noPhotoBox.style.display = "none";
    } else {
        previewImg.style.display = "none";
        noPhotoBox.style.display = "flex";
    }

    const storiesDiv = document.getElementById('student-stories-list');
    storiesDiv.innerHTML = "";
    if (!student.stories || student.stories.length === 0) {
        storiesDiv.innerHTML = "<p style='color: var(--text-muted);'>התלמיד טרם הזין סיפורים.</p>";
        return;
    }
    student.stories.forEach((story, index) => {
        storiesDiv.innerHTML += `
            <div class="sub-box">
                <h3 style="margin-bottom: 8px;">${index + 1}. ${story.title || "ללא כותרת"}</h3>
                <p style="white-space: pre-wrap; margin: 0; color: var(--text-main);">${story.content || ""}</p>
            </div>
        `;
    });
};

window.handleStudentPhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !currentEditingStudentId) return;

    const statusDiv = document.getElementById('photo-upload-status');
    statusDiv.style.color = "#854d0e";
    statusDiv.innerText = "מעבד ושומר תמונה בענן...";

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const maxSize = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

            try {
                await updateDoc(doc(db, "students", currentEditingStudentId), {
                    photo: compressedDataUrl
                });

                const previewImg = document.getElementById('student-photo-preview');
                const noPhotoBox = document.getElementById('student-no-photo-box');
                previewImg.src = compressedDataUrl;
                previewImg.style.display = "block";
                noPhotoBox.style.display = "none";

                statusDiv.style.color = "#16a34a";
                statusDiv.innerText = "התמונה נשמרה בהצלחה ותופיע בספר ✓";
            } catch (err) {
                statusDiv.style.color = "#dc2626";
                statusDiv.innerText = "שגיאה בשמירת התמונה.";
                console.error(err);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.showGreetingsEditor = async () => {
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('greetings-screen').classList.remove('hidden');

    const docSnap = await getDoc(doc(db, "classes", currentClassId));
    const greetings = docSnap.data().greetings || [];
    
    for (let i = 0; i <= 10; i++) {
        if (greetings[i]) {
            document.getElementById(`greeting-title-${i}`).value = greetings[i].title;
            document.getElementById(`greeting-text-${i}`).value = greetings[i].text;
            greetingsVisibility[i] = (greetings[i].visible !== undefined) ? greetings[i].visible : true;
        } else {
            greetingsVisibility[i] = true;
        }
        updateToggleUI(i);
    }
};

window.triggerGreetingsAutoSave = () => {
    const statusBanner = document.getElementById('greetings-autosave-status');
    statusBanner.innerText = "שומר שינויים בענן...";
    statusBanner.style.backgroundColor = "#fefce8";
    statusBanner.style.borderColor = "#fef08a";
    statusBanner.style.color = "#854d0e";

    clearTimeout(greetingsSaveTimeout);
    greetingsSaveTimeout = setTimeout(async () => {
        const greetings = [];
        for (let i = 0; i <= 10; i++) {
            greetings.push({
                title: document.getElementById(`greeting-title-${i}`).value,
                text: document.getElementById(`greeting-text-${i}`).value,
                visible: greetingsVisibility[i]
            });
        }
        try {
            await updateDoc(doc(db, "classes", currentClassId), { greetings: greetings });
            statusBanner.innerText = "כל השינויים נשמרו אוטומטית בענן ✓";
            statusBanner.style.backgroundColor = "#f0fdf4";
            statusBanner.style.borderColor = "#bbf7d0";
            statusBanner.style.color = "#166534";
        } catch (e) {
            statusBanner.innerText = "שגיאה בשמירה האוטומטית.";
            console.error(e);
        }
    }, 500);
};

// קריאה למודול הפקת הספר
window.generateBook = async () => {
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('book-view').classList.remove('hidden');
    const container = document.getElementById('book-pages-container');
    container.innerHTML = "<p>מפיק את עמודי הספר...</p>";
    
    container.innerHTML = await buildBookHTML(currentClassId);
};

window.backToMain = () => {
    if (unsubscribeStudents) unsubscribeStudents();
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    loadClasses();
};

window.backToClass = () => {
    document.getElementById('student-detail-screen').classList.add('hidden');
    document.getElementById('greetings-screen').classList.add('hidden');
    document.getElementById('book-view').classList.add('hidden');
    document.getElementById('class-screen').classList.remove('hidden');
};