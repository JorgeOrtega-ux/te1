// ========== general-tools.js - CÓDIGO COMPLETO ACTUALIZADO ==========

import { getTranslation } from '../general/translations-controller.js';
import { showModal } from '../general/modal-controller.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';

const DB_NAME = 'ProjectNocturneDB';
const DB_VERSION = 1;
const AUDIO_STORE_NAME = 'user_audio_store';

let db = null;
let isCachePopulated = false;
let userAudiosCache = [];
let audioCachePromise = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            if (!tempDb.objectStoreNames.contains(AUDIO_STORE_NAME)) {
                tempDb.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('✅ IndexedDB database opened successfully.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('Error opening IndexedDB:', event.target.error);
            reject('Error opening IndexedDB');
        };
    });
}

export function initDB() {
    return openDB();
}

async function saveAudioToDB(id, name, fileBlob) {
    const db = await openDB();
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE_NAME);

    return new Promise((resolve, reject) => {
        const audioRecord = { id, name, file: fileBlob };
        const request = store.put(audioRecord);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error saving audio to DB:', event.target.error);
            reject('Error saving audio');
        };
    });
}

async function getAllAudiosFromDB() {
    const db = await openDB();
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = (event) => {
            console.error('Error getting all audios from DB:', event.target.error);
            reject('Error fetching audios');
        };
    });
}

async function deleteAudioFromDB(id) {
    const db = await openDB();
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
            console.error('Error deleting audio from DB:', event.target.error);
            reject('Error deleting audio');
        };
    });
}

// **MODIFICACIÓN CLAVE**: Esta función ahora gestiona la promesa de carga.
async function populateAudioCache() {
    if (isCachePopulated) return;
    // Si ya hay una promesa de carga en curso, la esperamos.
    if (audioCachePromise) return audioCachePromise;

    // Creamos una nueva promesa para la carga.
    audioCachePromise = (async () => {
        try {
            userAudiosCache = await getAllAudiosFromDB();
            isCachePopulated = true;
            console.log('🔊 Audio cache populated on startup.');
        } catch (error) {
            console.error('Failed to populate audio cache:', error);
            // Asegurarnos de que no reintente infinitamente en caso de error.
            isCachePopulated = false;
        } finally {
            audioCachePromise = null; // Limpiamos la promesa una vez resuelta.
        }
    })();

    return audioCachePromise;
}

// **NUEVA FUNCIÓN EXPORTADA**: Para iniciar la precarga desde init-app.js
export function startAudioCachePreload() {
    // No necesitamos `await` aquí, solo queremos que empiece.
    populateAudioCache();
}


async function saveUserAudio(name, fileBlob) {
    const newAudio = {
        id: `user_audio_${Date.now()}`,
        name: name,
        file: fileBlob,
        icon: 'music_note'
    };
    await saveAudioToDB(newAudio.id, newAudio.name, newAudio.file);
    userAudiosCache.push(newAudio);
    return newAudio;
}

async function deleteUserAudio(audioId, callback) {
    const audioToDelete = userAudiosCache.find(audio => audio.id === audioId);
    if (!audioToDelete) return;

    // AHORA LLAMAMOS A showModal CON EL TIPO 'confirmation'
    showModal('confirmation', { type: 'audio', name: audioToDelete.name }, async () => {
        await deleteAudioFromDB(audioId);
        userAudiosCache = userAudiosCache.filter(audio => audio.id !== audioId);
        replaceDeletedAudioInTools(audioId, 'classic_beep');
        if (typeof callback === 'function') {
            callback();
        }
    });
}


function replaceDeletedAudioInTools(deletedAudioId, defaultSoundId) {
    if (window.alarmManager && typeof window.alarmManager.getAllAlarms === 'function') {
        const { userAlarms, defaultAlarms } = window.alarmManager.getAllAlarms();
        let changed = false;
        [...userAlarms, ...defaultAlarms].forEach(alarm => {
            if (alarm.sound === deletedAudioId) {
                alarm.sound = defaultSoundId;
                changed = true;
            }
        });
        if (changed) {
            window.alarmManager.saveAllAlarms();
            window.alarmManager.renderAllAlarmCards();
        }
    }
    if (window.timerManager && typeof window.timerManager.getAllTimers === 'function') {
        const { userTimers, defaultTimers } = window.timerManager.getAllTimers();
        let changed = false;
        [...userTimers, ...defaultTimers].forEach(timer => {
            if (timer.sound === deletedAudioId) {
                timer.sound = defaultSoundId;
                changed = true;
            }
        });
        if (changed) {
            window.timerManager.saveAllTimers();
            window.timerManager.renderAllTimerCards();
        }
    }
}
const SOUND_PATTERNS = {
    'classic_beep': { frequencies: [800], beepDuration: 150, pauseDuration: 150, type: 'square' },
    'gentle_chime': { frequencies: [523.25, 659.25, 783.99], beepDuration: 300, pauseDuration: 500, type: 'sine' },
    'digital_alarm': { frequencies: [1200, 800], beepDuration: 100, pauseDuration: 100, type: 'square' },
    'peaceful_tone': { frequencies: [440, 554.37, 659.25], beepDuration: 400, pauseDuration: 600, type: 'sine' },
    'urgent_beep': { frequencies: [1600, 1600], beepDuration: 80, pauseDuration: 80, type: 'sawtooth' }
};
export function getAvailableSounds() {
    const defaultSounds = [
        { id: 'classic_beep', nameKey: 'classic_beep', icon: 'volume_up' },
        { id: 'gentle_chime', nameKey: 'gentle_chime', icon: 'notifications' },
        { id: 'digital_alarm', nameKey: 'digital_alarm', icon: 'alarm' },
        { id: 'peaceful_tone', nameKey: 'peaceful_tone', icon: 'self_care' },
        { id: 'urgent_beep', nameKey: 'urgent_beep', icon: 'priority_high' }
    ];
    const customAudios = userAudiosCache.map(audio => ({
        id: audio.id,
        nameKey: audio.name,
        isCustom: true,
        icon: 'music_note',
        file: audio.file
    }));
    return [...defaultSounds, ...customAudios];
}

