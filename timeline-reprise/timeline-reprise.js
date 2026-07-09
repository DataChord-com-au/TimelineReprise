(function () {

    const manifest = [
        { type: 'css', path: 'dark-mode/dark-mode.css' },
        { type: 'js', path: 'timeline-reprise-core.js' },
        { type: 'js', path: 'timeline-reprise-overview.js' },
        { type: 'js', path: 'timeline-reprise-cardinal-axis.js' },
        { type: 'js', path: 'timeline-reprise-scaled-zones.js' },
        { type: 'js', path: 'timeline-reprise-event-layout.js' }
    ];
    
    const currentScript = document.currentScript ||
        document.getElementsByTagName("script")[document.getElementsByTagName("script").length - 1];

    const base = currentScript.src.replace(/[^\/]+$/, "");

    manifest.forEach(function (item) {
        if (item.type === 'css') {
            document.write(
                '<link rel="stylesheet" href="' + base + item.path + '">'
            );
            return;
        }

        document.write(
            '<script src="' + base + item.path + '"><\/script>'
        );
    });
}());
