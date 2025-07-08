// ========== DYNAMIC ISLAND CONTROLLER - REFACTORIZADO CON CLASES ==========

import { translateElementTree } from './translations-controller.js';

let dynamicIslandElement = null;
let notificationTimeout = null;
let dismissCallback = null;
let currentRingingToolId = null;
let isAnimating = false;

const NOTIFICATION_DISPLAY_DURATION = 5000;
const ANIMATION_TIMING = {
    APPEAR: 600,
    DISAPPEAR: 400,
    CONTENT_DELAY: 300,
    DISMISS_BUTTON_DELAY: 200
};

const ICONS = {
    'alarm': 'alarm',
    'timer': 'timer',
    'worldclock': 'schedule',
    'system_info': 'info',
    'system_error': 'error',
    'system_success': 'check_circle',
    'default': 'info'
};

function createDynamicIslandDOM() {
    if (document.querySelector('.dynamic-island')) return;

    dynamicIslandElement = document.createElement('div');
    dynamicIslandElement.className = 'dynamic-island';

    dynamicIslandElement.innerHTML = `
        <div class="island-notification-content">
            <div class="island-main-content">
                <div class="island-left">
                    <div class="island-circle">
                        <span class="material-symbols-rounded notification-icon-symbol"></span>
                    </div>
                </div>
                <div class="island-center">
                    <div class="notification-text-info">
                        <p class="notification-title" data-translate="" data-translate-category="notifications"></p>
                        <p class="notification-message" data-translate="" data-translate-category="notifications"></p>
                    </div>
                </div>
            </div>
            <div class="island-right">
                <button class="island-dismiss-button" data-action="dismiss-active-tool" data-translate="dismiss" data-translate-category="notifications">
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dynamicIslandElement);

    const dismissButton = dynamicIslandElement.querySelector('.island-dismiss-button');
    if (dismissButton) {
        dismissButton.addEventListener('click', handleDismissClick);
    }
}

function handleDismissClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dismissCallback && typeof dismissCallback === 'function') {
        dismissCallback(currentRingingToolId);
    }
    hideDynamicIsland();
}

function destroyDynamicIslandDOM() {
    if (dynamicIslandElement) {
        const dismissButton = dynamicIslandElement.querySelector('.island-dismiss-button');
        if (dismissButton) {
            dismissButton.removeEventListener('click', handleDismissClick);
        }
        dynamicIslandElement.remove();
        dynamicIslandElement = null;
    }
}

export function showDynamicIslandNotification(toolType, actionType, messageKey, category, data = {}, onDismiss = null) {
    if (isAnimating) {
        setTimeout(() => {
            showDynamicIslandNotification(toolType, actionType, messageKey, category, data, onDismiss);
        }, 100);
        return;
    }

    if (!dynamicIslandElement) {
        createDynamicIslandDOM();
    }
    if (!dynamicIslandElement) return;

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    dynamicIslandElement.classList.remove('active-tool-ringing', 'active', 'appearing', 'disappearing');

    isAnimating = true;

    setupNotificationContent(toolType, actionType, messageKey, category, data);

    if (actionType === 'ringing') {
        dismissCallback = onDismiss;
        currentRingingToolId = data.toolId;
    } else {
        dismissCallback = null;
        currentRingingToolId = null;
    }

    requestAnimationFrame(() => {
        startAppleStyleAppearAnimation(actionType);
    });

    console.log(`🏝️ Dynamic Island: ${toolType} ${actionType} - Class-based animation`);
}

function setupNotificationContent(toolType, actionType, messageKey, category, data) {
    const iconSymbol = dynamicIslandElement.querySelector('.notification-icon-symbol');
    const titleP = dynamicIslandElement.querySelector('.notification-title');
    const messageP = dynamicIslandElement.querySelector('.notification-message');

    if (!iconSymbol || !titleP || !messageP) return;

    let iconKey = toolType.toLowerCase();
    if (toolType === 'system') {
        if (actionType.includes('error') || actionType.includes('limit')) iconKey = 'system_error';
        else if (actionType.includes('success') || actionType.includes('deleted')) iconKey = 'system_success';
        else iconKey = 'system_info';
    }
    iconSymbol.textContent = ICONS[iconKey] || ICONS.default;

    let titleKey;
    let finalMessageKey = messageKey;

    if (actionType === 'limit_reached') {
        titleKey = 'limit_reached_title';
        finalMessageKey = 'limit_reached_message_premium';
    } else if (toolType === 'system') {
        titleKey = `${actionType}_title`;
    } else {
        titleKey = `${toolType.toLowerCase()}_${actionType}_title`;
    }

    titleP.setAttribute('data-translate', titleKey);
    titleP.setAttribute('data-translate-category', 'notifications');
    messageP.setAttribute('data-translate', finalMessageKey);

    if (data && Object.keys(data).length > 0) {
        messageP.setAttribute('data-placeholders', JSON.stringify(data));
    } else {
        messageP.removeAttribute('data-placeholders');
    }

    if (typeof translateElementTree === 'function') {
        translateElementTree(dynamicIslandElement);
    }
}

function startAppleStyleAppearAnimation(actionType) {
    dynamicIslandElement.classList.add('appearing');

    setTimeout(() => {
        dynamicIslandElement.classList.remove('appearing');
        dynamicIslandElement.classList.add('active');

        setTimeout(() => {
            const content = dynamicIslandElement.querySelector('.island-notification-content');
            if (content) {
                // **CAMBIO:** Usar clases para la animación de contenido
                content.classList.add('content-visible');
            }

            if (actionType === 'ringing') {
                setTimeout(() => {
                    dynamicIslandElement.classList.add('active-tool-ringing');
                }, ANIMATION_TIMING.DISMISS_BUTTON_DELAY);
            } else {
                notificationTimeout = setTimeout(() => {
                    hideDynamicIsland();
                }, NOTIFICATION_DISPLAY_DURATION);
            }

            isAnimating = false;

        }, ANIMATION_TIMING.CONTENT_DELAY);

    }, 100);
}

export function hideDynamicIsland() {
    if (!dynamicIslandElement || isAnimating) return;

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    isAnimating = true;

    const content = dynamicIslandElement.querySelector('.island-notification-content');
    if (content) {
        // **CAMBIO:** Usar clases para la animación de contenido
        content.classList.remove('content-visible');
    }

    setTimeout(() => {
        dynamicIslandElement.classList.remove('active', 'active-tool-ringing');
        dynamicIslandElement.classList.add('disappearing');

        setTimeout(() => {
            resetIslandState();
            destroyDynamicIslandDOM();
            isAnimating = false;
        }, ANIMATION_TIMING.DISAPPEAR);

    }, 150);
}

function resetIslandState() {
    dismissCallback = null;
    currentRingingToolId = null;
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

export function updateDynamicIslandContent(newTitle, newMessage) {
    if (!dynamicIslandElement || !dynamicIslandElement.classList.contains('active')) return;
    const titleElement = dynamicIslandElement.querySelector('.notification-title');
    const messageElement = dynamicIslandElement.querySelector('.notification-message');
    if (titleElement && newTitle) titleElement.textContent = newTitle;
    if (messageElement && newMessage) messageElement.textContent = newMessage;
}

export function updateDynamicIslandIcon(newIconName) {
    if (!dynamicIslandElement || !dynamicIslandElement.classList.contains('active')) return;
    const iconElement = dynamicIslandElement.querySelector('.notification-icon-symbol');
    if (iconElement && newIconName) iconElement.textContent = newIconName;
}

export function extendNotificationDisplay(additionalTime = 3000) {
    if (notificationTimeout && !currentRingingToolId) {
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => hideDynamicIsland(), additionalTime);
    }
}

export function isDynamicIslandVisible() {
    return dynamicIslandElement && (dynamicIslandElement.classList.contains('active') || dynamicIslandElement.classList.contains('appearing'));
}

export function hasRingingTool() {
    return dynamicIslandElement && dynamicIslandElement.classList.contains('active-tool-ringing');
}

export function forceHideDynamicIsland() {
    if (dynamicIslandElement) {
        isAnimating = false;
        resetIslandState();
        destroyDynamicIslandDOM();
    }
}

function handleWindowResize() {
    if (!dynamicIslandElement) return;
    // **CAMBIO:** Usar una clase para manejar el tamaño en viewports pequeños
    const isSmallViewport = window.innerWidth < 360;
    dynamicIslandElement.classList.toggle('small-viewport', isSmallViewport);
}

window.addEventListener('resize', handleWindowResize);
window.addEventListener('beforeunload', () => {
    forceHideDynamicIsland();
    window.removeEventListener('resize', handleWindowResize);
});