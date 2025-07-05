// Ruta: /assets/js/tools/alarm-controller.js
import { use24HourFormat, PREMIUM_FEATURES, activateModule, getCurrentActiveOverlay, allowCardMovement } from '../general/main.js';
import { prepareAlarmForEdit } from './menu-interactions.js';
import { playSound as playAlarmSound, stopSound as stopAlarmSound, initializeSortable, getAvailableSounds, handleAlarmCardAction, getSoundNameById, createExpandableToolContainer } from './general-tools.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { updateEverythingWidgets } from './everything-controller.js';
import { getTranslation } from '../general/translations-controller.js';
import { showConfirmation } from '../general/overlay-manager.js';

const ALARMS_STORAGE_KEY = 'user-alarms';
const DEFAULT_ALARMS_STORAGE_KEY = 'default-alarms-order';

const DEFAULT_ALARMS = [
    { id: 'default-2', title: 'lunch_time', hour: 13, minute: 0, sound: 'gentle_chime', enabled: false, type: 'default' },
    { id: 'default-3', title: 'read_book', hour: 21, minute: 0, sound: 'peaceful_tone', enabled: false, type: 'default' },
    { id: 'default-5', title: 'take_a_break', hour: 16, minute: 0, sound: 'gentle_chime', enabled: false, type: 'default' }
];

let clockInterval = null;
let userAlarms = [];
let defaultAlarmsState = [];
let activeAlarmTimers = new Map();

function renderAlarmSearchResults(searchTerm) {
    const resultsWrapper = document.querySelector('.alarm-search-results-wrapper');
    const creationWrapper = document.querySelector('.alarm-creation-wrapper');

    if (!resultsWrapper || !creationWrapper) return;

    if (!searchTerm) {
        resultsWrapper.classList.add('disabled');
        creationWrapper.classList.remove('disabled');
        resultsWrapper.innerHTML = '';
        return;
    }

    const allAlarms = [...userAlarms, ...defaultAlarmsState];
    const filteredAlarms = allAlarms.filter(alarm => {
        const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
        return translatedTitle.toLowerCase().includes(searchTerm);
    });

    creationWrapper.classList.add('disabled');
    resultsWrapper.classList.remove('disabled');
    resultsWrapper.innerHTML = '';

    if (filteredAlarms.length > 0) {
        const list = document.createElement('div');
        list.className = 'menu-list';
        filteredAlarms.forEach(alarm => {
            const item = createSearchResultItem(alarm);
            list.appendChild(item);
            addSearchItemEventListeners(item);
        });
        resultsWrapper.appendChild(list);
    } else {
        resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
    }
}

