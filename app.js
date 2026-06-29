


import {
    db,
    auth,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    setDoc,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "./firebase.js";



// ============================================================================
// 1. DOM ELEMENT SELECTORS
// ============================================================================
const menuForm = document.getElementById('menu-form');
const itemNameInput = document.getElementById('item-name');
const itemNameElInput = document.getElementById('item-name-el');
const itemDescriptionInput = document.getElementById('item-description'); 
const itemDescriptionElInput = document.getElementById('item-description-el'); 
const itemImageFileInput = document.getElementById('item-image-file');
const itemPriceInput = document.getElementById('item-price');
const itemCategorySelect = document.getElementById('item-category');
const itemBadgeInputs = document.querySelectorAll('input[name="item-badge"]');
const menuTableBody = document.getElementById('menu-table-body');
const searchBar = document.getElementById('search-bar');
const filterTabsContainer = document.getElementById('filter-tabs-container'); 
const emptyState = document.getElementById('empty-state');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginUsername = document.getElementById('admin-login-username');
const adminLoginPassword = document.getElementById('admin-login-password');
const adminLoginError = document.getElementById('admin-login-error');
const adminLogoutButton = document.getElementById('admin-logout-btn');
const adminUserName = document.getElementById('admin-user-name');
const restaurantSettingsForm = document.getElementById('restaurant-settings-form');
const settingRestaurantName = document.getElementById('setting-restaurant-name');
const settingLogoUrl = document.getElementById('setting-logo-url');
const settingPhone = document.getElementById('setting-phone');
const settingAddress = document.getElementById('setting-address');
const settingInstagram = document.getElementById('setting-instagram');
const settingPrimaryColor = document.getElementById('setting-primary-color');
const settingSecondaryColor = document.getElementById('setting-secondary-color');
const settingCurrency = document.getElementById('setting-currency');
const settingLanguages = document.getElementById('setting-languages');
const settingMenuTitle = document.getElementById('setting-menu-title');
const settingMenuSubtitle = document.getElementById('setting-menu-subtitle');
const settingMenuNote = document.getElementById('setting-menu-note');
const settingFooterText = document.getElementById('setting-footer-text');
const restaurantSettingsStatus = document.getElementById('restaurant-settings-status');

const statTotalItems = document.getElementById('stat-total-items');
const statAvailableItems = document.getElementById('stat-available-items');
const statOutOfStockItems = document.getElementById('stat-out-of-stock-items');
const statTotalCategories = document.getElementById('stat-total-categories');

// Selectors για τη λειτουργία του Responsive Burger Menu
const adminSidebar = document.getElementById('admin-sidebar');
const openSidebarTrigger = document.getElementById('open-sidebar-trigger');
const closeSidebarTrigger = document.getElementById('close-sidebar-trigger');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editItemId = document.getElementById('edit-item-id');
const editItemName = document.getElementById('edit-item-name');
const editItemNameEl = document.getElementById('edit-item-name-el');
const editItemDescription = document.getElementById('edit-item-description'); 
const editItemDescriptionEl = document.getElementById('edit-item-description-el'); 
const editItemImageFile = document.getElementById('edit-item-image-file');
const editItemPrice = document.getElementById('edit-item-price');
const editItemCategory = document.getElementById('edit-item-category');
const editItemBadgeInputs = document.querySelectorAll('input[name="edit-item-badge"]');
const closeModalBtn = document.getElementById('close-modal-btn');

// ============================================================================
// 2. STATE (ΜΝΗΜΗ ΕΦΑΡΜΟΓΗΣ)
// ============================================================================
const DEFAULT_CATEGORIES = ['Mains', 'Drinks', 'Desserts'];
const CLOUDINARY_CLOUD_NAME = 'dzz4waa9e';
const CLOUDINARY_UPLOAD_PRESET = 'bistro_menu_uploads';
const menuItemsRef = collection(db, 'menuItems');
const categoriesDocRef = doc(db, 'settings', 'categories');
const restaurantDocRef = doc(db, 'settings', 'restaurant');

let menuItems = [];
let categoryOrder = DEFAULT_CATEGORIES;
let currentFilter = 'All'; 
let currentSearchQuery = ''; 
let hasAttemptedLocalMenuMigration = false;
let hasStartedAdminSession = false;
let firebaseUnsubscribers = [];
const DEFAULT_RESTAURANT_SETTINGS = {
    restaurantName: 'Bistro',
    logoUrl: '',
    phone: '',
    address: '',
    instagram: '',
    primaryColor: '#0f172a',
    secondaryColor: '#f8fafc',
    currency: '€',
    languages: 'en,el',
    title: 'The Bistro Menu',
    subtitle: 'Fresh ingredients • Crafted daily',
    note: 'Browse our current dishes below. Please let our team know about allergies or dietary needs before ordering.',
    footerText: 'Prices include VAT. Ask our staff for daily specials and allergen information.'
};
let restaurantSettingsState = { ...DEFAULT_RESTAURANT_SETTINGS };

function getCheckedBadgeValues(inputs) {
    return Array.from(inputs)
        .filter(input => input.checked)
        .map(input => input.value);
}

function setCheckedBadgeValues(inputs, badges = []) {
    inputs.forEach(input => {
        input.checked = badges.includes(input.value);
    });
}

function setLoginError(message = '') {
    if (adminLoginError) adminLoginError.textContent = message;
}

function readableAuthError(error) {
    const code = error && error.code ? error.code : '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        return 'The username or password is not correct.';
    }
    if (code.includes('too-many-requests')) {
        return 'Too many attempts. Please wait a bit and try again.';
    }
    if (code.includes('network-request-failed')) {
        return 'Network problem. Check your connection and try again.';
    }
    return 'Could not sign in. Check that Email/Password auth is enabled in Firebase.';
}

