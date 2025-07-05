// ========== MODULE-MANAGER.JS - WITH PROCESS CANCELLATION ON MENU CLOSE ==========

// ========== IMPORTS AND DEPENDENCIES ==========

import { initializeMenuForOverlay, resetMenuForOverlay } from '../tools/menu-interactions.js';
import { applyLanguageStates, getCurrentLanguage, initLanguageManager, isLanguageChanging, resetLanguageStates, setLanguage, setLanguageChangeCallback, setTranslationFunction as setLanguageTranslationFunction, setupLanguageEventListeners, updateLanguageLabel } from './language-manager.js';
import { applyTheme, applyThemeStates, getCurrentTheme, initThemeManager, isThemeChanging, resetThemeStates, setThemeChangeCallback, setTranslationFunction as setThemeTranslationFunction, setupThemeEventListeners, updateThemeLabel } from './theme-manager.js';
import { isLocationChanging, cleanLocationChangeStates } from './location-manager.js';


// ========== CONSTANTS AND CONFIGURATION ==========

const TIMING_CONFIG = {
    MIN_INTERVAL_BETWEEN_OPERATIONS: 500,
    MOBILE_ANIMATION_DURATION: 300,
    STATE_RESET_DELAY: 200,
    MIN_VISIBILITY_CHECK_INTERVAL: 2000
};

const MODULE_TYPES = {
    CONTROL_CENTER: 'controlCenter',
    OVERLAY: 'overlay'
};

const MODULE_CONFIG = {
    controlCenter: {
        type: MODULE_TYPES.CONTROL_CENTER,
        defaultMenu: 'control_center',
        selectors: {
            toggle: '[data-module="toggleControlCenter"]',
            module: '.module-control-center'
        }
    },
    overlayContainer: {
        type: MODULE_TYPES.OVERLAY,
        selectors: {
            toggle: null,
            module: '.module-overlay'
        }
    }
};

const CONTROL_CENTER_MENUS = {
    'control_center': 'control_center',
    'appearance': 'appearance',
    'language': 'language',
    'settings': 'settings',
    'location': 'location'
};

const INDEPENDENT_OVERLAYS = {
    'menuAlarm': '[data-menu="Alarm"]',
    'menuTimer': '[data-menu="Timer"]',
    'menuWorldClock': '[data-menu="WorldClock"]',
    'menuPaletteColors': '[data-menu="paletteColors"]'
};

const TOGGLE_TO_MODULE_MAP = {
    'toggleControlCenter': 'controlCenter',
    'toggleMenuAlarm': 'overlayContainer',
    'toggleMenuTimer': 'overlayContainer',
    'toggleMenuWorldClock': 'overlayContainer',
    'togglePaletteColors': 'overlayContainer'
};

// ========== CENTRALIZED STATE ==========

const moduleState = {
    modules: {
        controlCenter: {
            active: false,
            type: MODULE_TYPES.CONTROL_CENTER,
            currentMenu: 'control_center'
        },
        overlayContainer: {
            active: false,
            type: MODULE_TYPES.OVERLAY,
            currentOverlay: null
        }
    },

    isModuleChanging: false,
    isApplyingStates: false,
    isUpdatingLabels: false,
    isSystemReady: false,
    initializationComplete: false,

    lastStateApplication: 0,
    lastLabelUpdate: 0
};

// ========== CACHED DOM REFERENCES ==========

const domCache = {
    controlCenter: {
        toggle: null,
        module: null
    },
    overlayContainer: {
        module: null
    },
    overlays: {}
};

// ========== EVENT DISPATCHER ==========
function dispatchModuleEvent(eventName, detail = {}) {
    const event = new CustomEvent(eventName, {
        detail: {
            ...detail,
            timestamp: Date.now()
        }
    });
    document.dispatchEvent(event);
}


// ========== CENTRALIZED CANCELLATION FUNCTION ==========

