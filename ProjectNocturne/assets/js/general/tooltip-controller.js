// ========== OPTIMIZED TOOLTIP SYSTEM - UNIFIED WITH DYNAMIC ELEMENTS FIX ==========

// ========== SYSTEM CONFIGURATION ==========
const TOOLTIP_ENABLED = true;

// ========== GLOBAL SYSTEM VARIABLES ==========
let tooltip = null;
let popperInstance = null;
let enabled = TOOLTIP_ENABLED;
let popperLoaded = false;
let activeElement = null;
const attachedElements = new WeakSet();
let tooltipResizeHandler = null;
let isRefreshingTooltips = false;
let isSystemInitialized = false;

let getTranslationFunction = null;

// ========== TOOLTIP MAPS BASED ON DATA-TOOLTIP (FALLBACK) ==========
let tooltipTextMap = {
    'Menu': 'Menu',
    'Settings': 'Settings',
    'Everything': 'Home',
    'Alarms': 'Alarms',
    'Stopwatch': 'Stopwatch',
    'Timer': 'Timer',
    'World Clock': 'World Clock'
};

// ========== UNIFIED OPTIMIZED INITIALIZATION FUNCTION ==========
function initializeTooltipSystem() {
    return new Promise((resolve, reject) => {
        if (!enabled) {
            resolve();
            return;
        }

        if (isSystemInitialized) {
            resolve();
            return;
        }

        function startTooltipSystem() {
            try {
                cleanupAllTooltips();
                attachEventListeners();
                handleWindowResize();

                isSystemInitialized = true;

                const event = new CustomEvent('tooltipSystemReady');
                document.dispatchEvent(event);

                resolve();
            } catch (error) {
                console.error('Error starting tooltip system:', error);
                reject(error);
            }
        }

        if (typeof Popper !== 'undefined') {
            popperLoaded = true;
            startTooltipSystem();
        } else {
            loadPopperJS(() => {
                startTooltipSystem();
            });
        }
    });
}

// ========== DEPENDENCY LOADING FUNCTIONS ==========
function loadPopperJS(callback) {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@popperjs/core@2';
    script.onload = () => {
        popperLoaded = true;
        callback();
    };
    script.onerror = () => {
        popperLoaded = false;
        console.error('Failed to load Popper.js. Tooltips will be disabled.');
        disableTooltips();
    };
    document.head.appendChild(script);
}

// ========== POSITION DETECTION FUNCTIONS ==========
function detectBestPlacement(element) {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const tooltipWidth = 150;
    const tooltipHeight = 40;
    const margin = 10;

    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;

    const placements = [
        {
            name: 'bottom',
            space: spaceBottom,
            condition: spaceBottom >= tooltipHeight + margin
        },
        {
            name: 'top',
            space: spaceTop,
            condition: spaceTop >= tooltipHeight + margin
        },
        {
            name: 'right',
            space: spaceRight,
            condition: spaceRight >= tooltipWidth + margin
        },
        {
            name: 'left',
            space: spaceLeft,
            condition: spaceLeft >= tooltipWidth + margin
        }
    ];

    for (let i = 0; i < placements.length; i++) {
        const placement = placements[i];
        if (placement.condition) {
            return placement.name;
        }
    }

    const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);

    if (maxSpace === spaceBottom) return 'bottom';
    if (maxSpace === spaceTop) return 'top';
    if (maxSpace === spaceRight) return 'right';
    return 'left';
}

// ========== TEXT RETRIEVAL ==========

