import { getTranslation, translateElementTree } from '../general/translations-controller.js';
import { use24HourFormat, toggleModule } from '../general/main.js';
import { refreshTooltips } from '../general/tooltip-controller.js';

const WIDGET_DEFINITIONS = {
    'clock-widget': {
        className: 'widget-clock',
        generateContent: () => `
            <div class="clock-content">
                <div class="clock-time" id="main-clock-time-long">--:--:--</div>
                <div class="clock-date" id="main-clock-date"></div>
            </div>
            <div class="add-button-container">
                <button class="header-button add-btn" data-action="toggle-add-menu" data-translate="add_element" data-translate-category="tooltips" data-translate-target="tooltip">
                    <span class="material-symbols-rounded">add</span>
                </button>
                <div class="dropdown-menu-container add-menu-custom disabled">
                    <div class="menu-list">
                        <div class="menu-link" data-module="toggleMenuAlarm">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">add_alarm</span></div>
                            <div class="menu-link-text"><span data-translate="new_alarm" data-translate-category="everything">Nueva alarma</span></div>
                        </div>
                        <div class="menu-link" data-module="toggleMenuTimer">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">timer</span></div>
                            <div class="menu-link-text"><span data-translate="new_timer" data-translate-category="everything">Nuevo temporizador</span></div>
                        </div>
                        <div class="menu-link" data-module="toggleMenuWorldClock">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">public</span></div>
                            <div class="menu-link-text"><span data-translate="add_clock" data-translate-category="everything">Añadir reloj</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `
    }
};

let smartUpdateInterval = null;
let updateTimeout = null;

function createWidgetElement(id) {
    const definition = WIDGET_DEFINITIONS[id];
    if (!definition) return null;
    const widget = document.createElement('div');
    widget.id = id;
    widget.className = `widget ${definition.className}`;
    widget.innerHTML = definition.generateContent();
    return widget;
}

function rebindEventListeners() {
    const actionItems = document.querySelectorAll('.add-menu-custom .menu-link[data-module]');
    actionItems.forEach(item => {
        const moduleName = item.dataset.module;
        if (moduleName) {
            item.addEventListener('click', () => {
                if (!item.classList.contains('disabled-interactions')) {
                    toggleModule(moduleName);
                    const menu = item.closest('.add-menu-custom');
                    if (menu) {
                        menu.classList.add('disabled');
                    }
                }
            });
        }
    });

    const addMenuButton = document.querySelector('[data-action="toggle-add-menu"]');
    if (addMenuButton) {
        addMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.querySelector('.add-menu-custom');
            if (menu) {
                menu.classList.toggle('disabled');
            }
        });
    }

    document.addEventListener('click', (e) => {
        const menu = document.querySelector('.add-menu-custom');
        const addButton = document.querySelector('[data-action="toggle-add-menu"]');
        if (menu && !menu.classList.contains('disabled') && !menu.contains(e.target) && !addButton.contains(e.target)) {
            menu.classList.add('disabled');
        }
    });
}

function renderAllWidgets() {
    const mainContainer = document.querySelector('.everything-grid-container');
    if (!mainContainer) return;

    mainContainer.innerHTML = '';

    const clockWidget = createWidgetElement('clock-widget');
    if (clockWidget) mainContainer.appendChild(clockWidget);

    if (typeof translateElementTree === 'function') {
        translateElementTree(mainContainer);
    }
    rebindEventListeners();
    updateActionCounts();
}

function updateActionCounts() {
    const alarmMenuItem = document.querySelector('.add-menu-custom .menu-link[data-module="toggleMenuAlarm"]');
    if (alarmMenuItem && window.alarmManager) {
        const count = window.alarmManager.getAlarmCount();
        const limit = window.alarmManager.getAlarmLimit();
        const isDisabled = count >= limit;
        alarmMenuItem.classList.toggle('disabled-interactions', isDisabled);
    }

    const timerMenuItem = document.querySelector('.add-menu-custom .menu-link[data-module="toggleMenuTimer"]');
    if (timerMenuItem && window.timerManager) {
        const count = window.timerManager.getTimersCount();
        const limit = window.timerManager.getTimerLimit();
        const isDisabled = count >= limit;
        timerMenuItem.classList.toggle('disabled-interactions', isDisabled);
    }

    const clockMenuItem = document.querySelector('.add-menu-custom .menu-link[data-module="toggleMenuWorldClock"]');
    if (clockMenuItem && window.worldClockManager) {
        const count = window.worldClockManager.getClockCount();
        const limit = window.worldClockManager.getClockLimit();
        const isDisabled = count >= limit;
        clockMenuItem.classList.toggle('disabled-interactions', isDisabled);
    }
}

export function initializeEverything() {
    if (smartUpdateInterval) clearInterval(smartUpdateInterval);
    renderAllWidgets();
    updateCurrentDate();
    smartUpdateInterval = setInterval(updateCurrentDate, 1000);
    document.addEventListener('translationsApplied', updateEverythingWidgets);
}

function updateCurrentDate() {
    const now = new Date();
    const clockTime = document.getElementById('main-clock-time-long');
    const clockDate = document.getElementById('main-clock-date');

    if (clockTime) {
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !use24HourFormat };
        clockTime.textContent = now.toLocaleTimeString(navigator.language, timeOptions);
    }

    if (clockDate) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const dayOfWeek = getTranslation(dayNames[now.getDay()], 'weekdays');
        const month = getTranslation(monthNames[now.getMonth()], 'months');
        clockDate.textContent = `${dayOfWeek}, ${now.getDate()} de ${month} de ${now.getFullYear()}`;
    }
}

export function updateEverythingWidgets() {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }

    updateTimeout = setTimeout(() => {
        if (typeof translateElementTree === 'function') {
            const mainContainer = document.querySelector('.everything-grid-container');
            if (mainContainer) {
                translateElementTree(mainContainer);
            }
        }
        updateCurrentDate();
        updateActionCounts();
        updateTimeout = null;
    }, 50);
}