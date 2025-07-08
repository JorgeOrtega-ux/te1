import { getTranslation } from './translations-controller.js';

let activeModal = null;
let onConfirmCallback = null;

function createModalDOM(modalType) {
    let modalHTML = '';

    if (modalType === 'confirmation') {
        modalHTML = `
            <div class="menu-delete">
                <h1></h1>
                <span><strong class="item-name"></strong></span>
                <div class="menu-delete-btns">
                    <button class="cancel-btn body-title"></button>
                    <button class="confirm-btn body-title"></button>
                </div>
            </div>
        `;
    } else if (modalType === 'suggestion') {
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

function destroyActiveModal() {
    if (activeModal) {
        activeModal.remove();
        activeModal = null;
        onConfirmCallback = null;
    }
}

export function showModal(type, data, onConfirm) {
    if (activeModal) {
        destroyActiveModal();
    }
    
    activeModal = createModalDOM(type);
    
    if (type === 'confirmation') {
        const { name } = data;
        const titleElement = activeModal.querySelector('h1');
        const messageElement = activeModal.querySelector('span');
        const confirmButton = activeModal.querySelector('.confirm-btn');

        const category = typeToTranslationKey[data.type] || 'general';
        titleElement.textContent = getTranslation(`confirm_delete_title_${data.type}`, 'confirmation');
        messageElement.innerHTML = getTranslation(`confirm_delete_message_${data.type}`, 'confirmation').replace('{name}', `<strong>${name}</strong>`);
        confirmButton.textContent = getTranslation('delete', 'confirmation');
        
        onConfirmCallback = onConfirm;
        confirmButton.onclick = () => {
            if (typeof onConfirmCallback === 'function') onConfirmCallback();
            hideModal();
        };

    } else if (type === 'suggestion') {
        const form = activeModal.querySelector('#suggestion-form');
        form.onsubmit = (e) => {
            e.preventDefault();
            console.log('Suggestion submitted:', {
                type: form.elements['suggestion-type'].value,
                text: form.elements['suggestion-text'].value
            });
            // Aquí iría la lógica para enviar el formulario
            hideModal();
        };
    }

    activeModal.querySelector('.cancel-btn').onclick = hideModal;
    activeModal.onclick = (e) => {
        if (e.target === activeModal) {
            hideModal();
        }
    };

    requestAnimationFrame(() => {
        activeModal.classList.add('active');
    });
}

export function hideModal() {
    if (!activeModal) return;
    activeModal.classList.remove('active');
    setTimeout(destroyActiveModal, 300);
}

// Mapeo para las traducciones de confirmación
const typeToTranslationKey = {
    'alarm': 'alarms',
    'timer': 'timer',
    'world-clock': 'world_clock',
    'audio': 'sounds'
};