const fs = require('fs');

let css = fs.readFileSync('swjtu-theme.css', 'utf-8');

// 1. Fix Marp strong rendering issues in CSS
css = css.replace(/strong\s*\{[^}]+\}/g, 'b, strong {\n  color: var(--color-accent) !important;\n  font-weight: 800 !important;\n}');

// 2. Fix readability over big images (Cover & Back)
// Replace the gradient overlay with a solid block overlay
// the current regex might fail so we'll just redefine section.cover::before
const newOverlay = `/* Block backdrop for cover */
section.cover::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85%;
  height: 75%;
  background: rgba(0, 30, 70, 0.90);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(8px);
}`;

css = css.replace(/section\.cover::before\s*\{[\s\S]*?z-index:\s*1;\n\}/m, newOverlay);

fs.writeFileSync('swjtu-theme.css', css, 'utf-8');
