import { Injectable, OnModuleInit, OnModuleDestroy, Logger, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private corePool: Pool;
  private bizWritePool: Pool;
  private bizReadPool: Pool; // Pool chuyên dụng cho Read Replica
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
      ssl: { rejectUnauthorized: false }
    });
    this.logger.log('Đã kết nối vào Core Database (Hệ thống)');

    // 2. Khởi tạo kết nối tới Business Database (Primary / Write)
    this.bizWritePool = new Pool({
      host: this.configService.get<string>('BIZ_DB_HOST'),
      port: this.configService.get<number>('BIZ_DB_PORT'),
      user: this.configService.get<string>('BIZ_DB_USER'),
      password: this.configService.get<string>('BIZ_DB_PASS'),
      database: this.configService.get<string>('BIZ_DB_NAME'),
      ssl: { rejectUnauthorized: false }
    });
    this.logger.log('Đã kết nối vào Business Database (Primary)');

    // 3. Khởi tạo kết nối tới Read Replica (Nếu biến môi trường tồn tại, nếu không fallback về Primary)
    const replicaHost = this.configService.get<string>('BIZ_REPLICA_HOST');
    if (replicaHost) {
      this.bizReadPool = new Pool({
        host: replicaHost,
        port: this.configService.get<number>('BIZ_REPLICA_PORT') || this.configService.get<number>('BIZ_DB_PORT'),
        user: this.configService.get<string>('BIZ_REPLICA_USER') || this.configService.get<string>('BIZ_DB_USER'),
        password: this.configService.get<string>('BIZ_REPLICA_PASS') || this.configService.get<string>('BIZ_DB_PASS'),
        database: this.configService.get<string>('BIZ_REPLICA_NAME') || this.configService.get<string>('BIZ_DB_NAME'),
        ssl: { rejectUnauthorized: false }
      });
      this.logger.log('Đã kết nối vào Business Database (Read Replica)');
    } else {
      this.bizReadPool = this.bizWritePool;
      this.logger.log('Không tìm thấy config Read Replica, sử dụng Primary cho truy vấn đọc.');
    }
  }

  // Hàm chạy câu lệnh SQL trên Database Lõi
  async executeCoreQuery(sql: string, params: any[] = []) {
    try {
      const result = await this.corePool.query(sql, params);
      return result.rows;
    } catch (error: any) { 
      this.logger.error('Lỗi thực thi Core DB:', error.message);
      throw error;
    }
  }

  // Hàm chạy câu lệnh SQL truy xuất dữ liệu Doanh nghiệp (Chỉ đọc)
  async executeBizQuery(sql: string, params: any[] = []) {
    try {
      let finalSql = sql.trim();
      
      // Kiểm tra giả định: AI có thể quên chỉ định cột và dùng SELECT *
      if (/\bSELECT\s+\*\b/i.test(finalSql)) {
        throw new BadRequestException("SAFETY_VIOLATION: Lệnh 'SELECT *' bị cấm. Yêu cầu AI chỉ định rõ các cột cần thiết.");
      }

      // Loại bỏ dấu chấm phẩy ở cuối (nếu có) để dễ dàng nối chuỗi
      if (finalSql.endsWith(';')) {
        finalSql = finalSql.slice(0, -1);
      }

      // Tự động ép giới hạn dòng nếu AI không tự thêm mệnh đề LIMIT
      if (!/\bLIMIT\b/i.test(finalSql)) {
        finalSql += ' LIMIT 100'; // Giới hạn cứng tối đa 100 dòng
      }

      finalSql += ';';

      // Sử dụng Read Pool thay vì Write Pool
      const result = await this.bizReadPool.query(finalSql, params);
      return result.rows;

    } catch (error: any) { 
      this.logger.error('Lỗi thực thi Business DB:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.corePool.end();
    await this.bizWritePool.end();
    if (this.bizReadPool !== this.bizWritePool) {
      await this.bizReadPool.end();
    }
  }
}