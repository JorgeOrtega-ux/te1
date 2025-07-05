// Ruta: /assets/js/tools/timer-controller.js
import { getTranslation } from '../general/translations-controller.js';
import { PREMIUM_FEATURES, activateModule, getCurrentActiveOverlay, allowCardMovement } from '../general/main.js';
import { prepareTimerForEdit, prepareCountToDateForEdit } from './menu-interactions.js';
import { playSound, stopSound, initializeSortable, getAvailableSounds, handleTimerCardAction, getSoundNameById, createExpandableToolContainer } from './general-tools.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { updateEverythingWidgets } from './everything-controller.js';
import { showConfirmation } from '../general/overlay-manager.js';

const TIMERS_STORAGE_KEY = 'user-timers';
const DEFAULT_TIMERS_STORAGE_KEY = 'default-timers-order';
let userTimers = [];
let defaultTimersState = [];
let activeTimers = new Map();
let pinnedTimerId = null;

const DEFAULT_TIMERS = [
    { id: 'default-timer-2', title: 'short_break_5', type: 'countdown', initialDuration: 300000, remaining: 300000, endAction: 'stop', sound: 'peaceful_tone', isRunning: false, isPinned: false },
    { id: 'default-timer-4', title: 'exercise_30', type: 'countdown', initialDuration: 1800000, remaining: 1800000, endAction: 'restart', sound: 'digital_alarm', isRunning: false, isPinned: false },
    { id: 'default-timer-5', title: 'study_session_45', type: 'countdown', initialDuration: 2700000, remaining: 2700000, endAction: 'restart', sound: 'gentle_chime', isRunning: false, isPinned: false }
];

function updatePinnedTimerNameDisplay() {
    const nameDisplayTool = document.querySelector('.info-tool[data-timer-name-display]');
    if (!nameDisplayTool) return;

    let span = nameDisplayTool.querySelector('span');
    if (!span) {
        span = document.createElement('span');
        nameDisplayTool.innerHTML = '';
        nameDisplayTool.appendChild(span);
    }

    const pinnedTimer = findTimerById(pinnedTimerId);
    if (pinnedTimer) {
        const title = pinnedTimer.id.startsWith('default-timer-')
            ? getTranslation(pinnedTimer.title, 'timer')
            : pinnedTimer.title;
        span.textContent = title;
        nameDisplayTool.setAttribute('data-translate', 'pinned_timer_tooltip');
        nameDisplayTool.setAttribute('data-translate-category', 'timer');
        nameDisplayTool.setAttribute('data-translate-target', 'tooltip');
    } else {
        span.textContent = '-';
        nameDisplayTool.removeAttribute('data-tooltip');
        nameDisplayTool.removeAttribute('data-translate');
        nameDisplayTool.removeAttribute('data-translate-category');
        nameDisplayTool.removeAttribute('data-translate-target');
    }
    if (window.tooltipManager && typeof window.tooltipManager.attachTooltipsToNewElements === 'function') {
        window.tooltipManager.attachTooltipsToNewElements(nameDisplayTool.parentElement);
    }
}

function renderTimerSearchResults(searchTerm) {
    const menuElement = document.querySelector('.menu-timer[data-menu="Timer"]');
    if (!menuElement) return;

    const resultsWrapper = menuElement.querySelector('.timer-search-results-wrapper');
    const creationWrapper = menuElement.querySelector('.timer-creation-wrapper');
    const typeSelector = menuElement.querySelector('.menu-content-selector');

    if (!resultsWrapper || !creationWrapper || !typeSelector) return;

    if (!searchTerm) {
        resultsWrapper.classList.add('disabled');
        creationWrapper.classList.remove('disabled');
        typeSelector.classList.remove('disabled');
        resultsWrapper.innerHTML = '';
        return;
    }

    const allTimers = [...userTimers, ...defaultTimersState];
    const filteredTimers = allTimers.filter(timer => {
        const translatedTitle = timer.id.startsWith('default-timer-') ? getTranslation(timer.title, 'timer') : timer.title;
        return translatedTitle.toLowerCase().includes(searchTerm);
    });

    creationWrapper.classList.add('disabled');
    typeSelector.classList.add('disabled');
    resultsWrapper.classList.remove('disabled');
    resultsWrapper.innerHTML = '';

    if (filteredTimers.length > 0) {
        const list = document.createElement('div');
        list.className = 'menu-list';
        filteredTimers.forEach(timer => {
            const item = createTimerSearchResultItem(timer);
            list.appendChild(item);
            addSearchItemEventListeners(item);
        });
        resultsWrapper.appendChild(list);
    } else {
        resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
    }
}

