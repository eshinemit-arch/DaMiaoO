/**
 * DaMiaoo 演示文稿自动化引擎 (Orchestrator)
 * --------------------------------------------------
 * 这个文件作为整个引擎的总入口。它协调两个独立的流程：
 * 1. Preprocessor: 负责预处理 Markdown、处理高级版式宏和结构分页。
 * 2. Compiler: 接收处理后标准 Markdown 并调用 Marp 渲染生成指定格式 (PPTX/PDF/HTML)。
 */

const DaMiaooPreprocessor = require('./damiaoo-preprocessor');
const DaMiaooCompiler = require('./damiaoo-compiler');

const args = process.argv.slice(2);

// 帮助信息
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
DaMiaoo 演示文稿自动化引擎 (CLI)
用法: node builder.js [选项] <文件>

选项:
  -p, --preprocess  只执行预处理 (生成 .process_*.md)
  -c, --compile     只执行编译 (将 MD 转换为目标格式)
  --html            生成 HTML 格式
  --pdf             生成 PDF 格式
  --pptx            生成 PPTX 格式 (默认)
  --force           强制覆盖执行

示例:
  node builder.js -p -c README.md --html
    `);
    process.exit(0);
}

// 解析参数
const file = args.find(arg => !arg.startsWith('-')) || 'demo.md';
const runPre = args.includes('-p') || args.includes('--preprocess');
const runComp = args.includes('-c') || args.includes('--compile');
const force = args.includes('--force');

// 如果既没指定 -p 也没指定 -c，默认全部执行
const runAll = !runPre && !runComp;

let format = 'pptx';
if (args.includes('--pdf')) format = 'pdf';
if (args.includes('--html')) format = 'html';

async function main() {
    let currentFile = file;
    let meta = {};

    // 1. 预处理阶段
    if (runPre || runAll) {
        console.log(`[*] 开始预处理: ${file}`);
        const preprocessor = new DaMiaooPreprocessor(file, { force });
        const preResult = preprocessor.run();

        if (preResult && preResult.success) {
            currentFile = preResult.outputFile;
            meta = preResult.meta;
        } else {
            process.exit(1);
        }
    }

    // 2. 编译阶段
    if (runComp || runAll) {
        console.log(`[*] 开始编译: ${currentFile} -> ${format.toUpperCase()}`);
        const compiler = new DaMiaooCompiler(currentFile, meta, { format });
        compiler.run();
    }
}

main().catch(err => {
    console.error(`\n[!] 构建异常: ${err.message}`);
    process.exit(1);
});
