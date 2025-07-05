// ========== IMPORTS AND DEPENDENCIES ==========
import { deactivateModule, isModuleCurrentlyChanging } from './main.js';

// ========== GLOBAL VARIABLES ==========
let isDragging = false;
let startY = 0;
let currentY = 0;
let initialTransform = 0;
const dragThreshold = 0.5;
let isEnabled = false;
let enableOpacityOnDrag = false;

let activeModule = null;
let activeMenu = null;
let dragHandleElement = null;

// ========== INITIALIZATION FUNCTIONS ==========
function initMobileDragController() {
    if (window.innerWidth > 468) {
        return;
    }
    
    if (isEnabled) {
        console.log('📱 Mobile drag controller already initialized, skipping...');
        return;
    }

    setupDragListeners();
    setupMobileClickListeners();
    setupResizeListener();
    isEnabled = true;
    console.log('📱 Mobile drag controller initialized for multiple modules');
}

// ========== EVENT LISTENER SETUP ==========
function setupDragListeners() {
    document.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    document.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
}

function setupMobileClickListeners() {
    const controlCenterModule = document.querySelector('.module-control-center');
    if (controlCenterModule) {
        controlCenterModule.addEventListener('click', function(e) {
            if (e.target === controlCenterModule) {
                e.stopPropagation();
                e.preventDefault();
                
                if (isModuleCurrentlyChanging()) {
                    return;
                }
     
                deactivateModule('controlCenter', { 
                    source: 'mobile-background-click',
                    withMobileAnimation: true
                });
            }
        }, true);
    }

    const overlayModule = document.querySelector('.module-overlay');
    if (overlayModule) {
        overlayModule.addEventListener('click', function(e) {
            if (e.target === overlayModule) {
                e.stopPropagation();
                e.preventDefault();
                
                if (isModuleCurrentlyChanging()) {
                    return;
                }
     
                deactivateModule('overlayContainer', { 
                    source: 'mobile-background-click',
                    withMobileAnimation: true
                });
            }
        }, true);
    }
}

function setupResizeListener() {
    window.addEventListener('resize', function() {
        const screenWidth = window.innerWidth;
        
        if (screenWidth > 468 && isEnabled) {
            disableDrag();
        } else if (screenWidth <= 468 && !isEnabled) {
            enableDrag();
        }
    });
}

// ========== DRAG FUNCTIONS ==========
function handleDragStart(e) {
    if (!isEnabled) return;

    const dragHandle = e.target.closest('.drag-handle');
    if (!dragHandle) return;

    const moduleInfo = getModuleFromDragHandle(dragHandle);
    if (!moduleInfo || !moduleInfo.module.classList.contains('active')) {
        return;
    }

    isDragging = true;
    activeModule = moduleInfo.module;
    activeMenu = moduleInfo.menu;
    dragHandleElement = dragHandle;

    if (e.type === 'touchstart') {
        startY = e.touches[0].clientY;
    } else {
        startY = e.clientY;
    }

    const transform = window.getComputedStyle(activeMenu).transform;
    if (transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        initialTransform = matrix.m42;
    } else {
        initialTransform = 0;
    }

    activeMenu.classList.add('dragging');
    
    activeMenu.addEventListener('touchmove', preventMenuScroll, { passive: false });

    e.preventDefault();
}

function handleDragMove(e) {
    if (!isDragging || !isEnabled || !activeMenu) return;

    if (e.type === 'touchmove') {
        currentY = e.touches[0].clientY;
    } else {
        currentY = e.clientY;
    }

    let deltaY = currentY - startY;
    
    if (deltaY < 0) {
        deltaY = 0;
    }

    const newTransform = initialTransform + deltaY;
    activeMenu.style.transform = `translateY(${newTransform}px)`;

    if (enableOpacityOnDrag) {
        const opacity = Math.max(0.3, 1 - (deltaY / (window.innerHeight * 0.4)));
        activeMenu.style.opacity = opacity;
    }

    e.preventDefault();
}

function handleDragEnd(e) {
    if (!isDragging || !isEnabled || !activeMenu) return;

    const deltaY = currentY - startY;
    const menuHeight = activeMenu.offsetHeight;
    const threshold = menuHeight * dragThreshold;

    isDragging = false;
    activeMenu.classList.remove('dragging');
    
    activeMenu.removeEventListener('touchmove', preventMenuScroll);

    if (deltaY > threshold) {
        const moduleName = getModuleNameFromElement(activeModule);
        if (moduleName) {
            deactivateModule(moduleName, { 
                source: 'mobile-drag',
                withMobileAnimation: true
            });
        }
    } else {
        returnToOriginalPosition();
    }

    activeModule = null;
    activeMenu = null;
    dragHandleElement = null;
}