function createTimerSearchResultItem(timer) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.id = `search-timer-${timer.id}`;
    item.dataset.id = timer.id;
    item.dataset.type = 'timer';

    const translatedTitle = timer.id.startsWith('default-timer-') ? getTranslation(timer.title, 'timer') : timer.title;
    const time = formatTime(timer.remaining, timer.type);

    const isCountdown = timer.type === 'countdown';
    const playPauseAction = timer.isRunning ? 'pause-card-timer' : 'start-card-timer';
    const playPauseIcon = timer.isRunning ? 'pause' : 'play_arrow';
    const playPauseTextKey = timer.isRunning ? 'pause' : 'play';

    let dynamicActionsHTML = '';
    if (isCountdown) {
        dynamicActionsHTML = `
            <div class="menu-link" data-action="${playPauseAction}">
                <div class="menu-link-icon"><span class="material-symbols-rounded">${playPauseIcon}</span></div>
                <div class="menu-link-text"><span>${getTranslation(playPauseTextKey, 'tooltips')}</span></div>
            </div>
            <div class="menu-link" data-action="reset-card-timer">
                <div class="menu-link-icon"><span class="material-symbols-rounded">refresh</span></div>
                <div class="menu-link-text"><span>${getTranslation('reset', 'tooltips')}</span></div>
            </div>
        `;
    }

    const deleteLinkHtml = timer.id.startsWith('default-timer-') ? '' : `
        <div class="menu-link" data-action="delete-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span>${getTranslation('delete_timer', 'timer')}</span></div>
        </div>
    `;

    item.innerHTML = `
        <div class="result-info">
            <span class="result-title">${translatedTitle}</span>
            <span class="result-time">${time}</span>
        </div>
        <div class="card-menu-container disabled"> <button class="card-pin-btn ${timer.isPinned ? 'active' : ''}" data-action="pin-timer" data-translate="pin_timer" data-translate-category="tooltips" data-translate-target="tooltip">
                 <span class="material-symbols-rounded">push_pin</span>
             </button>
             <div class="card-menu-btn-wrapper">
                 <button class="card-menu-btn" data-action="toggle-item-menu"
                     data-translate="timer_options"
                     data-translate-category="timer"
                     data-translate-target="tooltip">
                     <span class="material-symbols-rounded">more_horiz</span>
                 </button>
                 <div class="card-dropdown-menu body-title disabled">
                     ${dynamicActionsHTML}
                     <div class="menu-link" data-action="edit-timer">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                         <div class="menu-link-text"><span>${getTranslation('edit_timer', 'timer')}</span></div>
                     </div>
                     ${deleteLinkHtml}
                 </div>
             </div>
        </div>
    `;
    return item;
}

function addSearchItemEventListeners(item) {
    const menuContainer = item.querySelector('.card-menu-container');
    if (!menuContainer) return;

    item.addEventListener('mouseenter', () => {
        menuContainer.classList.remove('disabled');
    });

    item.addEventListener('mouseleave', () => {
        const dropdown = menuContainer.querySelector('.card-dropdown-menu');
        if (dropdown?.classList.contains('disabled')) {
            menuContainer.classList.add('disabled');
        }
    });

    item.addEventListener('click', e => {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        e.stopPropagation();

        const action = actionTarget.dataset.action;
        const timerId = item.dataset.id;

        if (action === 'toggle-item-menu') {
            const dropdown = item.querySelector('.card-dropdown-menu');
            const isOpening = dropdown.classList.contains('disabled');

            document.querySelectorAll('.timer-search-results-wrapper .card-dropdown-menu').forEach(d => {
                if (d !== dropdown) {
                    d.classList.add('disabled');
                }
            });

            if (isOpening) {
                dropdown.classList.remove('disabled');
            } else {
                dropdown.classList.add('disabled');
            }
            if (!dropdown.classList.contains('disabled')) {
                menuContainer.classList.remove('disabled');
            }
        } else {
            handleTimerCardAction(action, timerId, actionTarget);
        }
    });
}

function refreshSearchResults() {
    const searchInput = document.getElementById('timer-search-input');
    if (searchInput && searchInput.value) {
        renderTimerSearchResults(searchInput.value.toLowerCase());
    }
}

export function getTimersCount() {
    return userTimers.length;
}

export function getTimerLimit() {
    return PREMIUM_FEATURES ? 100 : 5;
}

function getRunningTimersCount() {
    const allTimers = [...userTimers, ...defaultTimersState];
    return allTimers.filter(timer => timer.isRunning).length;
}

function getActiveTimerDetails() {
    const runningTimer = [...userTimers, ...defaultTimersState].find(t => t.isRunning);
    if (!runningTimer) {
        return null;
    }

    const title = runningTimer.id.startsWith('default-timer-') ? getTranslation(runningTimer.title, 'timer') : runningTimer.title;
    const remainingTime = formatTime(runningTimer.remaining, runningTimer.type);

    return `${title} (${remainingTime} ${getTranslation('remaining', 'everything') || 'restantes'})`;
}

