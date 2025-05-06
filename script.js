import { getFirestore, collection, getDocs, doc, setDoc, writeBatch, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { auth, logOut, onAuthStateChanged } from './auth.js';

// Initialize Firestore
const db = getFirestore();

let currentUser = null;
let currentApartment = null;
let apartmentMembers = [];
const displayedCategories = new Set();

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
        // Set display name in Auth profile
        await updateProfile(user, { displayName });
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            displayName: displayName,
            createdAt: new Date().toISOString()
        });
        await ensureUserDocument(user); // Redundant but ensures user doc exists
        return user;
    } catch (error) {
        throw error;
    }
}

async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await ensureUserDocument(user); // Ensure user doc exists on login
        return user;
    } catch (error) {
        throw error;
    }
}

// Apartment management functions
async function createApartment(name, address) {
    try {
        const apartmentRef = doc(collection(db, "apartments"));
        await setDoc(apartmentRef, {
            name: name,
            address: address,
            createdBy: currentUser.uid,
            createdAt: new Date().toISOString(),
            members: [currentUser.uid]
        });
        return apartmentRef.id;
    } catch (error) {
        throw error;
    }
}

async function joinApartment(apartmentId) {
    try {
        const apartmentRef = doc(db, "apartments", apartmentId);
        const apartmentDoc = await getDoc(apartmentRef);
        
        if (!apartmentDoc.exists()) {
            throw new Error("Apartment not found");
        }

        const members = apartmentDoc.data().members || [];
        if (!members.includes(currentUser.uid)) {
            members.push(currentUser.uid);
            await setDoc(apartmentRef, { members }, { merge: true });
        }

        currentApartment = apartmentId;
        await loadApartmentMembers();
    } catch (error) {
        throw error;
    }
}

async function loadApartmentMembers() {
    if (!currentApartment) return;
    
    const apartmentRef = doc(db, "apartments", currentApartment);
    const apartmentDoc = await getDoc(apartmentRef);
    const memberIds = apartmentDoc.data().members || [];
    
    apartmentMembers = [];
    for (const memberId of memberIds) {
        const userDoc = await getDoc(doc(db, "users", memberId));
        if (userDoc.exists()) {
            apartmentMembers.push({
                id: memberId,
                ...userDoc.data()
            });
        }
    }
}

// Function to populate the dropdown menu on roommate-chores.html
async function populateDropdown() {
    const roommateSelect = document.getElementById('roommate-select');
    if (!roommateSelect) return;

    // Clear existing options
    roommateSelect.innerHTML = '';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "Select a roommate";
    roommateSelect.appendChild(defaultOption);

    // Add apartment members to dropdown
    apartmentMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.displayName;
        roommateSelect.appendChild(option);
    });
}

// Function to display chores for the selected roommate
async function displayChores(memberId) {
    const choresList = document.getElementById('chores-list');
    if (!choresList) return;

    choresList.innerHTML = '';

    if (!memberId) return;

    // Load chores from Firestore for current apartment
    const choresQuery = query(
        collection(db, "chores"),
        where("apartmentId", "==", currentApartment),
        where("assignedTo", "==", memberId)
    );
    const choresSnapshot = await getDocs(choresQuery);
    const chores = choresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Display chores
    chores.forEach(chore => {
        const div = document.createElement('div');
        div.classList.add('chore-item');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = chore.completed || false;

        checkbox.addEventListener('change', async function () {
            try {
                const choreRef = doc(db, "chores", chore.id);
                await setDoc(choreRef, {
                    completed: checkbox.checked,
                    completedAt: checkbox.checked ? new Date().toISOString() : null
                }, { merge: true });

                if (checkbox.checked) {
                    div.classList.add('completed');
                } else {
                    div.classList.remove('completed');
                }
            } catch (error) {
                console.error("Error updating chore:", error);
            }
        });

        const choreText = document.createElement('span');
        choreText.textContent = chore.name;

        div.appendChild(checkbox);
        div.appendChild(choreText);

        if (chore.completed) {
            div.classList.add('completed');
        }

        choresList.appendChild(div);
    });

    if (chores.length === 0) {
        const noChoresMessage = document.createElement('p');
        noChoresMessage.textContent = 'No chores assigned to this roommate.';
        choresList.appendChild(noChoresMessage);
    }
}

// Add event listener for the search button
document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            const selectedRoommate = document.getElementById('roommate-select').value;
            displayChores(selectedRoommate);
        });
    }
});

