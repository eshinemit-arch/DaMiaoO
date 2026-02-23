# 使用轻量级 Node.js 作为基础镜像
FROM node:18-slim

# 安装 Chromium 和相关依赖，Marp 转换 PDF/PPTX 需要它
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# 设置环境变量，告知 Marp 使用系统安装的 Chromium
ENV MARP_USER_CHROME_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

# 设置工作目录
WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 赋予快捷脚本执行权限 (为了兼容性)
RUN chmod +x dm.bat || true

# 设置入口点（默认可以直接运行 node builder.js）
ENTRYPOINT ["node", "builder.js"]

# 默认在没有参数时显示帮助
CMD ["--help"]
