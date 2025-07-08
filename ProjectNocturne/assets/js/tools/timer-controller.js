// timer-controller.js - CÓDIGO COMPLETO CON LÓGICA UNIFICADA Y CONSISTENTE
import { getTranslation } from '../general/translations-controller.js';
import { activateModule, getCurrentActiveOverlay, allowCardMovement } from '../general/main.js';
import { prepareTimerForEdit, prepareCountToDateForEdit } from '../general/menu-interactions.js';
import { playSound, stopSound, initializeSortable, getAvailableSounds, handleTimerCardAction, getSoundNameById, createExpandableToolContainer } from './general-tools.js';
import { showDynamicIslandNotification, hideDynamicIsland } from '../general/dynamic-island-controller.js';
import { updateEverythingWidgets } from './everything-controller.js';
import { showConfirmation } from '../general/confirmation-modal-controller.js';

const TIMERS_STORAGE_KEY = 'user-timers';
const DEFAULT_TIMERS_STORAGE_KEY = 'default-timers-order';
const LAST_VISIT_KEY = 'last-timer-visit-timestamp';
let userTimers = [];
let defaultTimersState = [];
let activeTimers = new Map();
let pinnedTimerId = null;

const DEFAULT_TIMERS = [
    { id: 'default-timer-2', title: 'short_break_5', type: 'countdown', initialDuration: 300000, remaining: 300000, sound: 'peaceful_tone', isRunning: false, isPinned: false },
    { id: 'default-timer-4', title: 'exercise_30', type: 'countdown', initialDuration: 1800000, remaining: 1800000, sound: 'digital_alarm', isRunning: false, isPinned: false },
    { id: 'default-timer-5', title: 'study_session_45', type: 'countdown', initialDuration: 2700000, remaining: 2700000, sound: 'gentle_chime', isRunning: false, isPinned: false }
];

// ========== FUNCIONES AUXILIARES CENTRALIZADAS ==========

function dispatchTimerStateChange() {
    document.dispatchEvent(new CustomEvent('timerStateChanged'));
}

function formatTimeSince(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const minute = 60, hour = 3600, day = 86400, year = 31536000;

    if (seconds < minute) return `${seconds} ${getTranslation('seconds', 'timer')}`;
    if (seconds < hour) return `${Math.floor(seconds / minute)} ${getTranslation('minutes', 'timer')}`;
    if (seconds < day) return `${Math.floor(seconds / hour)} ${getTranslation('hours', 'timer')}`;
    if (seconds < year) return `${Math.floor(seconds / day)} ${getTranslation('days', 'timer')}`;

    return `${Math.floor(seconds / year)} ${getTranslation('years', 'timer')}`;
}

function clearRangAtTag(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || !timer.rangAt) return;

    console.log(`🧹 Limpiando tag "sonó hace..." del timer ${timerId}`);
    delete timer.rangAt;
    
    const isUserTimer = userTimers.some(t => t.id === timerId);
    if (isUserTimer) {
        saveTimersToStorage();
    } else {
        saveDefaultTimersOrder();
    }

    updateTimerCardVisuals(timer);
    refreshSearchResults();
}

function shouldShowRangAtTag(timer) {
    // Solo mostrar si tiene rangAt, no está corriendo y no está sonando
    return timer.rangAt && !timer.isRunning && !timer.isRinging;
}