function clearFirebaseSubscriptions() {
    firebaseUnsubscribers.forEach((unsubscribe) => unsubscribe());
    firebaseUnsubscribers = [];
}

function usernameToAuthEmail(username) {
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '');
    return cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@bistro.local`;
}

function authEmailToUsername(email) {
    if (!email) return 'Admin';
    return email.endsWith('@bistro.local') ? email.replace('@bistro.local', '') : email;
}

function fillRestaurantSettingsForm(settings = {}) {
    const data = { ...DEFAULT_RESTAURANT_SETTINGS, ...settings };
    restaurantSettingsState = data;
    if (settingRestaurantName) settingRestaurantName.value = data.restaurantName || '';
    if (settingLogoUrl) settingLogoUrl.value = data.logoUrl || '';
    if (settingPhone) settingPhone.value = data.phone || '';
    if (settingAddress) settingAddress.value = data.address || '';
    if (settingInstagram) settingInstagram.value = data.instagram || '';
    if (settingPrimaryColor) settingPrimaryColor.value = data.primaryColor || DEFAULT_RESTAURANT_SETTINGS.primaryColor;
    if (settingSecondaryColor) settingSecondaryColor.value = data.secondaryColor || DEFAULT_RESTAURANT_SETTINGS.secondaryColor;
    if (settingCurrency) settingCurrency.value = data.currency || DEFAULT_RESTAURANT_SETTINGS.currency;
    if (settingLanguages) settingLanguages.value = data.languages || DEFAULT_RESTAURANT_SETTINGS.languages;
    if (settingMenuTitle) settingMenuTitle.value = data.title || '';
    if (settingMenuSubtitle) settingMenuSubtitle.value = data.subtitle || '';
    if (settingMenuNote) settingMenuNote.value = data.note || '';
    if (settingFooterText) settingFooterText.value = data.footerText || '';
}

function setRestaurantSettingsStatus(message = '', isError = false) {
    if (!restaurantSettingsStatus) return;
    restaurantSettingsStatus.textContent = message;
    restaurantSettingsStatus.style.color = isError ? '#fca5a5' : '#94a3b8';
}

function renderAdminBadges(badges = []) {
    if (!Array.isArray(badges) || badges.length === 0) return '';
    return `<div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px;">
        ${badges.map(badge => `<span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 3px 7px;">${escapeHTML(badge)}</span>`).join('')}
    </div>`;
}

function escapeHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeClassName(value) {
    return String(value || '').replace(/[^a-z0-9_-]/gi, '-');
}

function formatPrice(value) {
    const price = Number.parseFloat(value);
    return Number.isFinite(price) ? price.toFixed(2) : '0.00';
}

function currencySymbol() {
    return restaurantSettingsState.currency || DEFAULT_RESTAURANT_SETTINGS.currency;
}

async function uploadDishImage(file) {
    if (!file) return { imageUrl: '', imagePublicId: '' };

    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    uploadData.append('folder', 'bistro-menu/dishes');

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: uploadData
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Cloudinary upload failed: ${message}`);
    }

    const result = await response.json();
    return {
        imageUrl: result.secure_url,
        imagePublicId: result.public_id
    };
}