function getTooltipText(element) {
    const isColorElement = element.classList.contains('color-content');
    const colorHex = element.getAttribute('data-hex');
    const isGradient = colorHex && (colorHex.startsWith('linear-gradient') || colorHex.startsWith('radial-gradient'));
    const isBlocked = isColorElement && isColorBlockedForTheme(element);
    let unavailableText = '';

    if (isBlocked && getTranslationFunction) {
        unavailableText = getTranslationFunction('color_unavailable', 'color_system');
        if (unavailableText && unavailableText !== 'color_unavailable') {
            unavailableText = ` (${unavailableText})`;
        } else {
            unavailableText = ' (Not available)';
        }
    } else if (isBlocked) {
        unavailableText = ' (Not available)';
    }

    if (isGradient) {
        const hexRegex = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g;
        const matches = colorHex.match(hexRegex);
        if (matches && matches.length >= 2) {
            const hex1 = matches[0];
            const hex2 = matches[1];

            const gradientPhrase = getTranslationFunction('linear_gradient_90deg', 'tooltips') || 'Linear Gradient 90°';
            const separator = getTranslationFunction('color_separator', 'tooltips') || ': ';

            return `${gradientPhrase}${separator}${hex1}, ${hex2}`;
        } else {
            const translateKey = element.getAttribute('data-translate');
            const translateCategory = element.getAttribute('data-translate-category') || 'tooltips';
            if (typeof window.getTranslation === 'function') {
                const translatedText = window.getTranslation(translateKey, translateCategory);
                if (translatedText && translatedText !== translateKey) {
                    return translatedText;
                }
            }
            return translateKey;
        }
    }

    if (element.hasAttribute('data-translate') && element.getAttribute('data-translate-target') === 'tooltip') {
        const translateKey = element.getAttribute('data-translate');
        const translateCategory = element.getAttribute('data-translate-category') || 'tooltips';

        if (typeof window.getTranslation === 'function') {
            const translatedText = window.getTranslation(translateKey, translateCategory);
            if (translatedText && translatedText !== translateKey) {
                return translatedText + unavailableText;
            }
        }
        const fallbackText = translateKey;
        return fallbackText + unavailableText;
    }

    if (element.dataset.tooltip) {
        const tooltipKey = element.dataset.tooltip;
        let tooltipText;
        if (typeof window.getTranslation === 'function' && tooltipKey in (window.translations?.tooltips || {})) {
            const translatedText = window.getTranslation(tooltipKey, 'tooltips');
            if (translatedText && translatedText !== tooltipKey) {
                tooltipText = translatedText;
            } else {
                tooltipText = tooltipTextMap[tooltipKey] || tooltipKey;
            }
        } else {
            tooltipText = tooltipTextMap[tooltipKey] || tooltipKey;
        }

        return tooltipText + unavailableText;
    }

    if (element.dataset.originalTitle) {
        const originalTitle = element.dataset.originalTitle;
        return originalTitle + unavailableText;
    }

    if (element.title) {
        const title = element.title;
        return title + unavailableText;
    }

    return null;
}

function isColorBlockedForTheme(element) {
    if (!element.classList.contains('color-content')) {
        return false;
    }

    const colorHex = element.getAttribute('data-hex');
    if (!colorHex || colorHex === 'auto') {
        return false;
    }

    if (typeof window.colorTextManager === 'object' &&
        typeof window.colorTextManager.isValidForTheme === 'function') {
        return !window.colorTextManager.isValidForTheme(colorHex);
    }

    try {
        if (typeof chroma !== 'undefined') {
            const color = chroma(colorHex);
            const luminance = color.luminance();
            const html = document.documentElement;
            const isDarkMode = html.classList.contains('dark-mode');

            return isDarkMode ? luminance < 0.08 : luminance > 0.92;
        }
    } catch (e) {
        return false;
    }

    return false;
}

// ========== CLEANUP FUNCTIONS ==========
function cleanupAllTooltips() {
    const existingTooltips = document.querySelectorAll('#tooltip, .tooltip');
    for (let i = 0; i < existingTooltips.length; i++) {
        existingTooltips[i].remove();
    }

    if (popperInstance) {
        try {
            popperInstance.destroy();
        } catch (error) {
            console.error('Error destroying Popper instance during cleanup:', error);
        }
        popperInstance = null;
    }

    tooltip = null;
    activeElement = null;
}

