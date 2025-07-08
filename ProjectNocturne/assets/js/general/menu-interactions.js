"use strict";
import { use24HourFormat, deactivateModule } from './main.js';
import { getTranslation } from './translations-controller.js';
import { addTimerAndRender, updateTimer, getTimersCount, getTimerLimit } from '../tools/timer-controller.js';
import { showDynamicIslandNotification } from './dynamic-island-controller.js';
import { playSound, stopSound, generateSoundList, handleAudioUpload, deleteUserAudio, getSoundNameById } from '../tools/general-tools.js';
import { getCurrentLocation } from './location-manager.js';

let currentlyPlayingSound = null;
let soundTimeout = null;

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

const dropdownMap = {
    'toggleTimerEndActionDropdown': '.menu-timer-end-action',
    'toggleTimerTypeDropdown': '.menu-timer-type'
};

const menuTimeouts = {};
let areGlobalListenersInitialized = false;
let soundSelectionContext = null;
const menuStack = [];

/**
 * Resets the entire overlay navigation state.
 * Hides all sub-menus (like Sounds, Country, Timezone, Calendar, TimePicker) and clears the navigation history stack.
 * This is intended to be called when the main overlay module is closed to prevent stale menu views.
 */
export function resetOverlayNavigation() {
    const overlay = document.querySelector('.module-overlay');
    if (!overlay) return;

    // Find and hide any active sub-menus.
    const subMenus = overlay.querySelectorAll('.menu-sounds, .menu-country, .menu-timeZone, .menu-calendar, .menu-timePicker');
    subMenus.forEach(subMenu => {
        subMenu.classList.remove('active');
        subMenu.classList.add('disabled');

        // Reset search input if it exists
        const searchInput = subMenu.querySelector('input[type="text"]');
        if (searchInput) {
            searchInput.value = '';
            // Manually trigger an input event to clear search results
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // Clear the navigation history stack.
    menuStack.length = 0;
}

function navigateToMenu(menuName) {
    const overlay = document.querySelector('.module-overlay');
    if (!overlay) return;

    const currentMenu = overlay.querySelector('[data-menu].active:not(.disabled)');
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

    const currentMenu = overlay.querySelector('[data-menu].active:not(.disabled)');
    if (currentMenu) {
        currentMenu.classList.remove('active');
        currentMenu.classList.add('disabled');

        // Reset search input when navigating away from a menu with a search bar
        const searchInput = currentMenu.querySelector('input[type="text"]');
        if (searchInput && ['sounds', 'country', 'timeZone'].includes(currentMenu.dataset.menu)) {
            searchInput.value = '';
            // Dispara un evento 'input' para que la lógica de búsqueda se reinicie
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // If we are leaving the time picker, reset its internal state to show the hour list again.
        if (currentMenu.dataset.menu === 'timePicker') {
            const hourList = currentMenu.querySelector('[data-list-type="hours"]');
            const minuteList = currentMenu.querySelector('[data-list-type="minutes"]');
            if (hourList && minuteList) {
                hourList.classList.remove('disabled');
                hourList.classList.add('active');
                minuteList.classList.remove('active');
                minuteList.classList.add('disabled');
            }
        }
    }

    const previousMenuName = menuStack.pop();
    if (previousMenuName) {
        const previousMenu = overlay.querySelector(`[data-menu="${previousMenuName}"]`);
        if (previousMenu) {
            previousMenu.classList.remove('disabled');
            previousMenu.classList.add('active');
        }
    } else {
        deactivateModule('overlayContainer');
    }
}

const toggleDropdown = (action, parentMenu) => {
    const targetSelector = dropdownMap[action];
    if (!targetSelector || !parentMenu) return;
    const targetDropdown = parentMenu.querySelector(targetSelector);
    if (!targetDropdown) return;
    const isCurrentlyOpen = !targetDropdown.classList.contains('disabled');

    document.querySelectorAll('.dropdown-menu-container').forEach(d => {
        if (d !== targetDropdown) {
            d.classList.add('disabled');
        }
    });

    if (!isCurrentlyOpen) {
        targetDropdown.classList.remove('disabled');
    } else {
        targetDropdown.classList.add('disabled');
    }
};

function getMenuElement(menuName) {
    const menuSelectorMap = {
        'menuAlarm': '.menu-alarm[data-menu="alarm"]',
        'menuTimer': '.menu-timer[data-menu="timer"]',
        'menuWorldClock': '.menu-worldClock[data-menu="worldClock"]',
        'menuCalendar': '.menu-calendar[data-menu="calendar"]',
        'timePicker': '.menu-timePicker[data-menu="timePicker"]',
        'timeZone': '.menu-timeZone[data-menu="timeZone"]'
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
    updateAlarmDisplay(menuElement);
    updateDisplay('#alarm-selected-sound', getSoundNameById(state.alarm.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createAlarm';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_alarm');
            buttonText.textContent = getTranslation('create_alarm', 'alarms');
        }
    }
    menuElement.removeAttribute('data-editing-id');
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

    const timerTypeDropdown = menuElement.querySelector('[data-action="toggleTimerTypeDropdown"]');
    if (timerTypeDropdown) {
        timerTypeDropdown.classList.remove('disabled-interactive');
    }
    updateTimerTabView(menuElement);
    updateTimerDurationDisplay(menuElement);
    renderCalendar();
    updateDisplay('#selected-date-display', '-- / -- / ----', menuElement);
    updateDisplay('#selected-hour-display', '--', menuElement);
    updateDisplay('#selected-minute-display', '--', menuElement);
    updateDisplay('#countdown-selected-sound', getSoundNameById(state.timer.sound), menuElement);
    updateDisplay('#count-to-date-selected-sound', getSoundNameById(state.timer.countTo.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        if (createButton.classList.contains('disabled-interactive')) removeSpinnerFromCreateButton(createButton);
        createButton.dataset.action = 'createTimer';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'create_timer');
            buttonText.textContent = getTranslation('create_timer', 'timer');
        }
    }
    menuElement.removeAttribute('data-editing-id');
};

const resetWorldClockMenu = (menuElement) => {
    state.worldClock = JSON.parse(JSON.stringify(initialState.worldClock));
    const titleInput = menuElement.querySelector('#worldclock-title');
    if (titleInput) {
        titleInput.value = '';
        titleInput.parentElement.classList.remove('input-error');
    }
    updateDisplay('#worldclock-selected-country', getTranslation('select_a_country', 'world_clock'), menuElement);
    updateDisplay('#worldclock-selected-timezone', getTranslation('select_a_timezone', 'world_clock'), menuElement);

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
    menuElement.querySelector('[data-action="toggleTimerTypeDropdown"]').classList.add('disabled-interactive');
    updateTimerDurationDisplay(menuElement);
    updateDisplay('#countdown-selected-sound', getSoundNameById(timerData.sound), menuElement);
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveTimerChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
            buttonText.textContent = getTranslation('save_changes', 'timer');
        }
    }
    menuElement.setAttribute('data-editing-id', timerData.id);
}

function getFormattedDate(date) {
    const location = getCurrentLocation();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    let locale = 'default';
    if (location && location.code.toLowerCase() === 'us') locale = 'en-US';
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
    menuElement.querySelector('[data-action="toggleTimerTypeDropdown"]').classList.add('disabled-interactive');
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
    renderCalendar();
    const createButton = menuElement.querySelector('.create-tool');
    if (createButton) {
        createButton.dataset.action = 'saveCountToDateChanges';
        const buttonText = createButton.querySelector('span');
        if (buttonText) {
            buttonText.setAttribute('data-translate', 'save_changes');
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
            buttonText.textContent = getTranslation('save_changes', 'world_clock_options');
        }
    }
    menuElement.setAttribute('data-editing-id', clockData.id);
}

const initializeAlarmMenu = (menuElement) => {
    if (!menuElement.hasAttribute('data-editing-id')) setAlarmDefaults();
    updateAlarmDisplay(menuElement);
};

const initializeTimerMenu = (menuElement) => {
    updateTimerDurationDisplay(menuElement);
    renderCalendar();
    populateHourSelectionMenu();
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

const updateAlarmDisplay = (parent) => {
    const hour = state.alarm.hour;
    const minute = state.alarm.minute;
    let finalHourText;
    let finalAmPm = '';

    if (use24HourFormat) {
        finalHourText = String(hour).padStart(2, '0');
    } else {
        finalAmPm = hour >= 12 ? 'PM' : 'AM';
        let hour12 = hour % 12;
        hour12 = hour12 ? hour12 : 12;
        finalHourText = String(hour12).padStart(2, '0');
    }

    updateDisplay('#hour-display', finalHourText, parent);
    updateDisplay('#minute-display', `${String(minute).padStart(2, '0')}${finalAmPm ? ' ' + finalAmPm : ''}`, parent);
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

const renderCalendar = () => {
    const calendarMenu = getMenuElement('menuCalendar');
    if (!calendarMenu) return;

    const monthYearDisplay = calendarMenu.querySelector('#calendar-month-year');
    const daysContainer = calendarMenu.querySelector('.calendar-days');
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
        if (state.timer.countTo.selectedDate && i === new Date(state.timer.countTo.selectedDate).getDate() && date.getMonth() === new Date(state.timer.countTo.selectedDate).getMonth() && date.getFullYear() === new Date(state.timer.countTo.selectedDate).getFullYear()) {
            dayEl.classList.add('selected');
        }
        daysContainer.appendChild(dayEl);
    }
};

const selectCalendarDate = (day) => {
    state.timer.countTo.selectedDate = new Date(state.timer.countTo.date.getFullYear(), state.timer.countTo.date.getMonth(), day).toISOString();
    const selectedDate = new Date(state.timer.countTo.selectedDate);
    updateDisplay('#selected-date-display', getFormattedDate(selectedDate), getMenuElement('menuTimer'));
    renderCalendar();
    navigateBack();
};

const populateHourSelectionMenu = () => {
    const timePickerMenu = getMenuElement('timePicker');
    if (!timePickerMenu) return;
    const hourMenu = timePickerMenu.querySelector('.menu-list[data-list-type="hours"]');
    if (!hourMenu || hourMenu.children.length > 0) return;
    hourMenu.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        const link = document.createElement('div');
        link.className = 'menu-link'; link.setAttribute('data-action', 'selectTimerHour'); link.setAttribute('data-hour', i);
        link.innerHTML = `<div class="menu-link-text"><span>${hour}:00</span></div>`;
        hourMenu.appendChild(link);
    }
};

const populateMinuteSelectionMenu = (hour) => {
    const timePickerMenu = getMenuElement('timePicker');
    if (!timePickerMenu) return;
    const minuteMenu = timePickerMenu.querySelector('.menu-list[data-list-type="minutes"]');
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
    const loadingText = getTranslation('loading_countries', 'world_clock');
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
        countryList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${getTranslation('error_loading_countries', 'world_clock')}</span></div>`;
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
            timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${getTranslation('no_timezones_found', 'world_clock')}</span></div>`;
        }
    } catch (error) {
        timezoneList.innerHTML = `<div class="menu-link-text" style="padding: 0 12px;"><span>${getTranslation('error_loading_timezones', 'world_clock')}</span></div>`;
    }
}

