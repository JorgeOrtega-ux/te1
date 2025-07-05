import { getTranslation } from '../general/translations-controller.js';

// --- CONFIGURACIÓN Y ESTADO CENTRALIZADO ---
const LOCATION_STORAGE_KEY = 'user-location';
const IPWHO_API_URL = 'https://ipwho.is/';

const TIMING_CONFIG = {
    LOCATION_CHANGE_DURATION: 750,
};

const state = {
    isInitialized: false,
    isLoading: false,
    isChanging: false,
    changeTimeout: null,
    pendingCountry: null,
    isCancellable: false,
    selectedCountry: null,
    countries: [],
};

async function initLocationManager() {
    if (state.isInitialized) return;

    try {
        await loadCountriesLibrary();
        loadStoredLocation();
        await detectLocationIfNotSet();
        populateLocationMenu();
        addEventListeners();
        updateLocationDisplay();
        
        const event = new CustomEvent('locationChanged', { detail: { country: state.selectedCountry } });
        document.dispatchEvent(event);

    } catch (error) {
        console.error("❌ Error initializing Location Manager:", error);
    } finally {
        state.isInitialized = true;
    }
}

function applyCountryChange(country) {
    if (state.isChanging || (state.selectedCountry && state.selectedCountry.code === country.code)) {
        return Promise.resolve(false);
    }
    
    const previousCountry = state.selectedCountry;
    state.isChanging = true;
    state.pendingCountry = country;
    state.isCancellable = true;

    console.log(`✈️ Applying country change: ${country.name} (${country.code})`);
    setupCountryLoadingUI(country);

    return performCountryChange(country)
        .then(() => {
            if (state.isChanging && state.pendingCountry.code === country.code) {
                setCountry(country);
                completeCountryChange(country);
                return true;
            } else {
                console.log('🚫 Location change was cancelled during process');
                revertCountryChange(previousCountry);
                return false;
            }
        })
        .catch(error => {
            console.error('Error changing country:', error);
            revertCountryChange(previousCountry);
            return false;
        })
        .finally(() => {
            setTimeout(() => {
                state.isChanging = false;
                state.pendingCountry = null;
                state.isCancellable = false;
            }, 100);
        });
}

function performCountryChange(country) {
    return new Promise((resolve, reject) => {
        state.changeTimeout = setTimeout(() => {
            if (state.isChanging && state.pendingCountry.code === country.code) {
                resolve();
            } else {
                reject(new Error('Country change was cancelled'));
            }
            state.changeTimeout = null;
        }, TIMING_CONFIG.LOCATION_CHANGE_DURATION);
    });
}

function getCountryLinks() {
    return document.querySelectorAll('.menu-control-center[data-menu="location"] .menu-list .menu-link[data-country-code]');
}

function setupCountryLoadingUI(newCountry) {
    const countryLinks = getCountryLinks();
    countryLinks.forEach(link => {
        const linkCountryCode = link.dataset.countryCode;
        if (linkCountryCode === newCountry.code) {
            link.classList.remove('active');
            link.classList.add('preview-active');
            addSpinnerToLink(link);
        } else {
            link.classList.remove('active', 'preview-active');
            link.classList.add('disabled-interactive');
        }
    });
}

