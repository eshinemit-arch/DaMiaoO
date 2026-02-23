const fs = require('fs');

let css = fs.readFileSync('swjtu-theme.css', 'utf-8');

// The goal is to make Cover and Back looks exceptionally beautiful and professional.
// We will replace the existing cover styles with a new high-end geometric aesthetic, commonly seen in top university branding.

const newCoverStyle = `/* =========================================
   SLIDE LAYOUT: COVER (标题页 & 封底页)
   ========================================= */
section.cover {
  /* Using a clear, distinct solid minimal background instead of a full photo which can be noisy */
  background: var(--color-bg-surface);
  
  /* Geometric split logic: Left side solid color, Right side logo/photo logic, or a bottom heavy layout */
  /* Here we will do a highly modern "Card on a Dark Canvas" look */
  background-color: var(--color-primary);
  background-image: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 80px 120px;
}

section.cover::after {
  display: none !important;
}

/* We create an elegant white frosted glass card inside the cover to frame the text */
section.cover h1 {
  background: rgba(255, 255, 255, 0.95);
  color: var(--color-primary);
  padding: 40px 60px;
  margin: 0;
  border-radius: 20px 20px 0 0;
  font-size: 3.5em;
  font-weight: 800;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  z-index: 2;
  position: relative;
}

section.cover h1::after {
  content: '';
  position: absolute;
  left: 60px;
  bottom: 0px;
  width: 100px;
  height: 6px;
  background-color: var(--color-accent);
  border-radius: 3px;
}

section.cover h2 {
  background: rgba(255, 255, 255, 0.95);
  color: var(--color-text-main);
  padding: 20px 60px 40px 60px;
  margin: 0;
  border-radius: 0 0 20px 20px;
  font-size: 1.6em;
  font-weight: 400;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  z-index: 2;
  position: relative;
}

/* Secondary meta info sits below the card */
section.cover h3 {
  color: rgba(255,255,255,0.7);
  font-size: 1.2em;
  font-weight: 400;
  margin-top: 40px;
  padding-left: 20px;
  border-left: 4px solid var(--color-accent);
}

/* Removing any stray header/footer from cover */
section.cover header, section.cover footer {
  display: none;
}
`;

// Remove the old cover definition
css = css.replace(/\/\* =========================================\n\s*SLIDE LAYOUT: COVER.*?section\.cover footer,\s*section\.cover::after\s*\{\s*display:\s*none;\s*\}/gs, '');

// Append the new one before the next section
css = css.replace('/* =========================================\n   SLIDE LAYOUT: FOCUS', newCoverStyle + '\n\n/* =========================================\n   SLIDE LAYOUT: FOCUS');


fs.writeFileSync('swjtu-theme.css', css, 'utf-8');