function createSearchResultItem(alarm) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.id = `search-alarm-${alarm.id}`;
    item.dataset.id = alarm.id;
    item.dataset.type = 'alarm';

    const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    const time = formatTime(alarm.hour, alarm.minute);

    const deleteLinkHtml = alarm.type === 'default' ? '' : `
        <div class="menu-link" data-action="delete-alarm">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span data-translate="delete_alarm" data-translate-category="alarms">${getTranslation('delete_alarm', 'alarms')}</span></div>
        </div>
    `;

    item.innerHTML = `
        <div class="result-info">
            <span class="result-title">${translatedTitle}</span>
            <span class="result-time">${time}</span>
        </div>
        <div class="card-menu-container disabled"> <div class="card-menu-btn-wrapper">
                <button class="card-menu-btn" data-action="toggle-item-menu"
                        data-translate="options"
                        data-translate-category="world_clock_options"
                        data-translate-target="tooltip">
                    <span class="material-symbols-rounded">more_horiz</span>
                </button>
                <div class="card-dropdown-menu disabled body-title">
                     <div class="menu-link" data-action="toggle-alarm">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">${alarm.enabled ? 'toggle_on' : 'toggle_off'}</span></div>
                         <div class="menu-link-text"><span data-translate="${alarm.enabled ? 'deactivate_alarm' : 'activate_alarm'}" data-translate-category="alarms">${getTranslation(alarm.enabled ? 'deactivate_alarm' : 'activate_alarm', 'alarms')}</span></div>
                     </div>
                     <div class="menu-link" data-action="test-alarm">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">volume_up</span></div>
                         <div class="menu-link-text"><span data-translate="test_alarm" data-translate-category="alarms">${getTranslation('test_alarm', 'alarms')}</span></div>
                     </div>
                     <div class="menu-link" data-action="edit-alarm">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                         <div class="menu-link-text"><span data-translate="edit_alarm" data-translate-category="alarms">${getTranslation('edit_alarm', 'alarms')}</span></div>
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
        const alarmId = item.dataset.id;
        if (action === 'toggle-item-menu') {
            const dropdown = item.querySelector('.card-dropdown-menu');
            const isOpening = dropdown.classList.contains('disabled');
            document.querySelectorAll('.alarm-search-results-wrapper .card-dropdown-menu').forEach(d => {
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
            handleAlarmCardAction(action, alarmId, actionTarget);
        }
    });
}

function refreshSearchResults() {
    const searchInput = document.getElementById('alarm-search-input');
    if (searchInput && searchInput.value) {
        renderAlarmSearchResults(searchInput.value.toLowerCase());
    }
}

function getActiveAlarmsCount() {
    const allAlarms = [...userAlarms, ...defaultAlarmsState].filter(alarm => alarm.enabled);
    return allAlarms.length;
}

function getNextAlarmDetails() {
    const now = new Date();
    const activeAlarms = [...userAlarms, ...defaultAlarmsState].filter(a => a.enabled);
    if (activeAlarms.length === 0) {
        return null;
    }
    const upcomingAlarms = activeAlarms.map(alarm => {
        const alarmTime = new Date();
        alarmTime.setHours(alarm.hour, alarm.minute, 0, 0);
        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }
        return { ...alarm, time: alarmTime };
    }).sort((a, b) => a.time - b.time);
    const nextAlarm = upcomingAlarms[0];
    const title = nextAlarm.type === 'default' ? getTranslation(nextAlarm.title, 'alarms') : nextAlarm.title;
    const timeString = nextAlarm.time.toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit', hour12: !use24HourFormat });
    return `${title} (${timeString})`;
}

function updateAlarmCounts() {
    const userAlarmsCount = userAlarms.length;
    const defaultAlarmsCount = defaultAlarmsState.length;
    const userCountBadge = document.querySelector('.alarm-count-badge[data-count-for="user"]');
    const defaultCountBadge = document.querySelector('.alarm-count-badge[data-count-for="default"]');
    if (userCountBadge) userCountBadge.textContent = userAlarmsCount;
    if (defaultCountBadge) defaultCountBadge.textContent = defaultAlarmsCount;
    const userContainer = document.querySelector('.alarms-container[data-container="user"]');
    const defaultContainer = document.querySelector('.alarms-container[data-container="default"]');
    if (userContainer) {
        if (userAlarmsCount > 0) {
            userContainer.classList.remove('disabled');
            userContainer.classList.add('active');
        } else {
            userContainer.classList.remove('active');
            userContainer.classList.add('disabled');
        }
    }
    if (defaultContainer) {
        if (defaultAlarmsCount > 0) {
            defaultContainer.classList.remove('disabled');
            defaultContainer.classList.add('active');
        } else {
            defaultContainer.classList.remove('active');
            defaultContainer.classList.add('disabled');
        }
    }
    updateEverythingWidgets();
}

export function getAlarmCount() {
    return userAlarms.length;
}

export function getAlarmLimit() {
    return PREMIUM_FEATURES ? 100 : 5;
}
function createAlarm(title, hour, minute, sound) {
    const alarmLimit = getAlarmLimit();
    if (userAlarms.length >= alarmLimit) {
        // --- INICIO DE LA LÓGICA SIMPLIFICADA ---
        showDynamicIslandNotification(
            'system',
            'limit_reached', // Acción genérica
            null, // El controlador de notificaciones elegirá el mensaje
            'notifications',
            { type: getTranslation('alarms', 'tooltips') }
        );
        // --- FIN DE LA LÓGICA SIMPLIFICADA ---
        return false;
    }
    const alarm = {
        id: `alarm-${Date.now()}`,
        title,
        hour,
        minute,
        sound,
        enabled: true,
        type: 'user',
        created: new Date().toISOString()
    };
    userAlarms.push(alarm);
    saveAlarmsToStorage();
    renderAllAlarmCards();
    scheduleAlarm(alarm);
    updateAlarmCounts();
    showDynamicIslandNotification('alarm', 'created', 'alarm_created', 'notifications', { title: alarm.title });
    updateEverythingWidgets();
    return true;
}

function renderAllAlarmCards() {
    const userGrid = document.querySelector('.tool-grid[data-alarm-grid="user"]');
    const defaultGrid = document.querySelector('.tool-grid[data-alarm-grid="default"]');
    if (userGrid) userGrid.innerHTML = '';
    if (defaultGrid) defaultGrid.innerHTML = '';
    userAlarms.forEach(alarm => createAlarmCard(alarm));
    defaultAlarmsState.forEach(alarm => createAlarmCard(alarm));
}

function createAlarmCard(alarm) {
    const grid = document.querySelector(`.tool-grid[data-alarm-grid="${alarm.type}"]`);
    if (!grid) return;
    const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    const soundName = getSoundNameById(alarm.sound);
    const deleteLinkHtml = alarm.type === 'default' ? '' : `
        <div class="menu-link" data-action="delete-alarm">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span data-translate="delete_alarm" data-translate-category="alarms">${getTranslation('delete_alarm', 'alarms')}</span></div>
        </div>
    `;
    const cardHTML = `
        <div class="tool-card alarm-card ${!alarm.enabled ? 'alarm-disabled' : ''}" id="${alarm.id}" data-id="${alarm.id}" data-type="${alarm.type}">
            <div class="card-header">
                <div class="card-details">
                    <span class="card-title" title="${translatedTitle}">${translatedTitle}</span>
                    <span class="card-value">${formatTime(alarm.hour, alarm.minute)}</span>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-tags">
                    <span class="card-tag" data-sound-id="${alarm.sound}">${soundName}</span>
                </div>
            </div>
            <div class="card-options-container">
                <button class="card-dismiss-btn" data-type="alarm" data-action="dismiss-alarm">
                    <span data-translate="dismiss" data-translate-category="alarms">Dismiss</span>
                </button>
            </div>
            <div class="card-menu-container disabled">
                <div class="card-menu-btn-wrapper">
                    <button class="card-menu-btn" data-action="toggle-alarm-menu"
                            data-translate="options"
                            data-translate-category="world_clock_options"
                            data-translate-target="tooltip">
                        <span class="material-symbols-rounded">more_horiz</span>
                    </button>
                    <div class="card-dropdown-menu disabled body-title">
                        <div class="menu-link" data-action="toggle-alarm">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">${alarm.enabled ? 'toggle_on' : 'toggle_off'}</span></div>
                            <div class="menu-link-text"><span data-translate="${alarm.enabled ? 'deactivate_alarm' : 'activate_alarm'}" data-translate-category="alarms">${getTranslation(alarm.enabled ? 'deactivate_alarm' : 'activate_alarm', 'alarms')}</span></div>
                        </div>
                        <div class="menu-link" data-action="test-alarm">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">volume_up</span></div>
                            <div class="menu-link-text"><span data-translate="test_alarm" data-translate-category="alarms">${getTranslation('test_alarm', 'alarms')}</span></div>
                        </div>
                        <div class="menu-link" data-action="edit-alarm">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                            <div class="menu-link-text"><span data-translate="edit_alarm" data-translate-category="alarms">${getTranslation('edit_alarm', 'alarms')}</span></div>
                        </div>
                        ${deleteLinkHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    grid.insertAdjacentHTML('beforeend', cardHTML);
    const newCard = document.getElementById(alarm.id);
    if (newCard) {
        addCardEventListeners(newCard);
    }
}