function initializeTimerController() {
    const wrapper = document.querySelector('.timers-list-wrapper');
    if (wrapper) {
        const userContainer = createExpandableToolContainer({
            type: 'user',
            titleKey: 'my_timers',
            translationCategory: 'timer',
            icon: 'timer',
            containerClass: 'timers-container',
            badgeClass: 'timer-count-badge',
            gridAttribute: 'data-timer-grid',
            toggleFunction: toggleTimersSection
        });

        const defaultContainer = createExpandableToolContainer({
            type: 'default',
            titleKey: 'default_timers',
            translationCategory: 'timer',
            icon: 'timelapse',
            containerClass: 'timers-container',
            badgeClass: 'timer-count-badge',
            gridAttribute: 'data-timer-grid',
            toggleFunction: toggleTimersSection
        });
        wrapper.appendChild(userContainer);
        wrapper.appendChild(defaultContainer);
    }
    const section = document.querySelector('.section-timer');
    if (!section) return;

    const startBtn = section.querySelector('[data-action="start-pinned-timer"]');
    const pauseBtn = section.querySelector('[data-action="pause-pinned-timer"]');
    const resetBtn = section.querySelector('[data-action="reset-pinned-timer"]');

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (pinnedTimerId) {
                startTimer(pinnedTimerId);
            }
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (pinnedTimerId) {
                pauseTimer(pinnedTimerId);
            }
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (pinnedTimerId) {
                resetTimer(pinnedTimerId);
            }
        });
    }
    loadAndRestoreTimers();
    renderAllTimerCards();
    updateMainDisplay();
    initializeSortableGrids();
    updateMainControlsState();
    updateTimerCounts();

    const searchInput = document.getElementById('timer-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', e => renderTimerSearchResults(e.target.value.toLowerCase()));
    }

    window.timerManager = {
        startTimer,
        pauseTimer,
        resetTimer,
        handleEditTimer,
        handleDeleteTimer,
        dismissTimer,
        handlePinTimer,
        toggleTimersSection,
        findTimerById,
        getTimersCount,
        getTimerLimit, getRunningTimersCount,
        getActiveTimerDetails,
        getAllTimers: () => ({ userTimers, defaultTimers: defaultTimersState }),
        saveAllTimers: () => {
            saveTimersToStorage();
            saveDefaultTimersOrder();
        },
        renderAllTimerCards
    };

    updateEverythingWidgets();

    document.addEventListener('moduleDeactivated', (e) => {
        if (e.detail && e.detail.module === 'toggleMenuTimer') {
            const menuElement = document.querySelector('.menu-timer[data-menu="Timer"]');
            if (!menuElement) return;

            const searchInput = menuElement.querySelector('#timer-search-input');
            if (searchInput) {
                searchInput.value = '';
                renderTimerSearchResults('');
            }
        }
    });
}

function loadAndRestoreTimers() {
    const storedUserTimers = localStorage.getItem(TIMERS_STORAGE_KEY);
    if (storedUserTimers) {
        try {
            userTimers = JSON.parse(storedUserTimers);
        } catch (e) { userTimers = []; }
    }

    const storedDefaultTimers = localStorage.getItem(DEFAULT_TIMERS_STORAGE_KEY);
    if (storedDefaultTimers) {
        try {
            defaultTimersState = JSON.parse(storedDefaultTimers);
            const defaultIds = new Set(defaultTimersState.map(t => t.id));
            DEFAULT_TIMERS.forEach(defaultTimer => {
                if (!defaultIds.has(defaultTimer.id)) {
                    defaultTimersState.push({ ...defaultTimer });
                }
            });
        } catch (e) {
            defaultTimersState = JSON.parse(JSON.stringify(DEFAULT_TIMERS));
        }
    } else {
        defaultTimersState = JSON.parse(JSON.stringify(DEFAULT_TIMERS));
    }

    const allTimers = [...userTimers, ...defaultTimersState];
    const now = Date.now();

    allTimers.forEach(timer => {
        if (timer.isRunning) {
            if (timer.type === 'countdown') {
                if (timer.targetTime) {
                    const newRemaining = timer.targetTime - now;
                    timer.remaining = Math.max(0, newRemaining);
                }

                if (timer.remaining > 0) {
                    startCountdownTimer(timer);
                } else {
                    timer.isRunning = false;
                    delete timer.targetTime;
                }
            } else if (timer.type === 'count_to_date') {
                timer.remaining = new Date(timer.targetDate).getTime() - now;
                if (timer.remaining > 0) {
                    startCountToDateTimer(timer);
                } else {
                    timer.remaining = 0;
                    timer.isRunning = false;
                }
            }
        }
    });

    let pinnedTimer = allTimers.find(t => t.isPinned);
    if (!pinnedTimer && allTimers.length > 0) {
        pinnedTimer = allTimers[0];
        pinnedTimer.isPinned = true;
    }
    pinnedTimerId = pinnedTimer ? pinnedTimer.id : null;
    allTimers.forEach(t => t.isPinned = (t.id === pinnedTimerId));

    saveAllTimersState();
}

function saveAllTimersState() {
    saveTimersToStorage();
    saveDefaultTimersOrder();
}

function saveTimersToStorage() {
    localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(userTimers));
}

function saveDefaultTimersOrder() {
    localStorage.setItem(DEFAULT_TIMERS_STORAGE_KEY, JSON.stringify(defaultTimersState));
}

function findTimerById(timerId) {
    return userTimers.find(t => t.id === timerId) || defaultTimersState.find(t => t.id === timerId);
}

function startTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || timer.isRunning) return;

    if (timer.type === 'count_to_date') {
        if (timer.remaining <= 0) return;
        startCountToDateTimer(timer);
    } else {
        if (timer.remaining <= 0) return;
        timer.targetTime = Date.now() + timer.remaining;
        startCountdownTimer(timer);
    }

    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();

    const isUserTimer = userTimers.some(t => t.id === timerId);
    if (isUserTimer) {
        saveTimersToStorage();
    } else {
        saveDefaultTimersOrder();
    }
    updateEverythingWidgets();
}

function startCountdownTimer(timer) {
    timer.isRunning = true;
    const interval = setInterval(() => {
        timer.remaining = timer.targetTime ? timer.targetTime - Date.now() : 0;

        updateCardDisplay(timer.id);
        if (timer.id === pinnedTimerId) updateMainDisplay();

        if (timer.remaining <= 0) {
            handleTimerEnd(timer.id);
        }
    }, 1000);
    activeTimers.set(timer.id, interval);
}

function startCountToDateTimer(timer) {
    timer.isRunning = true;
    const interval = setInterval(() => {
        timer.remaining = new Date(timer.targetDate).getTime() - Date.now();
        updateCardDisplay(timer.id);
        if (timer.id === pinnedTimerId) updateMainDisplay();

        if (timer.remaining <= 0) {
            handleTimerEnd(timer.id);
        }
    }, 1000);
    activeTimers.set(timer.id, interval);
}

function pauseTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || !timer.isRunning) return;

    timer.isRunning = false;
    clearInterval(activeTimers.get(timerId));
    activeTimers.delete(timerId);

    delete timer.targetTime;

    const isUserTimer = userTimers.some(t => t.id === timerId);
    if (isUserTimer) {
        saveTimersToStorage();
    } else {
        saveDefaultTimersOrder();
    }

    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();
    updateEverythingWidgets();
}

function resetTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    pauseTimer(timerId);

    if (timer.type !== 'count_to_date') {
        timer.remaining = timer.initialDuration;
    }
    timer.isRunning = false;
    delete timer.targetTime;

    updateCardDisplay(timerId);
    if (timer.id === pinnedTimerId) {
        updateMainDisplay();
    }

    const isUserTimer = userTimers.some(t => t.id === timerId);
    if (isUserTimer) saveTimersToStorage(); else saveDefaultTimersOrder();
    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();
    updateEverythingWidgets();
}

function initializeSortableGrids() {
    if (!allowCardMovement) return;

    const sortableOptions = {
        animation: 150,
        filter: '.card-menu-container',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
    };

    initializeSortable('.tool-grid[data-timer-grid="user"]', {
        ...sortableOptions,
        onEnd: function () {
            const grid = document.querySelector('.tool-grid[data-timer-grid="user"]');
            const newOrder = Array.from(grid.querySelectorAll('.tool-card')).map(card => card.id);
            userTimers.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            saveTimersToStorage();
        }
    });

    initializeSortable('.tool-grid[data-timer-grid="default"]', {
        ...sortableOptions,
        onEnd: function () {
            const grid = document.querySelector('.tool-grid[data-timer-grid="default"]');
            const newOrder = Array.from(grid.querySelectorAll('.tool-card')).map(card => card.id);
            defaultTimersState.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            saveDefaultTimersOrder();
        }
    });
}


export function addTimerAndRender(timerData) {
    const newTimer = {
        id: `timer-${Date.now()}`,
        title: timerData.title,
        type: timerData.type,
        sound: timerData.sound,
        isRunning: false,
        isPinned: false,
    };

    const timerLimit = getTimerLimit();
    if (userTimers.length >= timerLimit) {
        showDynamicIslandNotification(
            'system',
            'limit_reached',
            null,
            'notifications',
            { type: getTranslation('timer', 'tooltips') }
        );
        return;
    }

    if (timerData.type === 'count_to_date') {
        newTimer.targetDate = timerData.targetDate;
        newTimer.remaining = new Date(timerData.targetDate).getTime() - Date.now();
    } else {
        newTimer.initialDuration = timerData.duration;
        newTimer.remaining = timerData.duration;
        newTimer.endAction = timerData.endAction;
    }

    userTimers.push(newTimer);

    if ((userTimers.length + defaultTimersState.length) === 1 || ![...userTimers, ...defaultTimersState].some(t => t.isPinned)) {
        newTimer.isPinned = true;
        pinnedTimerId = newTimer.id;
    }

    saveTimersToStorage();
    renderAllTimerCards();
    updateMainDisplay();
    updateMainControlsState();
    updateTimerCounts();

    if (newTimer.type === 'count_to_date') {
        startTimer(newTimer.id);
    }

    showDynamicIslandNotification('timer', 'created', 'timer_created', 'notifications', { title: newTimer.title });
    updateEverythingWidgets();
}

