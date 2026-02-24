const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DaMiaooCompiler {
    constructor(inputFile, meta = {}, config = {}) {
        this.inputFile = path.resolve(inputFile);
        this.dir = path.dirname(this.inputFile);

        let baseName = path.basename(this.inputFile);
        // 如果输入文件不是以 .process_ 或 .compiled_ 等中间前缀开头，说明是用户原始文件
        // 则在输出时加上 .compile_ 前缀，以保护原文件不被覆盖
        if (!baseName.match(/^\.?(process|compiled|compile)_/)) {
            this.originalFileName = `.compile_${baseName}`;
            this.rawBaseName = baseName.replace(/\.md$/, '');
        } else {
            // 否则剥离前缀作为正式输出文件名
            this.rawBaseName = baseName.replace(/^\.?(process|compiled|compile)_/, '').replace(/\.md$/, '');
            this.originalFileName = this.rawBaseName + '.md';
        }

        this.meta = meta;
        this.config = {
            format: config.format || 'pptx' // can be pdf, html, pptx
        };
    }

    run() {
        console.log('\n[🚀] 正在触发 Marp 核心渲染引擎...');
        const tempMarpFile = path.join(this.dir, `.compile_${this.rawBaseName}.md`);

        try {
            const rawContent = fs.readFileSync(this.inputFile, 'utf-8');

            // 如果元数据为空，尝试从当前文件实时提取 (专家独立模式)
            if (!this.meta.title) {
                this.meta = { ...this.meta, ...this.extractMeta(rawContent) };
            }

            const marpContent = this.translateToMarp(rawContent);
            fs.writeFileSync(tempMarpFile, marpContent, 'utf-8');

            const ext = this.config.format === 'html' ? '.html' : (this.config.format === 'pdf' ? '.pdf' : '.pptx');
            const outputFile = path.join(this.dir, this.rawBaseName + ext);

            // 主题定位逻辑
            let themeName = this.meta.theme || 'damiaoo';
            let themeFile = themeName.endsWith('.css') ? themeName : `${themeName}.css`;
            let themePath = path.resolve(this.dir, themeFile);
            if (!fs.existsSync(themePath)) {
                const prefixedPath = path.resolve(this.dir, `theme-${themeFile}`);
                if (fs.existsSync(prefixedPath)) themePath = prefixedPath;
            }

            console.log(`[*] 渲染翻译：DaMiaoo 语法 -> Marp 标准指令 [Done]`);
            console.log(`[*] 使用主题：${path.basename(themePath)}`);

            let formatArg = '';
            if (this.config.format === 'pdf') formatArg = '--pdf';
            if (this.config.format === 'html') formatArg = '--html';

            const cmd = `npx.cmd @marp-team/marp-cli "${tempMarpFile}" --theme "${themePath}" --allow-local-files -o "${outputFile}" --no-stdin ${formatArg}`;
            execSync(cmd, { stdio: 'inherit' });

            console.log(`\n[🎉] 构建成功: ${path.basename(outputFile)}`);
            return { success: true, outputFile };
        } catch (e) {
            console.error('\n[!] Marp 转换失败。请检查文件占用、CSS 语法或内容格式。');
            console.error(e);
            return { success: false, error: e };
        } finally {
            // 保留工作记录，不再删除中间文件
            // if (fs.existsSync(tempMarpFile)) fs.unlinkSync(tempMarpFile);
        }
    }

    extractMeta(content) {
        const meta = { theme: 'damiaoo' };
        const fmMatch = content.match(/^---([\s\S]+?)---/);
        if (fmMatch) {
            const fm = fmMatch[1];
            const pairs = {
                title: /^title:\s*["']?(.+?)["']?$/m,
                author: /^author:\s*["']?(.+?)["']?$/m,
                date: /^date:\s*["']?(.+?)["']?$/m,
                thanks: /^thanks:\s*["']?(.+?)["']?$/m,
                theme: /^theme:\s*["']?(.+?)["']?$/m
            };
            for (let [key, regex] of Object.entries(pairs)) {
                const match = fm.match(regex);
                if (match) meta[key] = match[1].trim();
            }
        }
        return meta;
    }

    translateToMarp(content) {
        // 1. 分离 Frontmatter 和 正文
        let frontmatter = "";
        let body = content;
        const fmMatch = content.match(/^---([\s\S]+?)---/);

        if (fmMatch) {
            const rawFm = fmMatch[1];
            // 过滤：仅保留 Marp 需要的指令，移除自定义标签防止其渲染
            const marpDirectives = ['marp', 'theme', 'paginate', 'footer', 'header', 'size', 'style', 'backgroundColor'];
            const filteredFm = rawFm.split('\n').filter(line => {
                const key = line.split(':')[0].trim();
                return marpDirectives.includes(key);
            }).join('\n');

            frontmatter = `---\n${filteredFm}\n---\n\n`;
            body = content.replace(fmMatch[0], '').trim();
        }

        // 2. 处理正文每一页
        const slides = body.split(/^---\s*$/gm);
        const translatedSlides = slides.map(slide => {
            let processed = slide.trim();
            if (!processed) return "";

            // A. 处理封面/封底 (系统指令，强制触发封面布局)
            const systemMatch = processed.match(/^[ \t]*@\[(front|back)\][ \t]*$/m);
            if (systemMatch) {
                const type = systemMatch[1];
                processed = processed.replace(/^[ \t]*@\[(front|back)\][ \t]*$/m, '').trim();

                const title = (this.meta.title || 'DaMiaoo Doc').replace(/\\\\/g, '<br>');
                const author = this.meta.author || '';
                const date = this.meta.date || '';
                const thanks = (this.meta.thanks || '感谢您的观看').replace(/\\\\/g, '<br>');

                // 智能元数据补全
                if (!processed.match(/^#\s+/m)) {
                    processed = `# ${type === 'front' ? title : thanks}\n${processed}`;
                }
                if (type === 'front' && !processed.match(/^##\s+/m)) {
                    processed += `\n\n## ${author}\n### ${date}`;
                }

                return `<!-- _class: cover -->\n\n${processed}`;
            }

            // B. 处理通用布局标签 (通过 replace 归一化为 Marp 指令)
            processed = processed.replace(/^[ \t]*@\[([a-zA-Z0-9-]+)(?::(\d+))?\][ \t]*$/gm, (match, layout, param) => {
                let directive = `<!-- _class: ${layout} -->`;
                if (layout === 'toc' && param !== undefined) {
                    // [优化] 使用 Marp 内联样式指令而非原始 HTML 标签，使中间件更整洁
                    directive += `\n<!-- _style: "section.toc :is(ul, ol) { counter-reset: toc-counter ${param}; }" -->`;
                }
                return directive;
            });

            return processed;
        });

        return frontmatter + translatedSlides.join('\n\n---\n\n');
    }
}

module.exports = DaMiaooCompiler;

// 独立运行逻辑
if (require.main === module) {
    const file = process.argv.find(arg => !arg.startsWith('--') && arg.endsWith('.md'));
    if (!file) {
        console.log('Usage: node damiaoo-compiler.js <file.md> [--pdf|--html]');
        process.exit(1);
    }

    let format = 'pptx';
    if (process.argv.includes('--pdf')) format = 'pdf';
    else if (process.argv.includes('--html')) format = 'html';

    new DaMiaooCompiler(file, {}, { format }).run();
}
