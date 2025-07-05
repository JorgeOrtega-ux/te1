// ========== menu-interactions.js - CÓDIGO COMPLETO ACTUALIZADO ==========

"use strict";
import { use24HourFormat, deactivateModule, PREMIUM_FEATURES, toggleModule } from '../general/main.js';
import { getTranslation } from '../general/translations-controller.js';
import { addTimerAndRender, updateTimer, getTimersCount, getTimerLimit } from './timer-controller.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { playSound, stopSound, generateSoundList, handleAudioUpload, deleteUserAudio, getSoundNameById } from './general-tools.js';
import { getCurrentLocation } from '../general/location-manager.js';

const autoIncrementState = {
    isActive: false,
    intervalId: null,
    timeoutId: null,
    initialDelay: 500,
    repeatInterval: 120
};

const initialState = {
    alarm: { hour: 0, minute: 0, sound: 'classic_beep' },
    timer: {
        currentTab: 'countdown',
        duration: { hours: 0, minutes: 5, seconds: 0 },
        countTo: { date: new Date(), selectedDate: null, selectedHour: null, selectedMinute: null, timeSelectionStep: 'hour', sound: 'classic_beep' },
        endAction: 'stop',
        sound: 'classic_beep'
    },
    worldClock: { country: '', timezone: '', countryCode: '', isEditing: false, editingId: null }
};

const state = JSON.parse(JSON.stringify(initialState));
state.timer.countTo.date = new Date();

// Objeto de mapeo de dropdowns eliminado, ya no es necesario
// const dropdownMap = { ... };

const menuTimeouts = {};
let areGlobalListenersInitialized = false;
let soundSelectionContext = null;

// ===== NUEVO: SISTEMA DE NAVEGACIÓN DE MENÚS =====
const menuStack = [];

function navigateToMenu(menuName) {
    const overlay = document.querySelector('.module-overlay');
    if (!overlay) return;

    const currentMenu = overlay.querySelector('.menu-alarm.active, .menu-timer.active, .menu-worldClock.active, .menu-sounds.active, .menu-country.active, .menu-timezone.active');
    
    if (currentMenu) {
        menuStack.push(currentMenu.dataset.menu);
        currentMenu.classList.remove('active');
        currentMenu.classList.add('disabled');
    }

    const nextMenu = overlay.querySelector(`[data-menu="${menuName}"]`);
    if (nextMenu) {
        nextMenu.classList.remove('disabled');
        nextMenu.classList.add('active');
    }
}

function navigateBack() {
    const overlay = document.querySelector('.module-overlay');
    if (!overlay) return;

    const currentMenu = overlay.querySelector('.menu-sounds.active, .menu-country.active, .menu-timezone.active');
    if (currentMenu) {
        currentMenu.classList.remove('active');
        currentMenu.classList.add('disabled');
    }

    const previousMenuName = menuStack.pop();
    if (previousMenuName) {
        const previousMenu = overlay.querySelector(`[data-menu="${previousMenuName}"]`);
        if (previousMenu) {
            previousMenu.classList.remove('disabled');
            previousMenu.classList.add('active');
        }
    } else {
        // Si no hay nada en la pila, cerramos el módulo de overlay
        deactivateModule('overlayContainer');
    }
}
// ===== FIN DEL NUEVO SISTEMA DE NAVEGACIÓN =====


function getMenuElement(menuName) {
    const menuSelectorMap = {
        'menuAlarm': '.menu-alarm[data-menu="Alarm"]',
        'menuTimer': '.menu-timer[data-menu="Timer"]',
        'menuWorldClock': '.menu-worldClock[data-menu="WorldClock"]'
    };
    return document.querySelector(menuSelectorMap[menuName]);
};

function startAutoIncrement(actionFn) {
    stopAutoIncrement();
    autoIncrementState.isActive = true;
    actionFn();
    autoIncrementState.timeoutId = setTimeout(() => {
        autoIncrementState.intervalId = setInterval(actionFn, autoIncrementState.repeatInterval);
    }, autoIncrementState.initialDelay);
}

function stopAutoIncrement() {
    if (autoIncrementState.timeoutId) clearTimeout(autoIncrementState.timeoutId);
    if (autoIncrementState.intervalId) clearInterval(autoIncrementState.intervalId);
    autoIncrementState.isActive = false;
    autoIncrementState.timeoutId = null;
    autoIncrementState.intervalId = null;
}

function addSpinnerToCreateButton(button) {
    button.classList.add('disabled-interactive');
    const originalTextSpan = button.querySelector('span');
    if (originalTextSpan) {
        button.setAttribute('data-original-text', originalTextSpan.textContent);
        originalTextSpan.style.display = 'none';
    }
    const loader = document.createElement('span');
    loader.className = 'material-symbols-rounded spinning';
    loader.textContent = 'progress_activity';
    button.appendChild(loader);
}

function removeSpinnerFromCreateButton(button) {
    button.classList.remove('disabled-interactive');
    const originalText = button.getAttribute('data-original-text');
    const textSpan = button.querySelector('span[data-translate]');
    const loader = button.querySelector('.spinning');
    if (loader) loader.remove();
    if (textSpan) {
        textSpan.textContent = originalText;
        textSpan.style.display = 'inline';
        button.removeAttribute('data-original-text');
    }
}

function validateField(element, condition) {
    if (condition) {
        element.classList.remove('input-error');
        return true;
    } else {
        element.classList.add('input-error');
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        return false;
    }
}

const setAlarmDefaults = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    state.alarm.hour = now.getHours();
    state.alarm.minute = now.getMinutes();
};

