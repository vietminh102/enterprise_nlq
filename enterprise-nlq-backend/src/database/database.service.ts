import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASS'),
      database: this.configService.get<string>('DB_NAME'),

      ssl: {
        rejectUnauthorized: false, 
      }
    });
    console.log('Đã kết nối thành công vào PostgreSQL với quyền Read-Only');
  }

  // Hàm chạy câu lệnh SQL an toàn
async executeQuery(sql: string, params: any[] = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error: any) { 
      console.error('Lỗi thực thi Database:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}