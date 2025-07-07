<div class="menu-alarm disabled body-title" data-menu="alarm">
    <div class="pill-container">
        <div class="drag-handle"></div>
    </div>
    <div class="menu-section">
        <div class="menu-section-top">
            <div class="search-content">
                <div class="search-content-icon">
                    <span class="material-symbols-rounded">search</span>
                </div>
                <div class="search-content-text">
                    <input type="text" id="alarm-search-input" class="body-title" autocomplete="off" data-translate="search_alarms_placeholder" data-translate-category="search" data-translate-target="placeholder">
                </div>
            </div>
        </div>
        <div class="menu-content-scrolleable overflow-y">
            <div class="search-results-wrapper disabled"></div>
            <div class="creation-wrapper active">
                <div class="menu-section-center overflow-y">
                    <div class="menu-content-wrapper active">
                        <div class="menu-content">
                            <div class="menu-content-header">
                                <div class="menu-content-header-primary">
                                    <span class="material-symbols-rounded">label</span>
                                    <span data-translate="alarm_title" data-translate-category="alarms"></span>
                                </div>
                            </div>
                            <div class="menu-content-general">
                                <div class="enter-text-tool">
                                    <input type="text" id="alarm-title" data-translate="my_new_alarm_placeholder" data-translate-category="alarms" data-translate-target="placeholder">
                                </div>
                            </div>
                        </div>
                        <div class="menu-content">
                            <div class="menu-content-header">
                                <div class="menu-content-header-primary">
                                    <span class="material-symbols-rounded">schedule</span>
                                    <span data-translate="alarm_settings" data-translate-category="alarms"></span>
                                </div>
                            </div>
                            <div class="menu-content-general">
                                <div class="enter-date-content">
                                    <div class="enter-date-tool">
                                        <div class="enter-date-tool-left" data-action="decreaseHour">
                                            <span class="material-symbols-rounded">arrow_left</span>
                                        </div>
                                        <div class="enter-date-tool-center" id="hour-display">--:--</div>
                                        <div class="enter-date-tool-right" data-action="increaseHour">
                                            <span class="material-symbols-rounded">arrow_right</span>
                                        </div>
                                    </div>
                                    <div class="enter-date-tool">
                                        <div class="enter-date-tool-left" data-action="decreaseMinute">
                                            <span class="material-symbols-rounded">arrow_left</span>
                                        </div>
                                        <div class="enter-date-tool-center" id="minute-display">0 minutos</div>
                                        <div class="enter-date-tool-right" data-action="increaseMinute">
                                            <span class="material-symbols-rounded">arrow_right</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="menu-content">
                            <div class="menu-content-header">
                                <div class="menu-content-header-primary">
                                    <span class="material-symbols-rounded">music_note</span>
                                    <span data-translate="alarm_sound" data-translate-category="alarms"></span>
                                </div>
                            </div>
                            <div class="menu-content-general">
                                <div class="custom-select-wrapper custom-select-wrapper--row">
                                    <div class="custom-select-content" data-action="open-sounds-menu" data-context="alarm">
                                        <div class="custom-select-content-left">
                                            <span id="alarm-selected-sound" data-translate="classic_beep" data-translate-category="sounds"></span>
                                        </div>
                                        <div class="custom-select-content-right">
                                            <span class="material-symbols-rounded">arrow_right</span>
                                        </div>
                                    </div>
                                    <div class="menu-action-button" data-action="previewAlarmSound">
                                        <span class="material-symbols-rounded">play_arrow</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="menu-section-bottom">
            <div class="create-tool" data-action="createAlarm">
                <span data-translate="create_alarm" data-translate-category="alarms"></span>
            </div>
        </div>
    </div>
</div>