function addCardEventListeners(card) {
    const menuContainer = card.querySelector('.card-menu-container');
    card.addEventListener('mouseenter', () => {
        menuContainer?.classList.remove('disabled');
    });
    card.addEventListener('mouseleave', () => {
        const dropdown = menuContainer?.querySelector('.card-dropdown-menu');
        if (dropdown?.classList.contains('disabled')) {
            menuContainer?.classList.add('disabled');
        }
    });
    const dismissButton = card.querySelector('[data-action="dismiss-alarm"]');
    if (dismissButton) {
        dismissButton.addEventListener('click', () => dismissAlarm(card.id));
    }
}

function scheduleAlarm(alarm) {
    if (!alarm.enabled) return;
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(alarm.hour, alarm.minute, 0, 0);
    if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
    }
    const timeUntilAlarm = alarmTime.getTime() - now.getTime();
    if (activeAlarmTimers.has(alarm.id)) {
        clearTimeout(activeAlarmTimers.get(alarm.id));
    }
    const timerId = setTimeout(() => {
        triggerAlarm(alarm);
        activeAlarmTimers.delete(alarm.id);
    }, timeUntilAlarm);
    activeAlarmTimers.set(alarm.id, timerId);
}

function triggerAlarm(alarm) {
    let soundToPlay = alarm.sound;
    const availableSounds = getAvailableSounds();
    if (!availableSounds.some(s => s.id === soundToPlay)) {
        console.warn(`Audio "${soundToPlay}" not found for alarm "${alarm.title}". Reverting to default.`);
        soundToPlay = 'classic_beep';
        alarm.sound = soundToPlay;
        updateAlarm(alarm.id, { sound: soundToPlay });
    }
    playAlarmSound(soundToPlay);
    const alarmCard = document.getElementById(alarm.id);
    if (alarmCard) {
        const optionsContainer = alarmCard.querySelector('.card-options-container');
        if (optionsContainer) {
            optionsContainer.classList.add('active');
        }
    }
    const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(getTranslation('alarm_ringing_title', 'notifications'), {
            body: getTranslation('alarm_ringing', 'notifications').replace('{title}', translatedTitle),
            icon: '/favicon.ico'
        });
    }
    showDynamicIslandNotification('alarm', 'ringing', 'alarm_ringing', 'notifications', {
        title: translatedTitle,
        toolId: alarm.id
    }, (dismissedId) => {
        if (dismissedId === alarm.id) {
            dismissAlarm(alarm.id);
        }
    });
    scheduleAlarm(alarm);
}