export function updateTimer(timerId, newData) {
    const timerIndex = userTimers.findIndex(t => t.id === timerId);
    const defaultTimerIndex = defaultTimersState.findIndex(t => t.id === timerId);

    if (timerIndex === -1 && defaultTimerIndex === -1) return;

    if (activeTimers.has(timerId)) {
        clearInterval(activeTimers.get(timerId));
        activeTimers.delete(timerId);
    }

    const isUserTimer = timerIndex !== -1;
    const targetArray = isUserTimer ? userTimers : defaultTimersState;
    const index = isUserTimer ? timerIndex : defaultTimerIndex;
    const oldTimer = targetArray[index];

    const updatedTimer = { ...oldTimer, ...newData, isRunning: false };

    if (updatedTimer.type === 'count_to_date') {
        updatedTimer.remaining = new Date(updatedTimer.targetDate).getTime() - Date.now();
        delete updatedTimer.targetTime;
        targetArray[index] = updatedTimer;
        startTimer(timerId);
    } else {
        updatedTimer.initialDuration = updatedTimer.duration;
        updatedTimer.remaining = updatedTimer.initialDuration;
        delete updatedTimer.targetTime;
        targetArray[index] = updatedTimer;
    }

    if (isUserTimer) saveTimersToStorage(); else saveDefaultTimersOrder();
    renderAllTimerCards();
    updateMainDisplay();
    updateMainControlsState();

    const titleForNotification = updatedTimer.id.startsWith('default-timer-') ? getTranslation(updatedTimer.title, 'timer') : updatedTimer.title;
    showDynamicIslandNotification('timer', 'updated', 'timer_updated', 'notifications', { title: titleForNotification });
    updateEverythingWidgets();
}


function renderAllTimerCards() {
    const userContainer = document.querySelector('.tool-grid[data-timer-grid="user"]');
    const defaultContainer = document.querySelector('.tool-grid[data-timer-grid="default"]');
    if (!userContainer || !defaultContainer) return;

    userContainer.innerHTML = '';
    defaultContainer.innerHTML = '';

    userTimers.forEach(timer => {
        const card = createTimerCard(timer);
        userContainer.appendChild(card);
    });

    defaultTimersState.forEach(timer => {
        const card = createTimerCard(timer);
        defaultContainer.appendChild(card);
    });

    setTimeout(() => {
        updatePinnedStatesInUI();
    }, 50);
}

function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'tool-card timer-card';
    card.id = timer.id;
    card.dataset.id = timer.id;
    if (!timer.isRunning && timer.remaining <= 0) {
        card.classList.add('timer-finished');
    }

    const isCountdown = timer.type === 'countdown';
    const playPauseAction = timer.isRunning ? 'pause-card-timer' : 'start-card-timer';
    const playPauseIcon = timer.isRunning ? 'pause' : 'play_arrow';
    const playPauseTextKey = timer.isRunning ? 'pause' : 'play';

    const isDefault = timer.id.startsWith('default-timer-');
    const titleText = isDefault ? getTranslation(timer.title, 'timer') : timer.title;
    const soundName = getSoundNameById(timer.sound);

    let countdownMenu = '';
    if (isCountdown) {
        countdownMenu = `
        <div class="menu-link" data-action="${playPauseAction}">
            <div class="menu-link-icon"><span class="material-symbols-rounded">${playPauseIcon}</span></div>
            <div class="menu-link-text"><span data-translate="${playPauseTextKey}" data-translate-category="tooltips">${getTranslation(playPauseTextKey, 'tooltips')}</span></div>
        </div>
        <div class="menu-link" data-action="reset-card-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">refresh</span></div>
            <div class="menu-link-text"><span data-translate="reset" data-translate-category="tooltips">${getTranslation('reset', 'tooltips')}</span></div>
        </div>
        `;
    }

    const deleteLinkHtml = isDefault ? '' : `
        <div class="menu-link" data-action="delete-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span data-translate="delete_timer" data-translate-category="timer">${getTranslation('delete_timer', 'timer')}</span></div>
        </div>
    `;

    card.innerHTML = `
        <div class="card-header">
            <div class="card-details">
                <span class="card-title" title="${titleText}">${titleText}</span>
                <span class="card-value">${formatTime(timer.remaining, timer.type)}</span>
            </div>
        </div>
        <div class="card-footer">
            <div class="card-tags">
                 <span class="card-tag" data-sound-id="${timer.sound}">${soundName}</span>
            </div>
        </div>
        <div class="card-options-container">
             <button class="card-dismiss-btn" data-type="timer" data-action="dismiss-timer">
                 <span data-translate="dismiss" data-translate-category="alarms">${getTranslation('dismiss', 'alarms')}</span>
             </button>
        </div>
        <div class="card-menu-container disabled">
             <button class="card-pin-btn" data-action="pin-timer" data-translate="pin_timer" data-translate-category="tooltips" data-translate-target="tooltip">
                 <span class="material-symbols-rounded">push_pin</span>
             </button>
             <div class="card-menu-btn-wrapper">
                 <button class="card-menu-btn" data-action="toggle-timer-options"
                     data-translate="timer_options"
                     data-translate-category="timer"
                     data-translate-target="tooltip">
                     <span class="material-symbols-rounded">more_horiz</span>
                 </button>
                 <div class="card-dropdown-menu body-title disabled">
                     ${countdownMenu}
                     <div class="menu-link" data-action="edit-timer">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                         <div class="menu-link-text"><span data-translate="edit_timer" data-translate-category="timer">${getTranslation('edit_timer', 'timer')}</span></div>
                     </div>
                     ${deleteLinkHtml}
                 </div>
             </div>
        </div>
    `;

    const menuContainer = card.querySelector('.card-menu-container');
    card.addEventListener('mouseenter', () => menuContainer?.classList.remove('disabled'));
    card.addEventListener('mouseleave', () => {
        const dropdown = menuContainer?.querySelector('.card-dropdown-menu');
        if (dropdown?.classList.contains('disabled')) {
            menuContainer?.classList.add('disabled');
        }
    });

    return card;
}

