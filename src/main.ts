import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Bật CORS để Frontend (Chrome Extension/Web) sau này có thể gọi API mà không bị chặn
  app.enableCors();
  
  await app.listen(3000);
  console.log(`🚀 Server đang chạy tại: http://localhost:3000`);
}
bootstrap();