function completeCountryChange(newCountry) {
    const countryLinks = getCountryLinks();
    countryLinks.forEach(link => {
        const linkCountryCode = link.dataset.countryCode;
        link.classList.remove('preview-active', 'disabled-interactive');
        removeSpinnerFromLink(link);

        if (linkCountryCode === newCountry.code) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function revertCountryChange(previousCountry) {
    const countryLinks = getCountryLinks();
    countryLinks.forEach(link => {
        const linkCountryCode = link.dataset.countryCode;
        link.classList.remove('preview-active', 'disabled-interactive');
        removeSpinnerFromLink(link);

        if (previousCountry && linkCountryCode === previousCountry.code) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function addSpinnerToLink(link) {
    removeSpinnerFromLink(link);
    const loaderDiv = document.createElement('div');
    loaderDiv.className = 'menu-link-icon menu-link-loader';
    loaderDiv.innerHTML = '<span class="material-symbols-rounded spinning">progress_activity</span>';
    link.appendChild(loaderDiv);
}

function removeSpinnerFromLink(link) {
    const loaderDiv = link.querySelector('.menu-link-loader');
    if (loaderDiv) {
        loaderDiv.remove();
    }
}

function loadCountriesLibrary() {
    return new Promise((resolve, reject) => {
        if (window.ct) {
            state.countries = Object.values(window.ct.getAllCountries()).sort((a, b) => a.name.localeCompare(b.name));
            return resolve(window.ct);
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/manuelmhtr/countries-and-timezones@latest/dist/index.min.js';
        script.onload = () => {
            if (window.ct) {
                state.countries = Object.values(window.ct.getAllCountries()).sort((a, b) => a.name.localeCompare(b.name));
                resolve(window.ct);
            } else {
                reject(new Error("Library loaded but 'ct' object not found"));
            }
        };
        script.onerror = (error) => reject(new Error('Failed to load countries-and-timezones script'));
        document.head.appendChild(script);
    });
}

function loadStoredLocation() {
    const storedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (storedLocation) {
        try {
            state.selectedCountry = JSON.parse(storedLocation);
        } catch (error) {
            state.selectedCountry = null;
        }
    }
}

async function detectLocationIfNotSet() {
    if (state.selectedCountry || state.isLoading) return;

    state.isLoading = true;
    showLoadingState(true);

    try {
        const response = await fetch(IPWHO_API_URL);
        if (!response.ok) throw new Error(`IPWHO API request failed with status ${response.status}`);
        
        const data = await response.json();
        if (data.success && data.country_code) {
            const country = state.countries.find(c => c.id === data.country_code);
            if (country) {
                console.log(`✅ País detectado: ${country.name} (${country.id})`);
                setCountry({ code: country.id, name: country.name });
            }
        }
    } catch (error) {
        console.error("Error detecting location from IP:", error);
    } finally {
        state.isLoading = false;
        showLoadingState(false);
    }
}

function setCountry(country) {
    state.selectedCountry = country;
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(country));
    updateLocationDisplay();
    
    const event = new CustomEvent('locationChanged', { detail: { country } });
    document.dispatchEvent(event);
    
    console.log(`País seleccionado: ${country.name} (${country.code})`);
}

function populateLocationMenu() {
    const menuList = document.querySelector('.menu-control-center[data-menu="location"] .menu-list');
    if (!menuList) return;

    menuList.innerHTML = '';
    state.countries.forEach(country => {
        const link = document.createElement('div');
        link.className = 'menu-link';
        link.dataset.countryCode = country.id;
        link.dataset.countryName = country.name;

        link.innerHTML = `
            <div class="menu-link-icon"><span class="material-symbols-rounded">flag</span></div>
            <div class="menu-link-text"><span>${country.name}</span></div>
        `;
        menuList.appendChild(link);
    });

    highlightSelectedCountryInMenu();
}

function highlightSelectedCountryInMenu() {
    const menuList = document.querySelector('.menu-control-center[data-menu="location"] .menu-list');
    if (!menuList) return;

    menuList.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));

    if (state.selectedCountry) {
        const activeLink = menuList.querySelector(`.menu-link[data-country-code="${state.selectedCountry.code}"]`);
        if (activeLink) activeLink.classList.add('active');
    }
}

function updateLocationDisplay() {
    const locationLinkSpan = document.querySelector('.menu-link[data-toggle="location"] .menu-link-text span');
    if (locationLinkSpan) {
        const locationLabel = getTranslation('location', 'menu');
        const currentLocation = state.selectedCountry ? state.selectedCountry.name : getTranslation('none_selected', 'menu');
        const newText = `${locationLabel}: ${currentLocation}`;
        
        if (locationLinkSpan.textContent !== newText) {
            locationLinkSpan.textContent = newText;
        }
    }
}

function showLoadingState(isLoading) {
    const locationLinkSpan = document.querySelector('.menu-link[data-toggle="location"] .menu-link-text span');
    if (locationLinkSpan) {
        if (isLoading) {
            const locationLabel = getTranslation('location', 'menu');
            const detectingText = getTranslation('detecting', 'menu');
            const newText = `${locationLabel}: ${detectingText}`;
            locationLinkSpan.textContent = newText;
        } else {
            updateLocationDisplay();
        }
    }
}

function filterCountryList(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const menuList = document.querySelector('.menu-control-center[data-menu="location"] .menu-list');
    if (!menuList) return;

    const links = menuList.querySelectorAll('.menu-link');
    let matchesFound = 0;

    links.forEach(link => {
        const countryName = link.dataset.countryName.toLowerCase();
        if (countryName.includes(normalizedQuery)) {
            link.style.display = 'flex';
            matchesFound++;
        } else {
            link.style.display = 'none';
        }
    });

    let noResultsMsg = menuList.querySelector('.no-results-message');
    if (matchesFound === 0 && normalizedQuery) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            menuList.appendChild(noResultsMsg);
        }
        const noResultsText = getTranslation('no_results', 'search');
        noResultsMsg.textContent = `${noResultsText} "${query}"`;
    } else {
        if (noResultsMsg) {
            noResultsMsg.remove();
        }
    }
}

function resetLocationSearch() {
    const searchInput = document.querySelector('#location-search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    filterCountryList('');
}

function addEventListeners() {
    const locationMenu = document.querySelector('.menu-control-center[data-menu="location"]');
    if (locationMenu) {
        locationMenu.querySelector('.menu-list').addEventListener('click', (e) => {
            const link = e.target.closest('.menu-link[data-country-code]');
            if (link && link.dataset.countryCode) {
                e.preventDefault();
                applyCountryChange({
                    code: link.dataset.countryCode,
                    name: link.dataset.countryName
                });
            }
        });

        const searchInput = locationMenu.querySelector('#location-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => filterCountryList(e.target.value));
        }
    }

    document.addEventListener('languageChanged', () => {
        updateLocationDisplay();
    });
}

function resetLocationStates() {
    if (state.changeTimeout) {
        clearTimeout(state.changeTimeout);
        state.changeTimeout = null;
    }
    
    state.isChanging = false;
    state.pendingCountry = null;
    state.isCancellable = false;
}



function cleanLocationChangeStates() {
    const previousCountry = state.selectedCountry;
    resetLocationStates();
    revertCountryChange(previousCountry);
}

function isLocationChanging() {
    return state.isChanging;
}

function getCurrentLocation() {
    return state.selectedCountry;
}
window.getCurrentLocation = getCurrentLocation;

export { initLocationManager, getCurrentLocation, isLocationChanging, resetLocationStates, cleanLocationChangeStates, resetLocationSearch };