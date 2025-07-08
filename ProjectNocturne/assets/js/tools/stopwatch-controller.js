// /assets/js/tools/stopwatch-controller.js

import { getTranslation } from '../general/translations-controller.js';
import { showDynamicIslandNotification } from '../general/dynamic-island-controller.js';
import { updateEverythingWidgets } from './everything-controller.js';

const stopwatchState = {
    isRunning: false,
    startTime: 0,
    elapsedTime: 0,
    lapNumber: 0,
    laps: [],
    timerInterval: null,
    format: 'ms', // Opciones: 's', 'ds', 'ms', 'sss'
};

let displayElement, startBtn, stopBtn, lapBtn, resetBtn, lapsTableBody, sectionBottom, changeFormatBtn, exportLapsBtn;

export function getLapLimit() {
    return 1000;
}

function saveState() {
    const stateToSave = {
        isRunning: stopwatchState.isRunning,
        startTime: stopwatchState.startTime,
        elapsedTime: stopwatchState.elapsedTime,
        laps: stopwatchState.laps,
        lapNumber: stopwatchState.lapNumber,
        format: stopwatchState.format,
    };
    localStorage.setItem('stopwatchState', JSON.stringify(stateToSave));
}

function loadState() {
    const savedState = localStorage.getItem('stopwatchState');
    if (!savedState) return;

    const parsedState = JSON.parse(savedState);
    stopwatchState.laps = parsedState.laps || [];
    stopwatchState.lapNumber = parsedState.lapNumber || 0;
    stopwatchState.startTime = parsedState.startTime || 0;
    stopwatchState.elapsedTime = parsedState.elapsedTime || 0;
    stopwatchState.isRunning = parsedState.isRunning || false;
    stopwatchState.format = parsedState.format || 'ms';

    if (stopwatchState.isRunning) {
        stopwatchState.elapsedTime = Date.now() - stopwatchState.startTime;
        startStopwatch(true);
    } else {
        updateDisplay();
    }

    if (stopwatchState.laps.length > 0) {
        lapsTableBody.innerHTML = '';
        stopwatchState.laps.forEach(renderLap);
        sectionBottom.classList.remove('disabled');
    }

    updateButtonStates();
}

function formatTime(milliseconds) {
    const totalMs = Math.floor(milliseconds);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    let timeString = '';

    if (hours > 0) {
        timeString += `${hours.toString().padStart(2, '0')}:`;
    }
    
    timeString += `${minutes.toString().padStart(2, '0')}:`;
    timeString += `${seconds.toString().padStart(2, '0')}`;

    switch (stopwatchState.format) {
        case 's':
            // No decimal places
            break;
        case 'ds':
            timeString += `.${Math.floor(ms / 100).toString()}`;
            break;
        case 'ms':
            timeString += `.${Math.floor(ms / 10).toString().padStart(2, '0')}`;
            break;
        case 'sss':
            timeString += `.${ms.toString().padStart(3, '0')}`;
            break;
        default:
            timeString += `.${Math.floor(ms / 10).toString().padStart(2, '0')}`;
            break;
    }

    return timeString;
}

function updateDisplay() {
    const currentTime = stopwatchState.isRunning ? (Date.now() - stopwatchState.startTime) : stopwatchState.elapsedTime;
    displayElement.textContent = formatTime(currentTime);
}

function getUpdateInterval() {
    switch (stopwatchState.format) {
        case 's':
            return 1000;
        case 'ds':
            return 100;
        case 'ms':
        case 'sss':
        default:
            return 10;
    }
}

function startStopwatch(isReload = false) {
    if (stopwatchState.isRunning && !isReload) return;

    stopwatchState.isRunning = true;

    if (!isReload) {
        stopwatchState.startTime = Date.now() - stopwatchState.elapsedTime;
    }

    clearInterval(stopwatchState.timerInterval);
    const interval = getUpdateInterval();
    stopwatchState.timerInterval = setInterval(updateDisplay, interval);

    updateButtonStates();
    saveState();
    if (!isReload) {
        updateEverythingWidgets();
    }
}

function stopStopwatch() {
    if (!stopwatchState.isRunning) return;

    stopwatchState.isRunning = false;
    stopwatchState.elapsedTime = Date.now() - stopwatchState.startTime;
    clearInterval(stopwatchState.timerInterval);
    updateButtonStates();
    saveState();
    updateEverythingWidgets();
}

function resetStopwatch() {
    stopwatchState.isRunning = false;
    clearInterval(stopwatchState.timerInterval);

    stopwatchState.elapsedTime = 0;
    stopwatchState.startTime = 0;
    stopwatchState.lapNumber = 0;
    stopwatchState.laps = [];

    updateDisplay();
    lapsTableBody.innerHTML = '';
    sectionBottom.classList.add('disabled');
    updateButtonStates();
    saveState();
    updateEverythingWidgets();
}

function recordLap() {
    if (!stopwatchState.isRunning) return;

    const lapLimit = getLapLimit();

    if (stopwatchState.lapNumber >= lapLimit) {
        showDynamicIslandNotification(
            'system',
            'limit_reached',
            null,
            'notifications',
            { type: getTranslation('stopwatch', 'tooltips') }
        );
        return;
    }

    const lapTime = Date.now() - stopwatchState.startTime;
    const previousLapTime = stopwatchState.laps.length > 0 ? stopwatchState.laps[stopwatchState.laps.length - 1].totalTime : 0;
    const lapDuration = lapTime - previousLapTime;
    stopwatchState.lapNumber++;

    const lapData = {
        lap: stopwatchState.lapNumber,
        time: lapDuration,
        totalTime: lapTime
    };
    stopwatchState.laps.push(lapData);

    renderLap(lapData);
    sectionBottom.classList.remove('disabled');
    saveState();
    updateButtonStates();
}

