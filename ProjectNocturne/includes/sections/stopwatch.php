<div class="section-stopwatch disabled">
    <div class="section-top">
        <div class="tool-options-wrapper">
            <div class="tool-options-content body-title">
                <div class="tool-options">
                    <div class="header-button"
                        data-action="start"
                        data-translate="play"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">play_arrow</span>
                    </div>
                    <div class="header-button"
                        data-action="stop"
                        data-translate="stop"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">pause</span>
                    </div>
                    <div class="header-button"
                        data-action="lap"
                        data-translate="lap"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">skip_next</span>
                    </div>
                    <div class="header-button"
                        data-action="reset"
                        data-translate="reset"
                        data-translate-category="tooltips"
                        data-translate-target="tooltip">
                        <span class="material-symbols-rounded">refresh</span>
                    </div>
                </div>
            </div>


            <div class="tool-options">
                <div class="header-button"
                    data-action="change-format"
                    data-translate="change_format"
                    data-translate-category="tooltips"
                    data-translate-target="tooltip">
                    <span class="material-symbols-rounded">timer_10_select</span>
                </div>

                <div class="header-button"
                    data-action="export-laps"
                    data-translate="export_laps"
                    data-translate-category="tooltips"
                    data-translate-target="tooltip">
                    <span class="material-symbols-rounded">download</span>
                </div>
                <div class="separator"></div>
                <?php include 'includes/components/tool-options.php'; ?>
            </div>
        </div>
    </div>
    <div class="section-center">
        <div class="tool-content">
            <div class="tool-stopwatch">
                <span>00:00:00.00</span>
            </div>
        </div>
    </div>
    <div class="section-bottom disabled">
        <div class="laps-table-container">
            <table class="laps-table body-title">
                <thead>
                    <tr>
                        <th data-translate="lap_header" data-translate-category="stopwatch"></th>
                        <th data-translate="time_header" data-translate-category="stopwatch"></th>
                        <th data-translate="total_time_header" data-translate-category="stopwatch"></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    </div>
</div>