


import {
    db,
    storage,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    setDoc,
    storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "./firebase.js";



// ============================================================================
// 1. DOM ELEMENT SELECTORS
// ============================================================================
const menuForm = document.getElementById('menu-form');
const itemNameInput = document.getElementById('item-name');
const itemDescriptionInput = document.getElementById('item-description'); 
const itemImageFileInput = document.getElementById('item-image-file');
const itemPriceInput = document.getElementById('item-price');
const itemCategorySelect = document.getElementById('item-category');
const itemBadgeInputs = document.querySelectorAll('input[name="item-badge"]');
const menuTableBody = document.getElementById('menu-table-body');
const searchBar = document.getElementById('search-bar');
const filterTabsContainer = document.getElementById('filter-tabs-container'); 
const emptyState = document.getElementById('empty-state');

const statTotalItems = document.getElementById('stat-total-items');
const statTopCategory = document.getElementById('stat-top-category');

// Selectors για τη λειτουργία του Responsive Burger Menu
const adminSidebar = document.getElementById('admin-sidebar');
const openSidebarTrigger = document.getElementById('open-sidebar-trigger');
const closeSidebarTrigger = document.getElementById('close-sidebar-trigger');
const sidebarOverlay = document.getElementById('sidebar-overlay');

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editItemId = document.getElementById('edit-item-id');
const editItemName = document.getElementById('edit-item-name');
const editItemDescription = document.getElementById('edit-item-description'); 
const editItemImageFile = document.getElementById('edit-item-image-file');
const editItemPrice = document.getElementById('edit-item-price');
const editItemCategory = document.getElementById('edit-item-category');
const editItemBadgeInputs = document.querySelectorAll('input[name="edit-item-badge"]');
const closeModalBtn = document.getElementById('close-modal-btn');

// ============================================================================
// 2. STATE (ΜΝΗΜΗ ΕΦΑΡΜΟΓΗΣ)
// ============================================================================
const DEFAULT_CATEGORIES = ['Mains', 'Drinks', 'Desserts'];
const menuItemsRef = collection(db, 'menuItems');
const categoriesDocRef = doc(db, 'settings', 'categories');

let menuItems = [];
let categoryOrder = DEFAULT_CATEGORIES;
let currentFilter = 'All'; 
let currentSearchQuery = ''; 
let hasAttemptedLocalMenuMigration = false;

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

function renderAdminBadges(badges = []) {
    if (!Array.isArray(badges) || badges.length === 0) return '';
    return `<div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px;">
        ${badges.map(badge => `<span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 3px 7px;">${badge}</span>`).join('')}
    </div>`;
}

function buildImagePath(file) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
    return `dish-images/${Date.now()}-${safeName}`;
}

async function uploadDishImage(file) {
    if (!file) return { imageUrl: '', imagePath: '' };
    const imagePath = buildImagePath(file);
    const imageReference = storageRef(storage, imagePath);
    await uploadBytes(imageReference, file);
    const imageUrl = await getDownloadURL(imageReference);
    return { imageUrl, imagePath };
}

function getSelectedFile(input) {
    return input && input.files && input.files.length > 0 ? input.files[0] : null;
}

async function deleteDishImage(imagePath) {
    if (!imagePath) return;
    try {
        await deleteObject(storageRef(storage, imagePath));
    } catch (error) {
        console.warn('Could not delete old image:', error);
    }
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
const sortable = new Sortable(menuTableBody, {
    animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle', 
    onEnd: async function () {
        let NewOrderedList = [];
        const rows = menuTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const id = row.getAttribute('data-id');
            const item = menuItems.find(i => i.id === id);
            if (item) { item.order = index + 1; NewOrderedList.push(item); }
        });
        if (currentFilter !== 'All' || currentSearchQuery !== '') {
            menuItems.forEach(item => { if (!NewOrderedList.some(n => n.id === item.id)) NewOrderedList.push(item); });
        }
        menuItems = NewOrderedList;
        await Promise.all(menuItems.map((item, index) => 
            updateDoc(doc(db, 'menuItems', item.id), { order: index + 1 })
        ));
        calculateCalculatedStats();
        renderDashboard(); 
    }
});

// ============================================================================
// 5. RENDER ENGINE
// ============================================================================
function renderDashboard() {
    menuTableBody.innerHTML = '';

    menuItems.sort((a, b) => parseInt(a.order || 0) - parseInt(b.order || 0));

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = (currentFilter === 'All' || item.category === currentFilter);
        const matchesSearch = item.name.toLowerCase().includes(currentSearchQuery.toLowerCase());
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

        const hideIcon = item.hidden ? 'Unstock' : 'Stocked';

        row.innerHTML = `
            <td>
                <strong>${item.name}</strong> ${item.hidden ? '<span style="color: #ef4444; font-size: 11px; margin-left: 5px; font-weight: bold;">[OUT OF STOCK]</span>' : ''}
                <div style="font-size: 13px; color: #64748b; font-weight: normal; margin-top: 4px;">${item.description || '<i>No description added.</i>'}</div>
                ${item.imageUrl ? '<div style="font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 600;">Photo added</div>' : ''}
                ${renderAdminBadges(item.badges)}
            </td>
            <td><span class="badge ${item.category}">${item.category}</span></td>
            <td><strong>${parseFloat(item.price).toFixed(2)} €</strong></td>
            <td style="text-align: right;">
                <div class="action-row" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                    <span class="drag-handle" style="margin-right: 10px;">☰</span>
                    <button class="btn-row-edit" style="background: ${item.hidden ? '#64748b' : '#2a4a58'}; color: white;" data-action="toggle-stock" data-id="${item.id}">${hideIcon}</button>
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
    const counts = {};
    categoryOrder.forEach(c => counts[c] = 0);
    menuItems.forEach(item => { if(counts[item.category] !== undefined) counts[item.category]++; });
    let maxCat = 'None'; let maxVal = 0;
    for (const [cat, val] of Object.entries(counts)) {
        if (val > maxVal) { maxVal = val; maxCat = cat; }
    }
    if (statTopCategory) statTopCategory.textContent = maxCat !== 'None' ? `${maxCat} (${maxVal})` : 'None';
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
            imageUrl: uploadedImage.imageUrl,
            imagePath: uploadedImage.imagePath,
            order: nextOrder, price: parseFloat(itemPriceInput.value), category: selectedCategory, hidden: false,
            badges: getCheckedBadgeValues(itemBadgeInputs)
        };

        await addDoc(menuItemsRef, newItem);
        itemNameInput.value = ''; itemDescriptionInput.value = ''; if (itemImageFileInput) itemImageFileInput.value = ''; itemPriceInput.value = '';
        setCheckedBadgeValues(itemBadgeInputs, []);
        
        // Κλείνουμε αυτόματα το μενού στο κινητό μετά την καταχώρηση
        closeMobileSidebar();
    } catch (error) {
        console.error('Could not add dish:', error);
        alert('The dish could not be saved. If you added a photo, check that Firebase Storage is enabled and its rules allow uploads.');
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
        const itemToDelete = menuItems.find(item => item.id === id);
        if (itemToDelete) await deleteDishImage(itemToDelete.imagePath);
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
    editItemDescription.value = targetItem.description || ''; 
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
                imageUpdate.imagePath = uploadedImage.imagePath;
                await deleteDishImage(targetItem.imagePath);
            }

            await updateDoc(doc(db, 'menuItems', idToUpdate), {
                name: editItemName.value.trim(),
                description: editItemDescription.value.trim(),
                price: parseFloat(editItemPrice.value),
                category: editItemCategory.value,
                badges: getCheckedBadgeValues(editItemBadgeInputs),
                ...imageUpdate
            });
            if (editItemImageFile) editItemImageFile.value = '';
            editModal.classList.add('hidden');
        } catch (error) {
            console.error('Could not update dish:', error);
            alert('The dish could not be updated. If you added a photo, check that Firebase Storage is enabled and its rules allow uploads.');
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Save Changes';
            }
        }
    }
});