function dismissAlarm(alarmId) {
    stopAlarmSound();
    const alarmCard = document.getElementById(alarmId);
    if (alarmCard) {
        const optionsContainer = alarmCard.querySelector('.card-options-container');
        if (optionsContainer) {
            optionsContainer.classList.remove('active');
        }
    }
    const alarm = findAlarmById(alarmId);
    if (alarm && alarm.enabled) {
        console.log(`Alarm ${alarmId} dismissed.`);
    }
    if (window.hideDynamicIsland) {
        window.hideDynamicIsland();
    }
}

function findAlarmById(alarmId) {
    return userAlarms.find(a => a.id === alarmId) || defaultAlarmsState.find(a => a.id === alarmId);
}

function toggleAlarm(alarmId) {
    const alarm = findAlarmById(alarmId);
    if (!alarm) return;
    alarm.enabled = !alarm.enabled;
    if (alarm.type === 'user') {
        saveAlarmsToStorage();
    } else if (alarm.type === 'default') {
        saveDefaultAlarmsOrder();
    }
    if (alarm.enabled) {
        scheduleAlarm(alarm);
    } else {
        if (activeAlarmTimers.has(alarmId)) {
            clearTimeout(activeAlarmTimers.get(alarmId));
            activeAlarmTimers.delete(alarmId);
        }
    }
    updateAlarmCardVisuals(alarm);
    refreshSearchResults();
    updateEverythingWidgets();
}

function deleteAlarm(alarmId) {
    const alarm = findAlarmById(alarmId);
    if (!alarm) return;
    if (alarm.type === 'default') {
        console.warn(`Attempted to delete default alarm: ${alarmId}. Deletion is not allowed for default alarms.`);
        return;
    }
    if (activeAlarmTimers.has(alarmId)) {
        clearTimeout(activeAlarmTimers.get(alarmId));
        activeAlarmTimers.delete(alarmId);
    }
    const originalTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    if (alarm.type === 'user') {
        userAlarms = userAlarms.filter(a => a.id !== alarmId);
        saveAlarmsToStorage();
    } else {
        defaultAlarmsState = defaultAlarmsState.filter(a => a.id !== alarmId);
        saveDefaultAlarmsOrder();
    }
    const alarmCard = document.getElementById(alarmId);
    if (alarmCard) {
        alarmCard.remove();
    }
    updateAlarmCounts();
    if (window.hideDynamicIsland) {
        window.hideDynamicIsland();
    }
    showDynamicIslandNotification('alarm', 'deleted', 'alarm_deleted', 'notifications', { title: originalTitle });
    refreshSearchResults();
    updateEverythingWidgets();
}

