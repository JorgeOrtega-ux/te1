function updateZoneInfo(timezone = null) {
    const infoTools = document.querySelectorAll('.info-tool[data-timezone-alarm], .info-tool[data-timezone-worldclock]');

    if (infoTools.length === 0) {
        return;
    }

    try {
        const finalTimeZone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const userFriendlyTimeZone = finalTimeZone.replace(/_/g, ' ');

        infoTools.forEach(tool => {
            let span = tool.querySelector('span');
            if (!span) {
                span = document.createElement('span');
                tool.textContent = '';
                tool.appendChild(span);
            }

            span.textContent = userFriendlyTimeZone;

            tool.setAttribute('data-translate', 'timezone');
            tool.setAttribute('data-translate-category', 'tooltips');
            tool.setAttribute('data-translate-target', 'tooltip');
        });

        if (window.tooltipManager && typeof window.tooltipManager.attachTooltipsToNewElements === 'function') {
            infoTools.forEach(tool => {
                window.tooltipManager.attachTooltipsToNewElements(tool.parentElement);
            });
        }

    } catch (error) {
        console.error("Error getting user's time zone:", error);
        infoTools.forEach(tool => {
            let span = tool.querySelector('span');
            if (!span) {
                span = document.createElement('span');
                tool.textContent = '';
                tool.appendChild(span);
            }
            span.textContent = "Time Zone Unavailable";
        });
    }
}

function initializeZoneInfoTool() {
    updateZoneInfo();
}

export { initializeZoneInfoTool, updateZoneInfo };