function getSelectedFile(input) {
    return input && input.files && input.files.length > 0 ? input.files[0] : null;
}


// ============================================================================
// 3. RESPONSIVE SIDEBAR INTERACTION (ΛΟΓΙΚΗ BURGER)
// ============================================================================
// Συναρτήσεις για Άνοιγμα / Κλείσιμο του Sidebar στο κινητό (Διορθωμένο overlay με class)
function openMobileSidebar() {
    adminSidebar.classList.add('active');
    document.body.classList.add('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.classList.add('visible');
}

function closeMobileSidebar() {
    adminSidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
}

// Listeners για τα κουμπιά και το overlay φόντο
if (openSidebarTrigger) openSidebarTrigger.addEventListener('click', openMobileSidebar);
if (closeSidebarTrigger) closeSidebarTrigger.addEventListener('click', closeMobileSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

// ============================================================================
// 4. DRAG AND DROP CONTROLLER
// ============================================================================
if (window.Sortable && menuTableBody) {
    new Sortable(menuTableBody, {
        animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle', 
        onEnd: async function () {
            const newlyOrderedItems = [];
            const rows = menuTableBody.querySelectorAll('tr');
            rows.forEach((row, index) => {
                const id = row.getAttribute('data-id');
                const item = menuItems.find(i => i.id === id);
                if (item) { item.order = index + 1; newlyOrderedItems.push(item); }
            });
            // Preserve hidden-by-filter items so a partial view reorder does not drop them.
            if (currentFilter !== 'All' || currentSearchQuery !== '') {
                menuItems.forEach(item => { if (!newlyOrderedItems.some(n => n.id === item.id)) newlyOrderedItems.push(item); });
            }
            menuItems = newlyOrderedItems;
            await Promise.all(menuItems.map((item, index) => 
                updateDoc(doc(db, 'menuItems', item.id), { order: index + 1 })
            ));
            calculateCalculatedStats();
            renderDashboard(); 
        }
    });
} else {
    console.warn('Sortable library did not load. Drag-and-drop ordering is disabled.');
}

// ============================================================================
// 5. RENDER ENGINE
// ============================================================================
function renderDashboard() {
    menuTableBody.innerHTML = '';

    menuItems.sort((a, b) => parseInt(a.order || 0) - parseInt(b.order || 0));

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = (currentFilter === 'All' || item.category === currentFilter);
        const matchesSearch = String(item.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) { emptyState.classList.remove('hidden'); } 
    else { emptyState.classList.add('hidden'); }

    filteredItems.forEach((item) => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.id);
        
        if (item.hidden) {
            row.style.opacity = "0.6";
            row.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
        }

        const availabilityLabel = item.hidden ? 'Out of Stock' : 'Available';
        const availabilityActionLabel = item.hidden ? 'Mark Available' : 'Mark Out of Stock';
        const availabilityClass = item.hidden ? 'out' : 'available';
        const categoryClass = safeClassName(item.category);
        const thumbnailHTML = item.imageUrl
            ? `<img class="dish-thumb" src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'dish-thumb dish-thumb-placeholder',textContent:'IMG'}))">`
            : `<span class="dish-thumb dish-thumb-placeholder">IMG</span>`;

        row.innerHTML = `
            <td>
                <div class="dish-cell">
                    ${thumbnailHTML}
                    <div class="dish-main">
                        <div class="dish-title-line">
                            <strong>${escapeHTML(item.name)}</strong>
                            <span class="status-pill ${availabilityClass}">${availabilityLabel}</span>
                        </div>
                        <div style="font-size: 13px; color: #64748b; font-weight: normal; margin-top: 4px;">${item.description ? escapeHTML(item.description) : '<i>No description added.</i>'}</div>
                        ${renderAdminBadges(item.badges)}
                    </div>
                </div>
            </td>
            <td><span class="badge ${categoryClass}">${escapeHTML(item.category)}</span></td>
            <td><strong>${formatPrice(item.price)} ${escapeHTML(currencySymbol())}</strong></td>
            <td style="text-align: right;">
                <div class="action-row" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                    <span class="drag-handle" style="margin-right: 10px;">☰</span>
                    <button class="btn-row-edit" style="background: ${item.hidden ? '#64748b' : '#2a4a58'}; color: white;" data-action="toggle-stock" data-id="${item.id}">${availabilityActionLabel}</button>
                    <button class="btn-row-edit" data-action="edit" data-id="${item.id}">Edit</button>
                    <button class="btn-row-del" data-action="delete" data-id="${item.id}">Delete</button>
                </div>
            </td>
        `;
        menuTableBody.appendChild(row);
    });

    calculateCalculatedStats();
    renderDropdowns();         
    renderFilterTabs();        
}

