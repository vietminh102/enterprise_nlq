import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Injectable()
export class VectorSearchService implements OnModuleInit {
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // 1. Tự động khởi chạy Listener khi Module NestJS sẵn sàng
  async onModuleInit() {
    await this.setupSchemaChangeListener();
  }

  // 2. Thiết lập kết nối tĩnh 24/7 chờ tín hiệu từ PostgreSQL
  private async setupSchemaChangeListener() {
    const listenerClient = new Client({
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      user: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASS'),
      database: this.configService.get<string>('DB_NAME'),
      ssl: { rejectUnauthorized: false }, 
    });
    listenerClient.on('error', (err) => {
      console.error('⚠️ [CẢNH BÁO] Trạm gác Vector bị ngắt kết nối mạng:', err.message);
      console.log('🔄 Đang tự động kết nối lại sau 5 giây...');
      listenerClient.end().catch(() => {}); // Đóng tàn dư kết nối cũ
      setTimeout(() => this.setupSchemaChangeListener(), 5000); // Thử kết nối lại
    });
    try {
      await listenerClient.connect();
      await listenerClient.query('LISTEN schema_changed');
      console.log('👂 Trạm gác Vector: Đang lắng nghe sự kiện thay đổi cấu trúc Database...');

      listenerClient.on('notification', async () => {
        console.log('⚡ [SỰ KIỆN] Phát hiện Database thay đổi! Đang tự động cập nhật Vector DB...');
        await this.seedAllSchemas();
      });
    } catch (error: any) {
      console.error('Lỗi khi thiết lập Lắng nghe Database:', error.message);
    }
  }

  // 3. Sử dụng model
  private async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    const result = await model.embedContent(text);
    return result.embedding.values.slice(0, 768);
  }

  // 4. Tìm kiếm ngữ nghĩa dựa trên cột description
  async findRelevantSchemas(userQuery: string): Promise<string[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(userQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      const sqlQuery = `
        SELECT description 
        FROM enterprise_embeddings 
        ORDER BY embedding <=> $1::vector 
        LIMIT 3;
      `;

      const rows = await this.dbService.executeQuery(sqlQuery, [vectorString]);
      return rows.map((row: any) => row.description);
    } catch (error: any) {
      console.error('Lỗi Vector Search:', error.message);
      return [];
    }
  }

  // 5. Tự động quét và nhúng toàn bộ bảng trong Database
  async seedAllSchemas() {
    try {
      console.log('Đang quét cấu trúc Database động...');
      
      const schemaQuery = `
        SELECT 
            table_name, 
            string_agg(column_name || ' ' || data_type, ', ') as columns
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name != 'enterprise_embeddings' 
        GROUP BY table_name;
      `;
      
      const tables = await this.dbService.executeQuery(schemaQuery);

      if (!tables || tables.length === 0) {
        return { status: 'Lỗi', message: 'Không tìm thấy bảng dữ liệu nào trong Database.' };
      }

      console.log('Bắt đầu làm sạch Vector DB cũ...');
      await this.dbService.executeQuery('TRUNCATE TABLE enterprise_embeddings RESTART IDENTITY;');

      console.log(`Đã tìm thấy ${tables.length} bảng. Bắt đầu Embedding...`);
      let count = 0;

      for (const table of tables) {
        const tableName = table.table_name;
        const ddl = `CREATE TABLE ${tableName} (${table.columns});`;

        const embedding = await this.generateEmbedding(ddl);
        const vectorString = `[${embedding.join(',')}]`;

        const sql = `
          INSERT INTO enterprise_embeddings (table_name, description, embedding)
          VALUES ($1, $2, $3::vector)
        `;
        
        await this.dbService.executeQuery(sql, [tableName, ddl, vectorString]);
        count++;
        console.log(`- Đã nhúng tự động bảng: ${tableName}`);
      }

      return { status: 'Thành công', message: `Đã đồng bộ lược đồ ${count} bảng vào Vector DB!` };
    } catch (error: any) {
      console.error('Lỗi khi nạp dữ liệu động:', error.message);
      return { status: 'Lỗi', message: error.message };
    }
  }
}