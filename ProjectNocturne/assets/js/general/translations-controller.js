// ========== TRANSLATIONS CONTROLLER - IMPROVED WITH NEW CATEGORIES ==========

let currentLanguage = 'en-us';
let translations = {};
let isTranslationSystemReady = false;

// ========== INITIALIZATION ==========

function initTranslationSystem() {
    return new Promise((resolve, reject) => {
        getCurrentLanguageFromStorage()
            .then(language => {
                currentLanguage = language;
                return loadTranslations(language);
            })
            .then(() => {
                applyTranslations();
                setupLanguageChangeListener();
                isTranslationSystemReady = true;

                const event = new CustomEvent('translationSystemReady', {
                    detail: { language: currentLanguage }
                });
                document.dispatchEvent(event);

                resolve();
            })
            .catch(error => {
                console.error('Error initializing translation system:', error);
                reject(error);
            });
    });
}

// ========== LANGUAGE MANAGEMENT ==========

function getCurrentLanguageFromStorage() {
    return new Promise(resolve => {
        const savedLanguage = localStorage.getItem('app-language');
        const supportedLanguages = ['en-us', 'es-mx', 'fr-fr'];
        if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
            resolve(savedLanguage);
        } else {
            resolve('en-us');
        }
    });
}

function setCurrentLanguage(language) {
    const supportedLanguages = ['en-us', 'es-mx', 'fr-fr'];
    if (supportedLanguages.includes(language) && language !== currentLanguage) {
        currentLanguage = language;
        return loadTranslations(language)
            .then(() => {
                applyTranslations();
                return true;
            })
            .catch(error => {
                console.error('Error setting language:', error);
                return false;
            });
    }
    return Promise.resolve(false);
}

// ========== TRANSLATION LOADING ==========