// ========== OPTIMIZED SHOW/HIDE TOOLTIP FUNCTIONS ==========
function showTooltip(element) {
    if (!enabled || !popperLoaded || !element) return;

    const tooltipText = getTooltipText(element);
    if (!tooltipText || tooltipText.trim() === '') {
        return;
    }

    hideTooltip();

    tooltip = document.createElement('div');
    tooltip.id = 'tooltip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);

    tooltip.textContent = tooltipText;
    tooltip.style.display = 'block';

    const bestPlacement = detectBestPlacement(element);

    try {
        popperInstance = Popper.createPopper(element, tooltip, {
            placement: bestPlacement,
            modifiers: [
                {
                    name: 'offset',
                    options: {
                        offset: [0, 10],
                    },
                },
                {
                    name: 'flip',
                    options: {
                        fallbackPlacements: ['top', 'right', 'bottom', 'left'],
                    },
                },
                {
                    name: 'preventOverflow',
                    options: {
                        boundary: 'viewport',
                        padding: 8,
                    },
                },
            ],
        });

        activeElement = element;
    } catch (error) {
        console.error('Error creating Popper instance:', error);
        hideTooltip();
    }
}

function hideTooltip() {
    if (popperInstance) {
        try {
            popperInstance.destroy();
        } catch (error) {
            console.error('Error destroying Popper instance:', error);
        }
        popperInstance = null;
    }

    if (tooltip) {
        try {
            tooltip.remove();
        } catch (error) {
            console.error('Error removing tooltip:', error);
        }
        tooltip = null;
    }

    activeElement = null;
}

// ========== OPTIMIZED MOBILE SIDEBAR SPECIFIC FUNCTION ==========

function initializeMobileSidebarTooltips() {
    const mobileSidebarButtons = document.querySelectorAll('.mobile-sidebar .sidebar-button');

    mobileSidebarButtons.forEach(button => {
        if (attachedElements.has(button)) return;
        attachedElements.add(button);

        if (button._tooltipHandlers) {
            button.removeEventListener('mouseenter', button._tooltipHandlers.mouseenter);
            button.removeEventListener('mouseleave', button._tooltipHandlers.mouseleave);
            button.removeEventListener('click', button._tooltipHandlers.click);
        }

        const mouseEnterHandler = () => showTooltip(button);
        const mouseLeaveHandler = () => hideTooltip();
        const clickHandler = () => hideTooltip();

        button.addEventListener('mouseenter', mouseEnterHandler);
        button.addEventListener('mouseleave', mouseLeaveHandler);
        button.addEventListener('click', clickHandler);

        button._tooltipHandlers = {
            mouseenter: mouseEnterHandler,
            mouseleave: mouseLeaveHandler,
            click: clickHandler
        };
    });
}

// ========== HELPER AND EVENT ATTACHMENT FUNCTIONS (REFACTORED) ==========
function _attachListenersToSingleElement(element) {
    if (attachedElements.has(element)) return;
    attachedElements.add(element);

    if (element.title && !element.dataset.originalTitle) {
        element.dataset.originalTitle = element.title;
        element.title = '';
    }

    if (element._tooltipHandlers) {
        element.removeEventListener('mouseenter', element._tooltipHandlers.mouseenter);
        element.removeEventListener('mouseleave', element._tooltipHandlers.mouseleave);
        element.removeEventListener('click', element._tooltipHandlers.click);
    }

    const mouseEnterHandler = () => showTooltip(element);
    const mouseLeaveHandler = () => hideTooltip();
    const clickHandler = () => hideTooltip();

    element.addEventListener('mouseenter', mouseEnterHandler);
    element.addEventListener('mouseleave', mouseLeaveHandler);
    element.addEventListener('click', clickHandler);

    element._tooltipHandlers = {
        mouseenter: mouseEnterHandler,
        mouseleave: mouseLeaveHandler,
        click: clickHandler
    };
}

function attachEventListeners() {
    const targetSelectors = [
        '.header-button[data-translate-target="tooltip"]',
        '.sidebar-button[data-translate-target="tooltip"]',
        '.color-content[data-translate-target="tooltip"]',
        '.menu-link[data-translate-target="tooltip"]',
        '[data-translate][data-translate-target="tooltip"]',
        '[data-tooltip]',
    ];
    const selectorString = targetSelectors.join(',');

    const elements = document.querySelectorAll(selectorString);
    elements.forEach(element => {
        if (element.classList.contains('menu-link') && !element.classList.contains('color-content')) {
            return;
        }
        _attachListenersToSingleElement(element);
    });
}