function getTimerControlsState(timer) {
    const isRinging = !!timer.isRinging;
    const isRunning = !!timer.isRunning;
    const hasRangAt = !!timer.rangAt;
    const isCountdown = timer.type === 'countdown';
    
    if (!isCountdown) {
        // Count-to-date: solo edit/delete
        return {
            startDisabled: true,
            pauseDisabled: true,
            resetDisabled: true,
            editDisabled: isRinging || isRunning,
            deleteDisabled: isRinging || isRunning,
            showPlayPause: false,
            showReset: false,
            isRinging,
            isRunning,
            hasRangAt
        };
    }

    // Countdown logic
    const canStart = timer.remaining > 0 || hasRangAt;
    
    // ========== LÓGICA CORREGIDA PARA RESET ==========
    // Reset DESHABILITADO si:
    // 1. Está corriendo o sonando
    // 2. Ya está en tiempo original SIN rangAt (estado "limpio")
    // 3. Timer restaurado (remaining == initialDuration Y tiene rangAt) ✅ ESTO ES LO CLAVE
    const isAtOriginalStateClean = timer.remaining >= timer.initialDuration && !hasRangAt;
    const isRestoredWithTag = timer.remaining >= timer.initialDuration && hasRangAt;
    const resetDisabled = isRinging || isRunning || isAtOriginalStateClean || isRestoredWithTag;
    
    return {
        // Start: Habilitado si hay tiempo restante O si sonó antes (rangAt)
        startDisabled: isRinging || isRunning || !canStart,
        
        // Pause: Habilitado solo si está corriendo y no sonando
        pauseDisabled: isRinging || !isRunning,
        
        // Reset: Deshabilitado en casos específicos (incluyendo timers restaurados)
        resetDisabled,
        
        // Edit/Delete: Deshabilitado si está corriendo o sonando
        editDisabled: isRinging || isRunning,
        deleteDisabled: isRinging || isRunning,
        
        // UI helpers
        showPlayPause: true,
        showReset: true,
        playPauseAction: isRunning ? 'pause-card-timer' : 'start-card-timer',
        playPauseIcon: isRunning ? 'pause' : 'play_arrow',
        playPauseTextKey: isRunning ? 'pause' : 'play',
        
        // Estados adicionales
        isRinging,
        isRunning,
        hasRangAt
    };
}

// ========== RESTAURACIÓN INTELIGENTE AL CARGAR ==========

// ========== RESTAURACIÓN INTELIGENTE AL CARGAR - CORREGIDA ==========

