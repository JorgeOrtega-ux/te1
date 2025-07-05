(function () {
    function applyThemeImmediately() {
        try {
            const savedTheme = localStorage.getItem('app-theme') || 'system';
            const html = document.documentElement;

            html.classList.remove('dark-mode', 'light-mode');

            switch (savedTheme) {
                case 'dark':
                    html.classList.add('dark-mode');
                    break;
                case 'light':
                    html.classList.add('light-mode');
                    break;
                case 'system':
                default:
                    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        html.classList.add('dark-mode');
                    } else {
                        html.classList.add('light-mode');
                    }
                    break;
            }

        } catch (error) {
            document.documentElement.classList.add('light-mode');
        }
    }

    applyThemeImmediately();

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            const currentTheme = localStorage.getItem('app-theme') || 'system';
            if (currentTheme === 'system') {
                applyThemeImmediately();
            }
        });
    }
})();