# Sử dụng Node.js 24 bản slim
FROM node:24-slim

# Thư mục làm việc bên trong container
WORKDIR /app

# Copy package.json và package-lock.json trước
# để Docker tận dụng cache khi cài thư viện
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ source code vào container
COPY . .

# Build project NestJS
RUN npm run build

# Mở port 3000
EXPOSE 3000

# Chạy ứng dụng
CMD ["npm", "run", "start:prod"]