function loadAndRestoreTimers() {
    console.log('🔄 Iniciando carga y restauración de timers...');
    
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const lastVisitTime = lastVisit ? parseInt(lastVisit, 10) : null;
    
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

    console.log(`⏰ Procesando ${allTimers.length} timers para restauración...`);

    // ========== RESTAURACIÓN INTELIGENTE MEJORADA ==========
    if (lastVisitTime) {
        allTimers.forEach(timer => {
            if (timer.type === 'countdown') {
                if (timer.isRinging) {
                    // ========== TIMER ESTABA SONANDO AL CERRAR WEB ==========
                    console.log(`🔧 RESTAURACIÓN: Timer ${timer.id} estaba sonando cuando se cerró la web`);
                    
                    // ===== ESTRATEGIA MEJORADA PARA CALCULAR CUÁNDO SONÓ =====
                    let whenItRang = now; // fallback final
                    
                    if (timer.targetTime) {
                        // Caso 1: Tenemos targetTime (momento exacto cuando debía terminar)
                        whenItRang = timer.targetTime;
                        console.log(`   - Usando targetTime: ${new Date(timer.targetTime).toLocaleString()}`);
                    } else if (timer.lastTriggered) {
                        // Caso 2: Tenemos lastTriggered (cuando se activó la alarma de sonido)
                        whenItRang = timer.lastTriggered;
                        console.log(`   - Usando lastTriggered: ${new Date(timer.lastTriggered).toLocaleString()}`);
                    } else {
                        // ========== CASO 3: CALCULARLO BASÁNDOSE EN LA DURACIÓN DEL TIMER ==========
                        // Esta es la estrategia clave que faltaba para los timers
                        console.log(`   - Calculando basándose en duración del timer`);
                        console.log(`   - Timer initialDuration: ${timer.initialDuration}ms`);
                        console.log(`   - Timer remaining en estado guardado: ${timer.remaining}ms`);
                        
                        // Si el timer estaba sonando, significa que remaining debería ser 0
                        // y targetTime debería ser aproximadamente el momento cuando sonó
                        
                        // Estrategia: Si no tenemos targetTime ni lastTriggered,
                        // asumimos que sonó hace poco tiempo antes de cerrar la web
                        const timeSinceLastVisit = now - lastVisitTime;
                        
                        if (timeSinceLastVisit < 60000) { // Menos de 1 minuto
                            // Sonó poco antes de cerrar la web
                            whenItRang = lastVisitTime - 2000; // 2 segundos antes del cierre
                        } else {
                            // Sonó hace más tiempo, calculamos mejor
                            // Si remaining era 0 cuando se guardó, entonces sonó cuando remaining llegó a 0
                            whenItRang = now - Math.min(timeSinceLastVisit / 2, 300000); // Máximo 5 minutos atrás
                        }
                        
                        console.log(`   - Tiempo calculado de sonido: ${new Date(whenItRang).toLocaleString()}`);
                    }
                    
                    timer.rangAt = whenItRang;
                    timer.remaining = timer.initialDuration;
                    timer.isRunning = false;
                    timer.isRinging = false;
                    delete timer.targetTime;
                    delete timer.lastTriggered; // Limpiar para evitar confusión futura
                    
                    console.log(`   ✅ Timer restaurado con tag offline: rangAt=${new Date(timer.rangAt).toLocaleString()}`);
                    
                } else if (timer.isRunning && timer.targetTime) {
                    const timeWhenFinished = timer.targetTime;
                    
                    if (now >= timeWhenFinished) {
                        // ========== TIMER TERMINÓ MIENTRAS WEB ESTABA CERRADA ==========
                        console.log(`🔧 RESTAURACIÓN: Timer ${timer.id} terminó mientras la web estaba cerrada`);
                        
                        // ===== AQUÍ ESTÁ LA CORRECCIÓN CLAVE =====
                        // Usar targetTime directamente como el momento exacto cuando sonó
                        timer.rangAt = timeWhenFinished; // ¡Momento exacto cuando terminó!
                        timer.remaining = timer.initialDuration;
                        timer.isRunning = false;
                        timer.isRinging = false;
                        delete timer.targetTime;
                        delete timer.lastTriggered;
                        
                        console.log(`   ✅ Timer restaurado con tag offline: rangAt=${new Date(timer.rangAt).toLocaleString()}`);
                        console.log(`   ⏰ Tiempo transcurrido desde que sonó: ${formatTimeSince(timer.rangAt)}`);
                        
                    } else {
                        // Timer aún corriendo normalmente - asegurar que remaining no sea negativo
                        const rawRemaining = timeWhenFinished - now;
                        timer.remaining = Math.max(0, rawRemaining);
                        startCountdownTimer(timer);
                        updateTimerCardControls(timer.id);
                    }
                } else if (timer.remaining <= 0 && !timer.rangAt) {
                    // ========== TIMER EN 00:00:00 SIN CONTEXTO ==========
                    console.log(`🔧 RESTAURACIÓN: Timer ${timer.id} estaba en 00:00:00 - calculando cuándo sonó`);
                    
                    // ===== CÁLCULO MÁS PRECISO PARA TIMERS EN 00:00:00 =====
                    timer.remaining = timer.initialDuration;
                    timer.isRunning = false;
                    timer.isRinging = false;
                    delete timer.targetTime;
                    delete timer.lastTriggered;
                    
                    // Si el timer está en 00:00:00, probablemente sonó antes de cerrar la web
                    if (lastVisitTime) {
                        const timeSinceLastVisit = now - lastVisitTime;
                        
                        if (timeSinceLastVisit < 300000) { // Menos de 5 minutos
                            // Sonó poco antes de cerrar la web
                            timer.rangAt = lastVisitTime - 10000; // 10 segundos antes del cierre
                        } else {
                            // Sonó hace más tiempo
                            timer.rangAt = now - Math.min(timeSinceLastVisit * 0.8, 1800000); // Máximo 30 minutos atrás
                        }
                    } else {
                        timer.rangAt = now - (60 * 1000); // Hace 1 minuto por defecto
                    }
                    
                    console.log(`   ✅ Timer restaurado con tag offline estimado: rangAt=${new Date(timer.rangAt).toLocaleString()}`);
                }
            } else if (timer.type === 'count_to_date' && timer.isRunning) {
                const rawRemaining = new Date(timer.targetDate).getTime() - now;
                timer.remaining = Math.max(0, rawRemaining);
                if (timer.remaining <= 0) {
                    timer.remaining = 0;
                    timer.isRunning = false;
                    timer.rangAt = new Date(timer.targetDate).getTime();
                } else {
                    startCountToDateTimer(timer);
                }
            }
        });
    }

    // Configurar timer fijado
    let pinnedTimer = allTimers.find(t => t.isPinned);
    if (!pinnedTimer && allTimers.length > 0) {
        pinnedTimer = allTimers[0];
        if (pinnedTimer) pinnedTimer.isPinned = true;
    }
    pinnedTimerId = pinnedTimer ? pinnedTimer.id : null;
    allTimers.forEach(t => t.isPinned = (t.id === pinnedTimerId));

    saveAllTimersState();
    updateMainControlsState();
    
    console.log('✅ Carga y restauración de timers completada');
}

