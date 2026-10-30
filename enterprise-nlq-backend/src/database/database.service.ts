import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private corePool: Pool;
  private bizPool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // 1. Khởi tạo kết nối tới Database Lõi
    this.corePool = new Pool({
      host: this.configService.get<string>('CORE_DB_HOST'),
      port: this.configService.get<number>('CORE_DB_PORT'),
      user: this.configService.get<string>('CORE_DB_USER'),
      password: this.configService.get<string>('CORE_DB_PASS'),
      database: this.configService.get<string>('CORE_DB_NAME'),
      ssl: {
        rejectUnauthorized: false, 
      }
    });
    this.logger.log('Đã kết nối thành công vào Core Database (Hệ thống)');

    // 2. Khởi tạo kết nối tới Database Doanh Nghiệp 
    this.bizPool = new Pool({
      host: this.configService.get<string>('BIZ_DB_HOST'),
      port: this.configService.get<number>('BIZ_DB_PORT'),
      user: this.configService.get<string>('BIZ_DB_USER'),
      password: this.configService.get<string>('BIZ_DB_PASS'),
      database: this.configService.get<string>('BIZ_DB_NAME'),
      ssl: {
        rejectUnauthorized: false, 
      }
    });
    this.logger.log('Đã kết nối thành công vào Business Database (Read-Only)');
  }

  // Hàm chạy câu lệnh SQL trên Database Lõi (Dùng cho Vector Search, Lưu Log...)
  async executeCoreQuery(sql: string, params: any[] = []) {
    try {
      const result = await this.corePool.query(sql, params);
      return result.rows;
    } catch (error: any) { 
      this.logger.error('Lỗi thực thi Core DB:', error.message);
      throw error;
    }
  }

  // Hàm chạy câu lệnh SQL an toàn trên Database Doanh nghiệp 
  async executeBizQuery(sql: string, params: any[] = []) {
    try {
      const result = await this.bizPool.query(sql, params);
      return result.rows;
    } catch (error: any) { 
      this.logger.error('Lỗi thực thi Business DB:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.corePool.end();
    await this.bizPool.end();
  }
}