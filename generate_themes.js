const fs = require('fs');

const baseCss = fs.readFileSync('theme-damiaoo.css', 'utf-8');

const themes = {
    'tsinghua': {
        'primary': '#660874',
        'secondary': '#4a0555',
        'accent': '#b8906f',
        'name': 'Tsinghua Pro Max Theme (Purple)'
    },
    'mit': {
        'primary': '#A31F34',
        'secondary': '#7a1727',
        'accent': '#8A8B8C',
        'name': 'MIT Pro Max Theme (Crimson & Silver)'
    },
    'fudan': {
        'primary': '#0F4C81',
        'secondary': '#0a355c',
        'accent': '#E03C31',
        'name': 'Fudan Pro Max Theme (Classic Blue)'
    },
    'tech': {
        'primary': '#1A1A1D',
        'secondary': '#0b0b0c',
        'accent': '#00E5FF',
        'name': 'Tech Corporate Theme (Dark & Cyan)'
    },
    'nature': {
        'primary': '#2d4a22',
        'secondary': '#1f3317',
        'accent': '#f4a261',
        'name': 'Ivy League Theme (Forest Green)'
    }
};

for (const [tag, colors] of Object.entries(themes)) {
    let newCss = baseCss;

    newCss = newCss.replace(/--color-primary:\s*#[a-fA-F0-9]{3,6};/g, `--color-primary: ${colors.primary};`);
    newCss = newCss.replace(/--color-secondary:\s*#[a-fA-F0-9]{3,6};/g, `--color-secondary: ${colors.secondary};`);
    newCss = newCss.replace(/--color-accent:\s*#[a-fA-F0-9]{3,6};/g, `--color-accent: ${colors.accent};`);
    newCss = newCss.replace(/SWJTU Pro Max Theme - Beautiful\.ai Style/g, colors.name);

    const outFile = `theme-${tag}.css`;
    fs.writeFileSync(outFile, newCss, 'utf-8');
    console.log(`Generated CSS Theme: ${outFile}`);
}