// ========== FUNCIONES PRINCIPALES ==========

function startTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || timer.isRunning || (timer.remaining <= 0 && !timer.rangAt)) return;

    console.log(`▶️ Iniciando timer ${timerId}`);

    handlePinTimer(timerId);
    clearRangAtTag(timerId);

    timer.isRunning = true;

    if (timer.type === 'countdown') {
        timer.targetTime = Date.now() + timer.remaining;
        startCountdownTimer(timer);
    } else {
        startCountToDateTimer(timer);
    }

    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();
    updateEverythingWidgets();
    saveAllTimersState();
    dispatchTimerStateChange();
}

function pauseTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer || !timer.isRunning) return;

    timer.isRunning = false;
    if (activeTimers.has(timer.id)) {
        clearTimeout(activeTimers.get(timer.id));
        activeTimers.delete(timer.id);
    }

    // ========== CORRECCIÓN PARA EVITAR VALORES NEGATIVOS AL PAUSAR ==========
    if(timer.type === 'countdown') {
        // Si el timer ya terminó (targetTime pasó), no calcular tiempo negativo
        const rawRemaining = timer.targetTime - Date.now();
        if (rawRemaining <= 0) {
            timer.remaining = 0; // Ya terminó, mantener en 0
        } else {
            timer.remaining = rawRemaining; // Aún hay tiempo restante
        }
    }
    delete timer.targetTime;

    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();
    updateEverythingWidgets();
    saveAllTimersState();
    dispatchTimerStateChange();
}

function resetTimer(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    console.log(`🔄 Reseteando timer ${timerId}`);

    timer.isRunning = false;
    if (activeTimers.has(timerId)) {
        clearTimeout(activeTimers.get(timer.id));
        activeTimers.delete(timer.id);
    }

    clearRangAtTag(timerId);
    
    delete timer.targetTime;
    timer.isRinging = false;
    if (timer.type !== 'count_to_date') {
        timer.remaining = timer.initialDuration;
    }

    updateCardDisplay(timerId);
    if (timer.id === pinnedTimerId) updateMainDisplay();
    updateTimerCardControls(timerId);
    updateMainControlsState();
    refreshSearchResults();
    updateEverythingWidgets();
    saveAllTimersState();
    dispatchTimerStateChange();
}

