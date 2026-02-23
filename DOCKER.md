# 🐳 DaMiaoo Docker 部署指南

为了实现跨平台的一致性体验，特别是解决 Linux 环境下 PDF/PPTX 转换所需的 Chromium 依赖问题，我们提供了完整的 Docker 支持。

## 1. 构建镜像

在项目根目录下执行：

```bash
docker build -t damiaoo-engine .
```

## 2. 推送到私有仓库

### 方案 A：手动推送 (以 GHCR 为例)

如果您使用的是 GitHub Container Registry 或私有 Harbor 仓库，请执行以下命令：

```bash
# 1. 登录私有仓库
docker login ghcr.io

# 2. 为镜像打标签 (更换为您的用户名/路径)
docker tag damiaoo-engine ghcr.io/your-username/damiaoo-engine:latest

# 3. 推送镜像
docker push ghcr.io/your-username/damiaoo-engine:latest
```

### 方案 B：自动化 CI/CD (GitHub Actions)

项目内置了 `.github/workflows/docker-publish.yml` 自动化脚本。

- 当您推送标签（如 `v1.0.0`）或向 `main` 分支推送代码时，系统会自动执行构建并推送到 GitHub Packages。
- **配置建议**：如果是企业私有 GitLab/Harbor，请在 CI 配置文件中修改 `REGISTRY` 环境变量。

## 3. 运行容器进行转换

由于转换需要读取本地 Markdown 文件并输出结果，建议使用 `-v` (volume) 将当前目录挂载到容器内。

### 基本命令格式

```bash
docker run --rm -v ${PWD}:/app/work damiaoo-engine [选项] work/<文件名>
```

### 常用示例

- **全自动转换为 HTML (推荐)**：

    ```bash
    docker run --rm -v ${PWD}:/app/work damiaoo-engine -p -c work/README.md --html
    ```

- **生成 PPTX 文件**：

    ```bash
    docker run --rm -v ${PWD}:/app/work damiaoo-engine -p -c work/README.md --pptx
    ```

- **强制覆盖处理**：

    ```bash
    docker run --rm -v ${PWD}:/app/work damiaoo-engine -p -c work/README.md --force
    ```

## 3. 常见问题 (FAQ)

- **文件权限**：在容器中生成的文件可能会属于 root 用户。如果遇到权限问题，请在命令前加上 `--user $(id -u):$(id -g)`。
- **中文字体**：镜像内已内置 `fonts-noto-cjk` 确保中文字符在 PDF/PPTX 中能正确渲染。
- **网络访问**：Marp 默认会通过 CDN 加载一些样式，如果您的服务器处于断网环境，请确保您的 Markdown 文件中不包含外部网络依赖。

---
**DaMiaoo Engine** - 让排版回归语义，让演示回归专业。