// Function to load and display chores for index.html
async function loadChores() {
    const accordionContainer = document.getElementById('accordion-container');
    if (!accordionContainer) return;

    // Clear existing content
    accordionContainer.innerHTML = '';

    // Load chores from Firestore
    const choresQuery = query(
        collection(db, "chores"),
        where("apartmentId", "==", currentApartment)
    );
    const choresSnapshot = await getDocs(choresQuery);
    const chores = choresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Group chores by category
    const choresByCategory = {};
    chores.forEach(chore => {
        if (!choresByCategory[chore.category]) {
            choresByCategory[chore.category] = [];
        }
        choresByCategory[chore.category].push(chore);
    });

    // Create accordion sections for each category
    for (const [category, categoryChores] of Object.entries(choresByCategory)) {
        const section = document.createElement('div');
        section.className = 'accordion-section';
        
        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.textContent = category;
        header.onclick = () => toggleSection(section);
        
        const content = document.createElement('div');
        content.className = 'accordion-content';
        
        categoryChores.forEach(chore => {
            const choreDiv = document.createElement('div');
            choreDiv.className = 'chore-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = chore.completed || false;
            checkbox.onchange = async () => {
                try {
                    const choreRef = doc(db, "chores", chore.id);
                    await setDoc(choreRef, {
                        completed: checkbox.checked,
                        completedAt: checkbox.checked ? new Date().toISOString() : null
                    }, { merge: true });
                    
                    if (checkbox.checked) {
                        choreDiv.classList.add('completed');
                    } else {
                        choreDiv.classList.remove('completed');
                    }
                    updateProgressBar();
                } catch (error) {
                    console.error("Error updating chore:", error);
                }
            };
            
            const choreText = document.createElement('span');
            choreText.textContent = chore.name;
            
            const roommateSelect = document.createElement('select');
            roommateSelect.className = 'roommate-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Assign to...";
            roommateSelect.appendChild(defaultOption);
            
            // Add roommates to dropdown
            apartmentMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.displayName;
                if (chore.assignedTo === member.id) {
                    option.selected = true;
                }
                roommateSelect.appendChild(option);
            });
            
            roommateSelect.onchange = async () => {
                try {
                    const choreRef = doc(db, "chores", chore.id);
                    await setDoc(choreRef, {
                        assignedTo: roommateSelect.value
                    }, { merge: true });
                } catch (error) {
                    console.error("Error assigning chore:", error);
                }
            };
            
            choreDiv.appendChild(checkbox);
            choreDiv.appendChild(choreText);
            choreDiv.appendChild(roommateSelect);
            
            if (chore.completed) {
                choreDiv.classList.add('completed');
            }
            
            content.appendChild(choreDiv);
        });
        
        section.appendChild(header);
        section.appendChild(content);
        accordionContainer.appendChild(section);
    }
    
    updateProgressBar();
}

function toggleSection(section) {
    const content = section.querySelector('.accordion-content');
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

async function updateProgressBar() {
    const progressBar = document.getElementById('chore-progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    
    if (!progressBar || !progressPercentage) return;
    
    const choresQuery = query(
        collection(db, "chores"),
        where("apartmentId", "==", currentApartment)
    );
    const choresSnapshot = await getDocs(choresQuery);
    const chores = choresSnapshot.docs.map(doc => doc.data());
    
    const totalChores = chores.length;
    const completedChores = chores.filter(chore => chore.completed).length;
    
    const percentage = totalChores > 0 ? (completedChores / totalChores) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressPercentage.textContent = `${Math.round(percentage)}%`;
}

// Make handleLogout available globally
window.handleLogout = async function() {
    try {
        await logOut();
        window.location.href = 'auth.html';
    } catch (error) {
        console.error("Error signing out:", error);
    }
};

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = userData.displayName;
            }
        }

        // Load user's apartments
        const apartmentsQuery = query(
            collection(db, "apartments"),
            where("members", "array-contains", currentUser.uid)
        );
        const apartmentsSnapshot = await getDocs(apartmentsQuery);
        
        if (!apartmentsSnapshot.empty) {
            // For now, just use the first apartment
            const apartment = apartmentsSnapshot.docs[0];
            currentApartment = apartment.id;
            
            // Load apartment members
            await loadApartmentMembers();
            
            // Load chores after members are loaded
            await loadChores();
        } else {
            window.location.href = 'settings.html';
        }
    } catch (error) {
        console.error("Error loading user data:", error);
    }
}

// Check if user is signed in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await ensureUserDocument(user);
        currentUser = user;
        await loadUserData();
        
        // Check if we're on the roommate-chores.html page
        if (document.getElementById('roommate-select')) {
            await loadApartmentMembers();
            await populateDropdown();
        }

        // Check if we're on the index.html page
        if (document.getElementById('accordion-container')) {
            await loadApartmentMembers();
            await loadChores();
        }
    } else {
        window.location.href = 'auth.html';
    }
});

export { signUp, signIn };