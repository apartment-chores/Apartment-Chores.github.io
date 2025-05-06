import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAup1H61VCuSBJDbofGVTArawNB-c3c6eU",
    authDomain: "apartment-chore.firebaseapp.com",
    projectId: "apartment-chore",
    storageBucket: "apartment-chore.appspot.com",
    messagingSenderId: "929712450963",
    appId: "1:929712450963:web:2667d71a01b28909110c66",
    measurementId: "G-P2VYXYY665"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Ensure user document exists in Firestore
async function ensureUserDocument(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : "Unnamed");
        await setDoc(userRef, {
            email: user.email || "",
            displayName: displayName,
            createdAt: new Date().toISOString()
        });
    }
}

// Authentication functions
async function signUp(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName });
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            displayName: displayName,
            createdAt: new Date().toISOString()
        });
        await ensureUserDocument(user);
        return user;
    } catch (error) {
        throw error;
    }
}

async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await ensureUserDocument(user);
        // Check if user has an apartment
        const apartmentsQuery = query(
            collection(db, "apartments"),
            where("members", "array-contains", user.uid)
        );
        const apartmentsSnapshot = await getDocs(apartmentsQuery);
        
        if (apartmentsSnapshot.empty) {
            window.location.href = 'settings.html';
        } else {
            window.location.href = 'index.html';
        }
        return user;
    } catch (error) {
        throw error;
    }
}

async function logOut() {
    try {
        await signOut(auth);
    } catch (error) {
        throw error;
    }
}

// Initialize auth state listener
function initAuthStateListener() {
    let isRedirecting = false;
    onAuthStateChanged(auth, (user) => {
        if (user && !isRedirecting) {
            isRedirecting = true;
            window.location.href = 'settings.html';
        } else if (!user && window.location.pathname !== '/auth.html') {
            window.location.href = 'auth.html';
        }
    });
}

async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (error) {
        throw error;
    }
}

export { auth, logOut, onAuthStateChanged, signUp, signIn, initAuthStateListener, resetPassword }; 