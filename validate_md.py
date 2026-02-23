# Pro Max Markdown-to-Presentation Validator
import sys
import re

def validate_markdown(file_path):
    print(f"[*] Validating Presentation Architecture: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"[!] Error: Could not read file - {e}")
        return False

    slides = content.split('---')
    if len(slides) < 2:
        print("[!] Error: Not a valid Marp Markdown file. Missing slide separators (---).")
        return False
        
    has_error = False
    
    # Check Frontmatter
    frontmatter = slides[0]
    if 'marp: true' not in frontmatter:
        print("[X] 致命错误: 缺少 'marp: true' 声明。这不是一个合法的演示文档。")
        has_error = True
    
    # Process each slide
    for idx, slide in enumerate(slides[1:], start=1):
        if not slide.strip():
            continue
            
        # 1. Check for split layout consistency
        if '<!-- _class: split -->' in slide:
            # A split layout MUST have an image and some text
            if '![' not in slide:
                print(f"[X] 语法错误 (幻灯片 {idx}): 使用了 'split' 双栏图文布局，但是没有发现图片标记 `![alt](url)`！右侧栏将会空白。")
                has_error = True
        
        # 2. Check for Text Overflow (Product Logic constraint)
        # Remove HTML comments, image links, and header hashes for word count
        text_only = re.sub(r'<!--.*?-->', '', slide)
        text_only = re.sub(r'!\[.*?\]\(.*?\)', '', text_only)
        text_only = re.sub(r'#+\s*', '', text_only)
        
        # very simple heuristic for word count roughly
        words = len(text_only.split())
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text_only))
        total_length = words + chinese_chars
        
        if total_length > 150:
            print(f"[!] 视觉警告 (幻灯片 {idx}): 文本量过大 (约 {total_length} 个视觉词符)。文字如果过多会自动缩小，破坏交大模板的留白高级感。建议将此页拆分为两页！")
            
        # 3. Check for proper headings
        has_h1 = bool(re.search(r'^#\s+', slide, flags=re.MULTILINE))
        has_h2_only = bool(re.search(r'^##\s+', slide, flags=re.MULTILINE)) and not has_h1
        
        if 'cover' not in slide and has_h2_only:
            print(f"[?] 格式建议 (幻灯片 {idx}): 该页只有二级标题 (##) 没有一级主标题 (#)。为保证顶部蓝线的统一，建议每个正文页包含一个 # 主标题。")

    if has_error:
        print("\n[🚫] 校验失败: Markdown 语法不符合 Beautiful.ai 设计规范，停止编译。请修复上述致命错误。")
        return False
    else:
        print("\n[✅] 校验通过: 完美契合设计规范。可以编译进入下一阶段！")
        return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_md.py <file.md>")
        sys.exit(1)
        
    md_file = sys.argv[1]
    is_valid = validate_markdown(md_file)
    
    if not is_valid:
        sys.exit(1)
