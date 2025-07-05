import { getTranslation } from './translations-controller.js';

let modalElement = null;
let onConfirmCallback = null;

const typeToTranslationKey = {
    'alarm': 'alarms',
    'timer': 'timer',
    'world-clock': 'world_clock',
    'audio': 'sounds'
};

function createConfirmationModal() {
    const modalHTML = `
        <div class="menu-delete">
            <h1></h1>
            <span><strong class="item-name"></strong></span>
            <div class="menu-delete-btns">
                <button class="cancel-btn body-title"></button>
                <button class="confirm-btn body-title"></button>
            </div>
        </div>
    `;

    modalElement = document.createElement('div');
    // --- CORRECCIÓN AQUÍ ---
    // Se ha eliminado la clase 'module-overlay'
    modalElement.className = 'confirmation-overlay';
    modalElement.innerHTML = modalHTML;
    document.body.appendChild(modalElement);

    const cancelButton = modalElement.querySelector('.cancel-btn');
    const confirmButton = modalElement.querySelector('.confirm-btn');

    cancelButton.addEventListener('click', hideConfirmation);
    confirmButton.addEventListener('click', () => {
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback();
        }
        hideConfirmation();
    });

    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideConfirmation();
        }
    });

    console.log('✅ Confirmation Modal Created');
    return modalElement;
}

function destroyConfirmationModal() {
    if (modalElement) {
        modalElement.remove();
        modalElement = null;
        onConfirmCallback = null;
        console.log('🗑️ Confirmation Modal Destroyed');
    }
}

export function showConfirmation(type, name, onConfirm) {
    // Si ya existe un modal (por alguna razón), lo eliminamos primero
    if (modalElement) {
        destroyConfirmationModal();
    }
    
    // Creamos un nuevo modal
    const currentModal = createConfirmationModal();

    const titleElement = currentModal.querySelector('h1');
    const messageElement = currentModal.querySelector('span');
    const nameElement = currentModal.querySelector('.item-name');
    const cancelButton = currentModal.querySelector('.cancel-btn');
    const confirmButton = currentModal.querySelector('.confirm-btn');

    const category = typeToTranslationKey[type] || 'general';
    const titleText = getTranslation(`confirm_delete_title_${type}`, 'confirmation') || `¿Quieres eliminar ${type}?`;
    const messageText = getTranslation(`confirm_delete_message_${type}`, 'confirmation') || 'Estás a punto de eliminar {name} de tu almacenamiento. No podrás deshacer la acción.';

    titleElement.textContent = titleText;
    messageElement.innerHTML = messageText.replace('{name}', `<strong>${name}</strong>`);
    
    cancelButton.textContent = getTranslation('cancel', 'confirmation') || 'Cancelar';
    confirmButton.textContent = getTranslation('delete', 'confirmation') || 'Eliminar';

    onConfirmCallback = onConfirm;
    
    // Forzar la animación de entrada
    requestAnimationFrame(() => {
        currentModal.classList.add('active');
    });
}

function hideConfirmation() {
    if (!modalElement) return;
    
    // Forzar animación de salida
    modalElement.classList.remove('active');
    
    // Esperar a que la animación termine para destruir el modal
    setTimeout(destroyConfirmationModal, 300); // 300ms para la transición de opacidad
}

export function initConfirmationModal() {
    // La inicialización ahora no hace nada, todo es bajo demanda.
}