const resetAlarmMenu = (menuElement) => {
    setAlarmDefaults();
    state.alarm.sound = 'classic_beep';
    const titleInput = menuElement.querySelector('#alarm-title');
    if (titleInput) {
        titleInput.value = '';
        titleInput.removeAttribute('disabled');
        titleInput.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    const searchInput = menuElement.querySelector('.search-content-text input');
    if (searchInput) searchInput.value = '';
    updateAlarmDisplay(menuElement);
    updateDisplay('#alarm-selected-sound', getSoundNameById(state.alarm.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createAlarm';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_alarm');
            buttonText.setAttribute('data-translate-category', 'alarms');
            buttonText.textContent = getTranslation('create_alarm', 'alarms');
        }
    }
    menuElement.removeAttribute('data-editing-id');
    const menuId = menuElement.dataset.menu;
    if (menuTimeouts[menuId]) {
        clearTimeout(menuTimeouts[menuId]);
        delete menuTimeouts[menuId];
    }
};

const resetTimerMenu = (menuElement) => {
    state.timer = JSON.parse(JSON.stringify(initialState.timer));
    state.timer.countTo.date = new Date();
    const countdownTitle = menuElement.querySelector('#timer-title');
    if (countdownTitle) {
        countdownTitle.value = '';
        countdownTitle.removeAttribute('disabled');
        countdownTitle.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    const countToTitle = menuElement.querySelector('#countto-title');
    if (countToTitle) {
        countToTitle.value = '';
        countToTitle.removeAttribute('disabled');
        countToTitle.parentElement.classList.remove('disabled-interactive', 'input-error');
    }
    updateTimerTabView(menuElement);
    updateTimerDurationDisplay(menuElement);
    renderCalendar(menuElement);
    updateDisplay('#selected-date-display', '-- / -- / ----', menuElement);
    updateDisplay('#selected-hour-display', '--', menuElement);
    updateDisplay('#selected-minute-display', '--', menuElement);
    resetDropdownDisplay(menuElement, '#timer-selected-end-action', 'stop_timer', 'timer');
    updateDisplay('#countdown-selected-sound', getSoundNameById(state.timer.sound), menuElement);
    updateDisplay('#count-to-date-selected-sound', getSoundNameById(state.timer.countTo.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createTimer';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_timer');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('create_timer', 'timer');
        }
    }
    menuElement.removeAttribute('data-editing-id');
};

const resetWorldClockMenu = (menuElement) => {
    const menuId = menuElement.dataset.menu;
    if (menuTimeouts[menuId]) {
        clearTimeout(menuTimeouts[menuId]);
        delete menuTimeouts[menuId];
    }
    state.worldClock = JSON.parse(JSON.stringify(initialState.worldClock));
    const titleInput = menuElement.querySelector('#worldclock-title');
    if (titleInput) {
        titleInput.value = '';
        titleInput.parentElement.classList.remove('input-error');
    }
    const countrySearchInput = document.querySelector('#country-search-input-new');
    if (countrySearchInput) countrySearchInput.value = '';
    const timezoneSearchInput = document.querySelector('#timezone-search-input');
    if (timezoneSearchInput) timezoneSearchInput.value = '';

    updateDisplay('#worldclock-selected-country', getTranslation('select_a_country', 'world_clock'), menuElement);
    updateDisplay('#worldclock-selected-timezone', getTranslation('select_a_timezone', 'world_clock'), menuElement);
    
    menuElement.querySelector('[data-action="open-country-menu"]').classList.remove('input-error');
    const timezoneSelector = menuElement.querySelector('[data-action="open-timezone-menu"]');
    if (timezoneSelector) {
        timezoneSelector.classList.add('disabled-interactive');
        timezoneSelector.classList.remove('input-error');
    }
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'addWorldClock';
        const buttonText = createButton.querySelector('span');
        if (buttonText) buttonText.textContent = getTranslation('add_clock', 'tooltips');
    }
    menuElement.removeAttribute('data-editing-id');
};


