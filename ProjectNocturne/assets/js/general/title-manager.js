// assets/js/general/title-manager.js

/**
 * Gestor de Títulos Dinámicos para ProjectNocturne (Versión 2.0 - con actualización en vivo)
 *
 * Este módulo actualiza el título del documento en tiempo real, reflejando
 * la información más reciente de la herramienta activa, incluyendo contadores en vivo.
 */

import { getActiveSection } from './main.js';

const BASE_TITLE = "ProjectNocturne";
let titleUpdateInterval = null; // Variable para almacenar nuestro intervalo

/**
 * Obtiene el título de la tarjeta del reloj que está actualmente fijado.
 * @returns {string|null} - El título del reloj fijado, o null si es el local o no hay ninguno.
 */
function getPinnedClockTitle() {
    const pinnedButton = document.querySelector('.card-pin-btn.active');
    if (!pinnedButton) return null;

    const card = pinnedButton.closest('.tool-card');
    if (card && card.dataset.id !== 'local') {
        return card.dataset.title || card.querySelector('.card-title')?.textContent || null;
    }

    return null;
}

/**
 * Función principal que actualiza el título del documento.
 * Ahora se ejecuta cada segundo para reflejar los cambios en tiempo real.
 */
export function updateTitle() {
    // Si no estamos en la ventana del navegador, no hacemos nada para ahorrar recursos.
    if (document.hidden) {
        return;
    }

    const activeSection = getActiveSection();
    let newTitle = "";

    // 1. Verificación de estados específicos con información dinámica
    const nextAlarmDetails = window.alarmManager?.getNextAlarmDetails();
    const runningTimersCount = window.timerManager?.getRunningTimersCount();
    const isStopwatchRunning = window.stopwatchController?.isStopwatchRunning();

    if (activeSection === 'alarm' && nextAlarmDetails) {
        newTitle = `(${nextAlarmDetails}) - ${BASE_TITLE}`;
    } else if (activeSection === 'timer' && runningTimersCount > 0) {
        const activeTimerDetails = window.timerManager.getActiveTimerDetails();
        newTitle = `(${activeTimerDetails}) - ${BASE_TITLE}`;
    } else if (activeSection === 'stopwatch' && isStopwatchRunning) {
        const stopwatchDetails = window.stopwatchController.getStopwatchDetails();
        newTitle = `(${stopwatchDetails}) - ${BASE_TITLE}`;
    } else if (activeSection === 'worldClock') {
        const pinnedClockTitle = getPinnedClockTitle();
        if (pinnedClockTitle) {
            newTitle = `(${pinnedClockTitle}) - ${BASE_TITLE}`;
        }
    }

    // 2. Si no hay un estado dinámico, se usa el título de la sección.
    if (!newTitle) {
        let sectionName = "Home";
        if (activeSection) {
            switch (activeSection) {
                case 'everything': sectionName = "Home"; break;
                case 'alarm':      sectionName = "Alarm"; break;
                case 'timer':      sectionName = "Timer"; break;
                case 'stopwatch':  sectionName = "Stopwatch"; break;
                case 'worldClock': sectionName = "WorldClock"; break;
            }
        }
        newTitle = `${BASE_TITLE} - ${sectionName}`;
    }

    // Solo actualizamos el DOM si el título ha cambiado.
    if (document.title !== newTitle) {
        document.title = newTitle;
    }
}

/**
 * Inicializa el gestor de títulos y configura los listeners.
 */
export function initTitleManager() {
    // Si ya hay un intervalo, lo limpiamos para evitar duplicados.
    if (titleUpdateInterval) {
        clearInterval(titleUpdateInterval);
    }

    // --- LA MEJORA CLAVE ---
    // Iniciamos un bucle que llama a updateTitle() cada segundo.
    // Esto asegura que la información de temporizadores y cronómetros esté siempre al día.
    titleUpdateInterval = setInterval(updateTitle, 1000);

    // Mantenemos los listeners de eventos para cambios instantáneos que no dependen del tiempo,
    // como cambiar de sección o fijar un nuevo reloj.
    document.addEventListener('sectionChanged', updateTitle);
    document.addEventListener('alarmStateChanged', updateTitle);
    document.addEventListener('worldClockStateChanged', updateTitle);
    document.addEventListener('alarmDetailsChanged', updateTitle); // Para cuando se edita una alarma

    console.log("👑 Live Title Manager Initialized (v2.1)");
}