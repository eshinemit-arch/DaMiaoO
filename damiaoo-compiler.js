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
        this.sections = [];
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
            this.sections = this.scanSections(marpContent);

            // 再次翻译以应用 TOC 内容 (如果需要)
            const finalMarpContent = this.translateToMarp(rawContent, true);
            fs.writeFileSync(tempMarpFile, finalMarpContent, 'utf-8');

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
                title: /^title[:：]\s*["']?(.+?)["']?$/m,
                author: /^author[:：]\s*["']?(.+?)["']?$/m,
                date: /^date[:：]\s*["']?(.+?)["']?$/m,
                thanks: /^thanks[:：]\s*["']?(.+?)["']?$/m,
                theme: /^theme[:：]\s*["']?(.+?)["']?$/m
            };
            for (let [key, regex] of Object.entries(pairs)) {
                const match = fm.match(regex);
                if (match) meta[key] = this.stripMarkdown(match[1].trim());
            }
        }
        return meta;
    }

    stripMarkdown(text) {
        return text.replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1');
    }

    scanSections(content) {
        const lines = content.split('\n');
        const sections = [];
        // 查找所有二级标题作为目录项
        const r2Regex = /^[ \t]*##[ \t]+(.+)$/;
        lines.forEach(line => {
            const match = line.match(r2Regex);
            if (match) {
                sections.push(this.stripMarkdown(match[1].trim()));
            }
        });
        return sections;
    }

    translateToMarp(content, applyTOC = false) {
        // 1. 分离 Frontmatter 和 正文
        let frontmatter = "";
        let body = content;
        const fmMatch = content.match(/^---([\s\S]+?)---/);

        if (fmMatch) {
            const rawFm = fmMatch[1];
            const marpDirectives = ['marp', 'theme', 'paginate', 'footer', 'header', 'size', 'style', 'backgroundColor'];
            const filteredFm = rawFm.split('\n').filter(line => {
                const key = line.split(':')[0].trim();
                return marpDirectives.includes(key);
            }).join('\n');

            frontmatter = `---\n${filteredFm}\n---\n\n`;
            body = content.replace(fmMatch[0], '').trim();
        }

        // 2. 预检测：搜寻目录意图（同时检测原始标签和已转换的 Marp 指令）
        let hasTOC = body.includes('@[toc]') || body.includes('_class: toc') || /^\s*#+\s+(目录|TOC|Table of Contents|Contents)\s*$/mi.test(body);

        // 3. 处理正文每一页
        let slides = body.split(/^---\s*$/gm);

        // 如果全文无目录，且不是第一遍扫描，则在封面后注入一个
        if (!hasTOC && applyTOC) {
            // 找到封面位置 (通常是第一个 slide)
            slides.splice(1, 0, "@[toc]");
        }

        const translatedSlides = slides.map(slide => {
            let processed = slide.trim();
            if (!processed) return "";

            // A. 处理封面/封底
            const systemMatch = processed.match(/^[ \t]*@\[(front|back)\][ \t]*$/m);
            if (systemMatch) {
                const type = systemMatch[1];
                processed = processed.replace(/^[ \t]*@\[(front|back)\][ \t]*$/m, '').trim();

                const title = (this.meta.title || 'DaMiaoo Doc').replace(/\\\\/g, '<br>');
                const author = this.meta.author || '';
                const date = this.meta.date || '';
                const thanks = (this.meta.thanks || '感谢您的观看').replace(/\\\\/g, '<br>');

                if (!processed.match(/^#\s+/m)) {
                    processed = `# ${type === 'front' ? title : thanks}\n${processed}`;
                }
                if (type === 'front' && !processed.match(/^##\s+/m) && author && author !== 'DaMiaoo') {
                    let subtitle = `\n\n## ${author}`;
                    if (date) subtitle += `\n### ${date}`;
                    processed += subtitle;
                }

                return `<!-- _class: cover -->\n\n${processed}`;
            }

            // B. 处理 [toc] 标签及其自动化内容
            if (processed.includes('@[toc]')) {
                const hasList = processed.match(/^\s*([-*+]|\d+[\.\)])\s+/m);
                
                // 1. [补齐标题]：如果用户没写标题，JS 才帮他补上
                if (!processed.match(/^[ \t]*#\s+/m)) {
                    processed = `# 目录\n\n${processed}`;
                }

                // 2. [补齐列表]：如果 Preprocessor 没填，这里补上（手动目录不会进这里）
                if (!hasList && applyTOC && this.sections.length > 0) {
                    const tocList = this.sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
                    processed += `\n\n${tocList}`;
                }

                // 3. [转换标签]
                processed = processed.replace(/^[ \t]*@\[toc(?:[:：](\d+))?\][ \t]*$/gm, (match, param) => {
                    let directive = `<!-- _class: toc -->`;
                    if (param !== undefined) {
                        directive += `\n<!-- _style: "section.toc :is(ul, ol) { counter-reset: toc-counter ${param}; }" -->`;
                    }
                    return directive;
                });
            }

            // C. 处理其余通用布局标签
            processed = processed.replace(/^[ \t]*@\[([a-zA-Z0-9-]+)(?::(\d+))?\][ \t]*$/gm, (match, layout, param) => {
                if (layout === 'toc') return match; // 已处理
                return `<!-- _class: ${layout} -->`;
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