export function prepareAlarmForEdit(alarmData) {
    const menuElement = getMenuElement('menuAlarm');
    if (!menuElement) return;
    state.alarm.hour = alarmData.hour;
    state.alarm.minute = alarmData.minute;
    state.alarm.sound = alarmData.sound;
    const titleInput = menuElement.querySelector('#alarm-title');
    if (titleInput) {
        if (alarmData.type === 'default') {
            titleInput.value = getTranslation(alarmData.title, 'alarms');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = alarmData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    updateAlarmDisplay(menuElement);
    updateDisplay('#alarm-selected-sound', getSoundNameById(alarmData.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveAlarmChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'alarms');
            buttonText.textContent = getTranslation('save_changes', 'alarms');
        }
    }
    menuElement.setAttribute('data-editing-id', alarmData.id);
}

export function prepareTimerForEdit(timerData) {
    const menuElement = getMenuElement('menuTimer');
    if (!menuElement) return;
    state.timer.currentTab = 'countdown';
    updateTimerTabView(menuElement);
    const durationInMs = timerData.initialDuration;
    const totalSeconds = Math.floor(durationInMs / 1000);
    state.timer.duration.hours = Math.floor(totalSeconds / 3600);
    state.timer.duration.minutes = Math.floor((totalSeconds % 3600) / 60);
    state.timer.duration.seconds = totalSeconds % 60;
    state.timer.endAction = timerData.endAction;
    state.timer.sound = timerData.sound;
    const titleInput = menuElement.querySelector('#timer-title');
    if (titleInput) {
        if (timerData.id.startsWith('default-timer-')) {
            titleInput.value = getTranslation(timerData.title, 'timer');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = timerData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    updateTimerDurationDisplay(menuElement);
    updateDisplay('#timer-selected-end-action', getTranslation(`${timerData.endAction}_timer`, 'timer'), menuElement);
    updateDisplay('#countdown-selected-sound', getSoundNameById(timerData.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveTimerChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('save_changes', 'timer');
        }
    }
    menuElement.setAttribute('data-editing-id', timerData.id);
}

function getFormattedDate(date) {
    const location = getCurrentLocation();
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    let locale = 'default';

    if (location && location.code.toLowerCase() === 'us') {
        locale = 'en-US';
    }

    return date.toLocaleDateString(locale, options);
}

export function prepareCountToDateForEdit(timerData) {
    const menuElement = getMenuElement('menuTimer');
    if (!menuElement) return;
    state.timer.currentTab = 'count_to_date';
    updateTimerTabView(menuElement);
    const titleInput = menuElement.querySelector('#countto-title');
    if (titleInput) {
        if (timerData.id.startsWith('default-timer-')) {
            titleInput.value = getTranslation(timerData.title, 'timer');
            titleInput.setAttribute('disabled', 'true');
            titleInput.parentElement.classList.add('disabled-interactive');
        } else {
            titleInput.value = timerData.title;
            titleInput.removeAttribute('disabled');
            titleInput.parentElement.classList.remove('disabled-interactive');
        }
    }
    state.timer.countTo.sound = timerData.sound;
    const targetDate = new Date(timerData.targetDate);
    state.timer.countTo.date = targetDate;
    state.timer.countTo.selectedDate = targetDate.toISOString();
    state.timer.countTo.selectedHour = targetDate.getHours();
    state.timer.countTo.selectedMinute = targetDate.getMinutes();

    updateDisplay('#selected-date-display', getFormattedDate(targetDate), menuElement);

    updateDisplay('#selected-hour-display', String(targetDate.getHours()).padStart(2, '0'), menuElement);
    updateDisplay('#selected-minute-display', String(targetDate.getMinutes()).padStart(2, '0'), menuElement);
    updateDisplay('#count-to-date-selected-sound', getSoundNameById(timerData.sound), menuElement);
    renderCalendar(menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveCountToDateChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'timer');
            buttonText.textContent = getTranslation('save_changes', 'timer');
        }
    }
    menuElement.setAttribute('data-editing-id', timerData.id);
}

export function prepareWorldClockForEdit(clockData) {
    const menuElement = getMenuElement('menuWorldClock');
    if (!menuElement) return;
    state.worldClock.isEditing = true;
    state.worldClock.editingId = clockData.id;
    state.worldClock.country = clockData.country;
    state.worldClock.timezone = clockData.timezone;
    state.worldClock.countryCode = clockData.countryCode;
    const titleInput = menuElement.querySelector('#worldclock-title');
    if (titleInput) titleInput.value = clockData.title;
    updateDisplay('#worldclock-selected-country', clockData.country, menuElement);
    const timezoneSelector = menuElement.querySelector('[data-action="open-timezone-menu"]');
    if (timezoneSelector) timezoneSelector.classList.remove('disabled-interactive');
    const ct = window.ct;
    const tzObject = ct.getTimezone(clockData.timezone);
    const cityName = tzObject.name.split('/').pop().replace(/_/g, ' ');
    const displayName = `(UTC ${tzObject.utcOffsetStr}) ${cityName}`;
    updateDisplay('#worldclock-selected-timezone', displayName, menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveWorldClockChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.setAttribute('data-translate-category', 'world_clock_options');
            buttonText.textContent = getTranslation('save_changes', 'world_clock_options');
        }
    }
    menuElement.setAttribute('data-editing-id', clockData.id);
}

const initializeAlarmMenu = (menuElement) => {
    if (!menuElement.hasAttribute('data-editing-id')) {
        setAlarmDefaults();
    }
    updateAlarmDisplay(menuElement);
};

const initializeTimerMenu = (menuElement) => {
    if (!menuElement.hasAttribute('data-editing-id')) {
        // No need to generate lists here, they are in their own menu now
    }
    updateTimerDurationDisplay(menuElement);
    renderCalendar(menuElement);
    populateHourSelectionMenu(menuElement);
};

const initializeWorldClockMenu = (menuElement) => {
    const timezoneSelector = menuElement.querySelector('[data-action="open-timezone-menu"]');
    if (timezoneSelector) timezoneSelector.classList.add('disabled-interactive');
};

export function initializeMenuForOverlay(menuName) {
    const menuElement = getMenuElement(menuName);
    if (!menuElement) return;
    switch (menuName) {
        case 'menuAlarm': initializeAlarmMenu(menuElement); break;
        case 'menuTimer': initializeTimerMenu(menuElement); break;
        case 'menuWorldClock': initializeWorldClockMenu(menuElement); break;
    }
}

export function resetMenuForOverlay(menuName) {
    const menuElement = getMenuElement(menuName);
    if (!menuElement) return;
    switch (menuName) {
        case 'menuAlarm': resetAlarmMenu(menuElement); break;
        case 'menuTimer': resetTimerMenu(menuElement); break;
        case 'menuWorldClock': resetWorldClockMenu(menuElement); break;
    }
}

