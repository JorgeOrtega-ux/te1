import { getTranslation } from './translations-controller.js';

let activeModal = null;
let onConfirmCallback = null;

// Mapeo para las traducciones de confirmación
const typeToTranslationKey = {
    'alarm': 'alarms',
    'timer': 'timer',
    'world-clock': 'world_clock',
    'audio': 'sounds'
};

/**
 * Crea el DOM del modal basado en el tipo especificado.
 * @param {string} modalType - El tipo de modal a crear ('confirmation' o 'suggestion').
 * @returns {HTMLElement} El elemento del overlay del modal.
 */
function createModalDOM(modalType) {
    let modalHTML = '';

    if (modalType === 'confirmation') {
        modalHTML = `
            <div class="menu-delete">
                <h1></h1>
                <span></span>
                <div class="menu-delete-btns">
                    <button class="cancel-btn body-title"></button>
                    <button class="confirm-btn body-title"></button>
                </div>
            </div>
        `;
    } else if (modalType === 'suggestion') {
        // (El código para el modal de sugerencias se mantiene igual)
        modalHTML = `
            <div class="menu-suggestion">
                <h1>${getTranslation('suggest_improvements_title', 'menu')}</h1>
                <p>${getTranslation('suggest_improvements_desc', 'menu')}</p>
                <form id="suggestion-form">
                    <div class="form-group">
                        <label for="suggestion-type">${getTranslation('suggestion_type', 'menu')}</label>
                        <select id="suggestion-type" name="suggestion-type">
                            <option value="improvement">${getTranslation('suggestion_type_improvement', 'menu')}</option>
                            <option value="bug">${getTranslation('suggestion_type_bug', 'menu')}</option>
                            <option value="feature_request">${getTranslation('suggestion_type_feature', 'menu')}</option>
                            <option value="other">${getTranslation('suggestion_type_other', 'menu')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="suggestion-text">${getTranslation('suggestion_message', 'menu')}</label>
                        <textarea id="suggestion-text" name="suggestion-text" rows="5" required></textarea>
                    </div>
                    <div class="menu-delete-btns">
                         <button type="button" class="cancel-btn body-title">${getTranslation('cancel', 'confirmation')}</button>
                         <button type="submit" class="confirm-btn body-title">${getTranslation('send_suggestion', 'menu')}</button>
                    </div>
                </form>
            </div>
        `;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.className = `module-overlay confirmation-overlay`;
    modalOverlay.innerHTML = modalHTML;
    document.body.appendChild(modalOverlay);

    return modalOverlay;
}

/**
 * Destruye el modal activo y limpia los listeners.
 */
function destroyActiveModal() {
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
        onConfirmCallback = null;
    }
}

/**
 * Muestra un modal de un tipo específico.
 * @param {string} type - El tipo de modal ('confirmation' o 'suggestion').
 * @param {object} data - Datos para poblar el modal. Para 'confirmation', necesita { type, name }.
 * @param {function} onConfirm - Callback a ejecutar si se confirma la acción.
 */
export function showModal(type, data, onConfirm) {
    if (activeModal) {
        destroyActiveModal();
    }
    
    activeModal = createModalDOM(type);
    
    // Asigna listeners comunes
    activeModal.querySelector('.cancel-btn').onclick = hideModal;
    activeModal.onclick = (e) => {
        if (e.target === activeModal) {
            hideModal();
        }
    };

    if (type === 'confirmation') {
        const { type: itemType, name } = data; // Extrae el tipo de item y el nombre
        const titleElement = activeModal.querySelector('h1');
        const messageElement = activeModal.querySelector('span');
        const confirmButton = activeModal.querySelector('.confirm-btn');

        // Usa el `typeToTranslationKey` para obtener la categoría correcta para las traducciones
        const translationKey = `confirm_delete_title_${itemType}`;
        const messageKey = `confirm_delete_message_${itemType}`;

        titleElement.textContent = getTranslation(translationKey, 'confirmation');
        messageElement.innerHTML = getTranslation(messageKey, 'confirmation').replace('{name}', `<strong>${name}</strong>`);
        confirmButton.textContent = getTranslation('delete', 'confirmation');
        
        onConfirmCallback = onConfirm;
        confirmButton.onclick = () => {
            if (typeof onConfirmCallback === 'function') onConfirmCallback();
            hideModal();
        };

    } else if (type === 'suggestion') {
        const form = activeModal.querySelector('#suggestion-form');
        const confirmButton = activeModal.querySelector('.confirm-btn');
        form.onsubmit = (e) => {
            e.preventDefault();
            console.log('Suggestion submitted:', {
                type: form.elements['suggestion-type'].value,
                text: form.elements['suggestion-text'].value
            });
            // Aquí iría la lógica para enviar el formulario
            hideModal();
        };
        // Aseguramos que el botón de submit también envíe el formulario
        confirmButton.onclick = () => form.requestSubmit();
    }

    // Muestra el modal con una transición
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            activeModal.classList.add('active');
        });
    });
}

/**
 * Oculta y destruye el modal activo.
 */
export function hideModal() {
    if (!activeModal) return;
    activeModal.classList.remove('active');
    // Espera a que la animación de salida termine para destruir el modal
    setTimeout(destroyActiveModal, 300);
}