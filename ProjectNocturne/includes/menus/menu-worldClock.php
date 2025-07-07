<div class="menu-worldClock disabled body-title" data-menu="worldClock">
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
                    <input type="text" id="worldclock-search-input" class="body-title" autocomplete="off" data-translate="search_clocks_placeholder" data-translate-category="search" data-translate-target="placeholder">
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
                                    <span data-translate="clock_title" data-translate-category="world_clock"></span>
                                </div>
                            </div>
                            <div class="menu-content-general">
                                <div class="enter-text-tool">
                                    <input type="text" id="worldclock-title" data-translate="my_new_clock_placeholder" data-translate-category="world_clock" data-translate-target="placeholder">
                                </div>
                            </div>
                        </div>
                        <div class="menu-content">
                            <div class="menu-content-header">
                                <div class="menu-content-header-primary">
                                    <span class="material-symbols-rounded">public</span>
                                    <span data-translate="country_and_timezone" data-translate-category="world_clock"></span>
                                </div>
                            </div>
                            <div class="menu-content-general">
                                <div class="custom-select-wrapper">
                                    <div class="custom-select-content" data-action="open-country-menu">
                                        <div class="custom-select-content-left">
                                            <span id="worldclock-selected-country" data-translate="select_a_country" data-translate-category="world_clock"></span>
                                        </div>
                                        <div class="custom-select-content-right">
                                            <span class="material-symbols-rounded">arrow_right</span>
                                        </div>
                                    </div>
                                    <div class="custom-select-content disabled-interactive" data-action="open-timezone-menu">
                                        <div class="custom-select-content-left">
                                            <span id="worldclock-selected-timezone" data-translate="select_a_timezone" data-translate-category="world_clock"></span>
                                        </div>
                                        <div class="custom-select-content-right">
                                            <span class="material-symbols-rounded">arrow_right</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="menu-section-bottom">
            <div class="create-tool" data-action="addWorldClock">
                <span data-translate="add_clock" data-translate-category="tooltips"></span>
            </div>
        </div>
    </div>
</div>