const loadCountriesAndTimezones = () => new Promise((resolve, reject) => {
    if (window.ct) return resolve(window.ct);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/manuelmhtr/countries-and-timezones@latest/dist/index.min.js';
    script.onload = () => window.ct ? resolve(window.ct) : reject(new Error('Library loaded but ct object not found'));
    script.onerror = () => reject(new Error('Failed to load script'));
    document.head.appendChild(script);
});

const updateDisplay = (selector, text, parent = document) => {
    const element = parent.querySelector(selector);
    if (element) element.textContent = text;
};

// Función toggleDropdown eliminada.
// const toggleDropdown = (action, parentMenu) => { ... };

const resetDropdownDisplay = (menuElement, displaySelector, translateKey, translateCategory) => {
    const display = menuElement.querySelector(displaySelector);
    if (display && typeof getTranslation === 'function') {
        display.textContent = getTranslation(translateKey, translateCategory);
    }
};

const updateAlarmDisplay = (parent) => {
    let finalHourText;
    const hourUnit = getTranslation('h', 'timer');
    const minuteUnit = getTranslation('min', 'timer');
    
    if (use24HourFormat) {
        finalHourText = `${state.alarm.hour} ${hourUnit}`;
    } else {
        const hour = state.alarm.hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        let hour12 = hour % 12;
        hour12 = hour12 ? hour12 : 12;
        finalHourText = `${hour12} ${ampm}`;
    }
    updateDisplay('#hour-display', finalHourText, parent);
    updateDisplay('#minute-display', `${state.alarm.minute} ${minuteUnit}`, parent);
};

const updateTimerDurationDisplay = (timerMenu) => {
    if (!timerMenu) return;
    const hourText = getTranslation('h', 'timer');
    const minuteText = getTranslation('min', 'timer');
    const secondText = getTranslation('s', 'timer');
    updateDisplay('#timer-hour-display', `${state.timer.duration.hours} ${hourText}`, timerMenu);
    updateDisplay('#timer-minute-display', `${state.timer.duration.minutes} ${minuteText}`, timerMenu);
    updateDisplay('#timer-second-display', `${state.timer.duration.seconds} ${secondText}`, timerMenu);
};

const updateTimerTabView = (timerMenu) => {
    if (!timerMenu) return;
    const display = timerMenu.querySelector('#timer-type-display');
    const iconDisplay = timerMenu.querySelector('#timer-type-icon');
    if (display && iconDisplay) {
        const isCountdown = state.timer.currentTab === 'countdown';
        const key = isCountdown ? 'countdown' : 'count_to_date';
        display.textContent = getTranslation(key, 'timer');
        iconDisplay.textContent = isCountdown ? 'timer' : 'event';
    }
    const dropdown = timerMenu.querySelector('.menu-timer-type');
    if (dropdown) {
        dropdown.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.tab === state.timer.currentTab) {
                link.classList.add('active');
            }
        });
    }
    timerMenu.querySelectorAll('.menu-content-wrapper[data-tab-content]').forEach(c => {
        c.classList.remove('active');
        c.classList.add('disabled');
    });
    const activeContent = timerMenu.querySelector(`.menu-content-wrapper[data-tab-content="${state.timer.currentTab}"]`);
    if (activeContent) {
        activeContent.classList.remove('disabled');
        activeContent.classList.add('active');
    }
};

const renderCalendar = (timerMenu) => {
    if (!timerMenu) return;
    const monthYearDisplay = timerMenu.querySelector('#calendar-month-year');
    const daysContainer = timerMenu.querySelector('.calendar-days');
    if (!monthYearDisplay || !daysContainer) return;
    const date = state.timer.countTo.date;
    monthYearDisplay.textContent = date.toLocaleDateString(navigator.language, { month: 'long', year: 'numeric' });
    daysContainer.innerHTML = '';
    const firstDayIndex = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const lastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstDayIndex; i++) daysContainer.innerHTML += `<div class="day other-month"></div>`;
    for (let i = 1; i <= lastDate; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'day'; dayEl.textContent = i; dayEl.dataset.day = i;
        const today = new Date();
        if (i === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) dayEl.classList.add('today');
        if (state.timer.countTo.selectedDate && i === new Date(state.timer.countTo.selectedDate).getDate() && date.getMonth() === new Date(state.timer.countTo.selectedDate).getMonth()) dayEl.classList.add('selected');
        daysContainer.appendChild(dayEl);
    }
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 265;
    const prevButton = timerMenu.querySelector('[data-action="prev-month"]');
    const nextButton = timerMenu.querySelector('[data-action="next-month"]');
    if (prevButton) {
        prevButton.disabled = (date.getFullYear() < minYear || (date.getFullYear() === minYear && date.getMonth() === 0));
        prevButton.classList.toggle('disabled-interactive', prevButton.disabled);
    }
    if (nextButton) {
        nextButton.disabled = false;
        nextButton.classList.remove('disabled-interactive');
    }
};

const selectCalendarDate = (day, timerMenu) => {
    state.timer.countTo.selectedDate = new Date(state.timer.countTo.date.getFullYear(), state.timer.countTo.date.getMonth(), day).toISOString();
    const selectedDate = new Date(state.timer.countTo.selectedDate);
    updateDisplay('#selected-date-display', getFormattedDate(selectedDate), timerMenu);
    timerMenu.querySelector('.calendar-container')?.classList.add('disabled');
    renderCalendar(timerMenu);
};

