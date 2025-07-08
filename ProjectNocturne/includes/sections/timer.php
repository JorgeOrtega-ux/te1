<div class="section-timer disabled">
    <div class="section-top">
        <div class="tool-options-wrapper">
            <div class="tool-options-content body-title">
                <div class="tool-options">
                    <div class="header-button"
                        data-action="start-pinned-timer"
                        data-translate="play"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </div>
                    <div class="header-button"
                        data-action="pause-pinned-timer"
                        data-translate="pause"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">pause</span>
                    </div>
                    <div class="header-button"
                        data-action="reset-pinned-timer"
                        data-translate="reset"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">refresh</span>
                    </div>
                    <div class="header-button"
                        data-module="toggleMenuTimer"
                        data-translate="add_timer"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">add</span>
                    </div>
                    <div class="info-tool" data-timer-name-display></div>
                </div>
            </div>
            <div class="tool-options">
                <?php include 'includes/components/tool-options.php'; ?>
            </div>
        </div>
    </div>
    <div class="section-center">
        <div class="tool-content">
            <div class="tool-timer">
                <span>00:05:00</span>
            </div>
        </div>
    </div>
    <div class="section-bottom">
        <div class="timers-list-wrapper"></div>
    </div>
</div>