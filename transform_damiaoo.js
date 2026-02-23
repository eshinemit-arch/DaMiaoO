const fs = require('fs');

console.log('Starting DaMiaoo transformation...');

// 1. Process CSS
let css = fs.readFileSync('swjtu-theme.css', 'utf-8');
css = css.replace(/SWJTU Pro Max Theme/gi, 'DaMiaoo Theme');
css = css.replace(/西南交通大学/g, '');
css = css.replace(/swjtu-theme/gi, 'theme-damiaoo');
fs.writeFileSync('theme-damiaoo.css', css, 'utf-8');
if (fs.existsSync('swjtu-theme.css')) fs.unlinkSync('swjtu-theme.css');
console.log('CSS transformed to theme-damiaoo.css');

// 2. Process builder.js
let builder = fs.readFileSync('builder.js', 'utf-8');
builder = builder.replace(/西南交通大学.*?引擎/g, 'DaMiaoo 演示文稿自动化引擎');
builder = builder.replace(/swjtu-theme/g, 'theme-damiaoo');
fs.writeFileSync('builder.js', builder, 'utf-8');
console.log('builder.js updated');

// 3. Process generate_themes.js
let gen = fs.readFileSync('generate_themes.js', 'utf-8');
gen = gen.replace(/swjtu-theme\.css/g, 'theme-damiaoo.css');
gen = gen.replace(/SWJTU Pro Max Theme - Beautiful\.ai Style/g, 'DaMiaoo Theme');
fs.writeFileSync('generate_themes.js', gen, 'utf-8');
console.log('generate_themes.js updated');

console.log('Transformation complete!');
