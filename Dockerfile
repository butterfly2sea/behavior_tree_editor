# 构建阶段
FROM node:16-alpine as build

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 构建项目
RUN npm run build

# 生产环境阶段
FROM nginx:stable-alpine as production

# 复制构建输出到nginx服务目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制nginx配置文件（如果需要自定义）
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

# 启动nginx服务
CMD ["nginx", "-g", "daemon off;"]