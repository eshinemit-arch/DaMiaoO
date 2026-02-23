import re
import os

with open('swjtu-theme.css', 'r', encoding='utf-8') as f:
    old_css = f.read()

match = re.search(r"url\('data:image/png;base64,([^']+)'\)", old_css)
base64_str = match.group(1) if match else ''

new_css = f"""/* SWJTU Pro Max Theme - Beautiful.ai Style */

@import 'default';

/* =========================================
   GLOBAL VARIABLES & DESIGN TOKENS
   ========================================= */
section {{
  --color-primary: #003E7E;
  --color-secondary: #002b5e;
  --color-accent: #f05a28;
  --color-text-main: #1d1d1f;
  --color-text-muted: #86868b;
  --color-bg-base: #fbfbfd;
  --color-bg-surface: #ffffff;
  
  --font-family: 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-title: 'Microsoft YaHei', -apple-system, sans-serif;
  
  --radius-lg: 24px;
  --radius-md: 16px;
  --radius-sm: 8px;
  
  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 24px 48px rgba(0, 0, 0, 0.12);
  
  font-family: var(--font-family);
  color: var(--color-text-main);
  background-color: var(--color-bg-base);
  font-size: 28px;
  padding: 60px 80px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}}

/* =========================================
   TYPOGRAPHY
   ========================================= */
h1, h2, h3, h4, h5, h6 {{
  font-family: var(--font-title);
  color: var(--color-primary);
  margin: 0 0 0.5em 0;
  line-height: 1.25;
  letter-spacing: -0.02em;
}}

h1 {{
  font-size: 2.2em;
  font-weight: 800;
  position: relative;
  padding-bottom: 20px;
}}

h1::after {{
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 60px;
  height: 6px;
  background-color: var(--color-accent);
  border-radius: 3px;
}}

h2 {{ font-size: 1.8em; font-weight: 700; }}
h3 {{ font-size: 1.4em; font-weight: 600; color: var(--color-text-main); }}

p {{ line-height: 1.6; margin-bottom: 1em; }}
strong {{ color: var(--color-primary); font-weight: 700; }}

/* =========================================
   LISTS & BULLETS
   ========================================= */
ul, ol {{ padding-left: 1.2em; line-height: 1.8; }}
li {{ margin-bottom: 0.5em; }}
li::marker {{ color: var(--color-primary); font-weight: bold; font-size: 1.2em; }}

/* =========================================
   HEADER & FOOTER (Marp Directives)
   ========================================= */
header {{
  position: absolute; top: 30px; left: 80px; right: 80px;
  color: var(--color-text-muted); font-size: 0.5em; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 10px;
}}

footer {{
  position: absolute; bottom: 30px; left: 80px;
  color: var(--color-text-muted); font-size: 0.5em;
}}

section::after {{
  position: absolute; bottom: 30px; right: 80px;
  color: var(--color-text-muted); font-size: 0.5em; font-weight: bold;
}}

/* =========================================
   SLIDE LAYOUT: COVER (标题页)
   ========================================= */
section.cover {{
  background-image: url('data:image/png;base64,{base64}');
  background-size: cover;
  background-position: center;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 80px;
}}

section.cover::before {{
  content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(0,62,126,0.9) 0%, rgba(0,43,94,0.7) 100%);
  z-index: 1;
}}

section.cover * {{ position: relative; z-index: 2; }}

section.cover h1 {{
  font-size: 3.5em; color: #ffffff; padding-bottom: 0; text-shadow: var(--shadow-sm);
}}
section.cover h1::after {{ display: none; }}

section.cover h2 {{
  font-size: 1.6em; color: rgba(255,255,255,0.9); font-weight: 400; margin-top: 20px;
}}

section.cover h3 {{
  color: rgba(255,255,255,0.7); font-size: 1.1em; font-weight: 400; margin-top: auto;
}}

section.cover header, section.cover footer, section.cover::after {{ display: none; }}

/* =========================================
   SLIDE LAYOUT: FOCUS (大字强调)
   ========================================= */
section.focus {{
  background-color: var(--color-primary);
  background-image: radial-gradient(circle at top right, var(--color-secondary), var(--color-primary));
  color: white; justify-content: center; align-items: flex-start;
}}

section.focus h1, section.focus h2, section.focus h3, section.focus p, section.focus li {{ color: white; }}
section.focus h1::after {{ background-color: var(--color-accent); }}
section.focus header, section.focus footer, section.focus::after {{ color: rgba(255,255,255,0.5); border-bottom-color: rgba(255,255,255,0.1); }}
section.focus li::marker {{ color: var(--color-accent); }}

/* =========================================
   SLIDE LAYOUT: SPLIT (图文双栏)
   ========================================= */
section.split {{
  display: grid; grid-template-columns: 1.2fr 1fr; gap: 60px; align-items: center;
}}
section.split h1 {{ grid-column: 1 / -1; margin-bottom: 20px; align-self: start; }}
section.split p:last-of-type, section.split img {{ margin: 0; width: 100%; height: 100%; min-height: 400px;
  object-fit: cover; border-radius: var(--radius-md); box-shadow: var(--shadow-md);
}}
section.split.gap-small {{ grid-template-columns: 1fr 1fr; gap: 40px; }}

/* =========================================
   TABLES (高质感表格)
   ========================================= */
table {{
  width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 1em;
  background: var(--color-bg-surface); border-radius: var(--radius-md);
  overflow: hidden; box-shadow: var(--shadow-sm); border: 1px solid #eaeaea;
}}
th {{ background-color: #f4f5f7; color: var(--color-primary); font-weight: 600; padding: 18px 24px; text-align: left; border-bottom: 2px solid #eaeaea; }}
td {{ padding: 16px 24px; border-bottom: 1px solid #f0f0f0; color: var(--color-text-main); }}
tr:last-child td {{ border-bottom: none; }}
tr:hover td {{ background-color: #fcfcfd; }}

/* =========================================
   BLOCKQUOTES (引用强调)
   ========================================= */
blockquote {{
  margin: 1.5em 0; padding: 1.5em 2em; background: var(--color-bg-surface);
  border-left: 6px solid var(--color-accent); border-radius: 0 var(--radius-md) var(--radius-md) 0; box-shadow: var(--shadow-sm);
}}
blockquote p {{ font-size: 1.25em; font-style: italic; color: var(--color-secondary); margin: 0; }}

/* =========================================
   IMAGE STYLES
   ========================================= */
img {{ border-radius: var(--radius-md); max-width: 100%; }}
img[alt~="shadow"] {{ box-shadow: var(--shadow-md); }}
img[alt~="center"] {{ display: block; margin: 0 auto; }}

/* =========================================
   CODE BLOCKS
   ========================================= */
pre {{ background: #1e1e1e; border-radius: var(--radius-md); padding: 1.5em; box-shadow: var(--shadow-md); overflow-x: auto; }}
code {{ font-family: 'Consolas', 'Fira Code', monospace; color: #d4d4d4; font-size: 0.85em; }}
"""

with open('swjtu-theme.css', 'w', encoding='utf-8') as f:
    f.write(new_css)