const populateHourSelectionMenu = (timerMenu) => {
    if (!timerMenu) return;
    const hourMenu = timerMenu.querySelector('.menu-timer-hour-selection .menu-list');
    if (!hourMenu || hourMenu.children.length > 0) return;
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        const link = document.createElement('div');
        link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimerHour'); link.setAttribute('data-hour', i);
        link.innerHTML = `<div class="menu-link-text"><span>${hour}:00</span></div>`;
        hourMenu.appendChild(link);
    }
};

const populateMinuteSelectionMenu = (hour, timerMenu) => {
    if (!timerMenu) return;
    const minuteMenu = timerMenu.querySelector('.menu-timer-minute-selection .menu-list');
    if (!minuteMenu) return;
    minuteMenu.innerHTML = '';
    for (let j = 0; j < 60; j += 5) {
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(j).padStart(2, '0');
        const link = document.createElement('div');
        link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimerMinute'); link.setAttribute('data-hour', hour); link.setAttribute('data-minute', j);
        link.innerHTML = `<div class="menu-link-text"><span>${hourStr}:${minuteStr}</span></div>`;
        minuteMenu.appendChild(link);
    }
};

async function populateCountryDropdown(parentMenu) {
    const countryList = parentMenu.querySelector('.country-list-container');
    if (!countryList) return;
    const loadingText = (typeof getTranslation === 'function') ? getTranslation('loading_countries', 'world_clock') : 'Loading countries...';
    countryList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${loadingText}</span></div>`;
    try {
        const ct = await loadCountriesAndTimezones();
        const countries = Object.values(ct.getAllCountries()).sort((a, b) => a.name.localeCompare(b.name));
        countryList.innerHTML = '';
        countries.forEach(country => {
            const link = document.createElement('div');
            link.className = 'menu-link'; link.setAttribute('data-action', 'selectCountry'); link.setAttribute('data-country-code', country.id);
            link.innerHTML = `<div class="menu-link-icon"><span class="material-symbols-rounded">public</span></div><div class="menu-link-text"><span>${country.name}</span></div>`;
            countryList.appendChild(link);
        });
    } catch (error) {
        const errorText = (typeof getTranslation === 'function') ? getTranslation('error_loading_countries', 'world_clock') : '❌ Error loading countries.';
        countryList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${errorText}</span></div>`;
    }
}