function updateAlarm(alarmId, newData) {
    const alarm = findAlarmById(alarmId);
    if (!alarm) return;
    Object.assign(alarm, newData);
    if (alarm.type === 'user') {
        saveAlarmsToStorage();
    } else if (alarm.type === 'default') {
        saveDefaultAlarmsOrder();
    }
    if (activeAlarmTimers.has(alarmId)) {
        clearTimeout(activeAlarmTimers.get(alarmId));
        activeAlarmTimers.delete(alarmId);
    }
    if (alarm.enabled) {
        scheduleAlarm(alarm);
    }
    updateAlarmCardVisuals(alarm);
    refreshSearchResults();
    const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    showDynamicIslandNotification('alarm', 'updated', 'alarm_updated', 'notifications', { title: translatedTitle });
    updateEverythingWidgets();
}

function updateAlarmCardVisuals(alarm) {
    const card = document.getElementById(alarm.id);
    if (!card) return;
    const title = card.querySelector('.card-title');
    const time = card.querySelector('.card-value');
    const sound = card.querySelector('.card-tag');
    const toggleLink = card.querySelector('[data-action="toggle-alarm"]');
    const toggleIcon = toggleLink?.querySelector('.material-symbols-rounded');
    const toggleText = toggleLink?.querySelector('.menu-link-text span');
    const translatedTitle = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    if (title) {
        title.textContent = translatedTitle;
        title.title = translatedTitle;
    }
    if (time) time.textContent = formatTime(alarm.hour, alarm.minute);
    if (sound) {
        sound.textContent = getSoundNameById(alarm.sound);
        sound.dataset.soundId = alarm.sound;
    }
    if (toggleIcon) toggleIcon.textContent = alarm.enabled ? 'toggle_on' : 'toggle_off';
    if (toggleText) {
        const key = alarm.enabled ? 'deactivate_alarm' : 'activate_alarm';
        toggleText.setAttribute('data-translate', key);
        toggleText.textContent = getTranslation(key, 'alarms');
    }
    card.classList.toggle('alarm-disabled', !alarm.enabled);
}

function saveAlarmsToStorage() {
    localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(userAlarms));
}

function saveDefaultAlarmsOrder() {
    localStorage.setItem(DEFAULT_ALARMS_STORAGE_KEY, JSON.stringify(defaultAlarmsState));
}

function loadDefaultAlarmsOrder() {
    const stored = localStorage.getItem(DEFAULT_ALARMS_STORAGE_KEY);
    if (stored) {
        try {
            defaultAlarmsState = JSON.parse(stored);
            const defaultIds = new Set(defaultAlarmsState.map(alarm => alarm.id));
            DEFAULT_ALARMS.forEach(defaultAlarm => {
                if (!defaultIds.has(defaultAlarm.id)) {
                    defaultAlarmsState.push({ ...defaultAlarm });
                }
            });
        } catch (error) {
            console.warn('Error loading default alarms order:', error);
            defaultAlarmsState = JSON.parse(JSON.stringify(DEFAULT_ALARMS));
        }
    } else {
        defaultAlarmsState = JSON.parse(JSON.stringify(DEFAULT_ALARMS));
    }
}

function loadAlarmsFromStorage() {
    const stored = localStorage.getItem(ALARMS_STORAGE_KEY);
    if (stored) {
        userAlarms = JSON.parse(stored);
    }
    userAlarms.forEach(alarm => {
        alarm.type = 'user';
        if (alarm.enabled) scheduleAlarm(alarm);
    });
}

function loadDefaultAlarms() {
    loadDefaultAlarmsOrder();
    defaultAlarmsState.forEach(alarm => {
        if (alarm.enabled) scheduleAlarm(alarm);
    });
}

function formatTime(hour, minute) {
    if (use24HourFormat) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    const ampm = hour >= 12 ? 'PM' : 'AM';
    let h12 = hour % 12;
    h12 = h12 ? h12 : 12;
    return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function toggleAlarmsSection(type) {
    const grid = document.querySelector(`.tool-grid[data-alarm-grid="${type}"]`);
    if (!grid) return;
    const container = grid.closest('.alarms-container');
    if (!container) return;
    const btn = container.querySelector('.expandable-card-toggle-btn');
    const isActive = grid.classList.toggle('active');
    btn.classList.toggle('expanded', isActive);
}

function updateLocalTime() {
    const el = document.querySelector('.tool-alarm span');
    if (el) {
        const now = new Date();
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24HourFormat };
        el.textContent = now.toLocaleTimeString(navigator.language, options);
    }
}