function loadTranslations(language) {
    return new Promise((resolve, reject) => {
        fetch(`config/translations/${language}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                translations = data;
                resolve();
            })
            .catch(error => {
                console.error(`❌ Error loading translations for ${language}:`, error);
                if (language !== 'en-us') {
                    return loadTranslations('en-us').then(resolve).catch(reject);
                }
                reject(error);
            });
    });
}

// ========== IMPROVED TRANSLATION APPLICATION ==========

function applyTranslations() {
    if (!translations || Object.keys(translations).length === 0) {
        console.warn('⚠️ No translations available');
        return;
    }

    translateElementsWithDataTranslate();
    updateDynamicMenuLabels();
    updateTooltipTranslations();
    updateColorSystemHeaders();
}

// ========== NEW UNIFIED SYSTEM WITH data-translate ==========

function translateElementsWithDataTranslate(parentElement = document.body) {
    const elementsToTranslate = parentElement.querySelectorAll('[data-translate]');

    elementsToTranslate.forEach(element => {
        const translateKey = element.getAttribute('data-translate');
        const translateCategory = element.getAttribute('data-translate-category') || 'menu';
        const translateTarget = element.getAttribute('data-translate-target') || 'text';
        const placeholdersAttr = element.getAttribute('data-placeholders');

        if (!translateKey) return;
        if (isDynamicMenuElement(element)) return;

        let translatedText = getTranslation(translateKey, translateCategory);

        if (placeholdersAttr) {
            try {
                const placeholders = JSON.parse(placeholdersAttr);
                for (const placeholder in placeholders) {
                    if (Object.prototype.hasOwnProperty.call(placeholders, placeholder)) {
                        translatedText = translatedText.replace(`{${placeholder}}`, placeholders[placeholder]);
                    }
                }
            } catch (e) {
                console.error("Error parsing data-placeholders JSON", e);
            }
        }

        switch (translateTarget) {
            case 'text':
                element.textContent = translatedText;
                break;
            case 'tooltip':
                break;
            case 'title':
                element.setAttribute('title', translatedText);
                break;
            case 'placeholder':
                element.setAttribute('placeholder', translatedText);
                break;
            case 'aria-label':
                element.setAttribute('aria-label', translatedText);
                break;
            default:
                element.textContent = translatedText;
        }
    });
}

function translateElementTree(element) {
    if (element) {
        if (element.hasAttribute('data-translate')) {
            translateElementsWithDataTranslate(new DocumentFragment().appendChild(element.cloneNode(false)));
        }
        translateElementsWithDataTranslate(element);
    }
}


// ========== FUNCTION TO DETECT DYNAMIC CONTROL CENTER ELEMENTS ==========

function isDynamicMenuElement(element) {
    const menuLink = element.closest('.menu-link');
    if (menuLink) {
        const toggle = menuLink.getAttribute('data-toggle');
        if (toggle === 'appearance' || toggle === 'language' || toggle === 'location') {
            return true;
        }
    }
    return false;
}

// ========== NEW FUNCTIONS FOR SPECIFIC CATEGORIES ==========

function updateColorSystemHeaders() {
    const colorSections = [
        { selector: '[data-section="main-colors"] .menu-content-header span:last-child', key: 'main_colors' },
        { selector: '[data-section="recent-colors"] .menu-content-header span:last-child', key: 'recent_colors' },
        { selector: '[data-section="default-colors"] .menu-content-header span:last-child', key: 'default_colors' },
        { selector: '[data-section="gradient-colors"] .menu-content-header span:last-child', key: 'gradient_colors' }
    ];

    colorSections.forEach(section => {
        const element = document.querySelector(section.selector);
        if (element) {
            const translatedText = getTranslation(section.key, 'color_system');
            if (translatedText && translatedText !== section.key) {
                element.textContent = translatedText;
            }
        }
    });
}

// ========== FUNCTIONS FOR IMPROVED DYNAMIC ELEMENTS ==========

function updateDynamicMenuLabels() {
    if (!translations.menu) {
        console.warn('⚠️ Translations not loaded for dynamic menu labels.');
        return;
    }

    updateAppearanceLabel();
    updateLanguageLabel();
    updateLocationLabel();
}

function updateAppearanceLabel() {
    const appearanceLink = document.querySelector('.menu-link[data-toggle="appearance"] .menu-link-text span');
    if (appearanceLink && translations.menu) {
        const currentTheme = (typeof window.getCurrentTheme === 'function') ? window.getCurrentTheme() : localStorage.getItem('app-theme') || 'system';
        const themeKey = getThemeTranslationKey(currentTheme);

        if (themeKey && translations.menu[themeKey] && translations.menu.appearance) {
            appearanceLink.textContent = `${translations.menu.appearance}: ${translations.menu[themeKey]}`;
        }
    }
}

function updateLanguageLabel() {
    const languageLink = document.querySelector('.menu-link[data-toggle="language"] .menu-link-text span');
    if (languageLink && translations.menu) {
        const currentLanguageFromControlCenter = (typeof window.getCurrentLanguage === 'function') ? window.getCurrentLanguage() : currentLanguage;
        const languageKey = getLanguageTranslationKey(currentLanguageFromControlCenter);

        if (languageKey && translations.menu[languageKey] && translations.menu.language) {
            languageLink.textContent = `${translations.menu.language}: ${translations.menu[languageKey]}`;
        }
    }
}

function updateLocationLabel() {
    const locationLinkSpan = document.querySelector('.menu-link[data-toggle="location"] .menu-link-text span');
    if (locationLinkSpan && typeof window.getCurrentLocation === 'function') {
        const locationLabel = getTranslation('location', 'menu');
        const currentLocationData = window.getCurrentLocation();
        const currentLocationName = currentLocationData ? currentLocationData.name : getTranslation('none_selected', 'menu');
        const newText = `${locationLabel}: ${currentLocationName}`;

        if (locationLinkSpan.textContent !== newText) {
            locationLinkSpan.textContent = newText;
        }
    }
}

function getThemeTranslationKey(theme) {
    const themeMap = {
        'system': 'sync_with_system',
        'dark': 'dark_theme',
        'light': 'light_theme'
    };
    return themeMap[theme] || 'sync_with_system';
}

function getLanguageTranslationKey(language) {
    const languageMap = {
        'en-us': 'english_us',
        'es-mx': 'spanish_mx',
        'fr-fr': 'french_fr'
    };
    return languageMap[language] || 'english_us';
}

// ========== TOOLTIP UPDATE ==========

function updateTooltipTranslations() {
    if (typeof window.updateTooltipTextMap === 'function' && translations) {
        window.updateTooltipTextMap(translations);
    }
}

// ========== LANGUAGE CHANGE LISTENER ==========

function setupLanguageChangeListener() {
    document.addEventListener('languageChanged', (e) => {
        if (e.detail && e.detail.language && e.detail.language !== currentLanguage) {
            console.log(`Translations Controller: Language changed event detected to ${e.detail.language}`);
            setCurrentLanguage(e.detail.language)
                .then(() => {
                    document.dispatchEvent(new CustomEvent('translationsApplied', {
                        detail: { language: currentLanguage }
                    }));
                });
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === 'app-language' && e.newValue && e.newValue !== currentLanguage) {
            console.log(`Translations Controller: Storage language change detected to ${e.newValue}`);
            setCurrentLanguage(e.newValue)
                .then(() => {
                    document.dispatchEvent(new CustomEvent('translationsApplied', {
                        detail: { language: currentLanguage }
                    }));
                });
        }
    });
}

// ========== PUBLIC FUNCTIONS ==========

function getTranslation(key, category = 'menu') {
    if (!translations || !translations[category]) {
        return key;
    }
    return translations[category][key] || key;
}

function getCurrentLanguage() {
    return currentLanguage;
}

function isSystemReady() {
    return isTranslationSystemReady;
}

function refreshTranslations() {
    if (isTranslationSystemReady) {
        applyTranslations();
    }
}

// ========== SPECIFIC FUNCTIONS FOR NEW CATEGORIES ==========

function getSearchTranslation(key) {
    return getTranslation(key, 'search');
}

function getSearchSectionTranslation(key) {
    return getTranslation(key, 'search_sections');
}

function getColorSystemTranslation(key) {
    return getTranslation(key, 'color_system');
}

// ========== DEBUG FUNCTIONS ==========

function debugTranslationsController() {
    console.group('🌐 Translations Controller Debug');
    console.log('Current language:', currentLanguage);
    console.log('System ready:', isTranslationSystemReady);
    console.log('Available categories:', translations ? Object.keys(translations) : 'None');

    if (translations) {
        Object.keys(translations).forEach(category => {
            console.log(`${category}:`, Object.keys(translations[category]).length, 'translations');
        });
    }

    console.log('Test translations:');
    console.log('- Menu settings:', getTranslation('settings', 'menu'));
    console.log('- Color unavailable:', getTranslation('color_unavailable', 'color_system'));
    console.log('- Search placeholder:', getTranslation('search_placeholder', 'search'));
    console.log('- Harmonies section:', getTranslation('harmonies', 'search_sections'));
    console.log('- Gradient colors section:', getTranslation('gradient_colors', 'color_system'));

    console.groupEnd();
}

// ========== FUNCTIONS FOR EXTERNAL MODULES ==========
window.getTranslation = getTranslation;
window.getCurrentLanguage = getCurrentLanguage;
window.updateDynamicMenuLabels = updateDynamicMenuLabels;
window.getSearchTranslation = getSearchTranslation;
window.getSearchSectionTranslation = getSearchSectionTranslation;
window.getColorSystemTranslation = getColorSystemTranslation;

// ========== EXPORTS ==========

export {
    applyTranslations, debugTranslationsController, getColorSystemTranslation, getCurrentLanguage,
    getSearchSectionTranslation, getSearchTranslation, getTranslation, initTranslationSystem,
    isSystemReady, refreshTranslations, setCurrentLanguage, translateElementTree
};

export {
    translateElementsWithDataTranslate, updateColorSystemHeaders, updateDynamicMenuLabels
};