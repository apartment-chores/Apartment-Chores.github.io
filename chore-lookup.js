import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// Your Firebase configuration
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
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', async () => {
    const roommateSelect = document.getElementById('roommate-select');
    const searchButton = document.getElementById('search-button');
    const choresList = document.getElementById('chores-list');

    try {
        // Fetch roommate names from Firestore
        const roommatesSnapshot = await getDocs(collection(db, 'roommates'));
        const roommates = roommatesSnapshot.docs.map(doc => doc.data().name);

        // Populate the dropdown
        roommates.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            roommateSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching roommates:', error);
        // Optionally, handle the error or display a message to the user
    }

    searchButton.addEventListener('click', async () => {
        const roommateName = roommateSelect.value.trim();

        if (!roommateName) {
            alert('Please select a roommate name.');
            return;
        }

        // Clear previous results
        choresList.innerHTML = '';

        try {
            // Query the chores collection for chores assigned to the specified roommate
            const choresQuery = query(
                collection(db, 'chores'),
                where('roommate', '==', roommateName)
            );

            const querySnapshot = await getDocs(choresQuery);
            const chores = querySnapshot.docs.map(doc => doc.data());

            if (chores.length === 0) {
                choresList.innerHTML = '<p>No chores assigned to this roommate.</p>';
                return;
            }

            const ul = document.createElement('ul');
            chores.forEach(chore => {
                const li = document.createElement('li');
                li.textContent = `${chore.name} - ${chore.completed ? 'Completed' : 'Incomplete'}`;
                ul.appendChild(li);
            });

            choresList.appendChild(ul);

        } catch (error) {
            console.error('Error fetching chores:', error);
            choresList.innerHTML = '<p>Error fetching chores. Please try again later.</p>';
        }
    });
});
