import { PREMIUM_FEATURES, use24HourFormat, activateModule, getCurrentActiveOverlay, allowCardMovement } from '../general/main.js';
import { prepareWorldClockForEdit } from './menu-interactions.js';
import { updateZoneInfo } from './zoneinfo-controller.js';
import { initializeSortable, handleWorldClockCardAction } from './general-tools.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { updateEverythingWidgets } from './everything-controller.js';
import { getTranslation } from '../general/translations-controller.js';
import { showConfirmation } from '../general/overlay-manager.js';

const clockIntervals = new Map();
const CLOCKS_STORAGE_KEY = 'world-clocks';
let userClocks = [];
let mainDisplayInterval = null;

function renderWorldClockSearchResults(searchTerm) {
    const resultsWrapper = document.querySelector('.worldclock-search-results-wrapper');
    const creationWrapper = document.querySelector('.worldclock-creation-wrapper');
    if (!resultsWrapper || !creationWrapper) return;
    if (!searchTerm) {
        resultsWrapper.classList.add('disabled');
        creationWrapper.classList.remove('disabled');
        resultsWrapper.innerHTML = '';
        return;
    }
    const filteredClocks = userClocks.filter(clock =>
        clock.title.toLowerCase().includes(searchTerm)
    );
    creationWrapper.classList.add('disabled');
    resultsWrapper.classList.remove('disabled');
    resultsWrapper.innerHTML = '';
    if (filteredClocks.length > 0) {
        const list = document.createElement('div');
        list.className = 'menu-list';
        filteredClocks.forEach(clock => {
            const item = createWorldClockSearchResultItem(clock);
            list.appendChild(item);
            addSearchItemEventListeners(item);
        });
        resultsWrapper.appendChild(list);
    } else {
        resultsWrapper.innerHTML = `<p class="no-results-message">${getTranslation('no_results', 'search')} "${searchTerm}"</p>`;
    }
}