function preventMenuScroll(e) {
    if (isDragging) {
        e.preventDefault();
    }
}

function returnToOriginalPosition() {
    if (!activeMenu) return;
    
    const menuElement = activeMenu;

    let transitionStyle = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    if (enableOpacityOnDrag) {
        transitionStyle += ', opacity 0.3s ease';
    }
    
    menuElement.style.transition = transitionStyle;
    menuElement.style.transform = 'translateY(0)';
    
    if (enableOpacityOnDrag) {
        menuElement.style.opacity = '1';
    }

    const handler = function() {
        menuElement.removeAttribute('style');
    };

    menuElement.addEventListener('transitionend', handler, { once: true });
}

// ========== HELPER FUNCTIONS ==========
function getModuleFromDragHandle(dragHandle) {
    const controlCenterModule = dragHandle.closest('.module-control-center');
    if (controlCenterModule) {
        const activeControlMenu = controlCenterModule.querySelector('.menu-control-center.active');
        if (activeControlMenu) {
            return {
                module: controlCenterModule,
                menu: activeControlMenu,
                type: 'controlCenter'
            };
        }
    }

    const overlayModule = dragHandle.closest('.module-overlay');
    if (overlayModule) {
        const activeOverlayMenu = overlayModule.querySelector('.menu-alarm.active, .menu-timer.active, .menu-worldClock.active, .menu-paletteColors.active');
        if (activeOverlayMenu) {
            return {
                module: overlayModule,
                menu: activeOverlayMenu,
                type: 'overlay'
            };
        }
    }

    return null;
}

function getModuleNameFromElement(moduleElement) {
    if (moduleElement.classList.contains('module-control-center')) {
        return 'controlCenter';
    }
    if (moduleElement.classList.contains('module-overlay')) {
        return 'overlayContainer';
    }
    return null;
}

// ========== ENABLE/DISABLE FUNCTIONS ==========
function enableDrag() {
    if (window.innerWidth <= 468) {
        isEnabled = true;
        
        const dragHandles = document.querySelectorAll('.drag-handle');
        dragHandles.forEach(handle => {
            handle.style.cursor = 'grab';
        });
        
        console.log('📱 Mobile drag enabled for all modules');
    }
}

function disableDrag() {
    isEnabled = false;
    isDragging = false;
    
    const dragHandles = document.querySelectorAll('.drag-handle');
    dragHandles.forEach(handle => {
        handle.style.cursor = '';
    });
    
    resetAllMenuStyles();
    
    document.body.style.cursor = '';
    
    activeModule = null;
    activeMenu = null;
    dragHandleElement = null;
}

function resetAllMenuStyles() {
    const allMenus = document.querySelectorAll('.menu-control-center, .menu-alarm, .menu-timer, .menu-worldClock, .menu-paletteColors');
    allMenus.forEach(menu => {
        menu.classList.remove('closing', 'dragging');
        menu.style.transform = '';
        menu.style.opacity = '';
        menu.style.transition = '';
    });
}

// ========== PUBLIC FUNCTIONS ==========
function isDragEnabled() {
    return isEnabled;
}

function setDragThreshold(newThreshold) {
    if (newThreshold >= 0 && newThreshold <= 1) {
        console.log(`📐 Drag threshold set to: ${newThreshold * 100}%`);
    } else {
        console.warn('⚠️ Invalid threshold. Must be between 0 and 1');
    }
}

function getDragThreshold() {
    return dragThreshold;
}

function setOpacityOnDrag(enabled) {
    enableOpacityOnDrag = enabled;
    console.log(`💫 Opacity on drag ${enabled ? 'enabled' : 'disabled'}`);
}

function getOpacityOnDrag() {
    return enableOpacityOnDrag;
}

function forceCloseDrag() {
    if (isDragging && activeModule) {
        isDragging = false;
        const moduleName = getModuleNameFromElement(activeModule);
        if (moduleName) {
            deactivateModule(moduleName, { 
                source: 'force-close-drag',
                withMobileAnimation: false
            });
        }
        
        activeModule = null;
        activeMenu = null;
        dragHandleElement = null;
    }
}

// ========== ELEMENT REFERENCE UPDATE FUNCTIONS ==========
function updateModuleReferences() {
    console.log('📱 Module references updated for drag controller');
}

// ========== EXPORTS ==========
export {
    initMobileDragController,
    enableDrag,
    disableDrag,
    isDragEnabled,
    setDragThreshold,
    getDragThreshold,
    setOpacityOnDrag,
    getOpacityOnDrag,
    forceCloseDrag,
    updateModuleReferences
};