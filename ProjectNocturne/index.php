<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>ProjectNocturne - Home</title>
    <meta name="description" content="Use ProjectNocturne to access useful tools like a world clock, custom alarms, timers, and stopwatches — all from your browser.">
    <meta name="keywords" content="online clock, online alarm, timer, stopwatch, tools, ProjectNocturne, web tools, online timer, free alarm, world clock">

    <link rel="icon" href="assets/img/favicon.ico" type="image/x-icon">

    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded" />
    <link rel="stylesheet" type="text/css" href="assets/css/general/styles.css">
    <link rel="stylesheet" type="text/css" href="assets/css/general/dark-mode.css">
    <link rel="stylesheet" type="text/css" href="assets/css/tools/tools.css">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

    <script src="assets/js/general/initial-theme.js"></script>
</head>


<body>
    <div class="page-wrapper">
        <div class="main-content">
            <?php include 'includes/layouts/sidebar-desktop.php'; ?>
            <div class="general-content overflow-y">
                <div class="general-content-top">
                    <?php include 'includes/layouts/header.php'; ?>
                </div>
                <div class="general-content-scrolleable">
                    <?php include 'includes/layouts/sidebar-mobile.php'; ?>
                    <?php include 'includes/modules/module-overlays.php'; ?>
                    <div class="scrollable-content overflow-y">
                        <div class="general-content-bottom">
                            <div class="section-content">
                                <?php include 'includes/sections/everything.php'; ?>
                                <?php include 'includes/sections/alarm.php'; ?>
                                <?php include 'includes/sections/timer.php'; ?>
                                <?php include 'includes/sections/stopwatch.php'; ?>
                                <?php include 'includes/sections/worldClock.php'; ?>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script type="module" src="assets/js/general/init-app.js"></script>
    <script type="module" src="assets/js/general/main.js"></script>
    <script type="module" src="assets/js/general/translations-controller.js"></script>
    <script type="module" src="assets/js/general/location-manager.js"></script>
    <script type="module" src="assets/js/general/module-manager.js"></script>
    <script type="module" src="assets/js/general/theme-manager.js"></script>
    <script type="module" src="assets/js/general/language-manager.js"></script>
    <script type="module" src="assets/js/general/tooltip-controller.js"></script>
    <script type="module" src="assets/js/general/drag-controller.js"></script>
    <script type="module" src="assets/js/general/dynamic-island-controller.js"></script>
    <script type="module" src="assets/js/general/modal-controller.js"></script>
    <script type="module" src="assets/js/general/menu-interactions.js"></script>
    <script type="module" src="assets/js/general/color-search-system.js"></script>

    <script type="module" src="assets/js/components/palette-colors.js"></script>

    <script type="module" src="assets/js/tools/general-tools.js"></script>
    <script type="module" src="assets/js/tools/everything-controller.js"></script>
    <script type="module" src="assets/js/tools/alarm-controller.js"></script>
    <script type="module" src="assets/js/tools/timer-controller.js"></script>
    <script type="module" src="assets/js/tools/stopwatch-controller.js"></script>
    <script type="module" src="assets/js/tools/worldClock-controller.js"></script>

    <script type="module" src="assets/js/config/zoneinfo-controller.js"></script>

</body>

</html>