window.toggleHideItem = async function(id) {
    const item = menuItems.find(i => i.id === id);
    if (item) {
        await updateDoc(doc(db, 'menuItems', id), { hidden: !item.hidden });
    }
};

menuTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === 'toggle-stock') await window.toggleHideItem(id);
    if (button.dataset.action === 'edit') openEditModal(id);
    if (button.dataset.action === 'delete') await deleteItem(id);
});

function renderDropdowns() {
    const currentMainSel = itemCategorySelect.value;
    itemCategorySelect.innerHTML = '';
    editItemCategory.innerHTML = '';
    categoryOrder.forEach(cat => {
        const opt1 = document.createElement('option'); opt1.value = cat; opt1.textContent = cat;
        itemCategorySelect.appendChild(opt1);
        const opt2 = document.createElement('option'); opt2.value = cat; opt2.textContent = cat;
        editItemCategory.appendChild(opt2);
    });
    if(currentMainSel && categoryOrder.includes(currentMainSel)) itemCategorySelect.value = currentMainSel;
}

function renderFilterTabs() {
    if (!filterTabsContainer) return;
    filterTabsContainer.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = `tab-btn ${currentFilter === 'All' ? 'active' : ''}`;
    allBtn.textContent = 'All Items';
    allBtn.onclick = () => handleTabClick(allBtn, 'All');
    filterTabsContainer.appendChild(allBtn);

    categoryOrder.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${currentFilter === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => handleTabClick(btn, cat);
        filterTabsContainer.appendChild(btn);
    });
}

function handleTabClick(buttonElement, category) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    buttonElement.classList.add('active');
    currentFilter = category;
    renderDashboard();
}

function calculateCalculatedStats() {
    if (statTotalItems) statTotalItems.textContent = menuItems.length;
    const availableItems = menuItems.filter(item => !item.hidden).length;
    const outOfStockItems = menuItems.filter(item => item.hidden).length;
    if (statAvailableItems) statAvailableItems.textContent = availableItems;
    if (statOutOfStockItems) statOutOfStockItems.textContent = outOfStockItems;
    if (statTotalCategories) statTotalCategories.textContent = categoryOrder.length;
}