function renderLap(lapData) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${lapData.lap}</td>
        <td>${formatTime(lapData.time)}</td>
        <td>${formatTime(lapData.totalTime)}</td>
    `;
    lapsTableBody.prepend(row);
}

function updateButtonStates() {
    const hasTime = stopwatchState.elapsedTime > 0;
    const isLapDisabled = !stopwatchState.isRunning;

    startBtn.classList.toggle('disabled-interactive', stopwatchState.isRunning);
    stopBtn.classList.toggle('disabled-interactive', !stopwatchState.isRunning);
    lapBtn.classList.toggle('disabled-interactive', isLapDisabled);
    resetBtn.classList.toggle('disabled-interactive', stopwatchState.isRunning || !hasTime);
    exportLapsBtn.classList.toggle('disabled-interactive', stopwatchState.laps.length === 0);
}

function getStopwatchDetails() {
    const state = stopwatchState;
    const time = formatTime(state.isRunning ? (Date.now() - state.startTime) : state.elapsedTime);
    const statusKey = state.isRunning ? 'running' : 'paused';
    const statusText = getTranslation(statusKey, 'stopwatch');

    if (state.elapsedTime === 0 && !state.isRunning) {
        return getTranslation('paused', 'stopwatch') + ' en 00.00';
    }

    return `${statusText} en ${time}`;
}

function isStopwatchRunning() {
    return stopwatchState.isRunning;
}

function changeFormat() {
    const formats = ['ds', 'ms', 'sss', 's'];
    const currentIndex = formats.indexOf(stopwatchState.format);
    stopwatchState.format = formats[(currentIndex + 1) % formats.length];
    
    // Si el cronómetro está corriendo, reiniciamos el intervalo con la nueva frecuencia
    if (stopwatchState.isRunning) {
        clearInterval(stopwatchState.timerInterval);
        const newInterval = getUpdateInterval();
        stopwatchState.timerInterval = setInterval(updateDisplay, newInterval);
    }
    
    updateDisplay();
    saveState();
}

function exportLaps() {
    if (typeof XLSX === 'undefined') {
        console.error("La librería XLSX no está cargada. Asegúrate de incluirla en tu HTML.");
        showDynamicIslandNotification('system', 'error', 'Error al exportar. Intenta de nuevo.', 'notifications');
        return;
    }

    const iconContainer = exportLapsBtn.querySelector('.material-symbols-rounded');
    const originalIconHTML = iconContainer.innerHTML;

    // Mostrar spinner y deshabilitar
    iconContainer.innerHTML = '<span class="material-symbols-rounded spinning">progress_activity</span>';
    exportLapsBtn.classList.add('disabled-interactive');

    try {
        setTimeout(() => { // Simular un pequeño retraso para que el spinner sea visible
            const wb = XLSX.utils.book_new();
            const ws_data = [
                [getTranslation("lap_header", "stopwatch"), getTranslation("time_header", "stopwatch"), getTranslation("total_time_header", "stopwatch")],
                ...stopwatchState.laps.map(lap => [lap.lap, formatTime(lap.time), formatTime(lap.totalTime)])
            ];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            XLSX.utils.book_append_sheet(wb, ws, "Laps");
            XLSX.writeFile(wb, "stopwatch_laps.xlsx");
        }, 500);
    } catch (error) {
        console.error("Error al exportar las vueltas:", error);
        showDynamicIslandNotification('system', 'error', 'Error al exportar.', 'notifications');
    } finally {
        setTimeout(() => {
            // Restaurar botón a su estado original
            iconContainer.innerHTML = originalIconHTML;
            exportLapsBtn.classList.remove('disabled-interactive');
            updateButtonStates(); // Re-evaluar estado del botón
        }, 1000); // Dar tiempo a que la descarga inicie
    }
}

window.stopwatchController = {
    getStopwatchDetails,
    isStopwatchRunning
};

export function initializeStopwatch() {
    const stopwatchSection = document.querySelector('.section-stopwatch');
    if (!stopwatchSection) return;

    displayElement = stopwatchSection.querySelector('.tool-stopwatch span');
    startBtn = stopwatchSection.querySelector('[data-action="start"]');
    stopBtn = stopwatchSection.querySelector('[data-action="stop"]');
    lapBtn = stopwatchSection.querySelector('[data-action="lap"]');
    resetBtn = stopwatchSection.querySelector('[data-action="reset"]');
    lapsTableBody = stopwatchSection.querySelector('.laps-table tbody');
    sectionBottom = stopwatchSection.querySelector('.section-bottom');
    changeFormatBtn = stopwatchSection.querySelector('[data-action="change-format"]');
    exportLapsBtn = stopwatchSection.querySelector('[data-action="export-laps"]');

    startBtn.addEventListener('click', () => startStopwatch(false));
    stopBtn.addEventListener('click', stopStopwatch);
    lapBtn.addEventListener('click', recordLap);
    resetBtn.addEventListener('click', resetStopwatch);
    changeFormatBtn.addEventListener('click', changeFormat);
    exportLapsBtn.addEventListener('click', exportLaps);

    loadState();
}