function getSoundNameById(soundId) {
    const sound = getAvailableSounds().find(s => s.id === soundId);
    if (!sound) {
        return getTranslation('classic_beep', 'sounds');
    }
    return sound.isCustom ? sound.nameKey : getTranslation(sound.nameKey, 'sounds');
}

let audioContext = null;
let activeSoundSource = null;
let isPlayingSound = false;
function initializeAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API is not available:', e);
            return false;
        }
    }
    return true;
}
export async function playSound(soundId) {
    if (isPlayingSound || !initializeAudioContext()) return;
    stopSound();
    isPlayingSound = true;
    const allSounds = getAvailableSounds();
    const soundToPlay = allSounds.find(s => s.id === soundId);

    if (soundToPlay && soundToPlay.isCustom) {
        try {
            const audioURL = URL.createObjectURL(soundToPlay.file);
            const audio = new Audio(audioURL);
            audio.loop = true;
            audio.play();
            activeSoundSource = { type: 'file', element: audio, url: audioURL };
        } catch (error) {
            console.error("Error playing user audio:", error);
            isPlayingSound = false;
        }
        return;
    }
    const pattern = SOUND_PATTERNS[soundId] || SOUND_PATTERNS['classic_beep'];
    let freqIndex = 0;
    const playBeep = () => {
        if (!isPlayingSound) return;
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        const freq = pattern.frequencies[freqIndex % pattern.frequencies.length];
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = pattern.type;
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + (pattern.beepDuration / 1000));
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + (pattern.beepDuration / 1000));
        freqIndex++;
    };
    playBeep();
    const intervalId = setInterval(playBeep, pattern.beepDuration + pattern.pauseDuration);
    activeSoundSource = { intervalId: intervalId, type: 'pattern' };
}
export function stopSound() {
    if (activeSoundSource) {
        if (activeSoundSource.type === 'pattern' && activeSoundSource.intervalId) {
            clearInterval(activeSoundSource.intervalId);
        } else if (activeSoundSource.type === 'file' && activeSoundSource.element) {
            activeSoundSource.element.pause();
            activeSoundSource.element.currentTime = 0;
            URL.revokeObjectURL(activeSoundSource.url);
        }
    }
    activeSoundSource = null;
    isPlayingSound = false;
}

// **MODIFICACIÓN CLAVE**: La función ahora es asíncrona y espera la carga de la caché.
export async function generateSoundList(uploadElement, listElement, actionName, activeSoundId = null) {
    // Esperamos a que la caché esté poblada.
    await populateAudioCache();

    if (!uploadElement || !listElement) {
        console.error('Sound list generation failed: target elements not found.');
        return;
    }

    uploadElement.innerHTML = '';
    listElement.innerHTML = '';

    const getTranslation = window.getTranslation || ((key) => key);

    const uploadListContainer = document.createElement('div');
    uploadListContainer.className = 'menu-list';
    const uploadLink = document.createElement('div');
    uploadLink.className = 'menu-link';
    uploadLink.dataset.action = 'upload-audio';
    uploadLink.innerHTML = `
        <div class="menu-link-icon"><span class="material-symbols-rounded">upload_file</span></div>
        <div class="menu-link-text"><span data-translate="upload_audio" data-translate-category="sounds">${getTranslation('upload_audio', 'sounds')}</span></div>
    `;
    uploadListContainer.appendChild(uploadLink);
    uploadElement.appendChild(uploadListContainer);

    const soundListContainer = document.createElement('div');
    soundListContainer.className = 'menu-list';

    const availableSounds = getAvailableSounds();
    const defaultSounds = availableSounds.filter(s => !s.isCustom);
    const userAudios = availableSounds.filter(s => s.isCustom);

    const defaultSoundsHeader = document.createElement('div');
    defaultSoundsHeader.className = 'menu-content-header-sm';
    defaultSoundsHeader.innerHTML = `<span>${getTranslation('default_audios', 'sounds')}</span>`;
    soundListContainer.appendChild(defaultSoundsHeader);
    defaultSounds.forEach(sound => {
        const menuLink = createSoundMenuItem(sound, actionName, activeSoundId, false);
        soundListContainer.appendChild(menuLink);
    });

    if (userAudios.length > 0) {
        const userAudiosHeader = document.createElement('div');
        userAudiosHeader.className = 'menu-content-header-sm';
        userAudiosHeader.innerHTML = `<span>${getTranslation('uploaded_audios', 'sounds')}</span>`;
        soundListContainer.appendChild(userAudiosHeader);
        userAudios.forEach(sound => {
            const menuLink = createSoundMenuItem(sound, actionName, activeSoundId, true);
            soundListContainer.appendChild(menuLink);
        });
    }

    listElement.appendChild(soundListContainer);
}