// ============================================================================
// 6. CREATE DISH OPERATION
// ============================================================================
menuForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const submitButton = menuForm.querySelector('button[type="submit"]');

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
        }

        const nextOrder = menuItems.length + 1;
        const selectedCategory = itemCategorySelect.value;
        const uploadedImage = await uploadDishImage(getSelectedFile(itemImageFileInput));

        const newItem = {
            name: itemNameInput.value.trim(), description: itemDescriptionInput.value.trim(), 
            nameEl: itemNameElInput.value.trim(),
            descriptionEl: itemDescriptionElInput.value.trim(),
            imageUrl: uploadedImage.imageUrl,
            imagePublicId: uploadedImage.imagePublicId,
            order: nextOrder, price: parseFloat(itemPriceInput.value), category: selectedCategory, hidden: false,
            badges: getCheckedBadgeValues(itemBadgeInputs)
        };

        await addDoc(menuItemsRef, newItem);
        itemNameInput.value = ''; itemNameElInput.value = ''; itemDescriptionInput.value = ''; itemDescriptionElInput.value = ''; if (itemImageFileInput) itemImageFileInput.value = ''; itemPriceInput.value = '';
        setCheckedBadgeValues(itemBadgeInputs, []);
        
        // Close the mobile drawer after a successful dish add.
        closeMobileSidebar();
    } catch (error) {
        console.error('Could not add dish:', error);
        alert('The dish could not be saved. If you added a photo, check your Cloudinary upload preset and internet connection.');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add To Menu';
        }
    }
});

// ============================================================================
// 7. DELETE & UPDATE OPERATIONS
// ============================================================================
async function deleteItem(id) {
    if(confirm("Are you sure you want to remove this dish?")) {
        await deleteDoc(doc(db, 'menuItems', id));
        const remainingItems = menuItems
            .filter(item => item.id !== id)
            .sort((a, b) => parseInt(a.order || 0) - parseInt(b.order || 0));
        await Promise.all(remainingItems.map((item, index) => 
            updateDoc(doc(db, 'menuItems', item.id), { order: index + 1 })
        ));
    }
}
window.deleteItem = deleteItem;

function openEditModal(id) {
    const targetItem = menuItems.find(item => item.id === id);
    if (!targetItem) return; 

    editItemId.value = targetItem.id;
    editItemName.value = targetItem.name;
    editItemNameEl.value = targetItem.nameEl || '';
    editItemDescription.value = targetItem.description || ''; 
    editItemDescriptionEl.value = targetItem.descriptionEl || '';
    if (editItemImageFile) editItemImageFile.value = '';
    editItemPrice.value = targetItem.price;
    renderDropdowns(); 
    editItemCategory.value = targetItem.category;
    setCheckedBadgeValues(editItemBadgeInputs, targetItem.badges || []);
    editModal.classList.remove('hidden');
}
window.openEditModal = openEditModal;

closeModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idToUpdate = editItemId.value;
    const targetItem = menuItems.find(item => item.id === idToUpdate);

    if (targetItem) {
        const submitButton = editForm.querySelector('button[type="submit"]');

        try {
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Saving...';
            }

            const newImageFile = getSelectedFile(editItemImageFile);
            const imageUpdate = {};

            if (newImageFile) {
                const uploadedImage = await uploadDishImage(newImageFile);
                imageUpdate.imageUrl = uploadedImage.imageUrl;
                imageUpdate.imagePublicId = uploadedImage.imagePublicId;
            }

            await updateDoc(doc(db, 'menuItems', idToUpdate), {
                name: editItemName.value.trim(),
                nameEl: editItemNameEl.value.trim(),
                description: editItemDescription.value.trim(),
                descriptionEl: editItemDescriptionEl.value.trim(),
                price: parseFloat(editItemPrice.value),
                category: editItemCategory.value,
                badges: getCheckedBadgeValues(editItemBadgeInputs),
                ...imageUpdate
            });
            if (editItemImageFile) editItemImageFile.value = '';
            editModal.classList.add('hidden');
        } catch (error) {
            console.error('Could not update dish:', error);
            alert('The dish could not be updated. If you added a photo, check your Cloudinary upload preset and internet connection.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Save Changes';
            }
        }
    }
});

