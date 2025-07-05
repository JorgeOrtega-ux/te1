// ========== DYNAMIC ISLAND CONTROLLER - IMPROVED APPLE-STYLE ========== 

import { translateElementTree } from './translations-controller.js';
import { PREMIUM_FEATURES } from '../general/main.js';

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
    'system_premium': 'workspace_premium',
    'system_success': 'check_circle',
    'default': 'info'
};

function createDynamicIslandDOM() {
    if (document.querySelector('.dynamic-island')) return;

    dynamicIslandElement = document.createElement('div');
    dynamicIslandElement.className = 'dynamic-island';

    dynamicIslandElement.innerHTML = `
        <div class="island-notification-content">
            <div class="island-left-group">
                <div class="island-circle">
                    <span class="material-symbols-rounded notification-icon-symbol"></span>
                </div>
                <div class="notification-text-info">
                    <p class="notification-title" data-translate="" data-translate-category="notifications"></p>
                    <p class="notification-message" data-translate="" data-translate-category="notifications"></p>
                </div>
            </div>
            <button class="island-dismiss-button" data-action="dismiss-active-tool" data-translate="dismiss" data-translate-category="notifications">
            </button>
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
        // Remover event listeners para evitar memory leaks
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

    // Limpiar timeout anterior si existe
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }

    // Reset de clases para nueva animación
    dynamicIslandElement.classList.remove('active-tool-ringing', 'active', 'appearing', 'disappearing');

    isAnimating = true;

    // Configurar contenido antes de la animación
    setupNotificationContent(toolType, actionType, messageKey, category, data);

    // Configurar callbacks y estado
    if (actionType === 'ringing') {
        dismissCallback = onDismiss;
        currentRingingToolId = data.toolId;
    } else {
        dismissCallback = null;
        currentRingingToolId = null;
    }

    // Iniciar animación de aparición estilo Apple
    requestAnimationFrame(() => {
        startAppleStyleAppearAnimation(actionType);
    });

    console.log(`🏝️ Dynamic Island: ${toolType} ${actionType} - Apple-style animation`);
}

function setupNotificationContent(toolType, actionType, messageKey, category, data) {
    const iconSymbol = dynamicIslandElement.querySelector('.notification-icon-symbol');
    const titleP = dynamicIslandElement.querySelector('.notification-title');
    const messageP = dynamicIslandElement.querySelector('.notification-message');

    if (!iconSymbol || !titleP || !messageP) return;

    // Configurar ícono
    let iconKey = toolType.toLowerCase();
    if (toolType === 'system') {
        if (actionType.includes('error')) iconKey = 'system_error';
        else if (actionType.includes('premium') || actionType.includes('limit')) iconKey = 'system_premium';
        else if (actionType.includes('success') || actionType.includes('deleted')) iconKey = 'system_success';
        else iconKey = 'system_info';
    }
    iconSymbol.textContent = ICONS[iconKey] || ICONS.default;

    // Configurar título
    let titleKey;
    let finalMessageKey = messageKey;

    if (actionType === 'limit_reached') {
        titleKey = 'limit_reached_title';
        finalMessageKey = PREMIUM_FEATURES ? 'limit_reached_message_premium' : 'premium_limit_reached_message';
    } else if (toolType === 'system') {
        if (actionType === 'premium_required') {
             titleKey = 'premium_required_title';
        } else {
             titleKey = `${actionType}_title`;
        }
    } else {
        titleKey = `${toolType.toLowerCase()}_${actionType}_title`;
    }

    // Configurar atributos de traducción
    titleP.setAttribute('data-translate', titleKey);
    titleP.setAttribute('data-translate-category', 'notifications');

    messageP.setAttribute('data-translate', finalMessageKey);
    if (data && Object.keys(data).length > 0) {
        messageP.setAttribute('data-placeholders', JSON.stringify(data));
    } else {
        messageP.removeAttribute('data-placeholders');
    }

    // Aplicar traducciones
    if (typeof translateElementTree === 'function') {
        translateElementTree(dynamicIslandElement);
    }
}

function startAppleStyleAppearAnimation(actionType) {
    // Fase 1: Aparecer como círculo pequeño
    dynamicIslandElement.classList.add('appearing');
    
    // Fase 2: Expandir y activar después de un delay
    setTimeout(() => {
        dynamicIslandElement.classList.remove('appearing');
        dynamicIslandElement.classList.add('active');
        
        // Fase 3: Mostrar contenido con delay para suavidad
        setTimeout(() => {
            const content = dynamicIslandElement.querySelector('.island-notification-content');
            if (content) {
                content.style.opacity = '1';
                content.style.transform = 'scale(1)';
            }
            
            // Fase 4: Si es ringing, agregar clase y mostrar botón dismiss
            if (actionType === 'ringing') {
                setTimeout(() => {
                    dynamicIslandElement.classList.add('active-tool-ringing');
                }, ANIMATION_TIMING.DISMISS_BUTTON_DELAY);
            } else {
                // Para notificaciones normales, programar ocultamiento automático
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

    // Fase 1: Ocultar contenido primero
    const content = dynamicIslandElement.querySelector('.island-notification-content');
    if (content) {
        content.style.opacity = '0';
        content.style.transform = 'scale(0.9)';
    }

    // Fase 2: Contraer y hacer desaparecer estilo Apple
    setTimeout(() => {
        dynamicIslandElement.classList.remove('active', 'active-tool-ringing');
        dynamicIslandElement.classList.add('disappearing');
        
        // Fase 3: Destruir después de la animación
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

// Función para actualizar el contenido dinámicamente (para casos especiales)
export function updateDynamicIslandContent(newTitle, newMessage) {
    if (!dynamicIslandElement || !dynamicIslandElement.classList.contains('active')) return;

    const titleElement = dynamicIslandElement.querySelector('.notification-title');
    const messageElement = dynamicIslandElement.querySelector('.notification-message');

    if (titleElement && newTitle) {
        titleElement.textContent = newTitle;
    }
    if (messageElement && newMessage) {
        messageElement.textContent = newMessage;
    }
}

// Función para cambiar el ícono dinámicamente
export function updateDynamicIslandIcon(newIconName) {
    if (!dynamicIslandElement || !dynamicIslandElement.classList.contains('active')) return;

    const iconElement = dynamicIslandElement.querySelector('.notification-icon-symbol');
    if (iconElement && newIconName) {
        iconElement.textContent = newIconName;
    }
}

// Función para extender el tiempo de display de una notificación
export function extendNotificationDisplay(additionalTime = 3000) {
    if (notificationTimeout && !currentRingingToolId) {
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            hideDynamicIsland();
        }, additionalTime);
    }
}

// Función para verificar si la isla está visible
export function isDynamicIslandVisible() {
    return dynamicIslandElement && 
           (dynamicIslandElement.classList.contains('active') || 
            dynamicIslandElement.classList.contains('appearing'));
}

// Función para verificar si hay una herramienta sonando
export function hasRingingTool() {
    return dynamicIslandElement && 
           dynamicIslandElement.classList.contains('active-tool-ringing');
}

// Función de limpieza para casos de emergencia
export function forceHideDynamicIsland() {
    if (dynamicIslandElement) {
        isAnimating = false;
        resetIslandState();
        destroyDynamicIslandDOM();
    }
}

// Función para manejar cambios de tamaño de ventana
function handleWindowResize() {
    if (!dynamicIslandElement || !dynamicIslandElement.classList.contains('active')) return;
    
    // Recalcular posición si es necesario
    const rect = dynamicIslandElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Asegurar que la isla no se salga de la pantalla en dispositivos pequeños
    if (viewportWidth < 360 && dynamicIslandElement.classList.contains('active-tool-ringing')) {
        dynamicIslandElement.style.width = `${Math.min(320, viewportWidth - 40)}px`;
    }
}

// Event listeners para optimizaciones
window.addEventListener('resize', handleWindowResize);

// Cleanup al salir de la página
window.addEventListener('beforeunload', () => {
    forceHideDynamicIsland();
    window.removeEventListener('resize', handleWindowResize);
});