export function updateTimer(timerId, newData) {
    console.log(`✏️ Editando timer ${timerId}`);
    
    const timerIndex = userTimers.findIndex(t => t.id === timerId);
    const defaultTimerIndex = defaultTimersState.findIndex(t => t.id === timerId);

    if (timerIndex === -1 && defaultTimerIndex === -1) return;

    if (activeTimers.has(timerId)) {
        clearTimeout(activeTimers.get(timerId));
        activeTimers.delete(timerId);
    }

    const isUserTimer = timerIndex !== -1;
    const targetArray = isUserTimer ? userTimers : defaultTimersState;
    const index = isUserTimer ? timerIndex : defaultTimerIndex;
    const oldTimer = targetArray[index];

    const updatedTimer = { ...oldTimer, ...newData, isRunning: false };

    // Limpiar tag al editar
    delete updatedTimer.rangAt;

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

function updateTimerCardVisuals(timer) {
    const card = document.getElementById(timer.id);
    if (!card) return;

    console.log(`🎨 Actualizando visuales del timer ${timer.id}, rangAt: ${timer.rangAt ? 'SÍ' : 'NO'}`);

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

    const tagElement = card.querySelector('.card-tag[data-sound-id]');
    if (tagElement) {
        tagElement.textContent = getSoundNameById(timer.sound);
        tagElement.dataset.soundId = timer.sound;
    }

    // ========== MANEJO DEL TAG "SONÓ HACE..." ==========
    let rangAgoTag = card.querySelector('.rang-ago-tag');
    
    if (shouldShowRangAtTag(timer)) {
        if (!rangAgoTag) {
            rangAgoTag = document.createElement('span');
            rangAgoTag.className = 'card-tag rang-ago-tag';
            card.querySelector('.card-tags').appendChild(rangAgoTag);
        }
        const timeAgo = formatTimeSince(timer.rangAt);
        rangAgoTag.textContent = getTranslation('rang_ago', 'timer').replace('{time}', timeAgo);
        console.log(`   📌 Tag "sonó hace..." añadido: ${timeAgo}`);
    } else if (rangAgoTag) {
        rangAgoTag.remove();
        console.log(`   🗑️ Tag "sonó hace..." eliminado`);
    }

    // Actualizar clase de timer terminado
    const isFinished = !timer.isRunning && timer.remaining <= 0 && !timer.rangAt;
    card.classList.toggle('timer-finished', isFinished);
}

function updateTimerCardControls(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    const cardElements = document.querySelectorAll(`#${timerId}, #search-timer-${timerId}`);
    const controlsState = getTimerControlsState(timer);

    cardElements.forEach(card => {
        // Play/Pause button
        const playPauseLink = card.querySelector('[data-action="start-card-timer"], [data-action="pause-card-timer"]');
        if (playPauseLink && controlsState.showPlayPause) {
            const icon = playPauseLink.querySelector('.material-symbols-rounded');
            const text = playPauseLink.querySelector('.menu-link-text span');

            playPauseLink.dataset.action = controlsState.playPauseAction;
            if (icon) icon.textContent = controlsState.playPauseIcon;
            if (text) {
                text.dataset.translate = controlsState.playPauseTextKey;
                text.textContent = getTranslation(controlsState.playPauseTextKey, 'tooltips');
            }

            const playPauseDisabled = controlsState.isRunning ? controlsState.pauseDisabled : controlsState.startDisabled;
            playPauseLink.classList.toggle('disabled-interactive', playPauseDisabled);
        }

        // Reset button
        const resetLink = card.querySelector('[data-action="reset-card-timer"]');
        if (resetLink && controlsState.showReset) {
            resetLink.classList.toggle('disabled-interactive', controlsState.resetDisabled);
        }

        // Edit/Delete buttons
        const editLink = card.querySelector('[data-action="edit-timer"]');
        const deleteLink = card.querySelector('[data-action="delete-timer"]');

        if (editLink) editLink.classList.toggle('disabled-interactive', controlsState.editDisabled);
        if (deleteLink) deleteLink.classList.toggle('disabled-interactive', controlsState.deleteDisabled);
    });

    console.log(`🎛️ Controles actualizados para timer ${timerId}: running=${controlsState.isRunning}, ringing=${controlsState.isRinging}, rangAt=${controlsState.hasRangAt}`);
}

function updateMainControlsState() {
    const section = document.querySelector('.section-timer');
    if (!section) return;

    const startBtn = section.querySelector('[data-action="start-pinned-timer"]');
    const pauseBtn = section.querySelector('[data-action="pause-pinned-timer"]');
    const resetBtn = section.querySelector('[data-action="reset-pinned-timer"]');
    const addTimerBtn = section.querySelector('[data-module="toggleMenuTimer"]');

    if (!startBtn || !pauseBtn || !resetBtn || !addTimerBtn) return;

    const pinnedTimer = findTimerById(pinnedTimerId);
    let isAnyRinging = [...userTimers, ...defaultTimersState].some(t => t.isRinging);

    // Add timer button disabled if any timer is ringing
    addTimerBtn.classList.toggle('disabled-interactive', isAnyRinging);

    if (pinnedTimer && pinnedTimer.type === 'countdown') {
        const controlsState = getTimerControlsState(pinnedTimer);
        
        startBtn.classList.toggle('disabled-interactive', controlsState.startDisabled);
        pauseBtn.classList.toggle('disabled-interactive', controlsState.pauseDisabled);
        resetBtn.classList.toggle('disabled-interactive', controlsState.resetDisabled);
        
        console.log(`🎛️ Main controls for ${pinnedTimer.id}: start=${controlsState.startDisabled}, pause=${controlsState.pauseDisabled}, reset=${controlsState.resetDisabled}`);
    } else {
        // No pinned timer or count-to-date timer
        startBtn.classList.add('disabled-interactive');
        pauseBtn.classList.add('disabled-interactive');
        resetBtn.classList.add('disabled-interactive');
    }
}

function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'tool-card timer-card';
    card.id = timer.id;
    card.dataset.id = timer.id;
    
    // Timer terminado si no está corriendo, tiempo es 0, y NO tiene rangAt
    if (!timer.isRunning && timer.remaining <= 0 && !timer.rangAt) {
        card.classList.add('timer-finished');
    }

    const controlsState = getTimerControlsState(timer);

    // ========== GENERAR TAG "SONÓ HACE..." ==========
    let rangAgoTag = '';
    if (shouldShowRangAtTag(timer)) {
        const timeAgo = formatTimeSince(timer.rangAt);
        const rangAgoText = getTranslation('rang_ago', 'timer').replace('{time}', timeAgo);
        rangAgoTag = `<span class="card-tag rang-ago-tag">${rangAgoText}</span>`;
    }

    // Controles específicos para countdown
    let countdownMenu = '';
    if (controlsState.showPlayPause || controlsState.showReset) {
        const startPauseDisabled = controlsState.isRunning ? 
            (controlsState.pauseDisabled ? 'disabled-interactive' : '') : 
            (controlsState.startDisabled ? 'disabled-interactive' : '');

        const playPauseMenu = controlsState.showPlayPause ? `
        <div class="menu-link ${startPauseDisabled}" data-action="${controlsState.playPauseAction}">
            <div class="menu-link-icon"><span class="material-symbols-rounded">${controlsState.playPauseIcon}</span></div>
            <div class="menu-link-text"><span data-translate="${controlsState.playPauseTextKey}" data-translate-category="tooltips">${getTranslation(controlsState.playPauseTextKey, 'tooltips')}</span></div>
        </div>` : '';

        const resetMenu = controlsState.showReset ? `
        <div class="menu-link ${controlsState.resetDisabled ? 'disabled-interactive' : ''}" data-action="reset-card-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">refresh</span></div>
            <div class="menu-link-text"><span data-translate="reset" data-translate-category="tooltips">${getTranslation('reset', 'tooltips')}</span></div>
        </div>` : '';

        countdownMenu = playPauseMenu + resetMenu;
    }

    const isDefault = timer.id.startsWith('default-timer-');
    const deleteLinkHtml = isDefault ? '' : `
        <div class="menu-link ${controlsState.deleteDisabled ? 'disabled-interactive' : ''}" data-action="delete-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span data-translate="delete_timer" data-translate-category="timer">${getTranslation('delete_timer', 'timer')}</span></div>
        </div>
    `;

    const titleText = isDefault ? getTranslation(timer.title, 'timer') : timer.title;
    const soundName = getSoundNameById(timer.sound);

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
                 ${rangAgoTag}
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
                     <div class="menu-link ${controlsState.editDisabled ? 'disabled-interactive' : ''}" data-action="edit-timer">
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

function renderTimerSearchResults(searchTerm) {
    const menuElement = document.querySelector('.menu-timer[data-menu="timer"]');
    if (!menuElement) return;

    const resultsWrapper = menuElement.querySelector('.search-results-wrapper');
    const creationWrapper = menuElement.querySelector('.creation-wrapper');
    const typeSelector = menuElement.querySelector('.menu-section-selector');

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
        return translatedTitle.toLowerCase().includes(searchTerm.toLowerCase());
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
    const controlsState = getTimerControlsState(timer);

    let dynamicActionsHTML = '';
    if (controlsState.showPlayPause || controlsState.showReset) {
        const startPauseDisabled = controlsState.isRunning ? 
            (controlsState.pauseDisabled ? 'disabled-interactive' : '') : 
            (controlsState.startDisabled ? 'disabled-interactive' : '');

        const playPauseAction = controlsState.showPlayPause ? `
            <div class="menu-link ${startPauseDisabled}" data-action="${controlsState.playPauseAction}">
                <div class="menu-link-icon"><span class="material-symbols-rounded">${controlsState.playPauseIcon}</span></div>
                <div class="menu-link-text"><span>${getTranslation(controlsState.playPauseTextKey, 'tooltips')}</span></div>
            </div>` : '';

        const resetAction = controlsState.showReset ? `
            <div class="menu-link ${controlsState.resetDisabled ? 'disabled-interactive' : ''}" data-action="reset-card-timer">
                <div class="menu-link-icon"><span class="material-symbols-rounded">refresh</span></div>
                <div class="menu-link-text"><span>${getTranslation('reset', 'tooltips')}</span></div>
            </div>` : '';

        dynamicActionsHTML = playPauseAction + resetAction;
    }

    const deleteLinkHtml = timer.id.startsWith('default-timer-') ? '' : `
        <div class="menu-link ${controlsState.deleteDisabled ? 'disabled-interactive' : ''}" data-action="delete-timer">
            <div class="menu-link-icon"><span class="material-symbols-rounded">delete</span></div>
            <div class="menu-link-text"><span>${getTranslation('delete_timer', 'timer')}</span></div>
        </div>
    `;

    item.innerHTML = `
        <div class="result-info">
            <span class="result-title">${translatedTitle}</span>
            <span class="result-time">${time}</span>
        </div>
        <div class="card-menu-container disabled"> 
            <button class="card-pin-btn ${timer.isPinned ? 'active' : ''}" data-action="pin-timer" data-translate="pin_timer" data-translate-category="tooltips" data-translate-target="tooltip">
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
                     <div class="menu-link ${controlsState.editDisabled ? 'disabled-interactive' : ''}" data-action="edit-timer">
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

        if (actionTarget.classList.contains('disabled-interactive')) {
            e.stopPropagation();
            return;
        }

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

function handleTimerEnd(timerId) {
    const timer = findTimerById(timerId);
    if (!timer) return;

    timer.isRunning = false;
    if (activeTimers.has(timerId)) {
        clearTimeout(activeTimers.get(timerId));
        activeTimers.delete(timerId);
    }
    timer.remaining = 0;

    // ===== CORRECCIÓN CLAVE =====
    // Guardar el momento exacto cuando sonó para restauración posterior
    timer.lastTriggered = Date.now();
    
    // NO eliminar rangAt aquí - se eliminará solo cuando el usuario descarte
    delete timer.rangAt;

    timer.isRinging = true;

    updateCardDisplay(timerId);
    renderAllTimerCards();
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

function dismissTimer(timerId) {
    stopSound();
    const card = document.getElementById(timerId);
    if (card) {
        const optionsContainer = card.querySelector('.card-options-container');
        if (optionsContainer) {
            optionsContainer.classList.remove('active');
        }
    }
    hideDynamicIsland();
    
    const timer = findTimerById(timerId);
    if (timer) {
        timer.isRinging = false;
        if (timer.type === 'countdown') {
            // ✅ RESET LIMPIO SIN TAGS (usuario se enteró del sonido)
            timer.remaining = timer.initialDuration;
            timer.isRunning = false;
            delete timer.targetTime;
            delete timer.rangAt; // NO mantener historial
            
            updateCardDisplay(timerId);
            if (timer.id === pinnedTimerId) updateMainDisplay();
            updateTimerCardControls(timerId);
            updateMainControlsState();
            refreshSearchResults();
            updateEverythingWidgets();
            saveAllTimersState();
            dispatchTimerStateChange();
        }
    }
}

// ========== RESTO DE FUNCIONES AUXILIARES ==========

export function getTimersCount() {
    return userTimers.length;
}

export function getTimerLimit() {
    return 25;
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

function findTimerById(timerId) {
    return userTimers.find(t => t.id === timerId) || defaultTimersState.find(t => t.id === timerId);
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

function startCountdownTimer(timer) {
    const tick = () => {
        if (!timer.isRunning) {
            if (activeTimers.has(timer.id)) {
                clearTimeout(activeTimers.get(timer.id));
                activeTimers.delete(timer.id);
            }
            return;
        }

        // ========== CORRECCIÓN PARA EVITAR TIEMPOS NEGATIVOS ==========
        // Calcular tiempo restante con protección contra valores negativos
        const rawRemaining = timer.targetTime - Date.now();
        timer.remaining = Math.max(0, rawRemaining);

        updateCardDisplay(timer.id);
        if (timer.id === pinnedTimerId) updateMainDisplay();

        // Verificar si el timer ha terminado usando el valor crudo para mayor precisión
        if (rawRemaining <= 0) {
            handleTimerEnd(timer.id);
        } else {
            const msUntilNextSecond = 1000 - (new Date().getMilliseconds());
            const timeoutId = setTimeout(tick, msUntilNextSecond);
            activeTimers.set(timer.id, timeoutId);
        }
    };
    tick();
}

function startCountToDateTimer(timer) {
    const tick = () => {
        if (!timer.isRunning) {
            if (activeTimers.has(timer.id)) {
                clearTimeout(activeTimers.get(timer.id));
                activeTimers.delete(timer.id);
            }
            return;
        }

        const rawRemaining = new Date(timer.targetDate).getTime() - Date.now();
        timer.remaining = Math.max(0, rawRemaining);
        
        updateCardDisplay(timer.id);
        if (timer.id === pinnedTimerId) updateMainDisplay();

        if (rawRemaining <= 0) {
            handleTimerEnd(timer.id);
        } else {
            const msUntilNextSecond = 1000 - (new Date().getMilliseconds());
            const timeoutId = setTimeout(tick, msUntilNextSecond);
            activeTimers.set(timer.id, timeoutId);
        }
    };
    tick();
}

function formatTime(ms, type = 'countdown') {
    // ========== CORRECCIÓN PARA EVITAR VALORES NEGATIVOS ==========
    // Asegurar que nunca mostremos tiempos negativos, especialmente durante actualizaciones en tiempo real
    if (ms <= 0) {
        return type === 'count_to_date' ? getTranslation('event_finished', 'timer') || "¡Evento finalizado!" : "00:00:00";
    }

    // Usar Math.max para prevenir valores negativos por latencia/timing
    const totalSeconds = Math.max(0, Math.floor(Math.max(0, ms) / 1000));

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

// ========== RESTO DE FUNCIONES PRINCIPALES ==========

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
    dispatchTimerStateChange();
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
        mainCard.classList.toggle('timer-finished', !timer.isRunning && timer.remaining <= 0 && !timer.rangAt);
    }

    if (searchItem) {
        const timeElement = searchItem.querySelector('.result-time');
        if (timeElement) {
            timeElement.textContent = formatTime(timer.remaining, timer.type);
        }
    }
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
    console.log(`✏️ Preparando edición del timer ${timerId}`);
    
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
            clearTimeout(activeTimers.get(timerId));
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

    window.addEventListener('beforeunload', () => {
        localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
    });

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
        getTimerLimit, 
        getRunningTimersCount,
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
            const menuElement = document.querySelector('.menu-timer[data-menu="timer"]');
            if (!menuElement) return;

            const searchInput = menuElement.querySelector('#timer-search-input');
            if (searchInput) {
                searchInput.value = '';
                renderTimerSearchResults('');
            }
        }
    });
}

// ========== EVENTOS DE TRADUCCIÓN ==========
document.addEventListener('translationsApplied', () => {
    const allTimers = [...userTimers, ...defaultTimersState];
    allTimers.forEach(timer => {
        updateTimerCardVisuals(timer);
    });
    updateMainDisplay();
});

export { initializeTimerController };