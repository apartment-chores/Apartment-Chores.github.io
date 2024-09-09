import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

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

let roommates = [];
const displayedCategories = new Set();
const allowedRoommates = {
    'Bathroom 1': new Set(['Xander', 'Spencer']),
    'Bathroom 2': new Set(['Adam', 'Sam', 'Riley']),
    'Bedroom 1': new Set(['Xander', 'Spencer']),
    'Bedroom 2': new Set(['Adam']),
    'Bedroom 3': new Set(['Riley', 'Sam'])
};

// Function to populate the dropdown menu on roommate-chores.html
async function populateDropdown() {
    const roommateSelect = document.getElementById('roommate-select');
    if (!roommateSelect) return; // If element doesn't exist, exit

    // Load roommates from Firestore
    const roommatesSnapshot = await getDocs(collection(db, "roommates"));
    roommates = roommatesSnapshot.docs.map(doc => doc.data().name);

    // Populate dropdown options
    roommates.forEach(roommate => {
        const option = document.createElement('option');
        option.value = roommate;
        option.textContent = roommate;
        roommateSelect.appendChild(option);
    });
}

// Function to display chores for the selected roommate
async function displayChores(roommate) {
    const choresList = document.getElementById('chores-list');
    if (!choresList) return; // If element doesn't exist, exit

    choresList.innerHTML = ''; // Clear previous list

    if (!roommate) return; // If no roommate is selected, do nothing

    // Load chores from Firestore
    const choresSnapshot = await getDocs(collection(db, "chores"));
    const chores = choresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter chores assigned to the selected roommate
    const filteredChores = chores.filter(chore => chore.roommate === roommate);

    // Display chores
    filteredChores.forEach(chore => {
        const div = document.createElement('div');
        div.classList.add('chore-item');
        if (chore.completed) {
            div.classList.add('completed');
        }
        div.textContent = chore.name;
        choresList.appendChild(div);
    });

    if (filteredChores.length === 0) {
        const noChoresMessage = document.createElement('p');
        noChoresMessage.textContent = 'No chores assigned to this roommate.';
        choresList.appendChild(noChoresMessage);
    }
}

// Event listener for the "Find My Chores" button
document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const selectedRoommate = document.getElementById('roommate-select').value;
            displayChores(selectedRoommate);
        });
    }

    // Check if we're on the roommate-chores.html page
    if (document.getElementById('roommate-select')) {
        populateDropdown();
    }

    // Check if we're on the index.html page
    if (document.getElementById('accordion-container')) {
        loadChores();
    }
});

// Function to load and display chores for index.html
async function loadChores() {
    const accordionContainer = document.getElementById('accordion-container');
    const progressBar = document.getElementById('chore-progress-bar');
    if (!accordionContainer) return;

    // Load roommates from Firestore
    const roommatesSnapshot = await getDocs(collection(db, "roommates"));
    roommates = roommatesSnapshot.docs.map(doc => doc.data().name);

    // Load chores from Firestore
    const choresSnapshot = await getDocs(collection(db, "chores"));
    const chores = {};
    let totalChores = 0;
    let completedChores = 0;

    choresSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!chores[data.category]) {
            chores[data.category] = [];
        }
        chores[data.category].push({
            ...data,
            id: doc.id
        });

        totalChores++;
        if (data.completed) {
            completedChores++;
        }
    });

    // Update the progress bar based on completed chores
    const completionRate = (completedChores / totalChores) * 100;
    progressBar.style.width = `${completionRate}%`;

    // Sort categories alphabetically
    const sortedCategories = Object.keys(chores).sort();

    sortedCategories.forEach(async category => {
        if (!displayedCategories.has(category)) {
            const accordionButton = document.createElement('button');
            accordionButton.classList.add('accordion');
            accordionButton.textContent = category;

            const panel = document.createElement('div');
            panel.classList.add('panel');

            const sortedChores = chores[category].sort((a, b) => (a.order || 0) - (b.order || 0));

            sortedChores.forEach(chore => {
                const li = document.createElement('li');
                if (chore.completed) {
                    li.classList.add('completed');
                }

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = chore.completed || false;
                checkbox.addEventListener('change', async function () {
                    try {
                        const choreRef = doc(db, "chores", chore.id);
                        await setDoc(choreRef, {
                            completed: checkbox.checked
                        }, { merge: true });

                        if (checkbox.checked) {
                            li.classList.add('completed');
                            completedChores++;
                        } else {
                            li.classList.remove('completed');
                            completedChores--;
                        }

                        const newCompletionRate = (completedChores / totalChores) * 100;
                        progressBar.style.width = `${newCompletionRate}%`;

                    } catch (error) {
                        console.error("Error updating chore:", error);
                    }
                });

                const choreTextDiv = document.createElement('div');
                choreTextDiv.classList.add('chore-text');
                const choreTitle = document.createElement('strong');
                choreTitle.textContent = chore.name;
                choreTextDiv.appendChild(choreTitle);

                const roommateSelect = document.createElement('select');
                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "No one assigned";
                roommateSelect.appendChild(defaultOption);

                roommates.forEach(roommate => {
                    const option = document.createElement('option');
                    option.value = roommate;
                    option.textContent = roommate;
                    if (chore.roommate === roommate) {
                        option.selected = true;
                    }
                    roommateSelect.appendChild(option);
                });

                roommateSelect.addEventListener('change', async function () {
                    const selectedRoommate = roommateSelect.value;
                    const allowed = allowedRoommates[category];

                    if (allowed && !allowed.has(selectedRoommate)) {
                        alert(`Only ${Array.from(allowed).join(', ')} can be assigned to ${category}.`);
                        roommateSelect.value = ""; // Revert selection
                        return;
                    }

                    try {
                        const choreRef = doc(db, "chores", chore.id);
                        await setDoc(choreRef, {
                            roommate: roommateSelect.value
                        }, { merge: true });
                        chore.roommate = roommateSelect.value;
                    } catch (error) {
                        console.error("Error updating roommate:", error);
                    }
                });

                li.appendChild(checkbox);
                li.appendChild(choreTextDiv);
                li.appendChild(roommateSelect);
                panel.appendChild(li);
            });

            accordionContainer.appendChild(accordionButton);
            accordionContainer.appendChild(panel);

            displayedCategories.add(category);

            accordionButton.addEventListener('click', function () {
                this.classList.toggle('active');
                if (panel.style.display === "block") {
                    panel.style.display = "none";
                } else {
                    panel.style.display = "block";
                }
            });
        }
    });

    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            const confirmation = confirm("Are you sure you want to reset all chores? This will unassign all roommates and mark all chores as incomplete.");
            if (confirmation) {
                try {
                    const choresSnapshot = await getDocs(collection(db, "chores"));
                    const batch = writeBatch(db);

                    choresSnapshot.forEach((doc) => {
                        batch.update(doc.ref, {
                            roommate: "",
                            completed: false
                        });
                    });

                    await batch.commit();
                    alert("All chores have been cleared.");
                    location.reload(); // Refresh the page to reflect changes
                } catch (error) {
                    console.error("Error clearing chores:", error);
                }
            }
        });
    }
}