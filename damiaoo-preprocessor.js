const fs = require('fs');
const path = require('path');

class DaMiaooPreprocessor {
    static REGEX = {
        FRONTMATTER: /^---\r?\n([\s\S]*?)\r?\n---/,
        HEADING: /^(#+)\s+(.+)$/,
        LAYOUT_TAG: /^\s*@\[([a-zA-Z0-9-]+)\]/m,
        LAYOUT_DIRECTIVE_GLOBAL: /^\s*@\[([a-zA-Z0-9-]+)\]/gm,
        IMAGE: /!\[.*?\]\(.*?\)/,
        MARP_DECLARATION: /marp: true/,
        HTML_TAGS: /<[^>]*>/g,
        COMMENTS: /<!--.*?-->/gs,
        LIST_ITEM: /^\s*\d+\.\s+/,
        ANY_LIST_ITEM: /^\s*([-*+]|\d+[\.\)])\s+/,
        SECTION_NUMBERING: /^((第?\s*[0-9一二三四五六七八九十百]+\s*(章节|部分|节|单元|模块|章|部))|(Chapter|Section|Part|Module)\s*\d+|[一二三四五六七八九十百]+\s*[、\.\s]|0?\d+[\.\s\)]+|[0-9\.]+)([\.\:\：\s、]*)\s*/i
    };

    constructor(inputFile, config = {}) {
        this.inputFile = path.resolve(inputFile);
        this.dir = path.dirname(this.inputFile);
        this.fileName = path.basename(this.inputFile);
        this.outputFile = path.join(this.dir, `.process_${this.fileName}`);

        this.hasError = false;
        this.meta = {};
        this.sections = [];
        this.config = {
            force: config.force || false,
            thresholds: {
                default: 250,
                chapter: 300,
                cover: 300,
                split: 400,
                quote: 400,
                cols: 450,
                toc: 2000
            }
        };
    }

    run() {
        this.logBanner();

        try {
            const rawContent = this.loadFile();

            // 阶段 1：解析及分离核心元数据与源码
            const { frontmatter, body } = this.preprocess(rawContent);

            // 阶段 2：层次结构深度分析
            const ranks = this.analyzeGlobalHierarchy(body);
            this.ranks = ranks;

            // 阶段 3：文档引言自动剥离 (Preamble Stripping)
            // 理由：首个 Rank 1 及其配套说明属于文档级信息，在 PPT 中已被 Cover 覆盖，应滤除以保持开门见山。
            let processedBody = this.stripDocumentPreamble(body, ranks);

            // 阶段 4：全局架构预切片 (Physical Pagination)
            const paginatedBody = this.applyPageSplitting(processedBody, ranks);
            let slides = this.splitIntoSlides(paginatedBody);

            // 阶段 5：架构地标锁定 (TOC & Chapters)
            this.sections = this.scanTOCEntries(slides, ranks.rank2);
            slides = this.tagInitialLandmarks(slides, ranks.rank2);

            // 系统页面注入 (Cover, TOC, Back) 并刷新终版目录
            slides = this.injectSystemPages(slides);
            this.sections = this.scanTOCEntries(slides, ranks.rank2);

            // 阶段 6：切片自治与微观排版 (Slide Processing Pipeline)
            const processedSlides = this.processSlideUnits(slides);

            if (this.hasError) {
                console.log('\n[🚫] 结构审查未通过：检测到严重的排版缺陷。请根据上述建议优化 MD 结构。');
                process.exit(1);
            }

            // 阶段 7：构建并输出最终资产
            const outputBody = processedSlides.map(s => s.trim()).filter(Boolean).join('\n\n---\n\n');

            // [优化] 重新构造 Frontmatter 展现提取后的 Title
            let fmLines = frontmatter.split('\n');
            if (!frontmatter.includes('title:')) {
                const pagIdx = fmLines.findIndex(l => l.includes('paginate: true'));
                const insertIdx = pagIdx !== -1 ? pagIdx + 1 : 2;
                fmLines.splice(insertIdx, 0, `title: ${this.meta.title}`);
            } else {
                fmLines = fmLines.map(line => {
                    if (line.startsWith('title:')) return `title: ${this.meta.title}`;
                    return line;
                });
            }
            const updatedFM = fmLines.join('\n');

            const finalContent = `${updatedFM}\n\n${outputBody}`;
            fs.writeFileSync(this.outputFile, finalContent, 'utf-8');
            console.log(`\n[✅] Markdown 预处理通过。中间件生成成功: ${path.basename(this.outputFile)}`);

            // 执行成果质量审计
            this.validateFinalOutput(finalContent);

            return {
                outputFile: this.outputFile,
                meta: this.meta,
                success: true
            };
        } catch (err) {
            console.error(`\n[!] 构建失败: ${err.message}`);
            if (this.config.force) console.error(err.stack);
            return { success: false, error: err };
        }
    }

    /**
     * 文档引言自动滤除系统：
     * 自动识别第一个 Rank 1 标题并剥离其后的说明文字，避免在 PPT 中产生冗余首页。
     */
    stripDocumentPreamble(body, ranks) {
        const lines = body.split(/\r?\n/);
        const rank1Regex = new RegExp(`^#{${ranks.rank1}}\\s+(.+)$`);

        let startIdx = -1;
        let endIdx = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const match = line.match(rank1Regex);
            if (match && startIdx === -1) {
                startIdx = i;
                const title = match[1].trim();
                if (this.meta.title === 'DaMiaoo 文稿' || !this.meta.title) {
                    this.meta.title = title;
                    console.log(`[*] 智能语义：从首个 Rank 1 提取标题 [${title}]，并自动滤除文档级引言。`);
                }
            } else if (startIdx !== -1) {
                // 命中下一个层级标题或手动分页符，代表引言结束
                if (line.match(/^#+/) || line.startsWith('---')) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (startIdx !== -1) {
            const before = lines.slice(0, startIdx);
            const after = endIdx !== -1 ? lines.slice(endIdx) : [];
            // 合并并清理前后的空行
            return [...before, ...after].join('\n').trim();
        }
        return body;
    }

    /**
     * 微观页面排版管道
     * 职责：物理碎片切分 -> 标题提权映射 -> 语义化适配
     */
    processSlideUnits(slides) {
        // 阶段 1：全局物理分页 pass (Density Check)
        // 职责：首先完成基于文字密度的物理拆分，为后续语义识别提供最基础的“视觉原子”
        let phase1 = [];
        for (const slide of slides) {
            const split = this.autoPaginateDefaultBody(slide);
            phase1.push(...split.split(/\n---\n/).map(s => s.trim()).filter(Boolean));
        }

        // 阶段 2：标题提权 pass (Title Promotion)
        // 职责：在分页完成后，统一将页面内的逻辑顶级标题提升为 Marp 视点级标题 (#)
        // 这样做可以确保后续的 inferLayout 能够基于标准化的标题层级进行判断
        let phase2 = phase1.map(slide => this.promoteLocalHeadings(slide));

        // 阶段 3：智能语义推演 pass (Layout Inference)
        // 职责：根据标准化后的结构，为每一页智能匹配最合适的版式标签 (@[tag])
        let phase3 = phase2.map(slide => this.inferLayout(slide));

        // 阶段 4：结构化扩充 pass (Flow Layout Pagination)
        // 职责：针对需要流式分布的版式（如 TOC、Cols、Cards）执行二次结构化分页
        let phase4 = [];
        for (const slide of phase3) {
            const exp = this.processStructuralExpansion(slide);
            phase4.push(...exp.split(/\n---\n/).map(s => s.trim()).filter(Boolean));
        }

        // 阶段 5：质量核验与生命体征审计 (Health Audit & Cleanup)
        let consecutiveShorts = 0;
        return phase4.map((slide, i) => {
            const cleanText = slide.replace(DaMiaooPreprocessor.REGEX.COMMENTS, '').replace(/^#.*$/gm, '').trim();
            const isShort = cleanText.length < 20 && !slide.includes('@[');

            // 碎片化缺陷拦截
            if (isShort && !slide.includes('@[front]')) {
                consecutiveShorts++;
                if (consecutiveShorts >= 3) {
                    const h3 = slide.match(/^###\s+(.+)$/m)?.[1] || "未命名子块";
                    this.fail(`[🚫] 结构性缺陷：检测到连续的碎片化 Rank 3 页面 (当前: ${h3})。\n    建议：为了保持文稿的张力，请将这些碎点合并到同一页，系统会自动推断为更高级的 @[cols] 分栏或 @[cards] 矩阵。`);
                }
            } else {
                consecutiveShorts = 0;
            }

            // 最终健康度报告
            this.validateSlideHealth(slide, i);
            return slide;
        });
    }

    /**
     * 最终生成物质量审计 (Quality Audit):
     * 在生成中间件后进行二次核验，并向控制台输出分析报表。
     */
    validateFinalOutput(content) {
        console.log('\n------------------------------------------------');
        console.log('         DaMiaoo 成果质量审计 (Quality Audit)');
        console.log('------------------------------------------------');

        const slides = content.split(/\n---\n/);
        const totalSlides = slides.length;
        const layoutCounts = {};
        let totalChars = 0;

        slides.forEach(s => {
            const layoutMatch = s.match(/@\[([a-zA-Z0-9-]+)/);
            const layout = layoutMatch ? layoutMatch[1] : 'default';
            layoutCounts[layout] = (layoutCounts[layout] || 0) + 1;

            const cleanText = s.replace(DaMiaooPreprocessor.REGEX.COMMENTS, '')
                .replace(DaMiaooPreprocessor.REGEX.HTML_TAGS, '')
                .replace(/^#.*/gm, '').trim();
            totalChars += cleanText.length;
        });

        console.log(`[📊] 全案规格: ${totalSlides} 页幻灯片 | 总计约 ${totalChars} 字`);
        console.log(`[📐] 平均密度: 每页 ${Math.round(totalChars / totalSlides)} 字 (理想值: 80-250)`);

        console.log('\n[🎨] 版式分布:');
        Object.entries(layoutCounts).forEach(([layout, count]) => {
            console.log(`    - ${layout.padEnd(10)}: ${count} 页`);
        });

        console.log('\n[🛤️] 架构确认:');
        if (this.sections.length > 0) {
            this.sections.forEach((s, idx) => {
                console.log(`    ${idx + 1}. ${s}`);
            });
        } else {
            console.log('    (未发现显式章节标识)');
        }

        console.log('------------------------------------------------\n');
    }

    logBanner() {
        console.log('==================================================');
        console.log('  DaMiaoo 演示文稿自动化引擎 - 预处理器 (Preprocessor)');
        console.log('==================================================\n');
        console.log(`[*] Target: ${this.fileName}`);
    }

    loadFile() {
        if (!fs.existsSync(this.inputFile)) {
            throw new Error(`输入文件不存在: ${this.fileName}`);
        }
        return fs.readFileSync(this.inputFile, 'utf-8');
    }

    /**
     * 前置处理：分离元数据与正文，并做基础校验
     * 重构目标：提高容错率，增强属性提取的健壮性
     */
    preprocess(content) {
        // 1. 分离 Frontmatter 与正文 (Body)
        const fmMatch = content.match(DaMiaooPreprocessor.REGEX.FRONTMATTER);
        let fmString = fmMatch ? fmMatch[1] : '';
        const body = fmMatch ? content.slice(fmMatch[0].length).trimStart() : content.trimStart();

        // 2. 自动化前导补全 (Never modify source, only output buffer)
        const hasMarp = DaMiaooPreprocessor.REGEX.MARP_DECLARATION.test(fmString);
        if (!hasMarp) {
            console.log('[*] 智能补全：脚本未发现 `marp: true` 声明，已在中间件中自动注入演示引擎配置。');
            fmString = `marp: true\npaginate: true\n${fmString}`;
        }

        if (fmString && !/theme:/i.test(fmString)) {
            fmString = `theme: damiaoo\n${fmString}`;
        }

        // 3. 元数据安全提取闭包 (Robust Meta Extraction)
        const extractMeta = (key, fallback) => {
            const regex = new RegExp(`^${key}:\\s*(?:["']?)(.*?)(?:["']?)\\s*$`, 'm');
            const match = fmString.match(regex);
            return (match && match[1].trim() !== '') ? match[1].trim() : fallback;
        };

        const defaultDate = new Date().toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        this.meta = {
            title: extractMeta('title', 'DaMiaoo 文稿'),
            author: extractMeta('author', 'DaMiaoo'),
            thanks: extractMeta('thanks', '感谢您的观看'),
            date: extractMeta('date', defaultDate),
            theme: extractMeta('theme', 'theme-damiaoo')
        };

        // 返回包含补全后指令的 Frontmatter
        return { frontmatter: `---\n${fmString.trim()}\n---`, body };
    }

    analyzeGlobalHierarchy(body) {
        console.log('[*] 正在分析文本语义结构...');
        const headings = body.match(/^#+/gm) || [];
        const uniqueLevels = [...new Set(headings.map(h => h.length))].sort((a, b) => a - b);

        const ranks = {
            rank1: uniqueLevels[0] || 1,
            rank2: uniqueLevels[1] || 2,
            rank3: uniqueLevels[2] || 3
        };
        console.log(`[*] 识别层级特色: Rank1(H${ranks.rank1}) | Rank2(H${ranks.rank2}) | Rank3(H${ranks.rank3})`);
        return ranks;
    }

    applyPageSplitting(body, ranks) {
        const lines = body.split(/\r?\n/);
        const result = [];
        let isBeginning = true;
        let inCodeBlock = false;

        const structuralLevels = [ranks.rank1, ranks.rank2, ranks.rank3];

        for (const line of lines) {
            // [修复] 代码块保护
            if (line.match(/^```/)) {
                inCodeBlock = !inCodeBlock;
                result.push(line);
                continue;
            }
            if (inCodeBlock) {
                result.push(line);
                continue;
            }

            const hMatch = line.match(DaMiaooPreprocessor.REGEX.HEADING);
            const lMatch = line.match(DaMiaooPreprocessor.REGEX.LAYOUT_TAG);

            const isLayoutTrigger = !!lMatch;
            const isHeadingTrigger = hMatch && structuralLevels.includes(hMatch[1].length);

            if ((isLayoutTrigger || isHeadingTrigger) && !isBeginning) {
                let lastSignificant = "";
                for (let j = result.length - 1; j >= 0; j--) {
                    const trimmed = result[j].trim();
                    if (trimmed && !trimmed.startsWith('<!--')) {
                        lastSignificant = trimmed;
                        break;
                    }
                }

                const isHeadingFollowingLayout = isHeadingTrigger && DaMiaooPreprocessor.REGEX.LAYOUT_TAG.test(lastSignificant);

                if (lastSignificant && !lastSignificant.startsWith('---') && !isHeadingFollowingLayout) {
                    result.push('---');
                }
            }

            if (line.trim() && !line.startsWith('---')) isBeginning = false;
            result.push(line);
        }
        return result.join('\n');
    }

    splitIntoSlides(body) {
        const slides = [];
        const lines = body.split(/\r?\n/);
        let currentSlide = [];
        let inCodeBlock = false;

        for (const line of lines) {
            if (line.match(/^```/)) inCodeBlock = !inCodeBlock;
            if (line.match(/^---\s*$/) && !inCodeBlock) {
                if (currentSlide.length > 0) slides.push(currentSlide.join('\n'));
                currentSlide = [];
            } else {
                currentSlide.push(line);
            }
        }
        if (currentSlide.length > 0) slides.push(currentSlide.join('\n'));
        return slides.map(s => s.trim()).filter(Boolean);
    }

    ensurePage(slides, tag, position = 'end') {
        const regex = new RegExp(`^\\s*@\\[${tag}\\]`, 'm');
        if (!slides.some(s => regex.test(s))) {
            if (position === 'start') slides.unshift(`@[${tag}]`);
            else if (position === 'toc') slides.splice(1, 0, `@[${tag}]`);
            else slides.push(`@[${tag}]`);
        }
    }

    injectSystemPages(slides) {
        this.ensurePage(slides, 'front', 'start');
        this.ensurePage(slides, 'toc', 'toc');
        this.ensurePage(slides, 'back', 'end');
        return slides;
    }

    scanTOCEntries(slides, rank2) {
        const entries = [];
        const r2Regex = new RegExp(`^[ \t]*#{${rank2}}[ \t]+(.+)$`, 'm');

        slides.forEach(slide => {
            if (slide.match(/^\s*@\[(front|back|toc)\]/m)) return;
            const m = slide.match(r2Regex);
            if (m) {
                const { clean, index } = this.normalizeHeadingText(m[1].trim());
                let text = clean;

                if (text.length > 18) {
                    text = text.substring(0, 18) + '...';
                    console.log(`[!] 标题警告：章节标题 [${clean}] 已截断为 [${text}]`);
                }

                // 使用无序列表语法，由 CSS 计数器接管编号显示
                entries.push(`- ${text}`);
            }
        });
        return entries;
    }

    promoteLocalHeadings(slide) {
        // [语义保护] 封面、封底和目录拥有独立渲染引擎，不介入通用提权
        if (slide.match(/^\s*@\[(front|back|toc)\]/m)) return slide;

        // [核心优化] 预处理代码块：提权引擎应无视代码块内部的 # 符号 (如 Bash 注释)
        // 否则会导致页内级别计算错误，进而产生 ## 标题。
        const noCodeText = slide.replace(/```[\s\S]*?```/g, '');
        const matches = noCodeText.match(/^#+/gm) || [];
        if (matches.length === 0) return slide;

        const levels = [...new Set(matches.map(h => h.length))].sort((a, b) => a - b);
        const [l1, l2, l3] = [levels[0], levels[1], levels[2]];

        let inCodeBlock = false;
        return slide.split(/\r?\n/).map(line => {
            if (line.trim().startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                return line;
            }
            if (inCodeBlock) return line;

            const m = line.match(DaMiaooPreprocessor.REGEX.HEADING);
            if (!m) return line;

            const level = m[1].length;
            const rawText = m[2];

            // 归一化映射：Local 最顶级标题始终提升为 Marp 视点级标题 (#)
            if (level === l1) return `# ${rawText}`;
            if (level === l2) return `## ${rawText}`;
            if (level === l3) return `### ${rawText}`;
            return `1. ${rawText}`;
        }).join('\n');
    }

    processFinalSlidePipeline(slide, index) {
        const directives = slide.match(DaMiaooPreprocessor.REGEX.LAYOUT_DIRECTIVE_GLOBAL) || [];
        if (directives.length > 1) {
            this.fail(`幻灯片 #${index + 1}: 检测到 ${directives.length} 个布局标签。每页仅允许唯一版式指令。`);
        }

        // 核心重构：先按照“结构逻辑”进行分页，再为分页后的每一页推断版式
        // 这样可以解决“一页里又有表又有引用”导致的布局冲突
        const paginatedParts = this.autoPaginateDefaultBody(slide);

        const processedParts = paginatedParts.split(/\n---\n/).map(part => {
            let p = part.trim();
            if (!p) return "";

            // 1. 语义识别 (赋予智能标签)
            p = this.inferLayout(p);

            // 2. 结构处理 (流式版式分页，如 @[toc])
            p = this.processStructuralExpansion(p);

            // 3. 视觉密度校验
            this.validateSlideHealth(p, index);

            return p;
        });

        return processedParts.filter(Boolean).join('\n---\n');
    }

    /**
     * 智能化结构拆分 (The Multi-Structural Splitter):
     * 识别页面内的混合结构（如表格+引用），并根据内容密度强制拆分。
     */
    autoPaginateDefaultBody(slide) {
        const atomicLayouts = /@\[(split|quote|metric|focus|cards|cols\d)\]/;
        if (slide.match(atomicLayouts)) return slide;

        // [修复] 分段逻辑需保护代码块，避免在代码块内部切分
        const lines = slide.split(/\r?\n/);
        const paragraphs = [];
        let currentP = [];
        let inCodeBlock = false;

        for (const line of lines) {
            if (line.match(/^```/)) inCodeBlock = !inCodeBlock;
            if (line.trim() === '' && !inCodeBlock) {
                if (currentP.length > 0) {
                    paragraphs.push(currentP.join('\n'));
                    currentP = [];
                }
            } else {
                currentP.push(line);
            }
        }
        if (currentP.length > 0) paragraphs.push(currentP.join('\n'));

        if (paragraphs.length <= 1) return slide;

        const subSlides = [];
        let currentBuffer = [];
        let currentLen = 0;

        const isStructured = (p) => p.includes('```') || /^\s*\|/m.test(p) || /^\s*>/m.test(p) || DaMiaooPreprocessor.REGEX.ANY_LIST_ITEM.test(p);

        paragraphs.forEach((p, idx) => {
            const pLen = p.trim().length;
            // [优化] 提高结构化拆分门槛 (从 80 -> 200)
            // 理由：短文本配合列表是极佳的排版，不应强行拆散导致幻灯片碎片化。
            const hasStructuralBreak = isStructured(p) && currentBuffer.length > 0 && (currentLen > 200 || isStructured(currentBuffer[currentBuffer.length - 1]));

            if ((currentLen + pLen > this.config.thresholds.default || hasStructuralBreak) && currentBuffer.length > 0) {
                subSlides.push(currentBuffer.join('\n\n'));
                currentBuffer = [p];
                currentLen = pLen;
            } else {
                currentBuffer.push(p);
                currentLen += pLen;
            }
        });
        if (currentBuffer.length > 0) subSlides.push(currentBuffer.join('\n\n'));

        if (subSlides.length <= 1) return slide;

        const headerMatch = slide.match(/^(#+)\s+(.+)$/m);
        if (headerMatch) {
            const hText = headerMatch[2];
            console.log(`[!] 结构优化：检测到 Slide #${subSlides.length > 1 ? '?' : ''} 存在混合排版结构，已自动拆分为 ${subSlides.length} 页。`);

            const hPrefix = headerMatch[1];
            return subSlides.map((s, i) => {
                if (i === 0) return s;
                if (s.startsWith(hPrefix)) return s;
                const cleanTitle = hText.replace(/\s*\(续\)$/, '');
                return `${hPrefix} ${cleanTitle} (续)\n\n${s}`;
            }).join('\n---\n');
        }

        return subSlides.join('\n---\n');
    }

    /**
     * 智能化语义推断 (The "Brain"):
     * 根据内容结构自动匹配最合适的版式，实现“零标记”排版。
     */
    inferLayout(slide) {
        // [优化] 更加精准的显式声明检测
        // 理由：正文中包含 @[xxx] 字样（如教程）时不应视为已手动指定版式
        const hasExplicit = DaMiaooPreprocessor.REGEX.LAYOUT_TAG.test(slide) || slide.includes('_class:');
        if (hasExplicit) return slide;

        const cleanBody = slide.replace(DaMiaooPreprocessor.REGEX.COMMENTS, '').trim();
        const lines = cleanBody.split('\n');
        const hMatch = slide.match(/^\s*(#+)\s+(.+)$/m); // [优化] 支持任意层级标题的语义识别
        const hasImage = DaMiaooPreprocessor.REGEX.IMAGE.test(slide);
        const hasQuote = /^\s*>/m.test(slide);
        const listItems = lines.filter(l => DaMiaooPreprocessor.REGEX.ANY_LIST_ITEM.test(l));

        // 1. [智能推断] 金句专题 (Quote)
        // 条件：包含引用块，且文本总量适中，无图片
        if (hasQuote && !hasImage && cleanBody.length < 350) {
            console.log(`[*] 智能感知：检测到引用结构，自动套用 @[quote]`);
            return `@[quote]\n${slide}`;
        }

        // 2. [智能推断] 图文分栏 (Split)
        // 条件：包含图片，且列表项不多（防止与其它卡片版式冲突）
        if (hasImage && listItems.length <= 4) {
            console.log(`[*] 智能感知：检测到图文组合，自动套用 @[split]`);
            return `@[split]\n${slide}`;
        }

        // 3. [智能推断] 业务网格 (Cols/Cards)
        // 条件：包含 2-6 个列表项，且标题包含特定业务关键词或总字数较少
        if (listItems.length >= 2 && listItems.length <= 6) {
            const hText = hMatch ? hMatch[2] : "";
            // [优化] 扩展业务关键词库，提高卡片/分栏版式的智能识别率
            const keywords = /对比|优势|步骤|模块|核心|特点|环节|路径|案例|要素|维度|一览|方法|语法|结构|基础|说明|参数|功能/i;
            const isShort = cleanBody.length < 500; // 适度放宽字数门槛

            if (keywords.test(hText) || isShort) {
                const layout = `cols${listItems.length}`;
                // 对于 3 项且无标题的情况，通常 cards 视觉效果更好
                const finalLayout = (listItems.length === 3 && !hText) ? 'cards' : layout;
                console.log(`[*] 智能感知：检测到并列结构 (${listItems.length}项)，自动套用 @[${finalLayout}]`);
                return `@[${finalLayout}]\n${slide}`;
            }
        }

        // 1.5 [智能推断] 核心数字 (Metric)
        // 条件：标题纯数字、百分比或货币符号，且无其它大量正文
        if (hMatch) {
            // 语义预洗：去除可能的 ** 或 __ 干扰以后进行纯数字判断
            const hText = hMatch[2].trim().replace(/[*_]/g, '');
            const textOnly = cleanBody.replace(/^#.*$/gm, '').trim();
            if (/^[\d.,%￥$€万亿+-]+$/.test(hText) && textOnly.length < 50) {
                console.log(`[*] 智能感知：发现核心指标 [${hText}]，自动套用 @[metric]`);
                return `@[metric]\n${slide}`;
            }
        }

        // [重要规定] 章节推断 (Chapter) 已从此处移除
        // 理由：结构应由全局架构扫描阶段 (tagInitialLandmarks) 唯一确定。
        // 子页面处理管道绝不能单方面“提级”或“创建”章节，以维护分页大原则。

        // 1. [智能推断] 金句专题 (Quote)
        // 条件：除了标题之外只有少量正文，且不是章节（防止污染预设地标）
        if (hMatch) {
            const text = hMatch[2].trim();
            const textOnly = cleanBody.replace(/^#.*$/gm, '').trim();
            if (textOnly.length > 0 && textOnly.length < 120 && !hasImage && !hasQuote) {
                console.log(`[*] 智能感知：检测到章节内强调页 [${text}]，自动套用 @[focus]`);
                return `@[focus]\n${slide}`;
            }
        }

        return slide;
    }

    translateLayoutSyntax(slide) {
        const match = slide.match(DaMiaooPreprocessor.REGEX.LAYOUT_TAG);
        if (!match) return slide;

        const layout = match[1].split(':')[0]; // 支持带参数的标签如 @[toc:4]
        if (layout === 'front' || layout === 'back') return this.renderCover(slide, layout);

        if (layout === 'toc') return this.autoPaginateFlowLayout(slide, 'toc', 4);
        if (layout === 'cards') return this.autoPaginateFlowLayout(slide, 'cards', 6);
        if (layout === 'cols2') return this.autoPaginateFlowLayout(slide, 'cols2', 2);
        if (layout === 'cols3') return this.autoPaginateFlowLayout(slide, 'cols3', 3);
        if (layout === 'cols4') return this.autoPaginateFlowLayout(slide, 'cols4', 4);
        if (layout === 'cols5') return this.autoPaginateFlowLayout(slide, 'cols5', 5);
        if (layout === 'cols6') return this.autoPaginateFlowLayout(slide, 'cols6', 6);
        if (layout === 'metric') return this.handleMetricLayout(slide);

        return slide.replace(DaMiaooPreprocessor.REGEX.LAYOUT_TAG, `<!-- _class: ${layout} -->`);
    }

    renderCover(slide, type) {
        let body = slide.replace(DaMiaooPreprocessor.REGEX.LAYOUT_TAG, '').trim();
        if (!body) {
            body = (type === 'front') ? `# ${this.meta.title}` : `# ${this.meta.thanks.replace(/[!！]$/, '')}`;
        }
        if (!body.match(/^##/m)) {
            body += `\n\n## ${this.meta.author}\n\n### ${this.meta.date}`;
        }

        const html = body.replace(/^#\s+(.+)$/m, '<h1 class="title">$1</h1>')
            .replace(/^##\s+(.+)$/m, '<h2 class="author">$1</h2>')
            .replace(/^###\s+(.+)$/m, '<h3 class="date">$1</h3>');

        return `<!-- _class: cover -->\n${html}`;
    }

    handleMetricLayout(slide) {
        let firstHeadingFound = false;
        const lines = slide.split(/\r?\n/);
        const result = [];

        for (const line of lines) {
            const hMatch = line.match(DaMiaooPreprocessor.REGEX.HEADING);
            const lMatch = line.match(DaMiaooPreprocessor.REGEX.LAYOUT_TAG);

            if (hMatch) {
                if (!firstHeadingFound) {
                    firstHeadingFound = true;
                    result.push(line);
                } else {
                    console.log(`[!] 视觉降级：@[metric] 版式仅允许一个巨型数字，标题 [${hMatch[2]}] 已自动降级为加粗正文。`);
                    result.push(`**${hMatch[2]}**`);
                }
            } else if (lMatch) {
                result.push(`<!-- _class: metric -->`);
            } else {
                result.push(line);
            }
        }
        return result.join('\n');
    }

    /**
     * 处理结构化扩充，保持 @[tag] 原型
     */
    processStructuralExpansion(slide) {
        const match = slide.match(DaMiaooPreprocessor.REGEX.LAYOUT_TAG);
        if (!match) return slide;

        const layout = match[1];

        // 针对需要分页的流式版式进行预处理
        const flowLayouts = ['toc', 'cards', 'cols2', 'cols3', 'cols4', 'cols5', 'cols6'];
        if (flowLayouts.includes(layout)) {
            const baseLimits = { toc: 4, cards: 6, cols2: 2, cols3: 3, cols4: 4, cols5: 5, cols6: 6 };
            return this.autoPaginateFlowLayout(slide, layout, baseLimits[layout]);
        }

        return slide;
    }

    tagInitialLandmarks(slides, rank2) {
        const landmarkRegex = new RegExp(`^[ \t]*#{${rank2}}[ \t]+(.+)$`, 'm');
        return slides.map(slide => {
            const hMatch = slide.match(landmarkRegex);
            if (hMatch) {
                const rawLevel = '#'.repeat(rank2);
                const rawText = hMatch[1].trim();

                // [2.1 定向归一化] 章节归一化应在锁定章节后立即执行，且仅针对章节标题
                const { clean } = this.normalizeHeadingText(rawText);
                const fullTitle = clean;
                let displayTitle = fullTitle;
                if (displayTitle.length > 25) displayTitle = displayTitle.substring(0, 25) + '...';

                // 更新 Slide 内容：使用原始完整标题（归一化后）
                const updatedSlide = slide.replace(landmarkRegex, `${rawLevel} ${fullTitle}`);

                const hasExplicitLayout = DaMiaooPreprocessor.REGEX.LAYOUT_TAG.test(updatedSlide);
                if (!hasExplicitLayout) {
                    console.log(`[*] 结构锁定：全案 Rank 2 层级确认 -> [${displayTitle}]`);
                    return `@[chapter]\n${updatedSlide}`;
                }
                return updatedSlide;
            }
            return slide;
        });
    }

    /**
     * 编号归一化：将“第一部分”、“1.”、“Module A”等转义为可计算的索引
     */
    normalizeHeadingText(text) {
        // UI/UX Pro Max 3.0: 兼容 Emoji 图标头，不应被视为编号
        const emojiHeader = text.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]+)\s*/u);
        const prefixEmoji = emojiHeader ? emojiHeader[1] : '';
        let workingText = emojiHeader ? text.replace(emojiHeader[0], '') : text;

        // 语义增强：剥离加粗/倾斜等 Markdown 包装，以便精确提取编号规则
        workingText = workingText.replace(/^([*_]{1,3})(\d+.*?)\1/, '$2');

        const match = workingText.match(DaMiaooPreprocessor.REGEX.SECTION_NUMBERING);
        const cleanBody = workingText.replace(DaMiaooPreprocessor.REGEX.SECTION_NUMBERING, '').trim();

        // [修复点] 如果清洗后为空，说明整个标题就是一个编号（如 "Section 1" 或 "第一章"）
        // 此时我们应该保留原标题，避免 TOC 出现空白或误抓下一行
        const finalContent = cleanBody || workingText;
        const result = prefixEmoji ? `${prefixEmoji} ${finalContent}` : finalContent;

        if (!match) return { clean: result, index: null };

        const rawPrefix = match[1];
        // 简单转义：识别阿拉伯数字或中文大写数字 (1-10)
        const cnDigits = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
        let num = parseInt(rawPrefix.replace(/[^\d]/g, ''));

        if (isNaN(num)) {
            const cnMatch = rawPrefix.match(/[一二三四五六七八九十]/);
            if (cnMatch) num = cnDigits[cnMatch[0]];
        }

        return { clean: finalContent, index: num };
    }

    autoPaginateFlowLayout(slide, layout, baseLimit) {
        let text = slide;

        // 特殊处理 TOC 自动填充内容 (使用已归一化的 entries)
        if (layout === 'toc' && !text.match(DaMiaooPreprocessor.REGEX.LIST_ITEM)) {
            const list = this.sections.join('\n');
            text += `\n\n# 目录\n\n${list}`;
        }

        const lines = text.split(/\r?\n/);
        let listItems = lines.filter(l => DaMiaooPreprocessor.REGEX.ANY_LIST_ITEM.test(l));
        const header = lines.filter(l => !DaMiaooPreprocessor.REGEX.ANY_LIST_ITEM.test(l)).join('\n');

        if (listItems.length === 0) return text;

        // [语义清洗] 针对 Cards/Cols 版式移除列表项标题后残留的分隔符 (如 : 或 ：)
        // 理由：CSS 会将 strong 标签设为 display: block，此时残存的分隔符会出现在正文首行，影响美观。
        // [优化] 现在支持更多标题形式：加粗、代码块以及普通短文标题。采用非贪婪匹配确保只切分首个分隔符。
        if (layout.startsWith('cols') || layout === 'cards') {
            listItems = listItems.map(item => {
                return item.replace(/^(\s*([-*+]|\d+[\.\)])\s+(?:\*\*.*?\*\*|`.*?`|[^:：\r\n]+?))\s*[:：]\s*/, '$1 ');
            });
            // 立即回流：确保在不触发分页的情况下也能获得清洗后的内容
            text = `${header.trim()}\n\n${listItems.join('\n')}`;
        }

        const totalLen = listItems.join('').replace(new RegExp(DaMiaooPreprocessor.REGEX.ANY_LIST_ITEM.source, 'g'), '').length;
        const avgLen = totalLen / listItems.length;

        let dynamicLimit = baseLimit;
        if (layout !== 'toc') {
            // [优化] 更有弹性的限额算法
            // 只有当条目数确实较多，且平均长度超过阈值时才严格限制
            if (avgLen > 150) dynamicLimit = Math.max(1, Math.floor(baseLimit / 2));
            else if (avgLen > 100 && listItems.length > 3) dynamicLimit = Math.max(2, Math.floor(baseLimit / 1.5));
            // 兜底：如果只有 2 或 3 个条目，且平均长度没到变态的 150+，则强制不分页
            if (listItems.length <= 3 && avgLen < 150) dynamicLimit = listItems.length;
        }

        if (listItems.length <= dynamicLimit) return text;

        console.log(`[!] 智能分发：版式 [${layout}] 密度过高 (均长:${Math.round(avgLen)})，动态限额调整为 ${dynamicLimit}/页。`);

        const slides = [];
        for (let i = 0; i < listItems.length; i += dynamicLimit) {
            const currentItems = listItems.slice(i, i + dynamicLimit);
            const chunk = currentItems.join('\n');
            let slideHeader = header;

            // [核心优化] 动态二次进化逻辑 (Dynamic Layout Evolution)
            if (layout.startsWith('cols') || layout === 'cards') {
                let evolvedLayout = layout;
                const count = currentItems.length;
                if (count === 1) evolvedLayout = 'cards';
                else if (count >= 2 && count <= 6) evolvedLayout = `cols${count}`;

                slideHeader = slideHeader.replace(/@\[([a-zA-Z0-9-]+)(?::\d+)?\]/, `@[${evolvedLayout}]`);
            }

            // 处理 (续) 标题
            if (i > 0) {
                slideHeader = slideHeader.replace(/#\s+(.+?)(?:\s*\(续\))?$/, '# $1 (续)');
            }

            // 路径参数传导 (针对 TOC)
            if (layout === 'toc' && i > 0) {
                slideHeader = slideHeader.replace(/@\[toc\]/, `@[toc:${i}]`);
            }

            slides.push(`${slideHeader.trim()}\n\n${chunk.trim()}`);
        }
        return slides.join('\n---\n');
    }

    validateSlideHealth(slide, index) {
        const layoutMatch = slide.match(DaMiaooPreprocessor.REGEX.LAYOUT_TAG);
        const layout = layoutMatch ? layoutMatch[1].split(':')[0] : 'default';

        // 1. [硬性校验] Split 布局必须包含图片
        if (layout === 'split' && !DaMiaooPreprocessor.REGEX.IMAGE.test(slide)) {
            this.fail(`幻灯片 #${index + 1}: [split] 布局强制要求插入图片。`);
        }

        const cleanContent = slide.replace(DaMiaooPreprocessor.REGEX.COMMENTS, '')
            .replace(DaMiaooPreprocessor.REGEX.HTML_TAGS, '')
            .replace(DaMiaooPreprocessor.REGEX.IMAGE, '')
            .replace(/^#.*/gm, '').trim();

        const count = cleanContent.length;
        let limit = this.config.thresholds.default;

        // 根据版式动态调整阈值
        if (['front', 'back', 'chapter'].includes(layout)) limit = this.config.thresholds.chapter;
        else if (['split', 'quote'].includes(layout)) limit = this.config.thresholds.split;
        else if (layout.startsWith('cols') || layout === 'cards') limit = this.config.thresholds.cols;
        else if (layout === 'toc') limit = this.config.thresholds.toc;

        // 2. [溢出处理]
        if (count > limit) {
            // 如果已经是分页后的子页面，不再重复校验（防止无限递归，虽然逻辑上不会）
            if (slide.includes('\n---')) return;

            // 原子版式（不可分页版式）处理
            const isAtomic = ['split', 'focus', 'quote', 'metric', 'chapter'].includes(layout);

            if (isAtomic) {
                const status = this.config.force ? '[⚠️]' : '[🚫]';
                console.log(`${status} 核心版式溢出 (Slide #${index + 1}): [${layout}] 内容严峻过载 (${count}/${limit})。`);
                console.log(`    由于该版式为“原子版面”，无法执行自动分页。`);

                if (!this.config.force) {
                    this.hasError = true;
                    console.log(`    [X] 编译拦截。建议精简文案或切换为普通版式。`);
                } else {
                    console.log(`    [!] 强制模式：已允许溢出编译，但物理呈现可能会坍塌（文字超出屏幕）。`);
                }
            } else {
                // 普通版式（Default/Cols）
                const status = '[!]';
                console.log(`${status} 文本密度预警 (Slide #${index + 1}): 当前字数 ${count} 已超过建议上限 ${limit}。`);
                // 注：对于非原子版式，Preprocessor 已经在之前的环节执行了 autoPaginateDefaultBody，
                // 如果能走到这里且仍超过 limit，说明单段落/单卡片本身就极其巨大。
            }
        }
    }

    fail(msg) {
        console.error(`[X] ${msg}`);
        this.hasError = true;
    }
}

module.exports = DaMiaooPreprocessor;

if (require.main === module) {
    const file = process.argv[2] || 'demo.md';
    const force = process.argv.includes('--force');
    new DaMiaooPreprocessor(file, { force }).run();
}