async function populateSoundsMenu(context) {
    const soundsMenu = document.querySelector('.menu-sounds');
    if (!soundsMenu) return;
    const uploadContainer = soundsMenu.querySelector('#upload-audio-wrapper');
    const listContainer = soundsMenu.querySelector('#sound-list-wrapper');
    let activeSoundId = '';
    if (context === 'alarm') {
        activeSoundId = state.alarm.sound;
    } else if (context === 'countdown') {
        activeSoundId = state.timer.sound;
    } else if (context === 'count_to_date') {
        activeSoundId = state.timer.countTo.sound;
    }

    // `generateSoundList` ahora es asíncrono y espera la caché,
    // por lo que esperamos a que termine antes de continuar.
    await generateSoundList(uploadContainer, listContainer, 'selectSound', activeSoundId);
}

function setupGlobalEventListeners() {
    if (areGlobalListenersInitialized) return;

    document.addEventListener('click', (event) => {
        const soundMenuToggle = event.target.closest('[data-module="toggleSoundsMenu"]');
        if (soundMenuToggle) {
            const context = soundMenuToggle.dataset.context;
            soundSelectionContext = context;
            populateSoundsMenu(context);
        }
    }, true);

    document.addEventListener('click', (event) => {
        const isClickInsideDropdown = event.target.closest('.dropdown-menu-container');
        const isClickOnToggle = event.target.closest('[data-action]')?.dataset.action in dropdownMap;
        if (!isClickInsideDropdown && !isClickOnToggle) {
            document.querySelectorAll('.dropdown-menu-container').forEach(d => d.classList.add('disabled'));
        }
    });

// CORRECCIÓN PARA EL SISTEMA DE BÚSQUEDA DE SONIDOS

// En menu-interactions.js, reemplazar la sección del event listener 'input' por esto:

document.body.addEventListener('input', (event) => {
    const target = event.target;
    if (!['sound-search-input', 'country-search-input', 'timezone-search-input'].includes(target.id)) return;

    const menu = target.closest('.menu-sounds, .menu-country, .menu-timeZone');
    if (!menu) return;

    const searchTerm = target.value.toLowerCase();
    const creationWrapper = menu.querySelector('.creation-wrapper');
    const resultsWrapper = menu.querySelector('.search-results-wrapper');

    if (!creationWrapper || !resultsWrapper) return;

    if (!searchTerm) {
        resultsWrapper.innerHTML = '';
        resultsWrapper.classList.add('disabled');
        creationWrapper.classList.remove('disabled');
        return;
    }

    creationWrapper.classList.add('disabled');
    resultsWrapper.classList.remove('disabled');
    resultsWrapper.innerHTML = '';

    if (target.id === 'sound-search-input') {
        // LÓGICA ESPECÍFICA PARA BÚSQUEDA DE SONIDOS
        const originalListContainer = creationWrapper.querySelector('#sound-list-wrapper');
        if (!originalListContainer) return;

        const allSoundItems = originalListContainer.querySelectorAll('.menu-link');
        console.log(`🔍 Búsqueda de sonidos: "${searchTerm}", elementos encontrados: ${allSoundItems.length}`);

        const filteredItems = Array.from(allSoundItems).filter(item => {
            // Buscar tanto en elementos con data-translate como en texto directo
            const textSpan = item.querySelector('.menu-link-text span');
            if (!textSpan) return false;

            let itemName = '';
            
            // Si tiene atributo data-translate, usar la traducción
            const translateKey = textSpan.getAttribute('data-translate');
            if (translateKey && typeof window.getTranslation === 'function') {
                itemName = window.getTranslation(translateKey, 'sounds');
            }
            
            // Si no se pudo obtener traducción o no tiene data-translate, usar texto directo
            if (!itemName || itemName === translateKey) {
                itemName = textSpan.textContent;
            }

            const matches = itemName.toLowerCase().includes(searchTerm);
            console.log(`   - "${itemName}" ${matches ? '✅' : '❌'}`);
            return matches;
        });

        console.log(`🎵 Sonidos filtrados: ${filteredItems.length}`);

        if (filteredItems.length > 0) {
            const newList = document.createElement('div');
            newList.className = 'menu-list';

            // Buscar encabezados de sección y agrupar resultados
            const headers = originalListContainer.querySelectorAll('.menu-content-header-sm');
            
            if (headers.length > 0) {
                // Si hay encabezados, agrupar por sección
                headers.forEach(header => {
                    const sectionItems = [];
                    let nextElement = header.nextElementSibling;
                    
                    // Recolectar elementos de esta sección que coinciden con la búsqueda
                    while (nextElement && !nextElement.classList.contains('menu-content-header-sm')) {
                        if (filteredItems.includes(nextElement)) {
                            sectionItems.push(nextElement);
                        }
                        nextElement = nextElement.nextElementSibling;
                    }
                    
                    // Solo mostrar la sección si tiene elementos que coinciden
                    if (sectionItems.length > 0) {
                        const headerClone = header.cloneNode(true);
                        newList.appendChild(headerClone);
                        sectionItems.forEach(item => {
                            const itemClone = item.cloneNode(true);
                            newList.appendChild(itemClone);
                        });
                    }
                });
            } else {
                // Si no hay encabezados, mostrar todos los elementos filtrados
                filteredItems.forEach(item => {
                    const itemClone = item.cloneNode(true);
                    newList.appendChild(itemClone);
                });
            }

            if (newList.hasChildNodes()) {
                resultsWrapper.appendChild(newList);
            } else {
                resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
            }
        } else {
            resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
        }

    } else {
        // LÓGICA PARA OTROS TIPOS DE BÚSQUEDA (países, zonas horarias)
        const originalListContainer = creationWrapper.querySelector('.menu-list, .country-list-container, .timezone-list-container');
        if (!originalListContainer) return;

        const allItems = originalListContainer.querySelectorAll('.menu-link');
        const filteredItems = Array.from(allItems).filter(item => {
            const itemName = item.querySelector('.menu-link-text span')?.textContent.toLowerCase();
            return itemName && itemName.includes(searchTerm);
        });

        if (filteredItems.length > 0) {
            const newList = document.createElement('div');
            newList.className = 'menu-list';
            filteredItems.forEach(item => newList.appendChild(item.cloneNode(true)));
            resultsWrapper.appendChild(newList);
        } else {
            resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
        }
    }
});

// FUNCIÓN AUXILIAR PARA DEBUG (opcional)
function debugSoundSearch() {
    const soundsMenu = document.querySelector('.menu-sounds');
    if (!soundsMenu) {
        console.log('❌ Menu de sonidos no encontrado');
        return;
    }

    const listContainer = soundsMenu.querySelector('#sound-list-wrapper');
    if (!listContainer) {
        console.log('❌ Contenedor de lista de sonidos no encontrado');
        return;
    }

    const allItems = listContainer.querySelectorAll('.menu-link');
    console.log(`🎵 Total de elementos de sonido: ${allItems.length}`);

    allItems.forEach((item, index) => {
        const textSpan = item.querySelector('.menu-link-text span');
        const soundId = item.getAttribute('data-sound-id');
        const translateKey = textSpan?.getAttribute('data-translate');
        const directText = textSpan?.textContent;
        
        console.log(`   ${index + 1}. ID: ${soundId}, Translate: ${translateKey}, Text: "${directText}"`);
    });

    const headers = listContainer.querySelectorAll('.menu-content-header-sm');
    console.log(`📑 Encabezados de sección: ${headers.length}`);
    headers.forEach((header, index) => {
        console.log(`   Sección ${index + 1}: "${header.textContent}"`);
    });
}

// Para usar el debug en la consola del navegador:
// debugSoundSearch();
    document.body.addEventListener('click', (event) => {
        const parentMenu = event.target.closest('.menu-alarm, .menu-timer, .menu-worldClock, .menu-sounds, .menu-country, .menu-timeZone, .menu-calendar, .menu-timePicker');
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

    areGlobalListenersInitialized = true;
}
async function handleMenuClick(event, parentMenu) {
    // --- INICIO DE LA CORRECCIÓN ---
    // Primero, verificamos si se hizo clic en un día del calendario.
    const dayTarget = event.target.closest('.calendar-days .day:not(.other-month)');
    if (dayTarget && dayTarget.dataset.day) {
        event.stopPropagation();
        selectCalendarDate(parseInt(dayTarget.dataset.day, 10));
        return; // Terminamos la ejecución aquí si fue un clic en un día.
    }

    // Si no fue un día, ahora buscamos un elemento con data-action.
    const target = event.target.closest('[data-action]');
    if (!target) return; // Si no hay acción, ahora sí salimos.
    // --- FIN DE LA CORRECCIÓN ---

    const action = target.dataset.action;
    const testSoundActions = ['test-sound', 'previewAlarmSound', 'previewCountdownSound', 'previewCountToDateSound'];

    if (testSoundActions.includes(action)) {
        event.stopPropagation();

        let soundId;
        const soundTestButton = target.closest('.sound-test-btn') || target;
        const menuLink = soundTestButton.closest('.menu-link');

        if (action === 'test-sound') {
            soundId = menuLink.dataset.soundId;
        } else {
            if (action === 'previewAlarmSound') soundId = state.alarm.sound;
            if (action === 'previewCountdownSound') soundId = state.timer.sound;
            if (action === 'previewCountToDateSound') soundId = state.timer.countTo.sound;
        }

        const icon = soundTestButton.querySelector('.material-symbols-rounded');

        if (currentlyPlayingSound && currentlyPlayingSound.id === soundId) {
            stopSound();
            clearTimeout(soundTimeout);
            if (icon) icon.textContent = 'play_arrow';
            if (menuLink) menuLink.classList.remove('sound-playing');
            currentlyPlayingSound = null;
        } else {
            if (currentlyPlayingSound) {
                stopSound();
                clearTimeout(soundTimeout);

                const prevButton = currentlyPlayingSound.button;
                if (prevButton) {
                    const prevIcon = prevButton.querySelector('.material-symbols-rounded');
                    if (prevIcon) prevIcon.textContent = 'play_arrow';

                    const prevLink = prevButton.closest('.menu-link');
                    if (prevLink) {
                        prevLink.classList.remove('sound-playing');
                        const prevActions = prevLink.querySelector('.menu-link-actions-container');
                        if (prevActions) {
                            prevActions.classList.add('disabled');
                            prevActions.classList.remove('active');
                        }
                    }
                }
            }

            playSound(soundId);
            if (icon) icon.textContent = 'stop';
            if (menuLink) menuLink.classList.add('sound-playing');
            currentlyPlayingSound = { id: soundId, button: soundTestButton };

            soundTimeout = setTimeout(() => {
                if (currentlyPlayingSound && currentlyPlayingSound.id === soundId) {
                    stopSound();

                    if (icon) icon.textContent = 'play_arrow';
                    if (menuLink) {
                        menuLink.classList.remove('sound-playing');
                        const actionsContainer = menuLink.querySelector('.menu-link-actions-container');
                        if (actionsContainer) {
                            actionsContainer.classList.add('disabled');
                            actionsContainer.classList.remove('active');
                        }
                    }

                    currentlyPlayingSound = null;
                }
            }, 3000);
        }
        return;
    }

    if (dropdownMap[action]) {
        toggleDropdown(action, parentMenu);
        return;
    }

    switch (action) {
        case 'selectTimerTab': {
            event.stopPropagation();
            const tab = target.dataset.tab;
            if (tab) {
                state.timer.currentTab = tab;
                updateTimerTabView(parentMenu);
                target.closest('.dropdown-menu-container')?.classList.add('disabled');
            }
            break;
        }
        case 'open-calendar-menu':
            navigateToMenu('calendar');
            renderCalendar();
            break;
        case 'open-time-picker-menu':
            navigateToMenu('timePicker');
            populateHourSelectionMenu();
            break;
        case 'open-country-menu':
            navigateToMenu('country');
            populateCountryDropdown(document.querySelector('.menu-country'));
            break;
        case 'open-timezone-menu':
            if (target.classList.contains('disabled-interactive')) return;
            navigateToMenu('timeZone');
            populateTimezoneDropdown(document.querySelector('.menu-timeZone'), state.worldClock.countryCode);
            break;
        case 'open-sounds-menu':
            const context = target.dataset.context;
            soundSelectionContext = context;
            navigateToMenu('sounds');
            populateSoundsMenu(context);
            break;
        case 'back-to-previous-menu':
            navigateBack();
            break;
        case 'selectSound':
            event.stopPropagation();
            const soundId = target.closest('.menu-link').dataset.soundId;
            const soundName = getSoundNameById(soundId);
            if (soundSelectionContext === 'alarm') {
                state.alarm.sound = soundId;
                updateDisplay('#alarm-selected-sound', soundName, getMenuElement('menuAlarm'));
            } else if (soundSelectionContext === 'countdown') {
                state.timer.sound = soundId;
                updateDisplay('#countdown-selected-sound', soundName, getMenuElement('menuTimer'));
            } else if (soundSelectionContext === 'count_to_date') {
                state.timer.countTo.sound = soundId;
                updateDisplay('#count-to-date-selected-sound', soundName, getMenuElement('menuTimer'));
            }
            navigateBack();
            break;
        case 'selectCountry':
            event.stopPropagation();
            const countryCode = target.getAttribute('data-country-code');
            state.worldClock.country = target.querySelector('.menu-link-text span')?.textContent;
            state.worldClock.countryCode = countryCode;
            const worldClockMenu = getMenuElement('menuWorldClock');
            updateDisplay('#worldclock-selected-country', state.worldClock.country, worldClockMenu);
            const timezoneSelector = worldClockMenu.querySelector('[data-action="open-timezone-menu"]');
            timezoneSelector.classList.remove('disabled-interactive');
            updateDisplay('#worldclock-selected-timezone', getTranslation('select_a_timezone', 'world_clock'), worldClockMenu);
            state.worldClock.timezone = '';
            navigateBack();
            break;
        case 'selectTimezone':
            event.stopPropagation();
            state.worldClock.timezone = target.getAttribute('data-timezone');
            const tzDisplayName = target.querySelector('.menu-link-text span')?.textContent;
            updateDisplay('#worldclock-selected-timezone', tzDisplayName, getMenuElement('menuWorldClock'));
            navigateBack();
            break;
        case 'selectTimerHour':
            event.stopPropagation();
            const hour = parseInt(target.dataset.hour, 10);
            state.timer.countTo.selectedHour = hour;
            const timerMenu = getMenuElement('menuTimer');
            updateDisplay('#selected-hour-display', String(hour).padStart(2, '0'), timerMenu);
            updateDisplay('#selected-minute-display', '--', timerMenu);
            const hourList = parentMenu.querySelector('[data-list-type="hours"]');
            const minuteList = parentMenu.querySelector('[data-list-type="minutes"]');
            if (hourList && minuteList) {
                hourList.classList.remove('active');
                hourList.classList.add('disabled');
                minuteList.classList.remove('disabled');
                minuteList.classList.add('active');
                populateMinuteSelectionMenu(hour);
            }
            break;
        case 'selectTimerMinute':
            event.stopPropagation();
            const minute = parseInt(target.dataset.minute, 10);
            state.timer.countTo.selectedMinute = minute;
            updateDisplay('#selected-minute-display', String(minute).padStart(2, '0'), getMenuElement('menuTimer'));
            navigateBack();
            break;
        case 'previewAlarmSound': stopSound(); playSound(state.alarm.sound); setTimeout(stopSound, 2000); break;
        case 'previewCountdownSound': stopSound(); playSound(state.timer.sound); setTimeout(stopSound, 2000); break;
        case 'previewCountToDateSound': stopSound(); playSound(state.timer.countTo.sound); setTimeout(stopSound, 2000); break;
        case 'upload-audio':
            event.stopPropagation();
            handleAudioUpload(() => populateSoundsMenu(soundSelectionContext));
            break;
        case 'delete-user-audio':
            event.stopPropagation();
            deleteUserAudio(target.closest('.menu-link').dataset.soundId, () => populateSoundsMenu(soundSelectionContext));
            break;
        case 'createAlarm': {
            if (window.alarmManager && window.alarmManager.getAlarmCount() >= window.alarmManager.getAlarmLimit()) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('alarms', 'tooltips') });
                return;
            }
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            if (!validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim())) return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                window.alarmManager?.createAlarm(alarmTitleInput.value.trim(), state.alarm.hour, state.alarm.minute, state.alarm.sound);
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'createTimer': {
            if (window.timerManager && window.timerManager.getTimersCount() >= window.timerManager.getTimerLimit()) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('timer', 'tooltips') });
                return;
            }
            if (state.timer.currentTab === 'countdown') {
                const timerTitleInput = parentMenu.querySelector('#timer-title');
                const { hours, minutes, seconds } = state.timer.duration;
                if (!validateField(timerTitleInput.parentElement, timerTitleInput.value.trim()) || (hours === 0 && minutes === 0 && seconds === 0)) return;
                addSpinnerToCreateButton(target);
                setTimeout(() => {
                    addTimerAndRender({ type: 'countdown', title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, sound: state.timer.sound });
                    deactivateModule('overlayContainer');
                }, 500);
            } else {
                const eventTitleInput = parentMenu.querySelector('#countto-title');
                const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;
                if (!validateField(eventTitleInput.parentElement, eventTitleInput.value.trim()) || !selectedDate || typeof selectedHour !== 'number' || typeof selectedMinute !== 'number') return;
                addSpinnerToCreateButton(target);
                setTimeout(() => {
                    const targetDate = new Date(selectedDate);
                    targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                    addTimerAndRender({ type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                    deactivateModule('overlayContainer');
                }, 500);
            }
            break;
        }
        case 'addWorldClock': {
            if (window.worldClockManager && window.worldClockManager.getClockCount() >= window.worldClockManager.getClockLimit()) {
                showDynamicIslandNotification('system', 'limit_reached', null, 'notifications', { type: getTranslation('world_clock', 'tooltips') });
                return;
            }
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            if (!validateField(clockTitleInput.parentElement, clockTitleInput.value.trim()) || !country || !timezone) return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                window.worldClockManager?.createAndStartClockCard(clockTitleInput.value.trim(), country, timezone);
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'saveAlarmChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            if (!editingId || !validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim())) return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                window.alarmManager?.updateAlarm(editingId, { title: alarmTitleInput.value.trim(), hour: state.alarm.hour, minute: state.alarm.minute, sound: state.alarm.sound });
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'saveTimerChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const timerTitleInput = parentMenu.querySelector('#timer-title');
            if (!editingId || !validateField(timerTitleInput.parentElement, timerTitleInput.value.trim())) return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                const { hours, minutes, seconds } = state.timer.duration;
                updateTimer(editingId, { title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, sound: state.timer.sound });
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'saveCountToDateChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const eventTitleInput = parentMenu.querySelector('#countto-title');
            const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;
            if (!editingId || !validateField(eventTitleInput.parentElement, eventTitleInput.value.trim()) || !selectedDate || typeof selectedHour !== 'number' || typeof selectedMinute !== 'number') return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                const targetDate = new Date(selectedDate);
                targetDate.setHours(selectedHour, selectedMinute, 0, 0);
                updateTimer(editingId, { type: 'count_to_date', title: eventTitleInput.value.trim(), targetDate: targetDate.toISOString(), sound: state.timer.countTo.sound });
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'saveWorldClockChanges': {
            const editingId = parentMenu.getAttribute('data-editing-id');
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            if (!editingId || !validateField(clockTitleInput.parentElement, clockTitleInput.value.trim()) || !country || !timezone) return;
            addSpinnerToCreateButton(target);
            setTimeout(() => {
                window.worldClockManager?.updateClockCard(editingId, { title: clockTitleInput.value.trim(), country, timezone });
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'prev-month': {
            state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() - 1);
            renderCalendar();
            break;
        }
        case 'next-month': {
            state.timer.countTo.date.setMonth(state.timer.countTo.date.getMonth() + 1);
            renderCalendar();
            break;
        }
    }
}
window.getCurrentlyPlayingSoundId = () => currentlyPlayingSound ? currentlyPlayingSound.id : null;
export function initMenuInteractions() {
    setupGlobalEventListeners();
}