function handleWindowResize() {
    const resizeHandler = () => {
        if (popperInstance) {
            try {
                popperInstance.update();
            } catch (error) {
                console.error('Error updating Popper instance on resize:', error);
                hideTooltip();
            }
        }
    };

    if (tooltipResizeHandler) {
        window.removeEventListener('resize', tooltipResizeHandler);
    }

    window.addEventListener('resize', resizeHandler);
    tooltipResizeHandler = resizeHandler;
}

// ========== PUBLIC FUNCTIONS ==========
function enableTooltips() {
    enabled = true;
    if (popperLoaded && !isSystemInitialized) {
        initializeTooltipSystem();
    }
}

function disableTooltips() {
    enabled = false;
    cleanupAllTooltips();

    isSystemInitialized = false;
}

function isTooltipSystemEnabled() {
    return enabled;
}

function addTooltip(element, text) {
    if (!enabled) return;

    if (typeof element === 'string') {
        element = document.querySelector(element);
    }

    if (!element) return;

    element.setAttribute('data-translate', text);
    element.setAttribute('data-translate-category', 'tooltips');
    element.setAttribute('data-translate-target', 'tooltip');
    element.removeAttribute('data-tooltip');
    element.removeAttribute('title');

    if (isSystemInitialized) {
        refreshTooltips();
    }
}

function updateTooltip(element, newText) {
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }

    if (!element) return;

    element.setAttribute('data-translate', newText);
    element.setAttribute('data-translate-category', 'tooltips');
    element.setAttribute('data-translate-target', 'tooltip');

    if (activeElement === element && tooltip) {
        const translatedText = getTooltipText(element);
        tooltip.textContent = translatedText;
    }
}

let refreshTooltipsTimeout = null;

function refreshTooltips() {
    if (!enabled || !isSystemInitialized) return;

    if (refreshTooltipsTimeout) {
        clearTimeout(refreshTooltipsTimeout);
    }

    refreshTooltipsTimeout = setTimeout(() => {
        isRefreshingTooltips = true;
        try {
   
            attachEventListeners();

        } catch (error) {
            console.error('❌ Error refreshing tooltips:', error);
        } finally {
            isRefreshingTooltips = false;
            refreshTooltipsTimeout = null;
        }
    }, 50);
}

// ========== ELEMENT MIGRATION FUNCTIONS ==========

function migrateTooltipToNewSystem(element, translateKey, category = 'tooltips') {
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }

    if (!element) return;

    element.removeAttribute('data-tooltip');
    if (element.hasAttribute('title')) {
        element.dataset.originalTitle = element.title;
        element.title = '';
    }

    element.setAttribute('data-translate', translateKey);
    element.setAttribute('data-translate-category', category);
    element.setAttribute('data-translate-target', 'tooltip');
}

function batchMigrateTooltips() {
    const migrationsMap = [
        { selector: '[data-tooltip="Menu"]', key: 'menu' },
        { selector: '[data-tooltip="Settings"]', key: 'settings' },
        { selector: '[data-tooltip="Everything"]', key: 'everything' },
        { selector: '[data-tooltip="Alarms"]', key: 'alarms' },
        { selector: '[data-tooltip="Stopwatch"]', key: 'stopwatch' },
        { selector: '[data-tooltip="Timer"]', key: 'timer' },
        { selector: '[data-tooltip="World Clock"]', key: 'world_clock' },
    ];

    migrationsMap.forEach(migration => {
        const elements = document.querySelectorAll(migration.selector);
        elements.forEach(element => {
            migrateTooltipToNewSystem(element, migration.key, migration.category);
        });
    });

    if (isSystemInitialized) {
        refreshTooltips();
    }
}

// ========== TOOLTIP MAPS MANAGEMENT ==========
function addTooltipText(key, text) {
    tooltipTextMap[key] = text;
}

