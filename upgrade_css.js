const fs = require('fs');

let css = fs.readFileSync('theme-damiaoo.css', 'utf-8');

// 1. Remove generic h1, h2, h3 blocks
css = css.replace(/^h1 \{\s*[\s\S]*?^\}\s*$/m, '');
css = css.replace(/^h1::after \{\s*[\s\S]*?^\}\s*$/m, '');
css = css.replace(/^h2 \{\s*[\s\S]*?^\}\s*$/m, '');
css = css.replace(/^h3 \{\s*[\s\S]*?^\}\s*$/m, '');

// 2. Add the intelligent heading logic just after the h1..h6 font definitions
const newGeneric = `
/* All headings default to subtitle styles unless they are the primary */
:is(h1, h2, h3, h4, h5, h6) {
  font-size: 1.4em;
  font-weight: 600;
  color: var(--color-text-main);
}

/* 自动升格特性：每一页的第一个主标题，不管你是几级标签，全自动赋予大标题视觉表现 */
section > :is(h1, h2, h3, h4, h5, h6):first-of-type {
  font-size: 2.2em;
  font-weight: 800;
  position: relative;
  padding-bottom: 20px;
  color: var(--color-primary);
}

section > :is(h1, h2, h3, h4, h5, h6):first-of-type::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 60px;
  height: 6px;
  background-color: var(--color-accent);
  border-radius: 3px;
}
`;

css = css.replace(/(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[\s\S]*?\})/, `$1\n${newGeneric}\n`);

// 3. Upgrade all layout-specific components to be level-agnostic
const replaceHeading = (suffix) => `:is(h1, h2, h3, h4, h5, h6):nth-of-type(${suffix})`;

const layouts = ['cover', 'focus', 'quote', 'metric', 'toc', 'section'];
for (const layout of layouts) {
  css = css.replace(new RegExp(`section\\.${layout} h1`, 'g'), `section.${layout} ${replaceHeading(1)}`);
  css = css.replace(new RegExp(`section\\.${layout} h2`, 'g'), `section.${layout} ${replaceHeading(2)}`);
  css = css.replace(new RegExp(`section\\.${layout} h3`, 'g'), `section.${layout} ${replaceHeading(3)}`);
}

// Split layout specific
css = css.replace(/section\.split\s*>\s*h1/g, `section.split > ${replaceHeading(1)}`);

fs.writeFileSync('theme-damiaoo.css', css, 'utf-8');
console.log('CSS upgrading complete.');

