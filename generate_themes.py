import os
import re

with open('swjtu-theme.css', 'r', encoding='utf-8') as f:
    base_css = f.read()

# Define new color palettes
themes = {
    'tsinghua': {
        'primary': '#660874',      # 清华紫
        'secondary': '#4a0555',    # 深紫
        'accent': '#b8906f',       # 香槟金/校徽金
        'name': 'Tsinghua Pro Max Theme (Purple)'
    },
    'mit': {
        'primary': '#A31F34',      # MIT 红色
        'secondary': '#7a1727',    # 深红
        'accent': '#8A8B8C',       # 银灰色
        'name': 'MIT Pro Max Theme (Crimson & Silver)'
    },
    'fudan': {
        'primary': '#0F4C81',      # 复旦蓝 (经典 Pantone 经典蓝)
        'secondary': '#0a355c',    # 深蓝
        'accent': '#E03C31',       # 亮红点缀
        'name': 'Fudan Pro Max Theme (Classic Blue)'
    },
    'tech': {
        'primary': '#1A1A1D',      # 暗黑科技风 (极简黑)
        'secondary': '#0b0b0c',    # 纯黑
        'accent': '#00E5FF',       # 荧光青蓝 (Cyberpunk)
        'name': 'Tech Corporate Theme (Dark & Cyan)'
    },
    'nature': {
         'primary': '#2d4a22',     # 常春藤墨绿
         'secondary': '#1f3317',   # 深林绿
         'accent': '#f4a261',      # 暖橘色/日落色
         'name': 'Ivy League Theme (Forest Green)'
    }
}

for theme_tag, colors in themes.items():
    new_css = base_css
    
    # Replace variables
    new_css = re.sub(r'--color-primary:\s*#[a-fA-F0-9]+;', f'--color-primary: {colors["primary"]};', new_css)
    new_css = re.sub(r'--color-secondary:\s*#[a-fA-F0-9]+;', f'--color-secondary: {colors["secondary"]};', new_css)
    new_css = re.sub(r'--color-accent:\s*#[a-fA-F0-9]+;', f'--color-accent: {colors["accent"]};', new_css)
    
    # Replace the theme header comment
    new_css = new_css.replace('SWJTU Pro Max Theme - Beautiful.ai Style', colors['name'])
    
    # Save to file
    out_file = f'theme-{theme_tag}.css'
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(new_css)
        
    print(f"Generated: {out_file}")
