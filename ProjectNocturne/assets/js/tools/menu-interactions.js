"use strict";
import { use24HourFormat, deactivateModule, PREMIUM_FEATURES } from '../general/main.js';
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
    const subMenus = overlay.querySelectorAll('.menu-sounds, .menu-country, .menu-timezone, .menu-calendar, .menu-time-picker');
    subMenus.forEach(subMenu => {
        subMenu.classList.remove('active');
        subMenu.classList.add('disabled');
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
        
        // If we are leaving the time picker, reset its internal state to show the hour list again.
        if (currentMenu.dataset.menu === 'TimePicker') {
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
        'menuAlarm': '.menu-alarm[data-menu="Alarm"]',
        'menuTimer': '.menu-timer[data-menu="Timer"]',
        'menuWorldClock': '.menu-worldClock[data-menu="WorldClock"]',
        'menuCalendar': '.menu-calendar[data-menu="Calendar"]',
        'menuTimePicker': '.menu-time-picker[data-menu="TimePicker"]'
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
    const timePickerMenu = getMenuElement('menuTimePicker');
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
    const timePickerMenu = getMenuElement('menuTimePicker');
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

function populateSoundsMenu(context) {
    const soundsMenu = document.querySelector('.menu-sounds');
    if (!soundsMenu) return;

    // --- INICIO DE LA CORRECCIÓN ---
    // Apuntamos a los nuevos IDs de los contenedores
    const uploadContainer = soundsMenu.querySelector('#upload-audio-wrapper');
    const listContainer = soundsMenu.querySelector('#sound-list-wrapper');
    // --- FIN DE LA CORRECCIÓN ---

    let activeSoundId = '';
    if (context === 'alarm') {
        activeSoundId = state.alarm.sound;
    } else if (context === 'countdown') {
        activeSoundId = state.timer.sound;
    } else if (context === 'count_to_date') {
        activeSoundId = state.timer.countTo.sound;
    }
    
    // Pasamos los dos contenedores a la función
    generateSoundList(uploadContainer, listContainer, 'selectSound', activeSoundId);
}
function setupGlobalEventListeners() {
    if (areGlobalListenersInitialized) return;

    document.addEventListener('click', (event) => {
        const isClickInsideDropdown = event.target.closest('.dropdown-menu-container');
        const isClickOnToggle = event.target.closest('[data-action]')?.dataset.action in dropdownMap;
        if (!isClickInsideDropdown && !isClickOnToggle) {
            document.querySelectorAll('.dropdown-menu-container').forEach(d => d.classList.add('disabled'));
        }
    });

   document.body.addEventListener('input', (event) => {
    const target = event.target;

    // Condicional para manejar específicamente la búsqueda de sonidos
    if (target.id === 'sound-search-input') {
        const searchTerm = target.value.toLowerCase();
        
        // 1. Ocultar o mostrar el botón de "Subir Audio"
        const uploadAudioWrapper = document.getElementById('upload-audio-wrapper');
        if (uploadAudioWrapper) {
            uploadAudioWrapper.style.display = searchTerm ? 'none' : 'block';
        }

        // 2. Filtrar la lista de sonidos y sus cabeceras de sección
        const soundListContainer = document.querySelector('#sound-list-wrapper .menu-list');
        if (!soundListContainer) return;

        const allSoundItems = soundListContainer.querySelectorAll('.menu-link[data-sound]');

        // Primero, filtramos todos los sonidos individualmente
        allSoundItems.forEach(item => {
            const itemNameElement = item.querySelector('.menu-link-text span');
            if (itemNameElement) {
                const itemName = itemNameElement.textContent.toLowerCase();
                // Muestra el item si coincide, de lo contrario lo oculta
                item.style.display = itemName.includes(searchTerm) ? 'flex' : 'none';
            }
        });

        // Ahora, verificamos la visibilidad de cada sección
        const headers = soundListContainer.querySelectorAll('.menu-content-header-sm');
        headers.forEach(header => {
            let nextElement = header.nextElementSibling;
            let hasVisibleItemsInSection = false;

            // Buscamos si algún elemento visible pertenece a esta sección
            while (nextElement && !nextElement.classList.contains('menu-content-header-sm')) {
                if (nextElement.matches('.menu-link[data-sound]') && nextElement.style.display !== 'none') {
                    hasVisibleItemsInSection = true;
                    break; // Si encontramos uno, ya no necesitamos seguir buscando en esta sección
                }
                nextElement = nextElement.nextElementSibling;
            }

            // Ocultamos la cabecera si no hay elementos visibles en su sección
            header.style.display = hasVisibleItemsInSection ? 'flex' : 'none';
        });

    } 
    // Mantenemos la lógica original para las otras búsquedas
    else if (target.matches('#country-search-input-new, #timezone-search-input')) {
        const searchTerm = target.value.toLowerCase();
        const listContainer = target.closest('.menu-section').querySelector('.menu-list, .sound-list-container');
        if (!listContainer) return;
        const items = listContainer.querySelectorAll('.menu-link');
        items.forEach(item => {
            const itemName = item.querySelector('.menu-link-text span')?.textContent.toLowerCase();
            if (itemName) {
                item.style.display = itemName.includes(searchTerm) ? 'flex' : 'none';
            }
        });
    }
});

    document.body.addEventListener('click', (event) => {
        const parentMenu = event.target.closest('.menu-alarm, .menu-timer, .menu-worldClock, .menu-sounds, .menu-country, .menu-timezone, .menu-calendar, .menu-time-picker');
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
    const target = event.target;

    const tabTarget = target.closest('.menu-timer-type .menu-link[data-tab]');
    if (tabTarget) {
        event.stopPropagation();
        state.timer.currentTab = tabTarget.dataset.tab;
        updateTimerTabView(parentMenu);
        tabTarget.closest('.dropdown-menu-container')?.classList.add('disabled');
        return;
    }

    const dayTarget = target.closest('.calendar-days .day:not(.other-month)');
    if (dayTarget && dayTarget.dataset.day) {
        event.stopPropagation();
        selectCalendarDate(parseInt(dayTarget.dataset.day, 10));
        return;
    }
    
    const actionTarget = target.closest('[data-action]');
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;

    if (dropdownMap[action]) {
        toggleDropdown(action, parentMenu);
        return; 
    }
    
    switch (action) {
        case 'open-calendar-menu':
            navigateToMenu('Calendar');
            renderCalendar();
            break;
        case 'open-time-picker-menu':
            navigateToMenu('TimePicker');
            populateHourSelectionMenu();
            break;
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
        case 'selectSound':
            event.stopPropagation();
            const soundId = actionTarget.dataset.sound;
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
            const countryCode = actionTarget.getAttribute('data-country-code');
            state.worldClock.country = actionTarget.querySelector('.menu-link-text span')?.textContent;
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
            state.worldClock.timezone = actionTarget.getAttribute('data-timezone');
            const tzDisplayName = actionTarget.querySelector('.menu-link-text span')?.textContent;
            updateDisplay('#worldclock-selected-timezone', tzDisplayName, getMenuElement('menuWorldClock'));
            navigateBack();
            break;
        case 'selectTimerHour':
            event.stopPropagation();
            const hour = parseInt(actionTarget.dataset.hour, 10);
            state.timer.countTo.selectedHour = hour;
            const timerMenu = getMenuElement('menuTimer');
            updateDisplay('#selected-hour-display', String(hour).padStart(2, '0'), timerMenu);
            updateDisplay('#selected-minute-display', '--', timerMenu);

            // Logic to switch from hour list to minute list inside TimePicker menu
            const hourList = parentMenu.querySelector('[data-list-type="hours"]');
            const minuteList = parentMenu.querySelector('[data-list-type="minutes"]');
            if(hourList && minuteList) {
                hourList.classList.remove('active');
                hourList.classList.add('disabled');
                minuteList.classList.remove('disabled');
                minuteList.classList.add('active');
                populateMinuteSelectionMenu(hour);
            }
            break;
        case 'selectTimerMinute':
            event.stopPropagation();
            const minute = parseInt(actionTarget.dataset.minute, 10);
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
            deleteUserAudio(actionTarget.dataset.audioId, () => populateSoundsMenu(soundSelectionContext));
            break;
        case 'createAlarm': {
            const alarmTitleInput = parentMenu.querySelector('#alarm-title');
            if (!validateField(alarmTitleInput.parentElement, alarmTitleInput.value.trim())) return;
            addSpinnerToCreateButton(actionTarget);
            setTimeout(() => {
                window.alarmManager?.createAlarm(alarmTitleInput.value.trim(), state.alarm.hour, state.alarm.minute, state.alarm.sound);
                deactivateModule('overlayContainer');
            }, 500);
            break;
        }
        case 'createTimer': {
            if (state.timer.currentTab === 'countdown') {
                const timerTitleInput = parentMenu.querySelector('#timer-title');
                const { hours, minutes, seconds } = state.timer.duration;
                if (!validateField(timerTitleInput.parentElement, timerTitleInput.value.trim()) || (hours === 0 && minutes === 0 && seconds === 0)) return;
                addSpinnerToCreateButton(actionTarget);
                setTimeout(() => {
                    addTimerAndRender({ type: 'countdown', title: timerTitleInput.value.trim(), duration: (hours * 3600 + minutes * 60 + seconds) * 1000, sound: state.timer.sound });
                    deactivateModule('overlayContainer');
                }, 500);
            } else {
                const eventTitleInput = parentMenu.querySelector('#countto-title');
                const { selectedDate, selectedHour, selectedMinute } = state.timer.countTo;
                if (!validateField(eventTitleInput.parentElement, eventTitleInput.value.trim()) || !selectedDate || typeof selectedHour !== 'number' || typeof selectedMinute !== 'number') return;
                addSpinnerToCreateButton(actionTarget);
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
            const clockTitleInput = parentMenu.querySelector('#worldclock-title');
            const { country, timezone } = state.worldClock;
            if (!validateField(clockTitleInput.parentElement, clockTitleInput.value.trim()) || !country || !timezone) return;
            addSpinnerToCreateButton(actionTarget);
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
            addSpinnerToCreateButton(actionTarget);
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
            addSpinnerToCreateButton(actionTarget);
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
            addSpinnerToCreateButton(actionTarget);
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
            addSpinnerToCreateButton(actionTarget);
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



export function initMenuInteractions() {
    setupGlobalEventListeners();
}