function createSoundMenuItem(sound, actionName, activeSoundId, isCustom) {
    const menuLink = document.createElement('div');
    menuLink.className = 'menu-link';
    menuLink.dataset.soundId = sound.id;
    if (sound.id === activeSoundId) {
        menuLink.classList.add('active');
    }

    const soundName = isCustom ? sound.nameKey : getTranslation(sound.nameKey, 'sounds');
    const translationAttrs = isCustom ? '' : `data-translate="${sound.nameKey}" data-translate-category="sounds"`;

    const iconDiv = document.createElement('div');
    iconDiv.className = 'menu-link-icon';
    iconDiv.innerHTML = `<span class="material-symbols-rounded">${sound.icon}</span>`;

    const textDiv = document.createElement('div');
    textDiv.className = 'menu-link-text';
    textDiv.dataset.action = actionName;
    textDiv.innerHTML = `<span ${translationAttrs}>${soundName}</span>`;

    menuLink.appendChild(iconDiv);
    menuLink.appendChild(textDiv);

    if (isCustom) {
        const testButtonContainer = document.createElement('div');
        testButtonContainer.className = 'menu-link-icon';
        
        const testButton = document.createElement('div');
        testButton.className = 'interactive-icon sound-test-btn';
        testButton.dataset.action = 'test-sound';
        testButton.innerHTML = `<span class="material-symbols-rounded">play_arrow</span>`;
        testButtonContainer.appendChild(testButton);

        const deleteButtonContainer = document.createElement('div');
        deleteButtonContainer.className = 'menu-link-icon';

        const deleteButton = document.createElement('div');
        deleteButton.className = 'interactive-icon';
        deleteButton.dataset.action = 'delete-user-audio';
        deleteButton.innerHTML = `<span class="material-symbols-rounded">delete</span>`;
        deleteButtonContainer.appendChild(deleteButton);

        menuLink.appendChild(deleteButtonContainer);
        menuLink.appendChild(testButtonContainer);

    } else {
        menuLink.addEventListener('mouseenter', () => {
            if (menuLink.querySelector('.menu-link-actions-container')) return;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'menu-link-icon menu-link-actions-container';

            const testButton = document.createElement('div');
            testButton.className = 'interactive-icon sound-test-btn';
            testButton.dataset.action = 'test-sound';
            
            const currentlyPlayingId = window.getCurrentlyPlayingSoundId ? window.getCurrentlyPlayingSoundId() : null;
            const isThisSoundPlaying = currentlyPlayingId === sound.id;
            const isAnotherSoundPlaying = currentlyPlayingId !== null && !isThisSoundPlaying;
            
            const iconName = isThisSoundPlaying ? 'stop' : 'play_arrow';
            testButton.innerHTML = `<span class="material-symbols-rounded">${iconName}</span>`;

            // FIX: Deshabilitar el botón si otro sonido ya está sonando
            if (isAnotherSoundPlaying) {
                testButton.classList.add('disabled-interactive');
            }
            
            actionsDiv.appendChild(testButton);
            menuLink.appendChild(actionsDiv);
        });

        menuLink.addEventListener('mouseleave', () => {
            const actionsDiv = menuLink.querySelector('.menu-link-actions-container');
            const currentlyPlayingId = window.getCurrentlyPlayingSoundId ? window.getCurrentlyPlayingSoundId() : null;
            const isThisSoundPlaying = currentlyPlayingId === sound.id;

            if (actionsDiv && !isThisSoundPlaying) {
                actionsDiv.remove();
            }
        });
    }

    return menuLink;
}
export async function handleAudioUpload(callback) {
    await populateAudioCache();
    const uploadLimit = 10;
    const singleFileSizeLimit = 1024 * 1024 * 1024;
    const maxSizeInMB = '1 GB';

    if (userAudiosCache.length >= uploadLimit) {
        const messageKey = 'limit_reached_message_premium';
        showDynamicIslandNotification(
            'system',
            'limit_reached',
            messageKey,
            'notifications',
            { type: getTranslation('audio_singular', 'sounds') }
        );
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            showDynamicIslandNotification('system', 'error', 'invalid_file_type', 'notifications');
            return;
        }

        if (file.size > singleFileSizeLimit) {
            showDynamicIslandNotification('system', 'error', 'file_too_large', 'notifications', { maxSize: maxSizeInMB });
            return;
        }

        try {
            const newAudio = await saveUserAudio(file.name, file);
            if (callback && typeof callback === 'function') {
                callback(newAudio);
            }
        } catch (error) {
            console.error("Error saving audio:", error);
        }
    };
    fileInput.click();
}

export function createExpandableToolContainer({ type, titleKey, translationCategory, icon, containerClass, badgeClass, gridAttribute, toggleFunction }) {
    const container = document.createElement('div');
    container.className = containerClass;
    container.dataset.container = type;

    container.innerHTML = `
        <div class="expandable-card-header">
            <div class="expandable-card-header-left">
                <div class="expandable-card-header-icon">
                    <span class="material-symbols-rounded">${icon}</span>
                </div>
                <div class="expandable-card-header-title">
                    <h3 data-translate="${titleKey}" data-translate-category="${translationCategory}">${getTranslation(titleKey, translationCategory)}</h3>
                </div>
            </div>
            <div class="expandable-card-header-right">
                <span class="${badgeClass}" data-count-for="${type}">0</span>
                <button class="expandable-card-toggle-btn">
                    <span class="material-symbols-rounded expand-icon">expand_more</span>
                </button>
            </div>
        </div>
        <div class="tool-grid" ${gridAttribute}="${type}"></div>
    `;

    const header = container.querySelector('.expandable-card-header');
    if (header) {
        header.addEventListener('click', () => toggleFunction(type));
    }

    return container;
}