if (searchBar) searchBar.addEventListener('input', (e) => { currentSearchQuery = e.target.value; renderDashboard(); });

function subscribeToFirebase() {
    onSnapshot(categoriesDocRef, async (snapshot) => {
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

    onSnapshot(menuItemsRef, async (snapshot) => {
        if (!hasAttemptedLocalMenuMigration && snapshot.empty) {
            hasAttemptedLocalMenuMigration = true;
            const savedMenu = JSON.parse(localStorage.getItem('productionMenu') || '[]');
            if (Array.isArray(savedMenu) && savedMenu.length > 0) {
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
}

renderDashboard();
subscribeToFirebase();

// ============================================================================
// PREMIUM QR CODE INITIALIZATION & ENGINE FUNCTIONS (Πλήρως Διορθωμένο)
// ============================================================================

// Αυτό το update διασφαλίζει ότι το QR code θα δείχνει στο σωστό menu.html του GitHub Pages
const targetCustomerMenuURL = window.location.href.replace("index.html", "menu.html").split('?')[0];

const qrContainer = document.getElementById("qr-code-element");
if (qrContainer) {
    const menuQRCodeInstance = new QRCode(qrContainer, {
        text: targetCustomerMenuURL,
        width: 100,
        height: 100,
        colorDark : "#0f172a", 
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H 
    });
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