function updateMainDisplay() {
    const mainDisplay = document.querySelector('.tool-timer span');
    if (!mainDisplay) return;

    const pinnedTimer = findTimerById(pinnedTimerId);
    if (pinnedTimer) {
        mainDisplay.textContent = formatTime(pinnedTimer.remaining, pinnedTimer.type);
    } else {
        mainDisplay.textContent = formatTime(0, 'countdown');
    }
    updatePinnedTimerNameDisplay();
}

function updateMainControlsState() {
    const section = document.querySelector('.section-timer');
    if (!section) return;

    const startBtn = section.querySelector('[data-action="start-pinned-timer"]');
    const pauseBtn = section.querySelector('[data-action="pause-pinned-timer"]');
    const resetBtn = section.querySelector('[data-action="reset-pinned-timer"]');
    const buttons = [startBtn, pauseBtn, resetBtn];

    const hasTimers = (userTimers.length + defaultTimersState.length) > 0;
    const pinnedTimer = findTimerById(pinnedTimerId);
    const isPinnedCountToDate = pinnedTimer && pinnedTimer.type === 'count_to_date';

    if (!hasTimers || isPinnedCountToDate) {
        buttons.forEach(btn => btn?.classList.add('disabled-interactive'));
    } else {
        buttons.forEach(btn => btn?.classList.remove('disabled-interactive'));
        startBtn?.classList.toggle('disabled-interactive', pinnedTimer?.isRunning);
        pauseBtn?.classList.toggle('disabled-interactive', !pinnedTimer?.isRunning);
    }
}

function updateCardDisplay(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    const mainCard = document.getElementById(timerId);
    const searchItem = document.getElementById(`search-timer-${timerId}`);

    if (mainCard) {
        const timeElement = mainCard.querySelector('.card-value');
        if (timeElement) {
            timeElement.textContent = formatTime(timer.remaining, timer.type);
        }
        mainCard.classList.toggle('timer-finished', !timer.isRunning && timer.remaining <= 0);
    }

    if (searchItem) {
        const timeElement = searchItem.querySelector('.result-time');
        if (timeElement) {
            timeElement.textContent = formatTime(timer.remaining, timer.type);
        }
    }
}

function updateTimerCardControls(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || timer.type !== 'countdown') return;

    const elementsToUpdate = [];
    const mainCard = document.getElementById(timerId);
    if (mainCard) elementsToUpdate.push(mainCard);
    const searchItem = document.getElementById(`search-timer-${timerId}`); //
    if (searchItem) elementsToUpdate.push(searchItem);

    elementsToUpdate.forEach(element => {
        const playPauseLink = element.querySelector('[data-action="start-card-timer"], [data-action="pause-card-timer"]');
        if (playPauseLink) {
            const icon = playPauseLink.querySelector('.menu-link-icon span');
            const text = playPauseLink.querySelector('.menu-link-text span');

            if (timer.isRunning) {
                playPauseLink.dataset.action = 'pause-card-timer';
                icon.textContent = 'pause';
                text.dataset.translate = 'pause';
                text.textContent = getTranslation('pause', 'tooltips');
            } else {
                playPauseLink.dataset.action = 'start-card-timer';
                icon.textContent = 'play_arrow';
                text.dataset.translate = 'play';
                text.textContent = getTranslation('play', 'tooltips');
            }
        }
    });
}

function updatePinnedStatesInUI() {
    const allTimers = [...userTimers, ...defaultTimersState];
    if (!pinnedTimerId && allTimers.length > 0) {
        const firstTimer = allTimers[0];
        pinnedTimerId = firstTimer.id;
        firstTimer.isPinned = true;
        const isUser = userTimers.some(t => t.id === firstTimer.id);
        if (isUser) saveTimersToStorage(); else saveDefaultTimersOrder();
    }

    document.querySelectorAll('.tool-card.timer-card').forEach(card => {
        const pinBtn = card.querySelector('.card-pin-btn');
        if (pinBtn) {
            pinBtn.classList.toggle('active', card.id === pinnedTimerId);
        }
    });

    document.querySelectorAll('.search-result-item[data-type="timer"]').forEach(searchItem => {
        const pinBtn = searchItem.querySelector('.card-pin-btn');
        if (pinBtn) {
            pinBtn.classList.toggle('active', searchItem.dataset.id === pinnedTimerId);
        }
    });
}


