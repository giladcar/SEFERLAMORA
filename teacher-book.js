import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase-init.js";

export async function buildBookHTML(classId) {
    const classSnap = await getDoc(doc(db, "classes", classId));
    const classInfo = classSnap.data();
    const greetings = classInfo.greetings || [];

    const q = query(collection(db, "students"), where("classId", "==", classId));
    const studentsSnap = await getDocs(q);

    // חילוץ נקי של שכבה ומספר כיתה (עובד גם לכיתות חדשות וגם לישנות)
    const gradeClean = (classInfo.grade || "").replace('כיתה ', '').trim();
    const numClean = classInfo.classNumber || (classInfo.name ? classInfo.name.split('-')[0].replace('כיתה', '').replace(gradeClean, '').trim() : '');
    const coverLabel = classInfo.shortLabel || `${gradeClean} ${numClean}`.trim();

    // 1. כריכה קדמית
    let html = `
        <div class="book-page cover-page">
            <img src="front.jpg" alt="כריכה קדמית">
            <div class="cover-class-overlay">${coverLabel}</div>
        </div>
    `;

    // 2. דבר המחנכת ושאר הברכות הפעילות
    greetings.forEach(g => {
        const isVisible = (g.visible !== undefined) ? g.visible : true;
        if (isVisible && g.text && g.text.trim() !== "") {
            html += `
                <div class="book-page">
                    <h2>${g.title}</h2>
                    <p>${g.text}</p>
                </div>
            `;
        }
    });

    // 3. סיפורי התלמידים + תמונת תלמיד מימין
    studentsSnap.forEach(docSnap => {
        const st = docSnap.data();
        if (st.stories && st.stories.length > 0) {
            st.stories.forEach(story => {
                const photoHtml = st.photo 
                    ? `<img src="${st.photo}" class="story-page-photo" alt="${st.firstName}">` 
                    : ``;

                html += `
                    <div class="book-page">
                        <div class="story-page-header">
                            ${photoHtml}
                            <div class="story-page-title-block">
                                <h2>${story.title || "סיפור ללא כותרת"}</h2>
                                <div class="author-tag">מאת: ${st.firstName} ${st.lastName}</div>
                            </div>
                        </div>
                        <p>${story.content || ""}</p>
                    </div>
                `;
            });
        }
    });

    // 4. כריכה אחורית
    html += `
        <div class="book-page cover-page">
            <img src="back.jpg" alt="כריכה אחורית">
        </div>
    `;

    return html;
}