if (searchBar) searchBar.addEventListener('input', (e) => { currentSearchQuery = e.target.value; renderDashboard(); });

if (restaurantSettingsForm) {
    restaurantSettingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = restaurantSettingsForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Saving...';
        }
        setRestaurantSettingsStatus('Saving...');

        try {
            await setDoc(restaurantDocRef, {
                restaurantName: settingRestaurantName.value.trim() || DEFAULT_RESTAURANT_SETTINGS.restaurantName,
                logoUrl: settingLogoUrl.value.trim(),
                phone: settingPhone.value.trim(),
                address: settingAddress.value.trim(),
                instagram: settingInstagram.value.trim(),
                primaryColor: settingPrimaryColor.value || DEFAULT_RESTAURANT_SETTINGS.primaryColor,
                secondaryColor: settingSecondaryColor.value || DEFAULT_RESTAURANT_SETTINGS.secondaryColor,
                currency: settingCurrency.value || DEFAULT_RESTAURANT_SETTINGS.currency,
                languages: settingLanguages.value || DEFAULT_RESTAURANT_SETTINGS.languages,
                title: settingMenuTitle.value.trim() || DEFAULT_RESTAURANT_SETTINGS.title,
                subtitle: settingMenuSubtitle.value.trim() || DEFAULT_RESTAURANT_SETTINGS.subtitle,
                note: settingMenuNote.value.trim() || DEFAULT_RESTAURANT_SETTINGS.note,
                footerText: settingFooterText.value.trim() || DEFAULT_RESTAURANT_SETTINGS.footerText
            }, { merge: true });
            setRestaurantSettingsStatus('Saved.');
            setTimeout(() => setRestaurantSettingsStatus(''), 2200);
        } catch (error) {
            console.error('Could not save restaurant settings:', error);
            setRestaurantSettingsStatus('Could not save restaurant info.', true);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Save Settings';
            }
        }
    });
}

function subscribeToFirebase() {
    clearFirebaseSubscriptions();

    const unsubscribeCategories = onSnapshot(categoriesDocRef, async (snapshot) => {
        if (snapshot.exists() && Array.isArray(snapshot.data().order)) {
            categoryOrder = snapshot.data().order;
        } else {
            const savedCategories = JSON.parse(localStorage.getItem('categoryOrder') || 'null');
            categoryOrder = Array.isArray(savedCategories) && savedCategories.length > 0
                ? savedCategories
                : DEFAULT_CATEGORIES;
            await setDoc(categoriesDocRef, { order: categoryOrder });
            localStorage.removeItem('categoryOrder');
        }
        renderDashboard();
    }, (error) => console.error('Category listener error:', error));

    const unsubscribeMenuItems = onSnapshot(menuItemsRef, async (snapshot) => {
        if (!hasAttemptedLocalMenuMigration && snapshot.empty) {
            hasAttemptedLocalMenuMigration = true;
            const savedMenu = JSON.parse(localStorage.getItem('productionMenu') || '[]');
            if (Array.isArray(savedMenu) && savedMenu.length > 0) {
                // One-time migration path for users who had menu data before Firestore sync.
                await Promise.all(savedMenu.map(({ id, ...item }) => addDoc(menuItemsRef, item)));
                localStorage.removeItem('productionMenu');
                return;
            }
        }

        menuItems = snapshot.docs.map(menuDoc => ({
            id: menuDoc.id,
            ...menuDoc.data()
        }));
        renderDashboard();
    }, (error) => console.error('Menu listener error:', error));

    const unsubscribeRestaurant = onSnapshot(restaurantDocRef, (snapshot) => {
        fillRestaurantSettingsForm(snapshot.exists() ? snapshot.data() : DEFAULT_RESTAURANT_SETTINGS);
    }, (error) => {
        console.error('Restaurant settings listener error:', error);
        setRestaurantSettingsStatus('Could not load restaurant info.', true);
    });

    firebaseUnsubscribers.push(unsubscribeCategories, unsubscribeMenuItems, unsubscribeRestaurant);
}