function formatTime(ms, type = 'countdown') {
    if (ms <= 0) {
        return type === 'count_to_date' ? getTranslation('event_finished', 'timer') || "¡Evento finalizado!" : "00:00:00";
    }

    const totalSeconds = Math.max(0, Math.round(ms / 1000));

    if (type === 'count_to_date') {
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        return `${hours}:${minutes}:${seconds}`;
    } else {
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
}
function handleTimerEnd(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    timer.isRunning = false;
    if (activeTimers.has(timerId)) {
        clearInterval(activeTimers.get(timerId));
        activeTimers.delete(timerId);
    }
    timer.remaining = 0;
    if (timer.type === 'countdown') {
        delete timer.targetTime;
    }

    updateCardDisplay(timerId);
    if (timer.id === pinnedTimerId) updateMainDisplay();
    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();

    const isUserTimer = userTimers.some(t => t.id === timerId);
    if (isUserTimer) saveTimersToStorage(); else saveDefaultTimersOrder();

    let soundToPlay = timer.sound;
    const availableSounds = getAvailableSounds();
    if (!availableSounds.some(s => s.id === soundToPlay)) {
        console.warn(`Audio "${soundToPlay}" not found for timer "${timer.title}". Reverting to default.`);
        soundToPlay = 'classic_beep';
        timer.sound = soundToPlay;
        updateTimer(timer.id, { sound: soundToPlay });
    }

    if (timer.sound) {
        playSound(soundToPlay);
    }
    const translatedTitle = timer.id.startsWith('default-timer-') ? getTranslation(timer.title, 'timer') : timer.title;

    if (timer.type === 'countdown' && timer.endAction === 'restart') {
        setTimeout(() => {
            stopSound();
            resetTimer(timerId);
            startTimer(timerId);
        }, 3000);

    } else {
        const card = document.getElementById(timerId);
        card?.querySelector('.card-options-container')?.classList.add('active');

        showDynamicIslandNotification('timer', 'ringing', 'timer_ringing', 'notifications', {
            title: translatedTitle,
            toolId: timer.id
        }, (dismissedId) => {
            if (dismissedId === timer.id) {
                dismissTimer(timer.id);
            }
        });
    }
}

function toggleTimersSection(type) {
    const grid = document.querySelector(`.tool-grid[data-timer-grid="${type}"]`);
    if (!grid) return;
    const container = grid.closest('.timers-container');
    if (!container) return;
    const btn = container.querySelector('.expandable-card-toggle-btn');
    const isActive = grid.classList.toggle('active');
    btn.classList.toggle('expanded', isActive);
}

function updateTimerCounts() {
    const userTimersCount = userTimers.length;
    const defaultTimersCount = defaultTimersState.length;

    const userCountBadge = document.querySelector('.timer-count-badge[data-count-for="user"]');
    const defaultCountBadge = document.querySelector('.timer-count-badge[data-count-for="default"]');

    if (userCountBadge) userCountBadge.textContent = userTimersCount;
    if (defaultCountBadge) defaultCountBadge.textContent = defaultTimersCount;

    const userContainer = document.querySelector('.timers-container[data-container="user"]');
    const defaultContainer = document.querySelector('.timers-container[data-container="default"]');

    if (userContainer) {
        if (userTimersCount > 0) {
            userContainer.classList.remove('disabled');
            userContainer.classList.add('active');
        } else {
            userContainer.classList.remove('active');
            userContainer.classList.add('disabled');
        }
    }
    if (defaultContainer) {
        if (defaultTimersCount > 0) {
            defaultContainer.classList.remove('disabled');
            defaultContainer.classList.add('active');
        } else {
            defaultContainer.classList.remove('active');
            defaultContainer.classList.add('disabled');
        }
    }
}


function handlePinTimer(timerId) {
    if (pinnedTimerId === timerId) return;

    const allTimers = [...userTimers, ...defaultTimersState];
    allTimers.forEach(t => t.isPinned = (t.id === timerId));
    pinnedTimerId = timerId;

    updatePinnedStatesInUI();
    updateMainDisplay();
    updateMainControlsState();
    saveTimersToStorage();
    saveDefaultTimersOrder();
}

function handleEditTimer(timerId) {
    const timerData = findTimerById(timerId);
    if (timerData) {
        if (timerData.type === 'count_to_date') {
            prepareCountToDateForEdit(timerData);
        } else {
            prepareTimerForEdit(timerData);
        }
        if (getCurrentActiveOverlay() !== 'menuTimer') {
            activateModule('toggleMenuTimer');
        }

        const searchInput = document.getElementById('timer-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        renderTimerSearchResults('');
    }
}


function handleDeleteTimer(timerId) {
    if (timerId.startsWith('default-timer-')) {
        console.warn(`Deletion of default timer ${timerId} is not allowed.`);
        return;
    }

    const timerToDelete = findTimerById(timerId);
    if (!timerToDelete) return;

    const timerName = timerToDelete.id.startsWith('default-timer-') ? getTranslation(timerToDelete.title, 'timer') : timerToDelete.title;

    showConfirmation('timer', timerName, () => {
        if (activeTimers.has(timerId)) {
            clearInterval(activeTimers.get(timerId));
            activeTimers.delete(timerId);
        }
        const originalTitle = timerToDelete.id.startsWith('default-timer-') ? getTranslation(timerToDelete.title, 'timer') : timerToDelete.title;

        const userIndex = userTimers.findIndex(t => t.id === timerId);
        if (userIndex !== -1) {
            userTimers.splice(userIndex, 1);
            saveTimersToStorage();
        }

        if (pinnedTimerId === timerId) {
            const allTimers = [...userTimers, ...defaultTimersState];
            pinnedTimerId = allTimers.length > 0 ? allTimers[0].id : null;
            if (pinnedTimerId) {
                const newPinnedTimer = findTimerById(pinnedTimerId);
                if (newPinnedTimer) {
                    newPinnedTimer.isPinned = true;
                    const isUser = userTimers.some(t => t.id === newPinnedTimer.id);
                    if (isUser) saveTimersToStorage(); else saveDefaultTimersOrder();
                }
            }
        }

        renderAllTimerCards();
        updateMainDisplay();
        updateMainControlsState();
        updateTimerCounts();
        refreshSearchResults();
        if (window.hideDynamicIsland) {
            window.hideDynamicIsland();
        }

        showDynamicIslandNotification('timer', 'deleted', 'timer_deleted', 'notifications', {
            title: originalTitle
        });
        updateEverythingWidgets();
    });
}

function updateTimerCardVisuals(timer) {
    const card = document.getElementById(timer.id);
    if (!card) return;

    const titleElement = card.querySelector('.card-title');
    if (titleElement) {
        const isDefault = timer.id.startsWith('default-timer-');
        const titleText = isDefault ? getTranslation(timer.title, 'timer') : timer.title;
        titleElement.textContent = titleText;
        titleElement.title = titleText;
    }

    const timeElement = card.querySelector('.card-value');
    if (timeElement) {
        timeElement.textContent = formatTime(timer.remaining, timer.type);
    }

    const tagElement = card.querySelector('.card-tag');
    if (tagElement) {
        tagElement.textContent = getSoundNameById(timer.sound);
        tagElement.dataset.soundId = timer.sound;
    }

    const dismissButton = card.querySelector('.card-dismiss-btn span');
    if (dismissButton) {
        dismissButton.textContent = getTranslation('dismiss', 'alarms');
    }

    const playPauseLink = card.querySelector('[data-action="start-card-timer"], [data-action="pause-card-timer"]');
    if (playPauseLink) {
        const textElement = playPauseLink.querySelector('.menu-link-text span');
        const textKey = timer.isRunning ? 'pause' : 'play';
        if (textElement) {
            textElement.dataset.translate = textKey;
            textElement.textContent = getTranslation(textKey, 'tooltips');
        }
    }

    const resetLink = card.querySelector('[data-action="reset-card-timer"] .menu-link-text span');
    if (resetLink) {
        resetLink.textContent = getTranslation('reset', 'tooltips');
    }

    const editLink = card.querySelector('[data-action="edit-timer"] .menu-link-text span');
    if (editLink) {
        editLink.textContent = getTranslation('edit_timer', 'timer');
    }

    const deleteLink = card.querySelector('[data-action="delete-timer"] .menu-link-text span');
    if (deleteLink) {
        deleteLink.textContent = getTranslation('delete_timer', 'timer');
    }
}

function dismissTimer(timerId) {
    stopSound();
    const card = document.getElementById(timerId);
    if (card) {
        const optionsContainer = card.querySelector('.card-options-container');
        if (optionsContainer) {
            optionsContainer.classList.remove('active');
        }
    }
    if (window.hideDynamicIsland) {
        window.hideDynamicIsland();
    }
    const timer = findTimerById(timerId);
    if (timer && timer.type === 'countdown' && timer.endAction === 'stop') {
        resetTimer(timerId);
    } else if (timer && timer.type === 'count_to_date') {
    }
}
document.addEventListener('translationsApplied', () => {
    const allTimers = [...userTimers, ...defaultTimersState];
    allTimers.forEach(timer => {
        updateTimerCardVisuals(timer);
    });
    updateMainDisplay();
});


export { initializeTimerController };



export function initializeScrollShadow() {
    const menus = document.querySelectorAll('.menu-alarm, .menu-timer, .menu-worldClock, .menu-paletteColors, .menu-control-center');

    menus.forEach(menu => {
        const topContainer = menu.querySelector('.menu-section-top, .menu-header');
        
        // Búsqueda mejorada para el contenedor de scroll
        let scrollableContainer = menu.querySelector('.menu-section-center.overflow-y');
        
        // Si no lo encuentra, usa los selectores anteriores como respaldo (para el Centro de Control)
        if (!scrollableContainer) {
           scrollableContainer = menu.querySelector('.menu-content-scrolleable, .menu-body.overflow-y');
        }

        if (topContainer && scrollableContainer) {
            // Elimina listeners antiguos para evitar duplicados si la función se llama de nuevo
            scrollableContainer.removeEventListener('scroll', handleScroll);
            
            // Define una función con nombre para poder eliminarla después
            function handleScroll() {
                if (scrollableContainer.scrollTop > 0) {
                    topContainer.classList.add('shadow');
                } else {
                    topContainer.classList.remove('shadow');
                }
            }

            scrollableContainer.addEventListener('scroll', handleScroll);
        }
    });
}
 initializeScrollShadow() 