function updateTooltipText(key, newText) {
    if (tooltipTextMap[key]) {
        tooltipTextMap[key] = newText;
    }
}

function removeTooltipText(key) {
    if (tooltipTextMap[key]) {
        delete tooltipTextMap[key];
    }
}

function getTooltipTextMap() {
    return { ...tooltipTextMap };
}

function setTooltipTextMap(newMap) {
    tooltipTextMap = { ...newMap };
}

function updateTooltipTextMapFromTranslations(translationMap) {
    if (translationMap && typeof translationMap === 'object' && translationMap.tooltips) {
        Object.assign(tooltipTextMap, translationMap.tooltips);
        refreshTooltips();
    }
}

function setTranslationGetter(translationFn) {
    getTranslationFunction = translationFn;
}

// ========== NEW TARGETED FUNCTION FOR DYNAMIC CONTENT ==========
function attachTooltipsToNewElements(container) {
    if (!enabled || !isSystemInitialized || !container) return;

    const targetSelectors = [
        '.header-button[data-translate-target="tooltip"]',
        '.sidebar-button[data-translate-target="tooltip"]',
        '.color-content[data-translate-target="tooltip"]',
        '.menu-link[data-translate-target="tooltip"]',
        '[data-translate][data-translate-target="tooltip"]',
        '[data-tooltip]',
    ];
    const selectorString = targetSelectors.join(',');

    const elements = container.querySelectorAll(selectorString);
    elements.forEach(_attachListenersToSingleElement);

    if (container.matches(selectorString)) {
        _attachListenersToSingleElement(container);
    }
}

// ========== COMPLETE RESET AND CLEANUP ==========
function resetTooltipSystem() {
    cleanupAllTooltips();
    isSystemInitialized = false;
    mobileSidebarInitialized = false;
    isRefreshingTooltips = false;

    if (refreshTooltipsTimeout) {
        clearTimeout(refreshTooltipsTimeout);
        refreshTooltipsTimeout = null;
    }
    if (tooltipResizeHandler) {
        window.removeEventListener('resize', tooltipResizeHandler);
        tooltipResizeHandler = null;
    }
    initializeTooltipSystem();
}

window.addEventListener('beforeunload', () => {
    cleanupAllTooltips();
    if (refreshTooltipsTimeout) {
        clearTimeout(refreshTooltipsTimeout);
    }
    if (tooltipResizeHandler) {
        window.removeEventListener('resize', tooltipResizeHandler);
    }
});

// ========== DEBUG FUNCTIONS ==========
function debugTooltipSystem() {
    console.group('🐛 Tooltip System Debug');
    console.log('System initialized:', isSystemInitialized);
    console.log('Refresh in progress:', isRefreshingTooltips);
    console.log('Popper loaded:', popperLoaded);
    console.log('System enabled:', enabled);
    console.log('WeakSet in use for unique elements');
    console.log('Active element:', activeElement);
    console.log('Current tooltip DOM:', tooltip);
    console.log('TooltipTextMap (current definitions):', tooltipTextMap);
    console.log('Translation Function Available:', !!getTranslationFunction);
    console.groupEnd();
}

function getTooltipSystemStatus() {
    return {
        isSystemInitialized,
        isRefreshingTooltips,
        popperLoaded,
        enabled,
        usingWeakSet: true,
        hasActiveElement: !!activeElement,
        hasActiveTooltip: !!tooltip,
        translationFunctionAvailable: !!getTranslationFunction
    };
}

// ========== EXPORTS ==========
export {
    addTooltip, addTooltipText, attachTooltipsToNewElements, batchMigrateTooltips, debugTooltipSystem,
    disableTooltips, enableTooltips, getTooltipSystemStatus, getTooltipTextMap, initializeMobileSidebarTooltips,
    initializeTooltipSystem, isTooltipSystemEnabled, migrateTooltipToNewSystem, refreshTooltips,
    removeTooltipText, resetTooltipSystem, setTooltipTextMap, setTranslationGetter
};

export {
    updateTooltip, updateTooltipText, updateTooltipTextMapFromTranslations as updateTooltipTextMap
};