async function populateTimezoneDropdown(parentMenu, countryCode) {
    const timezoneList = parentMenu.querySelector('.timezone-list-container');
    if (!timezoneList) return;
    timezoneList.innerHTML = '';
    try {
        const ct = await loadCountriesAndTimezones();
        const timezones = ct.getTimezonesForCountry(countryCode);
        if (timezones && timezones.length > 0) {
            timezones.forEach(tz => {
                const cityName = tz.name.split('/').pop().replace(/_/g, ' ');
                const displayName = `(UTC ${tz.utcOffsetStr}) ${cityName}`;
                const link = document.createElement('div');
                link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimezone'); link.setAttribute('data-timezone', tz.name);
                link.innerHTML = `<div class="menu-link-icon"><span class="material-symbols-rounded">schedule</span></div><div class="menu-link-text"><span>${displayName}</span></div>`;
                timezoneList.appendChild(link);
            });
        } else {
            const noTimezonesText = (typeof getTranslation === 'function') ? getTranslation('no_timezones_found', 'world_clock') : '⚠️ No timezones found.';
            timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${noTimezonesText}</span></div>`;
        }
    } catch (error) {
        const errorText = (typeof getTranslation === 'function') ? getTranslation('error_loading_timezones', 'world_clock') : '❌ Error loading timezones.';
        timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${errorText}</span></div>`;
    }
}

function populateSoundsMenu(context) {
    const soundsMenu = document.querySelector('.menu-sounds');
    if (!soundsMenu) return;
    const listContainer = soundsMenu.querySelector('.sound-list-container');
    let activeSoundId = '';
    if (context === 'alarm') activeSoundId = state.alarm.sound;
    else if (context === 'countdown') activeSoundId = state.timer.sound;
    else if (context === 'count_to_date') activeSoundId = state.timer.countTo.sound;
    
    generateSoundList(listContainer, 'selectSound', activeSoundId);
}

function setupGlobalEventListeners() {
    if (areGlobalListenersInitialized) return;

    // Listener para cerrar dropdowns (se mantiene por si hay otros)
    document.addEventListener('click', (event) => {
        const isClickInsideDropdown = event.target.closest('.dropdown-menu-container');
        const isClickOnToggle = event.target.closest('[data-action]')?.dataset.action?.includes('Dropdown');
        const isCalendarNavigation = event.target.closest('.calendar-nav, .calendar-header, .calendar-weekdays, .day.other-month');
        if (!isClickInsideDropdown && !isClickOnToggle && !isCalendarNavigation) {
            document.querySelectorAll('.dropdown-menu-container').forEach(d => d.classList.add('disabled'));
        }
    });

    // Listener para los nuevos inputs de búsqueda
    document.body.addEventListener('input', (event) => {
        const target = event.target;
        if (target.matches('#country-search-input-new, #timezone-search-input, #sound-search-input')) {
            const searchTerm = target.value.toLowerCase();
            const listContainer = target.closest('.menu-section').querySelector('.menu-list, .sound-list-container');
            if (!listContainer) return;
            const items = listContainer.querySelectorAll('.menu-link');
            let matchesFound = 0;
            items.forEach(item => {
                const itemName = item.querySelector('.menu-link-text span')?.textContent.toLowerCase();
                if (itemName) {
                    const match = itemName.includes(searchTerm);
                    item.style.display = match ? 'flex' : 'none';
                    if (match) matchesFound++;
                }
            });

            // Opcional: Manejar encabezados de sección en la lista de sonidos
            if (target.matches('#sound-search-input')) {
                const headers = listContainer.querySelectorAll('.menu-content-header-sm');
                headers.forEach(header => {
                    let hasVisibleItems = false;
                    let nextElement = header.nextElementSibling;
                    while (nextElement && nextElement.classList.contains('menu-link')) {
                        if (nextElement.style.display !== 'none') {
                            hasVisibleItems = true;
                            break;
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                    header.style.display = hasVisibleItems ? 'flex' : 'none';
                });
            }

            // Manejo de mensaje "sin resultados"
            let noResultsMsg = listContainer.querySelector('.no-results-message');
            if (matchesFound === 0 && searchTerm) {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-results-message menu-link-text';
                    listContainer.appendChild(noResultsMsg);
                }
                const noResultsText = (typeof getTranslation === 'function') ? getTranslation('no_results', 'search') : 'No results found for';
                noResultsMsg.textContent = `${noResultsText} "${target.value}"`;
                noResultsMsg.style.display = 'block';
            } else if (noResultsMsg) {
                noResultsMsg.style.display = 'none';
            }
        }
    });

    document.body.addEventListener('click', (event) => {
        const parentMenu = event.target.closest('.menu-alarm, .menu-timer, .menu-worldClock, .menu-sounds, .menu-country, .menu-timezone');
        if (!parentMenu || autoIncrementState.isActive) return;
        handleMenuClick(event, parentMenu);
    });

    const incrementDecrementActions = {
        'increaseHour': (p) => { state.alarm.hour = (state.alarm.hour + 1) % 24; updateAlarmDisplay(p); },
        'decreaseHour': (p) => { state.alarm.hour = (state.alarm.hour - 1 + 24) % 24; updateAlarmDisplay(p); },
        'increaseMinute': (p) => { state.alarm.minute = (state.alarm.minute + 1) % 60; updateAlarmDisplay(p); },
        'decreaseMinute': (p) => { state.alarm.minute = (state.alarm.minute - 1 + 60) % 60; updateAlarmDisplay(p); },
        'increaseTimerHour': (p) => { state.timer.duration.hours = (state.timer.duration.hours + 1) % 100; updateTimerDurationDisplay(p); },
        'decreaseTimerHour': (p) => { state.timer.duration.hours = (state.timer.duration.hours - 1 + 100) % 100; updateTimerDurationDisplay(p); },
        'increaseTimerMinute': (p) => { state.timer.duration.minutes = (state.timer.duration.minutes + 1) % 60; updateTimerDurationDisplay(p); },
        'decreaseTimerMinute': (p) => { state.timer.duration.minutes = (state.timer.duration.minutes - 1 + 60) % 60; updateTimerDurationDisplay(p); },
        'increaseTimerSecond': (p) => { state.timer.duration.seconds = (state.timer.duration.seconds + 1) % 60; updateTimerDurationDisplay(p); },
        'decreaseTimerSecond': (p) => { state.timer.duration.seconds = (state.timer.duration.seconds - 1 + 60) % 60; updateTimerDurationDisplay(p); },
    };

    Object.keys(incrementDecrementActions).forEach(action => {
        document.querySelectorAll(`[data-action="${action}"]`).forEach(button => {
            const parentMenu = button.closest('.menu-alarm, .menu-timer');
            if (!parentMenu) return;
            const actionFn = () => incrementDecrementActions[action](parentMenu);
            button.addEventListener('mousedown', () => startAutoIncrement(actionFn));
            button.addEventListener('touchstart', (e) => { e.preventDefault(); startAutoIncrement(actionFn); });
        });
    });

    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(eventType => {
        document.addEventListener(eventType, stopAutoIncrement);
    });
    
    document.querySelectorAll('.enter-text-tool input, .custom-select-content').forEach(el => {
        const parentWrapper = el.closest('.enter-text-tool, .custom-select-content');
        if (!parentWrapper) return;

        el.addEventListener('input', () => parentWrapper.classList.remove('input-error'));
        el.addEventListener('click', () => parentWrapper.classList.remove('input-error'));
    });

    areGlobalListenersInitialized = true;
}

async function handleMenuClick(event, parentMenu) {
    const target = event.target;

    const tabTarget = target.closest('.menu-timer-type .menu-link[data-tab]');
    if (tabTarget) {
        event.stopPropagation();
        state.timer.currentTab = tabTarget.dataset.tab;
        updateTimerTabView(parentMenu);
        const dropdown = tabTarget.closest('.dropdown-menu-container');
        if (dropdown) dropdown.classList.add('disabled');
        return;
    }

    const dayTarget = target.closest('.calendar-days .day:not(.other-month)');
    if (dayTarget && dayTarget.dataset.day) {
        event.stopPropagation();
        selectCalendarDate(parseInt(dayTarget.dataset.day, 10), parentMenu);
        return;
    }

    const actionTarget = target.closest('[data-action]');
    if (!actionTarget) return;

    const action = actionTarget.dataset.action;

    // Manejo de navegación y selección centralizado
    switch (action) {
        // --- Acciones de Navegación ---
        case 'open-sounds-menu':
            soundSelectionContext = actionTarget.dataset.context;
            navigateToMenu('Sounds');
            populateSoundsMenu(soundSelectionContext);
            break;

        case 'open-country-menu':
            navigateToMenu('Country');
            populateCountryDropdown(document.querySelector('.menu-country'));
            break;

        case 'open-timezone-menu':
            if (actionTarget.classList.contains('disabled-interactive')) return;
            navigateToMenu('Timezone');
            populateTimezoneDropdown(document.querySelector('.menu-timezone'), state.worldClock.countryCode);
            break;
        
        case 'back-to-previous-menu':
            navigateBack();
            break;

        // --- Acciones de Selección ---
        case 'selectSound': {
            event.stopPropagation();
            const soundId = actionTarget.dataset.sound;
            const soundName = getSoundNameById(soundId);
            const parentContext = soundSelectionContext;

            if (parentContext === 'alarm') {
                state.alarm.sound = soundId;
                updateDisplay('#alarm-selected-sound', soundName, getMenuElement('menuAlarm'));
            } else if (parentContext === 'countdown') {
                state.timer.sound = soundId;
                updateDisplay('#countdown-selected-sound', soundName, getMenuElement('menuTimer'));
            } else if (parentContext === 'count_to_date') {
                state.timer.countTo.sound = soundId;
                updateDisplay('#count-to-date-selected-sound', soundName, getMenuElement('menuTimer'));
            }

            navigateBack();
            break;
        }

        case 'selectCountry': {
            event.stopPropagation();
            const countryCode = actionTarget.getAttribute('data-country-code');
            state.worldClock.country = actionTarget.querySelector('.menu-link-text span')?.textContent;
            state.worldClock.countryCode = countryCode;

            const worldClockMenu = getMenuElement('menuWorldClock');
            updateDisplay('#worldclock-selected-country', state.worldClock.country, worldClockMenu);
            
            const timezoneSelector = worldClockMenu.querySelector('[data-action="open-timezone-menu"]');
            timezoneSelector.classList.remove('disabled-interactive');
            resetDropdownDisplay(worldClockMenu, '#worldclock-selected-timezone', 'select_a_timezone', 'world_clock');
            state.worldClock.timezone = '';

            navigateBack();
            break;
        }

        case 'selectTimezone': {
            event.stopPropagation();
            state.worldClock.timezone = actionTarget.getAttribute('data-timezone');
            const tzDisplayName = actionTarget.querySelector('.menu-link-text span')?.textContent;
            updateDisplay('#worldclock-selected-timezone', tzDisplayName, getMenuElement('menuWorldClock'));
            navigateBack();
            break;
        }

        // --- Resto de las acciones ---
        case 'selectTimerEndAction': 
            event.stopPropagation(); 
            updateDisplay('#timer-selected-end-action', actionTarget.querySelector('.menu-link-text span').textContent, parentMenu);
            state.timer.endAction = actionTarget.dataset.endAction; 
            actionTarget.closest('.dropdown-menu-container').classList.add('disabled');
            break;

        case 'prev-month': state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() - 1); renderCalendar(parentMenu); break;
        case 'next-month': state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() + 1); renderCalendar(parentMenu); break;
        case 'selectTimerHour':
            event.stopPropagation();
            const hour = parseInt(actionTarget.dataset.hour, 10);
            state.timer.countTo.selectedHour = hour;
            updateDisplay('#selected-hour-display', String(hour).padStart(2, '0'), parentMenu);
            updateDisplay('#selected-minute-display', '--', parentMenu);
            actionTarget.closest('.dropdown-menu-container')?.classList.add('disabled');
            populateMinuteSelectionMenu(hour, parentMenu);
            const minuteMenu = parentMenu.querySelector('.menu-timer-minute-selection');
            if (minuteMenu) minuteMenu.classList.remove('disabled');
            state.timer.countTo.timeSelectionStep = 'minute';
            break;
        case 'selectTimerMinute':
            event.stopPropagation();
            const minute = parseInt(actionTarget.dataset.minute, 10);
            state.timer.countTo.selectedMinute = minute;
            updateDisplay('#selected-minute-display', String(minute).padStart(2, '0'), parentMenu);
            actionTarget.closest('.dropdown-menu-container')?.classList.add('disabled');
            state.timer.countTo.timeSelectionStep = 'hour';
            break;
            
        case 'previewAlarmSound': stopSound(); playSound(state.alarm.sound); setTimeout(stopSound, 1000); break;
        case 'previewCountdownSound': stopSound(); playSound(state.timer.sound); setTimeout(stopSound, 1000); break;
        case 'previewCountToDateSound': stopSound(); playSound(state.timer.countTo.sound); setTimeout(stopSound, 1000); break;
        
        case 'upload-audio':
            event.stopPropagation();
            handleAudioUpload(() => {
                populateSoundsMenu(soundSelectionContext);
            });
            break;
        case 'delete-user-audio':
            event.stopPropagation();
            const audioIdToDelete = actionTarget.dataset.audioId;
            if (audioIdToDelete) deleteUserAudio(audioIdToDelete, () => populateSoundsMenu(soundSelectionContext));
            break;

        case 'createAlarm': {
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            const isTitleValid = validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim());

            if (!isTitleValid) return;
            
            const alarmLimit = window.alarmManager?.getAlarmLimit() ?? (PREMIUM_FEATURES ? 100 : 5);
            const currentAlarmCount = window.alarmManager?.getAlarmCount() ?? 0;
            if (currentAlarmCount >= alarmLimit) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('alarms', 'tooltips') });
                return;
            }
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                if (window.alarmManager?.createAlarm(alarmTitleInput.value.trim(), state.alarm.hour, state.alarm.minute, state.alarm.sound)) {
                    deactivateModule('overlayContainer', { source: 'create-alarm' });
                } else removeSpinnerFromCreateButton(actionTarget);
                resetAlarmMenu(parentMenu);
            }, 500);
            break;
        }
        case 'createTimer': {
            let isValid = true;
            if (state.timer.currentTab === 'countdown') {
                const timerTitleInput = parentMenu.querySelector('#timer-title');
                const { hours, minutes, seconds } = state.timer.duration;

                isValid = validateField(timerTitleInput.parentElement, timerTitleInput.value.trim());

                if (hours === 0 && minutes === 0 && seconds === 0) {
                    console.error("Timer duration must be greater than zero.");
                    isValid = false;
                }
                
                if (!isValid) return;

                if (getTimersCount() >= getTimerLimit()) {
                    showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('timer', 'tooltips') });
                    return;
                }
                
                addSpinnerToCreateButton(actionTarget);
                setTimeout(() => {
                    addTimerAndRender({ type: 'countdown', title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, endAction: state.timer.endAction, sound: state.timer.sound });
                    deactivateModule('overlayContainer', { source: 'create-timer' });
                    resetTimerMenu(parentMenu);
                }, 500);

            } else {
                const eventTitleInput = parentMenu.querySelector('#countto-title');
                const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;
                
                isValid = validateField(eventTitleInput.parentElement, eventTitleInput.value.trim());
                isValid = validateField(parentMenu.querySelector('[data-action="toggleCalendarDropdown"]'), selectedDate) && isValid;
                isValid = validateField(parentMenu.querySelector('[data-action="toggleTimerHourDropdown"]'), typeof selectedHour === 'number') && isValid;

                if (!isValid) return;
                
                if (getTimersCount() >= getTimerLimit()) {
                    showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('timer', 'tooltips') });
                    return;
                }
                addSpinnerToCreateButton(actionTarget);
                setTimeout(() => {
                    const targetDate = new Date(selectedDate);
                    targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                    addTimerAndRender({ type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                    deactivateModule('overlayContainer', { source: 'create-timer' });
                    resetTimerMenu(parentMenu);
                }, 500);
            }
            break;
        }
        case 'addWorldClock': {
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            const countrySelector = parentMenu.querySelector('[data-action="open-country-menu"]');
            const timezoneSelector = parentMenu.querySelector('[data-action="open-timezone-menu"]');

            let isValid = validateField(clockTitleInput.parentElement, clockTitleInput.value.trim());
            isValid = validateField(countrySelector, country) && isValid;
            
            if (!timezoneSelector.classList.contains('disabled-interactive')) {
                isValid = validateField(timezoneSelector, timezone) && isValid;
            }

            if (!isValid) return;

            const clockLimit = window.worldClockManager?.getClockLimit() ?? (PREMIUM_FEATURES ? 100 : 5);
            if ((window.worldClockManager?.getClockCount() ?? 0) >= clockLimit) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('world_clock', 'tooltips') });
                return;
            }
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                if (window.worldClockManager?.createAndStartClockCard(clockTitleInput.value.trim(), country, timezone)) {
                    deactivateModule('overlayContainer', { source: 'add-world-clock' });
                } else removeSpinnerFromCreateButton(actionTarget);
                resetWorldClockMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveAlarmChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            if (!editingId || !validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim())) return;
            
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                window.alarmManager?.updateAlarm(editingId, { title: alarmTitleInput.value.trim(), hour: state.alarm.hour, minute: state.alarm.minute, sound: state.alarm.sound });
                deactivateModule('overlayContainer', { source: 'save-alarm' });
                resetAlarmMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveTimerChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            if (!editingId) return;

            const timerTitleInput = parentMenu.querySelector('#timer-title');
            if (!validateField(timerTitleInput.parentElement, timerTitleInput.value.trim())) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                const { hours, minutes, seconds } = state.timer.duration;
                if (hours > 0 || minutes > 0 || seconds > 0) {
                    updateTimer(editingId, { title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, endAction: state.timer.endAction, sound: state.timer.sound });
                    deactivateModule('overlayContainer', { source: 'save-timer' });
                } else removeSpinnerFromCreateButton(actionTarget);
                resetTimerMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveCountToDateChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            if (!editingId) return;

            const eventTitleInput = parentMenu.querySelector('#countto-title');
            const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;

            let isValid = validateField(eventTitleInput.parentElement, eventTitleInput.value.trim());
            isValid = validateField(parentMenu.querySelector('[data-action="toggleCalendarDropdown"]'), selectedDate) && isValid;
            isValid = validateField(parentMenu.querySelector('[data-action="toggleTimerHourDropdown"]'), typeof selectedHour === 'number') && isValid;
            
            if (!isValid) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                const targetDate = new Date(selectedDate);
                targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                updateTimer(editingId, { type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                deactivateModule('overlayContainer', { source: 'save-timer' });
                resetTimerMenu(parentMenu);
            }, 500);
            break;
        }
        case 'saveWorldClockChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            
            let isValid = validateField(clockTitleInput.parentElement, clockTitleInput.value.trim());
            isValid = validateField(parentMenu.querySelector('[data-action="open-country-menu"]'), country) && isValid;
            isValid = validateField(parentMenu.querySelector('[data-action="open-timezone-menu"]'), timezone) && isValid;

            if (!editingId || !isValid) return;

            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                window.worldClockManager?.updateClockCard(editingId, { title: clockTitleInput.value.trim(), country, timezone });
                deactivateModule('overlayContainer', { source: 'save-world-clock' });
                resetWorldClockMenu(parentMenu);
            }, 500);
            break;
        }
    }
}

export function initMenuInteractions() {
    setupGlobalEventListeners();
}