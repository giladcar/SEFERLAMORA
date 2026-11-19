import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2yx6GiaeWX5nYQhdh8c3-2k2XvblRRN0",
    authDomain: "siporim-64515.firebaseapp.com",
    projectId: "siporim-64515",
    storageBucket: "siporim-64515.firebasestorage.app",
    messagingSenderId: "701042104939",
    appId: "1:701042104939:web:31df33c0b18beec2b26f2e",
    measurementId: "G-D0TQ44WC9B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);