function refreshWorldClockSearchResults() {
    const searchInput = document.getElementById('worldclock-search-input');
    if (searchInput && searchInput.value) {
        renderWorldClockSearchResults(searchInput.value.toLowerCase());
    }
}
function createWorldClockSearchResultItem(clock) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.id = `search-clock-${clock.id}`;
    item.dataset.id = clock.id;
    item.dataset.type = 'world-clock';
    const time = '--:--:--';
    const editText = getTranslation('edit_clock', 'world_clock_options');
    const deleteText = getTranslation('delete_clock', 'world_clock_options');
    item.innerHTML = `
        <div class="result-info">
            <span class="result-title">${clock.title}</span>
            <span class="result-time">${clock.country}</span>
        </div>
        <div class="card-menu-container disabled">
             <button class="card-pin-btn" data-action="pin-clock" data-translate="pin_clock" data-translate-category="tooltips" data-translate-target="tooltip">
                 <span class="material-symbols-rounded">push_pin</span>
             </button>
             <div class="card-menu-btn-wrapper">
                 <button class="card-menu-btn" data-action="toggle-item-menu" data-translate="options" data-translate-category="world_clock_options" data-translate-target="tooltip">
                     <span class="material-symbols-rounded">more_horiz</span>
                 </button>
                 <div class="card-dropdown-menu body-title disabled">
                     <div class="menu-link" data-action="edit-clock">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                         <div class="menu-link-text">
                             <span data-translate="edit_clock" data-translate-category="world_clock_options" data-translate-target="text">${editText}</span>
                         </div>
                     </div>
                     <div class="menu-link" data-action="delete-clock">
                         <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
                         <div class="menu-link-text">
                             <span data-translate="delete_clock" data-translate-category="world_clock_options" data-translate-target="text">${deleteText}</span>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    `;
    if (typeof window.attachTooltipsToNewElements === 'function') {
        window.attachTooltipsToNewElements(item);
    }
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
        const clockId = item.dataset.id;
        if (action === 'toggle-item-menu') {
            const dropdown = item.querySelector('.card-dropdown-menu');
            const isOpening = dropdown.classList.contains('disabled');
            document.querySelectorAll('.worldclock-search-results-wrapper .card-dropdown-menu').forEach(d => {
                if (d !== dropdown) d.classList.add('disabled');
            });
            dropdown.classList.toggle('disabled');
        } else {
            handleWorldClockCardAction(action, clockId, actionTarget);
        }
    });
}
const loadCountriesAndTimezones = () => new Promise((resolve, reject) => {
    if (window.ct) return resolve(window.ct);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/manuelmhtr/countries-and-timezones@latest/dist/index.min.js';
    script.onload = () => window.ct ? resolve(window.ct) : reject(new Error('Library loaded but ct object not found'));
    script.onerror = (error) => {
        showDynamicIslandNotification('system', 'error', 'loading_countries_error', 'notifications');
        reject(new Error('Failed to load countries-and-timezones script'));
    };
    document.head.appendChild(script);
});
function updateDateTime(element, timezone) {
    if (!element) return;
    try {
        const now = new Date();
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !use24HourFormat,
            timeZone: timezone
        };
        const currentAppLanguage = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : 'en-US';
        const timeString = now.toLocaleTimeString(currentAppLanguage, timeOptions);
        if (element.tagName === 'SPAN') {
            element.textContent = timeString;
            return;
        }
        if (element.classList.contains('tool-card')) {
            const timeElement = element.querySelector('.card-value');
            const dateElement = element.querySelector('.card-tag');
            if (timeElement) {
                timeElement.textContent = timeString;
            }
            if (dateElement) {
                const isLocal = element.classList.contains('local-clock-card');
                if (isLocal) {
                    dateElement.textContent = now.toLocaleDateString(currentAppLanguage, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: timezone
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Zona horaria inválida: ${timezone}`, error);
        const targetElement = element.classList.contains('tool-card') ? element.querySelector('.card-value') : element;
        if (targetElement) {
            targetElement.textContent = "Error";
        }
        if (clockIntervals.has(element)) {
            clearInterval(clockIntervals.get(element));
            clockIntervals.delete(element);
        }
    }
}
function startClockForElement(element, timezone) {
    if (clockIntervals.has(element)) {
        clearInterval(clockIntervals.get(element));
    }
    updateDateTime(element, timezone);
    const intervalId = setInterval(() => updateDateTime(element, timezone), 1000);
    clockIntervals.set(element, intervalId);
}
function saveClocksToStorage() {
    try {
        localStorage.setItem(CLOCKS_STORAGE_KEY, JSON.stringify(userClocks));
    } catch (error) {
        console.error('Error guardando los relojes en localStorage:', error);
    }
}
async function loadClocksFromStorage() {
    try {
        await loadCountriesAndTimezones();
        const storedClocks = localStorage.getItem(CLOCKS_STORAGE_KEY);
        if (storedClocks) {
            userClocks = JSON.parse(storedClocks);
            userClocks.forEach((clock, index) => {
                setTimeout(() => {
                    createAndStartClockCard(clock.title, clock.country, clock.timezone, clock.id, false);
                }, index * 10);
            });
        }
        if (typeof updateEverythingWidgets === 'function') {
            updateEverythingWidgets();
        }
    } catch (error) {
        console.error('Error cargando los relojes desde localStorage:', error);
        userClocks = [];
    }
}
function applyTranslationsToSpecificElement(element) {
    if (!element) return;
    const getTranslationSafe = (key, category) => {
        if (typeof window.getTranslation === 'function') {
            const text = window.getTranslation(key, category);
            return text === key ? key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : text;
        }
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };
    const elementsToTranslate = element.querySelectorAll('[data-translate]');
    elementsToTranslate.forEach(targetElement => {
        const translateKey = targetElement.getAttribute('data-translate');
        const translateCategory = targetElement.getAttribute('data-translate-category') || 'world_clock_options';
        const translateTarget = targetElement.getAttribute('data-translate-target') || 'text';
        if (!translateKey) return;
        const translatedText = getTranslationSafe(translateKey, translateCategory);
        switch (translateTarget) {
            case 'text':
                targetElement.textContent = translatedText;
                break;
            case 'tooltip':
                targetElement.setAttribute('data-tooltip', translatedText);
                break;
            case 'title':
                targetElement.setAttribute('title', translatedText);
                break;
            case 'placeholder':
                targetElement.setAttribute('placeholder', translatedText);
                break;
            default:
                targetElement.textContent = translatedText;
        }
    });
}
function createLocalClockCardAndAppend() {
    const grid = document.querySelector('.world-clocks-grid');
    if (!grid) return;
    const cardHTML = `
        <div class="tool-card world-clock-card local-clock-card" data-id="local">
            <div class="card-header">
                <div class="card-details">
                    <span class="card-title" data-translate="local_time" data-translate-category="world_clock_options">Tiempo Local</span>
                    <span class="card-value">--:--:--</span>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-tags">
                    <span class="card-tag">---, -- ----</span>
                </div>
            </div>
            <div class="card-menu-container disabled">
                <button class="card-pin-btn active" data-action="pin-clock"
                        data-translate="pin_clock"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                    <span class="material-symbols-rounded">push_pin</span>
                </button>
            </div>
        </div>
    `;
    grid.insertAdjacentHTML('afterbegin', cardHTML);
}
function getClockCount() {
    if (userClocks.length > 0) {
        return userClocks.length;
    }
    try {
        const storedClocks = localStorage.getItem(CLOCKS_STORAGE_KEY);
        if (storedClocks) {
            const parsedClocks = JSON.parse(storedClocks);
            return Array.isArray(parsedClocks) ? parsedClocks.length : 0;
        }
    } catch (e) {
        console.error("Error reading clock count from localStorage", e);
        return 0;
    }
    return 0;
}
function getClockLimit() {
    return PREMIUM_FEATURES ? 100 : 5;
}
function createAndStartClockCard(title, country, timezone, existingId = null, save = true) {
    const grid = document.querySelector('.world-clocks-grid');
    if (!grid) return;
    const totalClockLimit = PREMIUM_FEATURES ? 100 : 5;
    const totalCurrentClocks = grid.querySelectorAll('.tool-card').length;
    const hasLocalClock = document.querySelector('.local-clock-card');
    const actualCurrentClocks = hasLocalClock && existingId !== 'local' ? totalCurrentClocks - 1 : totalCurrentClocks;
    if (save && actualCurrentClocks >= totalClockLimit) {
        // --- INICIO DE LA LÓGICA SIMPLIFICADA ---
        showDynamicIslandNotification(
            'system',
            'limit_reached', // Acción genérica
            null, // El controlador de notificaciones elegirá el mensaje
            'notifications',
            { type: getTranslation('world_clock', 'tooltips') }
        );
        // --- FIN DE LA LÓGICA SIMPLIFICADA ---
        return;
    }
    const ct = window.ct;
    const countryForTimezone = ct.getCountryForTimezone(timezone);
    const timezoneObject = countryForTimezone ? ct.getTimezonesForCountry(countryForTimezone.id)?.find(tz => tz.name === timezone) : null;
    const utcOffsetText = timezoneObject ? `UTC ${timezoneObject.utcOffsetStr}` : '';
    const countryCode = countryForTimezone ? countryForTimezone.id : '';
    const cardId = existingId || `clock-card-${Date.now()}`;
    const cardHTML = `
        <div class="tool-card world-clock-card" id="${cardId}" data-id="${cardId}" data-timezone="${timezone}" data-country="${country}" data-country-code="${countryCode}" data-title="${title}">
            <div class="card-header">
                <div class="card-details">
                    <span class="card-title" title="${title}">${title}</span>
                    <span class="card-value">--:--:--</span>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-tags">
                    <span class="card-tag">${utcOffsetText}</span>
                </div>
            </div>
            <div class="card-menu-container disabled">
                 <button class="card-pin-btn" data-action="pin-clock"
                        data-translate="pin_clock"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                    <span class="material-symbols-rounded">push_pin</span>
                </button>
                <div class="card-menu-btn-wrapper">
                    <button class="card-menu-btn" data-action="toggle-card-menu"
                            data-translate="options"
                            data-translate-category="world_clock_options"
                            data-translate-target="tooltip">
                        <span class="material-symbols-rounded">more_horiz</span>
                    </button>
                    <div class="card-dropdown-menu disabled body-title">
                        <div class="menu-link" data-action="edit-clock">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">edit</span></div>
                            <div class="menu-link-text">
                                <span data-translate="edit_clock"
                                      data-translate-category="world_clock_options"
                                      data-translate-target="text">Edit clock</span>
                            </div>
                        </div>
                        <div class="menu-link" data-action="delete-clock">
                            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
                            <div class="menu-link-text">
                                <span data-translate="delete_clock"
                                      data-translate-category="world_clock_options"
                                      data-translate-target="text">Delete clock</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    grid.insertAdjacentHTML('beforeend', cardHTML);
    const newCardElement = document.getElementById(cardId);
    if (newCardElement) {
        startClockForElement(newCardElement, timezone);
        const menuContainer = newCardElement.querySelector('.card-menu-container');
        newCardElement.addEventListener('mouseenter', () => {
            menuContainer?.classList.remove('disabled');
        });
        newCardElement.addEventListener('mouseleave', () => {
            const dropdown = menuContainer?.querySelector('.card-dropdown-menu');
            if (dropdown?.classList.contains('disabled')) {
                menuContainer?.classList.add('disabled');
            }
        });
        setTimeout(() => {
            applyTranslationsToSpecificElement(newCardElement);
            if (window.attachTooltipsToNewElements) {
                window.attachTooltipsToNewElements(newCardElement);
            }
        }, 0);
    }
    if (save) {
        userClocks.push({ id: cardId, title, country, timezone, countryCode });
        saveClocksToStorage();
        showDynamicIslandNotification('worldclock', 'created', 'worldclock_created', 'notifications', { title: title });
        if (typeof updateEverythingWidgets === 'function') {
            updateEverythingWidgets();
        }
    }
}
function updateClockCard(id, newData) {
    const card = document.getElementById(id);
    if (!card) return;
    card.setAttribute('data-title', newData.title);
    card.setAttribute('data-country', newData.country);
    card.setAttribute('data-timezone', newData.timezone);
    const titleElement = card.querySelector('.card-title');
    if (titleElement) {
        titleElement.textContent = newData.title;
        titleElement.setAttribute('title', newData.title);
    }
    const ct = window.ct;
    const countryForTimezone = ct.getCountryForTimezone(newData.timezone);
    const timezoneObject = countryForTimezone ? ct.getTimezonesForCountry(countryForTimezone.id)?.find(tz => tz.name === newData.timezone) : null;
    const utcOffsetText = timezoneObject ? `UTC ${timezoneObject.utcOffsetStr}` : '';
    const offsetElement = card.querySelector('.card-tag');
    if (offsetElement) {
        offsetElement.textContent = utcOffsetText;
    }
    startClockForElement(card, newData.timezone);
    const clockIndex = userClocks.findIndex(clock => clock.id === id);
    if (clockIndex !== -1) {
        userClocks[clockIndex] = { ...userClocks[clockIndex], ...newData };
        saveClocksToStorage();
    }
    setTimeout(() => {
        applyTranslationsToSpecificElement(card);
        if (window.attachTooltipsToNewElements) {
            window.attachTooltipsToNewElements(card);
        }
    }, 0);
    showDynamicIslandNotification('worldclock', 'updated', 'worldclock_updated', 'notifications', { title: newData.title });
    if (typeof updateEverythingWidgets === 'function') {
        updateEverythingWidgets();
    }
}
function updateExistingCardsTranslations() {
    const cards = document.querySelectorAll('.tool-card.world-clock-card');
    cards.forEach(card => {
        applyTranslationsToSpecificElement(card);
    });
}
function initializeLocalClock() {
    const localClockCard = document.querySelector('.local-clock-card');
    if (!localClockCard) return;
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    localClockCard.dataset.timezone = localTimezone;
    const locationText = localClockCard.querySelector('.card-title');
    const dateText = localClockCard.querySelector('.card-tag');
    if (locationText) {
        locationText.textContent = getTranslation('local_time', 'world_clock_options');
    }
    if (dateText) {
        const now = new Date();
        dateText.textContent = now.toLocaleDateString(navigator.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: localTimezone
        });
    }
    const menuContainer = localClockCard.querySelector('.card-menu-container');
    localClockCard.addEventListener('mouseenter', () => {
        menuContainer?.classList.remove('disabled');
    });
    localClockCard.addEventListener('mouseleave', () => {
        const dropdown = menuContainer?.querySelector('.card-dropdown-menu');
        if (!dropdown || dropdown.classList.contains('disabled')) {
            menuContainer?.classList.add('disabled');
        }
    });
    startClockForElement(localClockCard, localTimezone);
    const localPinBtn = localClockCard.querySelector('.card-pin-btn');
    pinClock(localPinBtn);
}
function updateLocalClockTranslation() {
    const localClockCard = document.querySelector('.local-clock-card');
    if (localClockCard) {
        const locationText = localClockCard.querySelector('.card-title');
        if (locationText) {
            locationText.textContent = getTranslation('local_time', 'world_clock_options');
        }
    }
}
function initializeSortableGrid() {
    if (!allowCardMovement) return;
    initializeSortable('.world-clocks-grid', {
        animation: 150,
        filter: '.local-clock-card, .card-menu-container',
        draggable: '.tool-card.world-clock-card',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onMove: function (evt) {
            return !evt.related.classList.contains('local-clock-card');
        },
        onEnd: function () {
            const grid = document.querySelector('.world-clocks-grid');
            const newOrder = Array.from(grid.querySelectorAll('.tool-card:not(.local-clock-card)')).map(card => card.id);
            userClocks.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
            saveClocksToStorage();
        }
    });
}
function pinClock(button) {
    const card = button.closest('.tool-card, .search-result-item');
    if (!card) return;
    const allPinButtons = document.querySelectorAll('.card-pin-btn');
    allPinButtons.forEach(btn => btn.classList.remove('active'));
    const clockId = card.dataset.id;
    const mainCardPinBtn = document.querySelector(`.tool-card[data-id="${clockId}"] .card-pin-btn`);
    if (mainCardPinBtn) mainCardPinBtn.classList.add('active');
    button.classList.add('active');
    const timezone = card.dataset.timezone || userClocks.find(c => c.id === clockId)?.timezone;
    if (timezone) {
        updateZoneInfo(timezone);
        updateMainPinnedDisplay(card);
    }
}
function deleteClock(clockId) {
    const card = document.getElementById(clockId);
    if (!card) return;

    const clockTitle = card.dataset.title;

    showConfirmation('world-clock', clockTitle, () => {
        const isPinned = card.querySelector('.card-pin-btn.active');

        if (clockIntervals.has(card)) {
            clearInterval(clockIntervals.get(card));
            clockIntervals.delete(card);
        }

        userClocks = userClocks.filter(clock => clock.id !== clockId);
        saveClocksToStorage();
        card.remove();

        const searchItem = document.getElementById(`search-clock-${clockId}`);
        if (searchItem) searchItem.remove();

        if (isPinned) {
            const localClockCard = document.querySelector('.local-clock-card');
            const localPinBtn = localClockCard.querySelector('.card-pin-btn');
            pinClock(localPinBtn);
        }

        showDynamicIslandNotification('worldclock', 'deleted', 'worldclock_deleted', 'notifications', {
            title: clockTitle
        });

        if (typeof updateEverythingWidgets === 'function') {
            updateEverythingWidgets();
        }

        refreshWorldClockSearchResults();
    });
}
function updateMainPinnedDisplay(card) {
    if (mainDisplayInterval) {
        clearInterval(mainDisplayInterval);
    }
    const pinnedDisplay = document.querySelector('.tool-worldClock');
    if (!pinnedDisplay) return;
    const timeEl = pinnedDisplay.querySelector('span');
    const timezone = card.dataset.timezone;
    function update() {
        if (!timeEl) return;
        const now = new Date();
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: !use24HourFormat,
            timeZone: timezone
        };
        const currentAppLanguage = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : 'en-US';
        timeEl.textContent = now.toLocaleTimeString(currentAppLanguage, timeOptions);
    }
    update();
    mainDisplayInterval = setInterval(update, 1000);
}

function handleEditClock(clockId) {
    const clockData = userClocks.find(clock => clock.id === clockId);

    if (clockData) {
        prepareWorldClockForEdit(clockData);
        const searchInput = document.getElementById('worldclock-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        renderWorldClockSearchResults('');

        if (getCurrentActiveOverlay() !== 'menuWorldClock') {
            activateModule('toggleMenuWorldClock');
        }
    } else {
        console.error(`No se encontraron datos para el reloj con ID: ${clockId}`);
    }
}

document.addEventListener('languageChanged', (e) => {
    console.log('🌐 Language changed detected in WorldClock controller:', e.detail);
    setTimeout(() => {
        updateLocalClockTranslation();
        updateExistingCardsTranslations();
        if (typeof window.forceRefresh === 'function') {
            window.forceRefresh({ source: 'worldClockLanguageChange', preset: 'TOOLTIPS_ONLY' });
        }
    }, 500);
});

document.addEventListener('translationsApplied', (e) => {
    setTimeout(() => {
        updateLocalClockTranslation();
        updateExistingCardsTranslations();
    }, 100);
});

window.worldClockManager = {
    createAndStartClockCard,
    updateClockCard,
    updateExistingCardsTranslations,
    updateLocalClockTranslation,
    pinClock,
    deleteClock,
    handleEditClock,
    getClockCount,
    getClockLimit
};

export function initWorldClock() {
    createLocalClockCardAndAppend();
    initializeLocalClock();
    loadClocksFromStorage();
    initializeSortableGrid();

    const searchInput = document.getElementById('worldclock-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderWorldClockSearchResults(e.target.value.toLowerCase()));
    }

    document.addEventListener('moduleDeactivated', (e) => {
        if (e.detail && e.detail.module === 'toggleMenuWorldClock') {
            if (searchInput) {
                searchInput.value = '';
                renderWorldClockSearchResults('');
            }
        }
    });
}