function startClock() {
    if (clockInterval) return;
    updateLocalTime();
    clockInterval = setInterval(updateLocalTime, 1000);
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
    initializeSortable('.tool-grid[data-alarm-grid="user"]', {
        ...sortableOptions,
        onEnd: function (evt) {
            const newOrderIds = Array.from(evt.to.children).map(card => card.id);
            userAlarms.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
            saveAlarmsToStorage();
        }
    });
    initializeSortable('.tool-grid[data-alarm-grid="default"]', {
        ...sortableOptions,
        onEnd: function (evt) {
            const newOrderIds = Array.from(evt.to.children).map(card => card.id);
            defaultAlarmsState.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
            saveDefaultAlarmsOrder();
        }
    });
}

function handleEditAlarm(alarmId) {
    const alarmData = findAlarmById(alarmId);
    if (alarmData) {
        prepareAlarmForEdit(alarmData);
        const searchInput = document.getElementById('alarm-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        renderAlarmSearchResults('');
        if (getCurrentActiveOverlay() !== 'menuAlarm') {
            activateModule('toggleMenuAlarm');
        }
    }
}

function handleDeleteAlarm(alarmId) {
    const alarm = findAlarmById(alarmId);
    if (!alarm) return;

    const alarmName = alarm.type === 'default' ? getTranslation(alarm.title, 'alarms') : alarm.title;
    showConfirmation('alarm', alarmName, () => {
        deleteAlarm(alarmId);
    });
}

function testAlarm(alarmId) {
    const alarm = findAlarmById(alarmId);
    if (alarm && alarm.sound) {
        playAlarmSound(alarm.sound);
        setTimeout(() => stopAlarmSound(), 1000);
    }
}

export function initializeAlarmClock() {
    startClock();
    const wrapper = document.querySelector('.alarms-list-wrapper');
    if (wrapper) {
        const userContainer = createExpandableToolContainer({
            type: 'user',
            titleKey: 'my_alarms',
            translationCategory: 'alarms',
            icon: 'alarm',
            containerClass: 'alarms-container',
            badgeClass: 'alarm-count-badge',
            gridAttribute: 'data-alarm-grid',
            toggleFunction: toggleAlarmsSection
        });

        const defaultContainer = createExpandableToolContainer({
            type: 'default',
            titleKey: 'default_alarms',
            translationCategory: 'alarms',
            icon: 'alarm_on',
            containerClass: 'alarms-container',
            badgeClass: 'alarm-count-badge',
            gridAttribute: 'data-alarm-grid',
            toggleFunction: toggleAlarmsSection
        });
        wrapper.appendChild(userContainer);
        wrapper.appendChild(defaultContainer);
    }
    loadAlarmsFromStorage();
    loadDefaultAlarms();
    renderAllAlarmCards();
    updateAlarmCounts();
    initializeSortableGrids();
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    const searchInput = document.getElementById('alarm-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderAlarmSearchResults(e.target.value.toLowerCase()));
    }

    window.alarmManager = {
        createAlarm,
        toggleAlarm,
        deleteAlarm,
        updateAlarm,
        toggleAlarmsSection,
        dismissAlarm,
        findAlarmById,
        handleEditAlarm,
        testAlarm,
        handleDeleteAlarm,
        getAlarmCount,
        getAlarmLimit,
        getActiveAlarmsCount,
        getNextAlarmDetails,
        getAllAlarms: () => ({ userAlarms, defaultAlarms: defaultAlarmsState }),
        saveAllAlarms: () => {
            saveAlarmsToStorage();
            saveDefaultAlarmsOrder();
        },
        renderAllAlarmCards
    };

    updateEverythingWidgets();
    document.addEventListener('translationsApplied', () => {
        const allAlarms = [...userAlarms, ...defaultAlarmsState];
        allAlarms.forEach(alarm => {
            updateAlarmCardVisuals(alarm);
        });
        document.querySelectorAll('[data-translate-category="alarms"]').forEach(element => {
            const key = element.dataset.translate;
            if (key) {
                element.textContent = getTranslation(key, 'alarms');
            }
        });
        const searchInput = document.getElementById('alarm-search-input');
        if (searchInput && searchInput.value) {
            renderAlarmSearchResults(searchInput.value.toLowerCase());
        }
    });
    document.addEventListener('moduleDeactivated', (e) => {
        if (e.detail && e.detail.module === 'toggleMenuAlarm') {
            const searchInput = document.getElementById('alarm-search-input');
            if (searchInput) {
                searchInput.value = '';
                renderAlarmSearchResults('');
            }
        }
    });
}