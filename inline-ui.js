const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const uiHtmlPath = path.join(distDir, 'ui.html');
const uiCssPath = path.join(distDir, 'ui.css');
const uiJsPath = path.join(distDir, 'ui.js');

try {
    let html = fs.readFileSync(uiHtmlPath, 'utf8');
    const css = fs.readFileSync(uiCssPath, 'utf8');
    const js = fs.readFileSync(uiJsPath, 'utf8');

    // Replace link tag with style tag
    html = html.replace(/<link rel="stylesheet" href="ui.css">/, `<style>${css}</style>`);

    // Replace script tag with inlined script
    html = html.replace(/<script src="ui.js"><\/script>/, `<script>${js}</script>`);

    fs.writeFileSync(uiHtmlPath, html);
    console.log('Successfully inlined CSS and JS into dist/ui.html');
} catch (err) {
    console.error('Error inlining files:', err.message);
    process.exit(1);
}