if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoginError('Signing in...');

        const submitButton = adminLoginForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Signing in...';
        }

        try {
            const loginTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('auth-timeout')), 12000);
            });

            await Promise.race(
                [
                    signInWithEmailAndPassword(
                        auth,
                        usernameToAuthEmail(adminLoginUsername.value),
                        adminLoginPassword.value
                    ),
                    loginTimeout
                ]
            );
            adminLoginPassword.value = '';
        } catch (error) {
            console.error('Admin sign in failed:', error);
            setLoginError(error.message === 'auth-timeout'
                ? 'Login is taking too long. Check internet connection and Firebase Authentication setup.'
                : readableAuthError(error));
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Sign In';
            }
        }
    });
}

if (adminLogoutButton) {
    adminLogoutButton.addEventListener('click', async () => {
        await signOut(auth);
    });
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        document.body.classList.remove('admin-authenticated');
        if (adminUserName) adminUserName.textContent = '';
        clearFirebaseSubscriptions();
        hasStartedAdminSession = false;
        menuItems = [];
        renderDashboard();
        return;
    }

    document.body.classList.add('admin-authenticated');
    setLoginError('');
    if (adminUserName) adminUserName.textContent = authEmailToUsername(user.email);

    if (!hasStartedAdminSession) {
        hasStartedAdminSession = true;
        renderDashboard();
        subscribeToFirebase();
    }
});

// ============================================================================
// PREMIUM QR CODE INITIALIZATION & ENGINE FUNCTIONS (Πλήρως Διορθωμένο)
// ============================================================================

// Build the customer-facing menu URL from the current admin page location.
function getCustomerMenuURL() {
    const currentUrl = new URL(window.location.href);
    currentUrl.search = '';
    currentUrl.hash = '';

    if (currentUrl.pathname.endsWith('/')) {
        currentUrl.pathname += 'menu.html';
        return currentUrl.toString();
    }

    const pathParts = currentUrl.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart.includes('.')) {
        pathParts[pathParts.length - 1] = 'menu.html';
    } else {
        pathParts.push('menu.html');
    }

    currentUrl.pathname = pathParts.join('/');
    return currentUrl.toString();
}

const targetCustomerMenuURL = getCustomerMenuURL();

const qrContainer = document.getElementById("qr-code-element");
if (qrContainer && window.QRCode) {
    new QRCode(qrContainer, {
        text: targetCustomerMenuURL,
        width: 100,
        height: 100,
        colorDark : "#0f172a", 
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H 
    });
} else if (qrContainer) {
    qrContainer.innerHTML = '<span style="font-size: 11px; color: #94a3b8;">QR unavailable</span>';
    console.warn('QRCode library did not load. QR generation is disabled.');
}

// Download handler function με διπλό έλεγχο (img & canvas) για 100% επιτυχία
window.downloadMenuQR = function() {
    const qrElement = document.getElementById("qr-code-element");
    if (!qrElement) return;

    const qrImage = qrElement.querySelector("img");
    const qrCanvas = qrElement.querySelector("canvas");

    let finalDataImageStream = "";

    if (qrImage && qrImage.src && qrImage.src.startsWith("data:image")) {
        finalDataImageStream = qrImage.src;
    } else if (qrCanvas) {
        finalDataImageStream = qrCanvas.toDataURL("image/png");
    }

    if (finalDataImageStream) {
        const virtualDownloadLinkAnchor = document.createElement("a");
        virtualDownloadLinkAnchor.href = finalDataImageStream;
        virtualDownloadLinkAnchor.download = "Bistro_Menu_Table_QR.png";
        
        document.body.appendChild(virtualDownloadLinkAnchor);
        virtualDownloadLinkAnchor.click();
        document.body.removeChild(virtualDownloadLinkAnchor);
    } else {
        alert("The QR code is generating. Please wait a second and click download again!");
    }
};