export function initializeCategorySliderService() {
    const config = {
        enableService: true,
        enableButtons: true,
        scrollStep: 200,
        containerSelector: '.tool-options-wrapper',
        wrapperSelector: '.section-top',
        pointerOnly: true
    };
    if (!config.enableService) return;
    if (config.pointerOnly && !window.matchMedia('(pointer: fine)').matches) return;
    const wrappers = document.querySelectorAll(config.wrapperSelector);
    if (!wrappers.length) return;
    function createScrollButton(dir, container, wrapper) {
        const btn = document.createElement('button');
        btn.className = `scroll-btn scroll-btn-${dir}`;
        btn.setAttribute('aria-label', `Scroll ${dir}`);
        btn.innerHTML = dir === 'left'
            ? '<span class="material-symbols-rounded">arrow_left</span>'
            : '<span class="material-symbols-rounded">arrow_right</span>';
        btn.addEventListener('click', function handleScrollButtonClick() {
            container.scrollBy({
                left: (dir === 'left' ? -1 : 1) * config.scrollStep,
                behavior: 'smooth'
            });
        });
        return btn;
    }
    function updateScrollButtons(container, wrapper, buttons) {
        if (!config.enableButtons) {
            buttons.left?.remove();
            buttons.right?.remove();
            buttons.left = buttons.right = null;
            return;
        }
        const canScroll = container.scrollWidth > container.clientWidth;
        if (!canScroll) {
            buttons.left?.remove();
            buttons.right?.remove();
            buttons.left = buttons.right = null;
            return;
        }
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const roundedScrollLeft = Math.round(scrollLeft);
        if (roundedScrollLeft > 0) {
            if (!buttons.left) {
                buttons.left = createScrollButton('left', container, wrapper);
                wrapper.append(buttons.left);
            }
        } else {
            buttons.left?.remove();
            buttons.left = null;
        }
        if (roundedScrollLeft + clientWidth < scrollWidth) {
            if (!buttons.right) {
                buttons.right = createScrollButton('right', container, wrapper);
                wrapper.append(buttons.right);
            }
        } else {
            buttons.right?.remove();
            buttons.right = null;
        }
    }
    function setupDragScrollBehavior(container) {
        let isDragging = false, startX = 0, scrollStart = 0;
        function handleMouseDown(e) {
            if (container.scrollWidth <= container.clientWidth) return;
            isDragging = true;
            startX = e.pageX - container.offsetLeft;
            scrollStart = container.scrollLeft;
            container.classList.add('dragging');
        }
        function handleMouseUpOrLeave() {
            isDragging = false;
            container.classList.remove('dragging');
        }
        function handleMouseMove(e) {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            container.scrollLeft = scrollStart - (x - startX);
        }
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mouseup', handleMouseUpOrLeave);
        container.addEventListener('mouseleave', handleMouseUpOrLeave);
        container.addEventListener('mousemove', handleMouseMove);
    }
    function initializeWrappers() {
        wrappers.forEach(function processWrapper(wrapper) {
            const container = wrapper.querySelector(config.containerSelector);
            if (!container) return;
            const buttons = { left: null, right: null };
            setupDragScrollBehavior(container);
            function updateButtonsForThisWrapper() {
                updateScrollButtons(container, wrapper, buttons);
            }
            container.addEventListener('scroll', updateButtonsForThisWrapper);
            new ResizeObserver(function handleResize() {
                updateButtonsForThisWrapper();
            }).observe(container);
            requestAnimationFrame(updateButtonsForThisWrapper);
        });
    }
    function handleWindowResize() {
        wrappers.forEach(function processWrapperOnResize(wrapper) {
            const container = wrapper.querySelector(config.containerSelector);
            if (container) {
                requestAnimationFrame(function updateButtonsOnResize() {
                    const buttons = {
                        left: wrapper.querySelector('.scroll-btn-left'),
                        right: wrapper.querySelector('.scroll-btn-right')
                    };
                    updateScrollButtons(container, wrapper, buttons);
                });
            }
        });
    }
    function handleWindowLoad() {
        requestAnimationFrame(function updateButtonsOnLoad() {
            wrappers.forEach(function processWrapperOnLoad(wrapper) {
                const container = wrapper.querySelector(config.containerSelector);
                if (container) {
                    const buttons = {
                        left: wrapper.querySelector('.scroll-btn-left'),
                        right: wrapper.querySelector('.scroll-btn-right')
                    };
                    updateScrollButtons(container, wrapper, buttons);
                }
            });
        });
    }
    initializeWrappers();
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('load', handleWindowLoad);
}
export function initializeCentralizedFontManager() {
    const sections = ['alarm', 'timer', 'stopwatch', 'worldClock'];
    const clockContainers = {};
    const clockElements = {};
    const decreaseButtons = {};
    const increaseButtons = {};
    const fontSizeDisplays = {};
    let resizeObservers = [];
    let globalScaleFactor = 1.0;
    let isInitialized = false;
    const STORAGE_KEY = 'clockFontScale_global';
    const FONT_SIZE_RATIO = 8;
    const PIXEL_INCREMENT = 2;
    const autoIncrementState = {
        isActive: false,
        intervalId: null,
        direction: null,
        initialDelay: 500,
        repeatInterval: 150,
        currentButton: null,
        currentSection: null
    };
    function initializeFontManager() {
        setupFontManager();
    }
    function setupFontManager() {
        if (isInitialized) return;
        findFontElements();
        const hasElements = Object.keys(clockElements).length > 0;
        if (!hasElements) {
            setTimeout(setupFontManager, 1000);
            return;
        }
        loadFontScalesFromStorage();
        setupFontEventListeners();
        setupFontResizeObservers();
        adjustAndApplyFontSizeToAllSections();
        isInitialized = true;
    }
    function findFontElements() {
        sections.forEach(function processSectionElements(sectionName) {
            const section = document.querySelector(`.section-${sectionName}`);
            if (!section) return;
            const clockContainer = section.querySelector('.tool-content');
            const clockElement = section.querySelector(`.tool-${sectionName} span`);
            const decreaseBtn = section.querySelector('.increse-font-zise-left');
            const increaseBtn = section.querySelector('.increse-font-zise-right');
            const fontSizeDisplay = section.querySelector('.increse-font-zise-center');
            if (clockContainer && clockElement && decreaseBtn && increaseBtn && fontSizeDisplay) {
                clockContainers[sectionName] = clockContainer;
                clockElements[sectionName] = clockElement;
                decreaseButtons[sectionName] = decreaseBtn;
                increaseButtons[sectionName] = increaseBtn;
                fontSizeDisplays[sectionName] = fontSizeDisplay;
            }
        });
    }
    function loadFontScalesFromStorage() {
        const savedScale = localStorage.getItem(STORAGE_KEY);
        if (savedScale && !isNaN(parseFloat(savedScale))) {
            globalScaleFactor = Math.max(0.2, Math.min(3.0, parseFloat(savedScale)));
        } else {
            globalScaleFactor = 1.0;
        }
    }
    function saveFontScaleToStorage() {
        localStorage.setItem(STORAGE_KEY, globalScaleFactor.toString());
    }
    function startAutoIncrement(direction, button, sectionName) {
        stopAutoIncrement();
        autoIncrementState.isActive = true;
        autoIncrementState.direction = direction;
        autoIncrementState.currentButton = button;
        autoIncrementState.currentSection = sectionName;
        button.classList.add('auto-incrementing');
        autoIncrementState.intervalId = setTimeout(function startRepeating() {
            autoIncrementState.intervalId = setInterval(function performAutoIncrement() {
                let success = false;
                if (autoIncrementState.direction === 'increase') {
                    success = increaseFontSizeForSection(autoIncrementState.currentSection);
                } else if (autoIncrementState.direction === 'decrease') {
                    success = decreaseFontSizeForSection(autoIncrementState.currentSection);
                }
                if (!success) {
                    stopAutoIncrement();
                }
            }, autoIncrementState.repeatInterval);
        }, autoIncrementState.initialDelay);
    }
    function stopAutoIncrement() {
        if (autoIncrementState.intervalId) {
            clearTimeout(autoIncrementState.intervalId);
            clearInterval(autoIncrementState.intervalId);
            autoIncrementState.intervalId = null;
        }
        if (autoIncrementState.currentButton) {
            autoIncrementState.currentButton.classList.remove('auto-incrementing');
        }
        autoIncrementState.isActive = false;
        autoIncrementState.direction = null;
        autoIncrementState.currentButton = null;
        autoIncrementState.currentSection = null;
    }
    function setupFontEventListeners() {
        sections.forEach(function setupSectionListeners(sectionName) {
            if (increaseButtons[sectionName]) {
                const increaseBtn = increaseButtons[sectionName];
                increaseBtn.addEventListener('click', function handleIncreaseFontSize(e) {
                    if (!autoIncrementState.isActive) {
                        increaseFontSizeForSection(sectionName);
                    }
                });
                increaseBtn.addEventListener('mousedown', function handleIncreaseMouseDown(e) {
                    e.preventDefault();
                    startAutoIncrement('increase', increaseBtn, sectionName);
                });
                increaseBtn.addEventListener('mouseup', stopAutoIncrement);
                increaseBtn.addEventListener('mouseleave', stopAutoIncrement);
                increaseBtn.addEventListener('touchstart', function handleIncreaseTouchStart(e) {
                    e.preventDefault();
                    startAutoIncrement('increase', increaseBtn, sectionName);
                });
                increaseBtn.addEventListener('touchend', stopAutoIncrement);
                increaseBtn.addEventListener('touchcancel', stopAutoIncrement);
            }
            if (decreaseButtons[sectionName]) {
                const decreaseBtn = decreaseButtons[sectionName];
                decreaseBtn.addEventListener('click', function handleDecreaseFontSize(e) {
                    if (!autoIncrementState.isActive) {
                        decreaseFontSizeForSection(sectionName);
                    }
                });
                decreaseBtn.addEventListener('mousedown', function handleDecreaseMouseDown(e) {
                    e.preventDefault();
                    startAutoIncrement('decrease', decreaseBtn, sectionName);
                });
                decreaseBtn.addEventListener('mouseup', stopAutoIncrement);
                decreaseBtn.addEventListener('mouseleave', stopAutoIncrement);
                decreaseBtn.addEventListener('touchstart', function handleDecreaseTouchStart(e) {
                    e.preventDefault();
                    startAutoIncrement('decrease', decreaseBtn, sectionName);
                });
                decreaseBtn.addEventListener('touchend', stopAutoIncrement);
                decreaseBtn.addEventListener('touchcancel', stopAutoIncrement);
            }
        });
        document.addEventListener('mouseup', function handleGlobalMouseUp() {
            if (autoIncrementState.isActive) {
                stopAutoIncrement();
            }
        });
        window.addEventListener('blur', function handleWindowBlur() {
            if (autoIncrementState.isActive) {
                stopAutoIncrement();
            }
        });
    }
    function setupFontResizeObservers() {
        sections.forEach(function setupSectionObserver(sectionName) {
            if (clockContainers[sectionName]) {
                const observer = new ResizeObserver(function handleContainerResize() {
                    adjustAndApplyFontSizeToSection(sectionName);
                });
                observer.observe(clockContainers[sectionName]);
                resizeObservers.push(observer);
            }
        });
    }
    function roundToEvenNumber(number) {
        const rounded = Math.round(number);
        return rounded % 2 === 0 ? rounded : rounded + 1;
    }
    function calculateBaseFontSize(containerWidth) {
        const baseSize = containerWidth / FONT_SIZE_RATIO;
        return roundToEvenNumber(baseSize);
    }
    function getCurrentActualFontSize(sectionName) {
        if (!sectionName || !clockContainers[sectionName]) {
            return 0;
        }
        const baseSize = calculateBaseFontSize(clockContainers[sectionName].offsetWidth);
        const calculatedSize = baseSize * globalScaleFactor;
        return roundToEvenNumber(calculatedSize);
    }
    function checkIfWouldOverflowWithPixelSize(sectionName, targetPixelSize) {
        const container = clockContainers[sectionName];
        const element = clockElements[sectionName];
        if (!container || !element) return true;
        const currentSize = element.style.fontSize;
        element.style.fontSize = targetPixelSize + 'px';
        const overflows = element.scrollWidth > container.offsetWidth;
        element.style.fontSize = currentSize;
        return overflows;
    }
    function adjustAndApplyFontSizeToSection(sectionName) {
        const container = clockContainers[sectionName];
        const element = clockElements[sectionName];
        const display = fontSizeDisplays[sectionName];
        if (!container || !element || !display) return;
        const baseSize = calculateBaseFontSize(container.offsetWidth);
        const calculatedSize = baseSize * globalScaleFactor;
        const finalSize = roundToEvenNumber(calculatedSize);
        element.style.fontSize = finalSize + 'px';
        display.textContent = finalSize + ' px';
        updateFontButtonStatesForSection(sectionName);
    }
    function adjustAndApplyFontSizeToAllSections() {
        sections.forEach(function adjustEachSection(sectionName) {
            if (clockContainers[sectionName]) {
                adjustAndApplyFontSizeToSection(sectionName);
            }
        });
    }
    function updateFontButtonStatesForSection(sectionName) {
        const currentSize = getCurrentActualFontSize(sectionName);
        const canDecrease = currentSize > 8;
        const canIncrease = !checkIfWouldOverflowWithPixelSize(sectionName, currentSize + PIXEL_INCREMENT);
        const decreaseBtn = decreaseButtons[sectionName];
        const increaseBtn = increaseButtons[sectionName];
        if (decreaseBtn) {
            if (canDecrease) {
                decreaseBtn.classList.remove('disabled-interactive');
            } else {
                decreaseBtn.classList.add('disabled-interactive');
            }
        }
        if (increaseBtn) {
            if (canIncrease) {
                increaseBtn.classList.remove('disabled-interactive');
            } else {
                increaseBtn.classList.add('disabled-interactive');
            }
        }
    }
    function increaseFontSizeForSection(sectionName) {
        const currentSize = getCurrentActualFontSize(sectionName);
        const targetSize = currentSize + PIXEL_INCREMENT;
        const wouldOverflow = sections.some(function (section) {
            return clockContainers[section] &&
                checkIfWouldOverflowWithPixelSize(section, targetSize);
        });
        if (!wouldOverflow) {
            const container = clockContainers[sectionName];
            if (container) {
                const baseSize = calculateBaseFontSize(container.offsetWidth);
                globalScaleFactor = targetSize / baseSize;
                adjustAndApplyFontSizeToAllSections();
                saveFontScaleToStorage();
                return true;
            }
        }
        return false;
    }
    function decreaseFontSizeForSection(sectionName) {
        const currentSize = getCurrentActualFontSize(sectionName);
        const targetSize = Math.max(8, currentSize - PIXEL_INCREMENT);
        if (targetSize >= 8) {
            const container = clockContainers[sectionName];
            if (container) {
                const baseSize = calculateBaseFontSize(container.offsetWidth);
                globalScaleFactor = targetSize / baseSize;
                adjustAndApplyFontSizeToAllSections();
                saveFontScaleToStorage();
                return true;
            }
        }
        return false;
    }
    function increaseFontSize() {
        const firstSection = Object.keys(clockElements)[0];
        if (firstSection) {
            return increaseFontSizeForSection(firstSection);
        }
        return false;
    }
    function decreaseFontSize() {
        const firstSection = Object.keys(clockElements)[0];
        if (firstSection) {
            return decreaseFontSizeForSection(firstSection);
        }
        return false;
    }
    function setFontScaleForSection(sectionName, scale) {
        if (typeof scale !== 'number' || scale < 0.2) return false;
        const wouldOverflow = sections.some(function (section) {
            const container = clockContainers[section];
            if (!container) return false;
            const baseSize = calculateBaseFontSize(container.offsetWidth);
            const testSize = roundToEvenNumber(baseSize * scale);
            return checkIfWouldOverflowWithPixelSize(section, testSize);
        });
        if (!wouldOverflow) {
            globalScaleFactor = scale;
            adjustAndApplyFontSizeToAllSections();
            saveFontScaleToStorage();
            return true;
        }
        return false;
    }
    function resetFontSizeForAllSections() {
        globalScaleFactor = 1.0;
        adjustAndApplyFontSizeToAllSections();
        saveFontScaleToStorage();
    }
    function getCurrentFontScale() {
        return globalScaleFactor;
    }
    function getCurrentActualFontSizePublic(sectionName) {
        if (!sectionName) {
            const firstSection = Object.keys(clockElements)[0];
            if (firstSection) {
                return getCurrentActualFontSize(firstSection);
            }
            return 0;
        }
        return getCurrentActualFontSize(sectionName);
    }
    function getFontManagerStatus() {
        return {
            initialized: isInitialized,
            globalScaleFactor: globalScaleFactor,
            pixelIncrement: PIXEL_INCREMENT,
            autoIncrement: {
                isActive: autoIncrementState.isActive,
                direction: autoIncrementState.direction,
                currentSection: autoIncrementState.currentSection,
                initialDelay: autoIncrementState.initialDelay,
                repeatInterval: autoIncrementState.repeatInterval
            },
            elements: {
                containers: Object.keys(clockContainers),
                elements: Object.keys(clockElements),
                decreaseButtons: Object.keys(decreaseButtons),
                increaseButtons: Object.keys(increaseButtons),
                displays: Object.keys(fontSizeDisplays)
            },
            observers: resizeObservers.length
        };
    }
    function destroyFontManager() {
        stopAutoIncrement();
        resizeObservers.forEach(function disconnectObserver(observer) {
            observer.disconnect();
        });
        resizeObservers = [];
        isInitialized = false;
    }
    const publicFontAPI = {
        increaseFontSizeForSection: increaseFontSizeForSection,
        decreaseFontSizeForSection: decreaseFontSizeForSection,
        setFontScaleForSection: setFontScaleForSection,
        resetFontSizeForAllSections: resetFontSizeForAllSections,
        getCurrentFontScaleForSection: getCurrentFontScale,
        getCurrentActualSizeForSection: getCurrentActualFontSizePublic,
        increaseFontSize: increaseFontSize,
        decreaseFontSize: decreaseFontSize,
        resetFontSize: resetFontSizeForAllSections,
        getCurrentScale: getCurrentFontScale,
        getCurrentActualSize: getCurrentActualFontSizePublic,
        adjustAndApplyFontSizeToAll: adjustAndApplyFontSizeToAllSections,
        adjustAndApplyFontSizeToSection: adjustAndApplyFontSizeToSection,
        updateAllButtonStates: function () {
            sections.forEach(function updateSection(sectionName) {
                if (clockContainers[sectionName]) {
                    updateFontButtonStatesForSection(sectionName);
                }
            });
        },
        startAutoIncrement: startAutoIncrement,
        stopAutoIncrement: stopAutoIncrement,
        setAutoIncrementSettings: function (initialDelay, repeatInterval) {
            if (typeof initialDelay === 'number' && initialDelay > 0) {
                autoIncrementState.initialDelay = initialDelay;
            }
            if (typeof repeatInterval === 'number' && repeatInterval > 0) {
                autoIncrementState.repeatInterval = repeatInterval;
            }
        },
        getStatus: getFontManagerStatus,
        destroy: destroyFontManager,
        debugInfo: function () {
            console.group('🔤 Font Manager Debug');
            console.log('Status:', getFontManagerStatus());
            console.log('Available sections:', sections);
            console.log('Found containers:', Object.keys(clockContainers));
            console.log('Found elements:', Object.keys(clockElements));
            console.groupEnd();
        }
    };
    window.centralizedFontManager = publicFontAPI;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicFontAPI;
    }
    initializeFontManager();
}
export function initializeTextStyleManager() {
    const textStyleState = {
        isBold: false,
        isItalic: false,
        sections: ['alarm', 'timer', 'stopwatch', 'worldClock'],
        boldButtonSelector: '[data-action="toggleBoldMode"]',
        italicButtonSelector: '[data-action="toggleItalicMode"]',
        toolDivSelectors: {
            'alarm': '.tool-alarm',
            'timer': '.tool-timer',
            'stopwatch': '.tool-stopwatch',
            'worldClock': '.tool-worldClock'
        },
        localStorageKeys: {
            bold: 'textStyle_isBold',
            italic: 'textStyle_isItalic'
        },
        isInitialized: false,
        _attachedListeners: new WeakSet()
    };
    if (textStyleState.isInitialized) return;
    loadTextStylesFromStorage();
    attachTextStyleEventListeners();
    applyTextStylesToAllSections();
    updateTextButtonStates();
    document.addEventListener('sectionChanged', handleSectionChangeForTextStyles);
    const observer = new MutationObserver((mutationsList) => {
        let relevantChange = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && (
                mutation.addedNodes.length > 0 &&
                Array.from(mutation.addedNodes).some(node => node.nodeType === Node.ELEMENT_NODE && (
                    node.matches(textStyleState.boldButtonSelector) ||
                    node.matches(textStyleState.italicButtonSelector) ||
                    node.matches('.section-alarm') || node.matches('.section-timer') ||
                    node.matches('.section-stopwatch') || node.matches('.section-worldClock') ||
                    node.querySelector(textStyleState.boldButtonSelector) ||
                    node.querySelector(textStyleState.italicButtonSelector) ||
                    node.querySelector('.section-alarm') || node.querySelector('.section-timer') ||
                    node.querySelector('.section-stopwatch') || node.querySelector('.section-worldClock')
                ))
            )) {
                relevantChange = true;
                break;
            }
        }
        if (relevantChange) {
            clearTimeout(textStyleState._refreshTimeout);
            textStyleState._refreshTimeout = setTimeout(() => {
                attachTextStyleEventListeners();
                applyTextStylesToAllSections();
                updateTextButtonStates();
            }, 50);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    textStyleState.isInitialized = true;
    function loadTextStylesFromStorage() {
        textStyleState.isBold = localStorage.getItem(textStyleState.localStorageKeys.bold) === 'true';
        textStyleState.isItalic = localStorage.getItem(textStyleState.localStorageKeys.italic) === 'true';
    }
    function saveTextStylesToStorage() {
        localStorage.setItem(textStyleState.localStorageKeys.bold, textStyleState.isBold);
        localStorage.setItem(textStyleState.localStorageKeys.italic, textStyleState.isItalic);
    }
    function attachTextStyleEventListeners() {
        const boldButtons = document.querySelectorAll(textStyleState.boldButtonSelector);
        const italicButtons = document.querySelectorAll(textStyleState.italicButtonSelector);
        boldButtons.forEach(button => {
            if (!textStyleState._attachedListeners.has(button)) {
                button.addEventListener('click', toggleBoldMode);
                textStyleState._attachedListeners.add(button);
            }
        });
        italicButtons.forEach(button => {
            if (!textStyleState._attachedListeners.has(button)) {
                button.addEventListener('click', toggleItalicMode);
                textStyleState._attachedListeners.add(button);
            }
        });
    }
    function handleSectionChangeForTextStyles() {
        applyTextStylesToAllSections();
        updateTextButtonStates();
    }
    function toggleBoldMode(event) {
        event.preventDefault();
        textStyleState.isBold = !textStyleState.isBold;
        applyTextStylesToAllSections();
        updateTextButtonStates();
        saveTextStylesToStorage();
        dispatchTextStyleChangeEvent();
        console.log('Bold mode toggled:', textStyleState.isBold);
    }
    function toggleItalicMode(event) {
        event.preventDefault();
        textStyleState.isItalic = !textStyleState.isItalic;
        applyTextStylesToAllSections();
        updateTextButtonStates();
        saveTextStylesToStorage();
        dispatchTextStyleChangeEvent();
        console.log('Italic mode toggled:', textStyleState.isItalic);
    }
    function applyTextStylesToAllSections() {
        textStyleState.sections.forEach(sectionName => {
            const toolDiv = document.querySelector(textStyleState.toolDivSelectors[sectionName]);
            if (toolDiv) {
                if (textStyleState.isBold) {
                    toolDiv.classList.add('bold-mode');
                } else {
                    toolDiv.classList.remove('bold-mode');
                }
                if (textStyleState.isItalic) {
                    toolDiv.classList.add('italic-mode');
                } else {
                    toolDiv.classList.remove('italic-mode');
                }
            }
        });
    }
    function updateTextButtonStates() {
        const boldButtons = document.querySelectorAll(textStyleState.boldButtonSelector);
        const italicButtons = document.querySelectorAll(textStyleState.italicButtonSelector);
        boldButtons.forEach(button => {
            if (textStyleState.isBold) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        italicButtons.forEach(button => {
            if (textStyleState.isItalic) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    function dispatchTextStyleChangeEvent() {
        const event = new CustomEvent('textStyleChanged', {
            detail: {
                isBold: textStyleState.isBold,
                isItalic: textStyleState.isItalic
            }
        });
        document.dispatchEvent(event);
    }
}
export function initializeScrollShadow() {
    const menus = document.querySelectorAll('[data-menu]');
    const generalContent = document.querySelector('.general-content');

    const setupScrollShadow = (topContainer, scrollableContainer) => {
        if (topContainer && scrollableContainer) {
            const handleScroll = () => {
                if (scrollableContainer.scrollTop > 0) {
                    topContainer.classList.add('shadow');
                } else {
                    topContainer.classList.remove('shadow');
                }
            };
            scrollableContainer.removeEventListener('scroll', handleScroll);
            scrollableContainer.addEventListener('scroll', handleScroll);
        }
    };

    menus.forEach(menu => {
        const topContainer = menu.querySelector('.menu-section-top, .menu-header');
        const scrollableContainer = menu.querySelector('.overflow-y');
        setupScrollShadow(topContainer, scrollableContainer);
    });

    if (generalContent) {
        const topContainer = generalContent.querySelector('.general-content-top');
        const scrollableContainer = generalContent.querySelector('.scrollable-content');
        setupScrollShadow(topContainer, scrollableContainer);
    }
}
export function initializeFullScreenManager() {
    if (!document.documentElement.requestFullscreen) {
        console.warn('Fullscreen API is not supported in this browser.');
        document.querySelectorAll('[data-action="toggleFullScreen"]').forEach(button => {
            button.style.display = 'none';
        });
        return;
    }
    document.addEventListener('click', function (event) {
        const fullScreenButton = event.target.closest('[data-action="toggleFullScreen"]');
        if (!fullScreenButton) return;
        event.preventDefault();
        const section = fullScreenButton.closest('.section-alarm, .section-timer, .section-stopwatch, .section-worldClock');
        if (!section) {
            console.error('Fullscreen button is not inside a recognized section.');
            return;
        }
        const sectionCenter = section.querySelector('.section-center');
        if (!sectionCenter) {
            console.error('.section-center not found within the section.');
            return;
        }
        toggleFullScreen(sectionCenter);
    });
    function toggleFullScreen(element) {
        if (!document.fullscreenElement) {
            element.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    document.addEventListener('fullscreenchange', () => {
        const fullscreenElement = document.fullscreenElement;
        const isInFullScreen = !!fullscreenElement;
        console.log('Fullscreen mode toggled:', isInFullScreen);
        const allButtons = document.querySelectorAll('[data-action="toggleFullScreen"]');
        allButtons.forEach(button => {
            const icon = button.querySelector('.material-symbols-rounded');
            if (!icon) return;
            const section = button.closest('.section-alarm, .section-timer, .section-stopwatch, .section-worldClock');
            const sectionCenter = section ? section.querySelector('.section-center') : null;
            if (fullscreenElement && sectionCenter === fullscreenElement) {
                icon.textContent = 'fullscreen_exit';
            } else {
                icon.textContent = 'fullscreen';
            }
        });
    });
}
export function initializeSortable(gridSelector, options) {
    const grid = document.querySelector(gridSelector);
    if (grid && typeof Sortable !== 'undefined') {
        new Sortable(grid, options);
    } else if (typeof Sortable === 'undefined') {
        console.warn('SortableJS not available. Drag-and-drop functionality will be disabled.');
    }
}
export function initializeCardEventListeners() {
    const mainContainer = document.querySelector('.general-content-scrolleable');
    if (!mainContainer) {
        console.error("Main container for card events not found!");
        return;
    }

    mainContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.tool-card');
        if (!card) {
            document.querySelectorAll('.card-dropdown-menu').forEach(m => m.classList.add('disabled'));
            return;
        }

        const cardId = card.dataset.id;
        const actionTarget = e.target.closest('[data-action]');

        if (e.target.closest('.card-menu-btn')) {
            e.stopPropagation();
            const dropdown = card.querySelector('.card-dropdown-menu');
            if (dropdown) {
                const isOpening = dropdown.classList.contains('disabled');
                document.querySelectorAll('.card-dropdown-menu').forEach(m => {
                    if (m !== dropdown) {
                        m.classList.add('disabled');
                    }
                });
                if (isOpening) {
                    dropdown.classList.remove('disabled');
                } else {
                    dropdown.classList.add('disabled');
                }
            }
            return;
        }

        if (!actionTarget) return;

        const action = actionTarget.dataset.action;

        if (card.classList.contains('alarm-card')) {
            handleAlarmCardAction(action, cardId, actionTarget);
        } else if (card.classList.contains('timer-card')) {
            handleTimerCardAction(action, cardId, actionTarget);
        } else if (card.classList.contains('world-clock-card')) {
            handleWorldClockCardAction(action, cardId, actionTarget);
        }
    });
}

export function handleAlarmCardAction(action, alarmId, target) {
    if (!window.alarmManager) {
        console.error("Alarm manager no está disponible.");
        return;
    }

    const alarm = window.alarmManager.findAlarmById(alarmId);
    if (alarm && alarm.isRinging && action !== 'dismiss-alarm') {
        console.warn(`Action "${action}" blocked for ringing alarm: ${alarmId}`);
        return;
    }

    switch (action) {
        case 'toggle-alarm':
            window.alarmManager.toggleAlarm(alarmId);
            break;
        case 'test-alarm':
            window.alarmManager.testAlarm(alarmId);
            break;
        case 'edit-alarm':
            window.alarmManager.handleEditAlarm(alarmId);
            break;
        case 'delete-alarm':
            window.alarmManager.handleDeleteAlarm(alarmId);
            break;
        case 'dismiss-alarm':
            window.alarmManager.dismissAlarm(alarmId);
            break;
    }
}

export function handleTimerCardAction(action, timerId, target) {
    if (!window.timerManager) {
        console.error("Timer manager no está disponible.");
        return;
    }

    const timer = window.timerManager.findTimerById(timerId);
    if (timer && timer.isRinging && action !== 'dismiss-timer') {
        console.warn(`Action "${action}" blocked for ringing timer: ${timerId}`);
        return;
    }

    switch (action) {
        case 'pin-timer':
            window.timerManager.handlePinTimer(timerId);
            break;
        case 'start-card-timer':
            window.timerManager.startTimer(timerId);
            break;
        case 'pause-card-timer':
            window.timerManager.pauseTimer(timerId);
            break;
        case 'reset-card-timer':
            window.timerManager.resetTimer(timerId);
            break;
        case 'edit-timer':
            window.timerManager.handleEditTimer(timerId);
            break;
        case 'delete-timer':
            window.timerManager.handleDeleteTimer(timerId);
            break;
        case 'dismiss-timer':
            window.timerManager.dismissTimer(timerId);
            break;
    }
}

export function handleWorldClockCardAction(action, clockId, target) {
    if (!window.worldClockManager) {
        console.error("WorldClock manager no está disponible.");
        return;
    }

    switch (action) {
        case 'pin-clock':
            window.worldClockManager.pinClock(target);
            break;
        case 'edit-clock':
            window.worldClockManager.handleEditClock(clockId);
            console.log("se activo el modoo editar reloj");
            break;
        case 'delete-clock':
            window.worldClockManager.deleteClock(clockId);
            break;
    }
}

export { deleteUserAudio, getSoundNameById };