function cancelAllActiveProcesses(reason = 'unknown') {
    let processesCancelled = false;

    if (isThemeChanging()) {
        console.log(`🚫 Cancelling active theme change (${reason})`);

        cleanThemeChangeStates();
        processesCancelled = true;
    }

    if (isLanguageChanging()) {
        console.log(`🚫 Cancelling active language change (${reason})`);

        cleanLanguageChangeStates();
        processesCancelled = true;
    }

    if (isLocationChanging()) {
        console.log(`🚫 Cancelling active location change (${reason})`);
        cleanLocationChangeStates();
        processesCancelled = true;
    }

    return processesCancelled;
}

// ========== PRIVATE CLEANUP FUNCTIONS ==========

function cleanThemeChangeStates() {
    resetThemeStates();

    const themeLinks = document.querySelectorAll('.menu-link[data-theme]');
    const currentTheme = getCurrentTheme();

    themeLinks.forEach(link => {
        const linkTheme = link.getAttribute('data-theme');
        link.classList.remove('preview-active', 'disabled-interactive');

        const loaderDiv = link.querySelector('.menu-link-loader');
        if (loaderDiv) {
            loaderDiv.remove();
        }

        if (linkTheme === currentTheme) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function cleanLanguageChangeStates() {
    resetLanguageStates();

    const languageLinks = document.querySelectorAll('.menu-link[data-language]');
    const currentLanguage = getCurrentLanguage();

    languageLinks.forEach(link => {
        const linkLanguage = link.getAttribute('data-language');
        link.classList.remove('preview-active', 'disabled-interactive');

        const loaderDiv = link.querySelector('.menu-link-loader');
        if (loaderDiv) {
            loaderDiv.remove();
        }

        if (linkLanguage === currentLanguage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ========== SIMPLIFIED FUNCTIONS ==========

function cancelActiveProcessesOnModuleClose(moduleName) {
    return cancelAllActiveProcesses(`module-close:${moduleName}`);
}


// ========== MAIN INITIALIZATION ==========

function initModuleManager() {
    return new Promise((resolve, reject) => {
        if (moduleState.initializationComplete) {
            resolve();
            return;
        }

        Promise.all([
            initThemeManager(),
            initLanguageManager(),
            initializeDOMReferences(),
            initializeEventListeners()
        ])
            .then(() => {
                setupCallbacks();
                moduleState.isSystemReady = true;
                moduleState.initializationComplete = true;

                setTimeout(() => {
                    applyInitialStates();
                }, 100);

                resolve();
            })
            .catch(error => {
                console.error('❌ Error initializing Module Manager:', error);
                reject(error);
            });
    });
}

function setupCallbacks() {
    setThemeChangeCallback(() => {
        if (!moduleState.isUpdatingLabels) {
            updateMenuLabels();
        }
    });

    setLanguageChangeCallback(() => {
        if (!moduleState.isUpdatingLabels) {
            updateMenuLabels();
        }
    });
}

// ========== SUBSYSTEM INITIALIZATION ==========

function initializeDOMReferences() {
    return new Promise(resolve => {
        domCache.controlCenter.toggle = document.querySelector(MODULE_CONFIG.controlCenter.selectors.toggle);
        domCache.controlCenter.module = document.querySelector(MODULE_CONFIG.controlCenter.selectors.module);
        domCache.overlayContainer.module = document.querySelector(MODULE_CONFIG.overlayContainer.selectors.module);

        Object.keys(INDEPENDENT_OVERLAYS).forEach(overlayName => {
            domCache.overlays[overlayName] = document.querySelector(INDEPENDENT_OVERLAYS[overlayName]);
        });

        resolve();
    });
}

function initializeEventListeners() {
    return new Promise(resolve => {
        setupModuleEvents();
        setupThemeEventListeners();
        setupLanguageEventListeners();
        setupGlobalEvents();
        resolve();
    });
}

// ========== UPDATED CORE FUNCTIONS ==========

function activateModule(moduleName) {
    const normalizedName = normalizeModuleName(moduleName);

    if (!MODULE_CONFIG[normalizedName] || moduleState.isModuleChanging) {
        return;
    }

    moduleState.isModuleChanging = true;
    console.log('🔧 Activating module:', normalizedName);

    deactivateAllModules({ source: 'new-module-activation' });

    if (normalizedName === 'controlCenter') {
        activateControlCenter();
    } else if (normalizedName === 'overlayContainer') {
        activateOverlayContainer(moduleName);
    }

    dispatchModuleEvent('moduleActivated', { module: moduleName });

    setTimeout(() => {
        logModuleStates();
        moduleState.isModuleChanging = false;
    }, 50);
}

function deactivateModule(moduleName, options = {}) {
    const normalizedName = normalizeModuleName(moduleName);

    if (!MODULE_CONFIG[normalizedName] || !moduleState.modules[normalizedName]?.active) {
        return;
    }

    const { source = 'unknown', withMobileAnimation = false } = options;

    cancelActiveProcessesOnModuleClose(normalizedName);

    if (withMobileAnimation && window.innerWidth <= 468) {
        deactivateModuleWithAnimation(normalizedName, source);
    } else {
        performStandardDeactivation(normalizedName, source);
    }
}

function toggleModule(moduleName) {
    const normalizedName = normalizeModuleName(moduleName);

    if (!MODULE_CONFIG[normalizedName]) {
        console.warn(`Unknown module: ${moduleName}`);
        return;
    }

    const isActive = moduleState.modules[normalizedName]?.active || false;

    if (isActive) {
        const overlayContainer = domCache.overlayContainer.module;
        const currentToggle = getToggleFromOverlay(moduleState.modules.overlayContainer.currentOverlay);
        if (normalizedName === 'overlayContainer' && currentToggle !== moduleName) {
            activateModule(moduleName);
        } else {
            deactivateModule(normalizedName);
        }
    } else {
        activateModule(moduleName);
    }
}

function deactivateAllModules(options = {}) {
    const { source = 'unknown' } = options;
    cancelAllActiveProcesses(`deactivateAll due to ${source}`);

    Object.keys(moduleState.modules).forEach(moduleName => {
        if (moduleState.modules[moduleName].active) {
            performModuleDeactivation(moduleName);
        }
    });
}

// ========== MODULE SPECIFIC FUNCTIONS ==========

function activateControlCenter() {
    const controlCenterModule = domCache.controlCenter.module;

    if (controlCenterModule) {
        controlCenterModule.classList.remove('disabled');
        controlCenterModule.classList.add('active');
        moduleState.modules.controlCenter.active = true;

        showControlCenterMenu(moduleState.modules.controlCenter.currentMenu);
    }
}

function activateOverlayContainer(originalToggleName) {
    const overlayContainer = domCache.overlayContainer.module;

    if (overlayContainer) {
        overlayContainer.classList.remove('disabled');
        overlayContainer.classList.add('active');
        moduleState.modules.overlayContainer.active = true;

        const overlayToShow = getOverlayFromToggle(originalToggleName);
        if (overlayToShow) {
            showSpecificOverlay(overlayToShow);
            moduleState.modules.overlayContainer.currentOverlay = overlayToShow;

            initializeMenuForOverlay(overlayToShow);
        }
    }
}

function deactivateModuleWithAnimation(moduleName, source) {
    if (moduleState.isModuleChanging) return;

    moduleState.isModuleChanging = true;
    console.log('🔧 Closing module with animation:', moduleName, 'from:', source);

    let activeMenu = null;

    if (moduleName === 'controlCenter') {
        const controlCenterModule = domCache.controlCenter.module;
        activeMenu = controlCenterModule?.querySelector('.menu-control-center.active');
    } else if (moduleName === 'overlayContainer') {
        const overlayContainer = domCache.overlayContainer.module;
        const currentOverlay = moduleState.modules.overlayContainer.currentOverlay;
        if (currentOverlay) {
            activeMenu = domCache.overlays[currentOverlay];
        }
    }

    if (activeMenu) {
        performMobileCloseAnimation(activeMenu, () => {
            performModuleDeactivation(moduleName);
            logModuleStates();
        });
    } else {
        performModuleDeactivation(moduleName);
        logModuleStates();
        moduleState.isModuleChanging = false;
    }
}

function performStandardDeactivation(moduleName, source) {
    if (!moduleState.isModuleChanging) {
        moduleState.isModuleChanging = true;
        console.log('🔧 Closing module:', moduleName, 'from:', source);

        performModuleDeactivation(moduleName);
        logModuleStates();

        setTimeout(() => {
            moduleState.isModuleChanging = false;
        }, 50);
    }
}

function performModuleDeactivation(moduleName) {
    let deactivatedToggle = null;
    const module = moduleState.modules[moduleName];

    if (moduleName === 'controlCenter') {
        const controlCenterModule = domCache.controlCenter.module;
        if (controlCenterModule) {
            controlCenterModule.classList.remove('active');
            controlCenterModule.classList.add('disabled');
            module.active = false;
            deactivatedToggle = 'toggleControlCenter';
            resetControlCenterToDefaultMenu();
        }
    } else if (moduleName === 'overlayContainer') {
        const overlayContainer = domCache.overlayContainer.module;
        if (overlayContainer) {
            overlayContainer.classList.remove('active');
            overlayContainer.classList.add('disabled');
            module.active = false;

            const overlayToReset = module.currentOverlay;
            deactivatedToggle = getToggleFromOverlay(overlayToReset);

            hideAllOverlays();
            module.currentOverlay = null;

            if (overlayToReset) {
                resetMenuForOverlay(overlayToReset);
            }
        }
    }

    if (deactivatedToggle) {
        dispatchModuleEvent('moduleDeactivated', { module: deactivatedToggle });
    }
}


// ========== MENU AND OVERLAY MANAGEMENT ==========

function showControlCenterMenu(menuName) {
    const controlCenter = domCache.controlCenter.module;
    if (!controlCenter) return;

    const allMenuContainers = controlCenter.querySelectorAll('.menu-control-center[data-menu]');
    allMenuContainers.forEach(menu => {
        menu.classList.remove('active');
        menu.classList.add('disabled');
    });

    const targetMenuContainer = controlCenter.querySelector(`.menu-control-center[data-menu="${menuName}"]`);
    if (targetMenuContainer) {
        targetMenuContainer.classList.remove('disabled');
        targetMenuContainer.classList.add('active');
        moduleState.modules.controlCenter.currentMenu = menuName;
    }
}

function resetControlCenterToDefaultMenu() {
    const defaultMenu = MODULE_CONFIG.controlCenter.defaultMenu;
    if (defaultMenu) {
        showControlCenterMenu(defaultMenu);
    }
}

function showSpecificOverlay(overlayName) {
    hideAllOverlays();

    const overlayElement = domCache.overlays[overlayName];
    if (overlayElement) {
        overlayElement.classList.remove('disabled');
        overlayElement.classList.add('active');
        console.log('🔧 Showing overlay:', overlayName);
    } else {
        console.warn('❌ Overlay element not found:', overlayName, INDEPENDENT_OVERLAYS[overlayName]);
    }
}

function hideAllOverlays() {
    Object.keys(domCache.overlays).forEach(overlayName => {
        const overlayElement = domCache.overlays[overlayName];
        if (overlayElement) {
            overlayElement.classList.remove('active');
            overlayElement.classList.add('disabled');
        }
    });
}

// ========== HELPER FUNCTIONS ==========

function normalizeModuleName(moduleName) {
    if (TOGGLE_TO_MODULE_MAP[moduleName]) {
        return TOGGLE_TO_MODULE_MAP[moduleName];
    }

    if (moduleName.startsWith('toggleMenu') || moduleName === 'togglePaletteColors') {
        return 'overlayContainer';
    }

    return moduleName;
}

function getOverlayFromToggle(toggleName) {
    const toggleToOverlayMap = {
        'toggleMenuAlarm': 'menuAlarm',
        'toggleMenuTimer': 'menuTimer',
        'toggleMenuWorldClock': 'menuWorldClock',
        'togglePaletteColors': 'menuPaletteColors'
    };

    return toggleToOverlayMap[toggleName] || null;
}

function getToggleFromOverlay(overlayName) {
    const overlayToToggleMap = {
        'menuAlarm': 'toggleMenuAlarm',
        'menuTimer': 'toggleMenuTimer',
        'menuWorldClock': 'toggleMenuWorldClock',
        'menuPaletteColors': 'togglePaletteColors'
    };
    return overlayToToggleMap[overlayName] || null;
}


function performMobileCloseAnimation(element, callback) {
    element.classList.add('closing', 'slide-out-mobile');

    const onAnimationEnd = () => {
        callback();
        resetMobileMenuStyles(element);
    };

    element.addEventListener('transitionend', onAnimationEnd, { once: true });
}

function resetMobileMenuStyles(element) {
    if (element) {
        element.classList.remove('closing', 'dragging', 'slide-out-mobile');
        element.removeAttribute('style');
    }
    setTimeout(() => {
        moduleState.isModuleChanging = false;
    }, 50);
}

// ========== STATE VERIFICATION ==========

function hasStateInconsistencies() {
    const inconsistencies = [];

    try {
        const moduleInconsistencies = checkModuleStateConsistency();
        if (moduleInconsistencies.length > 0) {
            inconsistencies.push(...moduleInconsistencies);
        }

        const themeInconsistency = checkThemeConsistency();
        if (themeInconsistency) {
            inconsistencies.push(themeInconsistency);
        }

        const languageInconsistency = checkLanguageConsistency();
        if (languageInconsistency) {
            inconsistencies.push(languageInconsistency);
        }

        if (inconsistencies.length > 0) {
            console.log('🔍 State inconsistencies detected:', inconsistencies);
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Error checking state consistency:', error);
        return true;
    }
}

function checkModuleStateConsistency() {
    const inconsistencies = [];

    Object.keys(moduleState.modules).forEach(moduleName => {
        const moduleInfo = moduleState.modules[moduleName];
        const moduleElement = getModuleElementByName(moduleName);

        if (moduleElement) {
            const hasActiveClass = moduleElement.classList.contains('active');

            if (moduleInfo.active && !hasActiveClass) {
                inconsistencies.push(`${moduleName}: state active but missing CSS class`);
            }

            if (!moduleInfo.active && hasActiveClass) {
                inconsistencies.push(`${moduleName}: state inactive but has active CSS class`);
            }
        } else if (moduleInfo.active) {
            inconsistencies.push(`${moduleName}: marked active but DOM element missing`);
        }
    });

    return inconsistencies;
}

function checkThemeConsistency() {
    try {
        const currentTheme = getCurrentTheme();
        const htmlElement = document.documentElement;

        switch (currentTheme) {
            case 'dark':
                if (!htmlElement.classList.contains('dark-mode')) {
                    return 'Theme dark but missing dark-mode class';
                }
                break;
            case 'light':
                if (!htmlElement.classList.contains('light-mode')) {
                    return 'Theme light but missing light-mode class';
                }
                break;
            case 'system':
                const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                const expectedClass = prefersDark ? 'dark-mode' : 'light-mode';
                if (!htmlElement.classList.contains(expectedClass)) {
                    return `Theme system but missing ${expectedClass} class`;
                }
                break;
        }

        const activeThemeLinks = document.querySelectorAll('.menu-link[data-theme].active');
        if (activeThemeLinks.length !== 1) {
            return 'Theme menu links inconsistent';
        }

    } catch (error) {
        return `Theme check error: ${error.message}`;
    }

    return null;
}

function checkLanguageConsistency() {
    try {
        const currentLang = getCurrentLanguage();
        const storedLanguage = localStorage.getItem('app-language');

        if (storedLanguage !== currentLang) {
            return 'Language state vs localStorage mismatch';
        }

        const activeLanguageLinks = document.querySelectorAll('.menu-link[data-language].active');
        if (activeLanguageLinks.length !== 1) {
            return 'Language menu links inconsistent';
        }

    } catch (error) {
        return `Language check error: ${error.message}`;
    }

    return null;
}

function getModuleElementByName(moduleName) {
    switch (moduleName) {
        case 'controlCenter':
            return domCache.controlCenter.module;
        case 'overlayContainer':
            return domCache.overlayContainer.module;
        default:
            return null;
    }
}

// ========== INITIAL STATE APPLICATION ==========

function applyInitialStates() {
    const now = Date.now();

    if (now - moduleState.lastStateApplication < TIMING_CONFIG.MIN_INTERVAL_BETWEEN_OPERATIONS) {
        return;
    }

    if (moduleState.isApplyingStates || isThemeChanging() ||
        isLanguageChanging() || moduleState.isUpdatingLabels) {
        return;
    }

    moduleState.isApplyingStates = true;
    moduleState.lastStateApplication = now;

    try {
        applyThemeStates();
        applyLanguageStates();

    } catch (error) {
        console.error('❌ Error applying initial states:', error);
    } finally {
        setTimeout(() => {
            moduleState.isApplyingStates = false;
        }, TIMING_CONFIG.STATE_RESET_DELAY);
    }
}

// ========== LABEL UPDATES ==========

function updateMenuLabels() {
    const now = Date.now();

    if (now - moduleState.lastLabelUpdate < TIMING_CONFIG.MIN_INTERVAL_BETWEEN_OPERATIONS) {
        return;
    }

    if (moduleState.isUpdatingLabels || isThemeChanging() ||
        isLanguageChanging() || moduleState.isApplyingStates) {
        return;
    }

    moduleState.isUpdatingLabels = true;
    moduleState.lastLabelUpdate = now;

    try {
        updateThemeLabel();
        updateLanguageLabel();
    } catch (error) {
        console.error('❌ Error updating menu labels:', error);
    } finally {
        setTimeout(() => {
            moduleState.isUpdatingLabels = false;
        }, TIMING_CONFIG.STATE_RESET_DELAY);
    }
}

// ========== EVENT LISTENER SETUP ==========

function setupModuleEvents() {
    if (domCache.controlCenter.toggle) {
        domCache.controlCenter.toggle.addEventListener('click', () => {
            toggleModule('controlCenter');
        });
    }

    const overlayToggles = [
        { selector: '[data-module="toggleMenuAlarm"]', toggle: 'toggleMenuAlarm' },
        { selector: '[data-module="toggleMenuTimer"]', toggle: 'toggleMenuTimer' },
        { selector: '[data-module="toggleMenuWorldClock"]', toggle: 'toggleMenuWorldClock' },
        { selector: '[data-module="togglePaletteColors"]', toggle: 'togglePaletteColors' }
    ];

    overlayToggles.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(element => {
            element.addEventListener('click', () => {
                toggleModule(item.toggle);
            });
        });
    });

    setupControlCenterInternalEvents();
}

function setupControlCenterInternalEvents() {
    const controlCenterModule = domCache.controlCenter.module;
    if (!controlCenterModule) return;

    controlCenterModule.addEventListener('click', (e) => {
        const menuLink = e.target.closest('.menu-link');
        if (!menuLink) return;

        const targetMenu = menuLink.getAttribute('data-toggle');
        if (targetMenu && CONTROL_CENTER_MENUS[targetMenu]) {
            e.preventDefault();
            showControlCenterMenu(targetMenu);
        }

        const themeAttribute = menuLink.getAttribute('data-theme');
        if (themeAttribute) {
            e.preventDefault();
            applyTheme(themeAttribute);
        }

        const languageAttribute = menuLink.getAttribute('data-language');
        if (languageAttribute) {
            e.preventDefault();
            setLanguage(languageAttribute);
        }
    });
}

function setupGlobalEvents() {
    document.addEventListener('click', (e) => {
        if (moduleState.isModuleChanging) return;

        if (window.innerWidth > 468) {
            handleDesktopOutsideClick(e);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (moduleState.isModuleChanging) return;

        if (e.key === 'Escape') {
            handleEscapeKey();
        }
    });

    setupVisibilityAndMenuEvents();
}

function handleDesktopOutsideClick(e) {
    const activeModule = getActiveModule();
    if (!activeModule) return;

    if (activeModule === 'controlCenter') {
        const controlCenterModule = domCache.controlCenter.module;
        const controlCenterToggle = domCache.controlCenter.toggle;

        const isClickOutside = !controlCenterModule?.contains(e.target) &&
            !controlCenterToggle?.contains(e.target);

        if (isClickOutside) {
            deactivateModule('controlCenter', { source: 'desktop-outside-click' });
        }
    } else if (activeModule === 'overlayContainer') {
        const overlayContainer = domCache.overlayContainer.module;

        const isClickInOverlay = overlayContainer?.contains(e.target);
        const isClickInToggle = e.target.closest('[data-module^="toggleMenu"], [data-module="togglePaletteColors"]');

        if (!isClickInOverlay && !isClickInToggle) {
            deactivateModule('overlayContainer', { source: 'desktop-outside-click' });
        }
    }
}

function setupVisibilityAndMenuEvents() {
    let lastVisibilityCheck = 0;

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && moduleState.isSystemReady && moduleState.initializationComplete) {
            const now = Date.now();

            if (now - lastVisibilityCheck < TIMING_CONFIG.MIN_VISIBILITY_CHECK_INTERVAL) {
                return;
            }

            lastVisibilityCheck = now;

            setTimeout(() => {
                forceUpdateStates();
            }, 1000);
        }
    });

    document.addEventListener('click', (e) => {
        const menuLink = e.target.closest('.menu-link[data-toggle]');
        if (menuLink && moduleState.isSystemReady && moduleState.initializationComplete) {
            setTimeout(() => {
                if (!moduleState.isApplyingStates && !isThemeChanging() &&
                    !isLanguageChanging()) {
                    applyInitialStates();
                }
            }, 300);
        }
    });
}

// ========== UTILITY FUNCTIONS ==========

function getActiveModule() {
    return Object.keys(moduleState.modules).find(name => moduleState.modules[name].active) || null;
}

function isModuleActive(moduleName) {
    const normalizedName = normalizeModuleName(moduleName);
    return moduleState.modules[normalizedName]?.active || false;
}

function isAnyModuleActive() {
    return Object.values(moduleState.modules).some(module => module.active);
}

// ========== CONTROL AND STATE FUNCTIONS ==========

function forceUpdateStates() {
    if (!moduleState.isSystemReady || !moduleState.initializationComplete) {
        return;
    }

    if (!moduleState.isApplyingStates && !isThemeChanging() &&
        !isLanguageChanging() && !moduleState.isUpdatingLabels) {

        if (hasStateInconsistencies()) {
            console.log('🔄 Force updating module states due to detected inconsistencies');
            applyInitialStates();
        }
    }
}

function isModuleCurrentlyChanging() {
    const controlCenterModule = domCache.controlCenter.module;
    const overlayContainer = domCache.overlayContainer.module;

    const isControlCenterBusy = controlCenterModule?.classList.contains('closing') ||
        controlCenterModule?.querySelector('.menu-control-center.closing') || false;

    const isOverlayBusy = overlayContainer?.classList.contains('closing') ||
        overlayContainer?.querySelector('.menu-alarm.closing, .menu-timer.closing, .menu-worldClock.closing, .menu-paletteColors.closing') || false;

    return moduleState.isModuleChanging || isControlCenterBusy || isOverlayBusy;
}

function isLoading() {
    return isThemeChanging() || isLanguageChanging() ||
        moduleState.isApplyingStates || moduleState.isUpdatingLabels;
}

function resetModuleChangeFlag() {
    moduleState.isModuleChanging = false;
    console.log('🔧 Module change flag reset manually');
}

// ========== CONNECTING WITH TRANSLATION SYSTEM ==========

function setTranslationFunction(translationFn) {
    getTranslation = translationFn;

    setThemeTranslationFunction(translationFn);
    setLanguageTranslationFunction(translationFn);

    if (moduleState.isSystemReady && !moduleState.isUpdatingLabels) {
        setTimeout(() => {
            updateMenuLabels();
        }, 100);
    }
}

// ========== LOGGING AND DEBUGGING ==========

function logModuleStates() {
    console.groupCollapsed('📊 Module States');
    const allStates = {};

    Object.keys(moduleState.modules).forEach(moduleName => {
        const module = moduleState.modules[moduleName];
        const status = module.active ? '✅ ACTIVE' : '❌ INACTIVE';

        if (moduleName === 'controlCenter') {
            allStates['Control Center'] = {
                Status: status,
                'Current Menu': module.currentMenu || 'None'
            };
        } else if (moduleName === 'overlayContainer') {
            allStates['Overlay Container'] = {
                Status: status,
                'Current Overlay': module.currentOverlay || 'None'
            };
        }
    });

    console.table(allStates);
    console.groupEnd();
}

function debugModuleState() {
    console.group('🐛 Module Manager State Debug');
    console.log('System Ready:', moduleState.isSystemReady);
    console.log('Initialization Complete:', moduleState.initializationComplete);
    console.log('Current Theme:', getCurrentTheme());
    console.log('Current Language:', getCurrentLanguage());
    console.log('Module Changing:', moduleState.isModuleChanging);
    console.log('Loading States:', isLoading());
    console.log('Active Module:', getActiveModule());
    console.log('Any Module Active:', isAnyModuleActive());

    console.log('Theme Changing:', isThemeChanging());
    console.log('Language Changing:', isLanguageChanging());

    console.group('🐛 Overlay Cache Debug');
    Object.keys(INDEPENDENT_OVERLAYS).forEach(overlayName => {
        const selector = INDEPENDENT_OVERLAYS[overlayName];
        const element = domCache.overlays[overlayName];
        console.log(`${overlayName}:`, {
            selector: selector,
            found: !!element,
            classes: element ? element.className : 'N/A'
        });
    });
    console.groupEnd();

    console.groupEnd();
}

function debugStateConsistency() {
    console.group('🔍 State Consistency Debug Report');
    console.log('Has Inconsistencies:', hasStateInconsistencies());

    Object.keys(moduleState.modules).forEach(moduleName => {
        const moduleInfo = moduleState.modules[moduleName];
        const moduleElement = getModuleElementByName(moduleName);
        console.log(`${moduleName}:`, {
            internalState: moduleInfo.active,
            domElement: !!moduleElement,
            hasActiveClass: moduleElement?.classList.contains('active')
        });
    });

    console.log('Current Theme:', getCurrentTheme());
    console.log('Current Language:', getCurrentLanguage());
    console.groupEnd();
}

// ========== PUBLIC GETTERS ==========

function isReady() {
    return moduleState.isSystemReady && moduleState.initializationComplete;
}

function getModuleStates() {
    const states = {};
    Object.keys(moduleState.modules).forEach(name => {
        states[name] = moduleState.modules[name].active;
    });
    return states;
}

// ========== PUBLIC CANCELLATION FUNCTIONS ==========

function cancelActiveProcesses(reason = 'manual') {
    return cancelAllActiveProcesses(reason);
}

function isAnyProcessActive() {
    return isThemeChanging() || isLanguageChanging();
}

// ========== GLOBAL ESCAPE KEY HANDLER ==========

function handleEscapeKey() {
    if (isAnyProcessActive()) {
        cancelAllActiveProcesses('escape-key');
        return;
    }

    const activeModule = getActiveModule();
    if (activeModule) {
        deactivateModule(activeModule, { source: 'escape-key' });
    }
}

// ========== EXPORTS ==========

export {
    activateModule, applyInitialStates, applyLanguageStates, applyTheme, applyThemeStates,
    cancelActiveProcesses, cancelAllActiveProcesses, checkLanguageConsistency, checkModuleStateConsistency,
    checkThemeConsistency, debugModuleState, debugStateConsistency, deactivateAllModules,
    deactivateModule, forceUpdateStates, getActiveModule, getCurrentLanguage, getCurrentTheme,
    getModuleStates, handleEscapeKey, hasStateInconsistencies, initModuleManager, isAnyModuleActive,
    isAnyProcessActive, isLoading, isModuleActive, isModuleCurrentlyChanging, isReady, logModuleStates
};

export {
    resetModuleChangeFlag, setLanguage, setTranslationFunction, showControlCenterMenu,
    showSpecificOverlay, toggleModule, updateMenuLabels
};