import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);
  private genAI: GoogleGenerativeAI;
  
  // 1. Khởi tạo Cache lưu trữ kết quả Schema Lookup (Tránh gọi API Gemini liên tục cho câu hỏi trùng)
  private readonly schemaCache = new Map<string, string[]>();

  constructor(
    private readonly dbService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // Hàm tạo hash MD5 để làm Key Cache ngắn gọn và an toàn
  private generateCacheKey(text: string): string {
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Sửa lỗi: Cập nhật đúng tên model embedding mới nhất của Google
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values; 
  }

  // 2. Tham số mặc định giới hạn Top 3 (có thể truyền 5 khi gọi hàm)
  async findRelevantSchemas(userQuery: string, limit: number = 3): Promise<string[]> {
    const cacheKey = this.generateCacheKey(userQuery);
    
    // BƯỚC 1: Kiểm tra Cache trước khi gọi API
    if (this.schemaCache.has(cacheKey)) {
      this.logger.log(`[Cache Hit] Trả về Schema từ bộ nhớ đệm cho truy vấn.`);
      return this.schemaCache.get(cacheKey)!;
    }

    try {
      const queryEmbedding = await this.generateEmbedding(userQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      // Sử dụng toán tử <=> cho Cosine Distance (Tương thích với hnsw index vector_cosine_ops)
      const sqlQuery = `
        SELECT description 
        FROM schema_metadata 
        ORDER BY embedding <=> $1::vector 
        LIMIT $2;
      `;

      const rows = await this.dbService.executeCoreQuery(sqlQuery, [vectorString, limit]);
      const schemas = rows.map((row: any) => row.description);

      // BƯỚC 2: Lưu kết quả vào Cache
      if (schemas.length > 0) {
        this.schemaCache.set(cacheKey, schemas);
      }

      return schemas;
    } catch (error: any) {
      this.logger.error('Lỗi Vector Search:', error.message);
      return [];
    }
  }

  // 3. Precompute schema_metadata và Tạo Index
  async seedAllSchemas() {
    try {
      this.logger.log('Đang quét cấu trúc Database động...');
      
      const schemaQuery = `
        SELECT 
            table_name, 
            string_agg(column_name || ' ' || data_type, ', ') as columns
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name != 'schema_metadata' 
        GROUP BY table_name;
      `;
      
      const tables = await this.dbService.executeBizQuery(schemaQuery);

      if (!tables || tables.length === 0) {
        return { status: 'Lỗi', message: 'Không tìm thấy bảng dữ liệu nào trong Database Doanh nghiệp.' };
      }

      this.logger.log('Làm sạch Vector DB cũ và xóa Cache...');
      
      // BƯỚC 1: Xóa Cache cũ do cấu trúc bảng đã thay đổi
      this.schemaCache.clear();
      
      await this.dbService.executeCoreQuery('TRUNCATE TABLE schema_metadata RESTART IDENTITY;');
      // Drop index cũ để không làm chậm quá trình INSERT số lượng lớn
      await this.dbService.executeCoreQuery('DROP INDEX IF EXISTS schema_metadata_embedding_idx;');

      // BƯỚC 2: Tối ưu Precompute (Tính toán Embedding song song toàn bộ các bảng thay vì chờ tuần tự)
      const embeddingPromises = tables.map(async (table) => {
        const tableName = table.table_name;
        const ddl = `CREATE TABLE ${tableName} (${table.columns});`;
        const embedding = await this.generateEmbedding(ddl);
        return { tableName, ddl, vectorString: `[${embedding.join(',')}]` };
      });

      const embeddedData = await Promise.all(embeddingPromises);

      let count = 0;
      for (const data of embeddedData) {
        const sql = `
          INSERT INTO schema_metadata (table_name, description, embedding)
          VALUES ($1, $2, $3::vector)
        `;
        await this.dbService.executeCoreQuery(sql, [data.tableName, data.ddl, data.vectorString]);
        count++;
        this.logger.log(`- Đã lưu Schema Vector: ${data.tableName}`);
      }

      // BƯỚC 3: TẠO INDEX VECTOR (Sử dụng thuật toán HNSW của pgvector)
      this.logger.log('Đang khởi tạo HNSW Vector Index trên PostgreSQL...');
      await this.dbService.executeCoreQuery(`
        CREATE INDEX schema_metadata_embedding_idx 
        ON schema_metadata USING hnsw (embedding vector_cosine_ops);
      `);

      return { status: 'Thành công', message: `Đã đồng bộ ${count} bảng và cấu hình HNSW Index thành công!` };
    } catch (error: any) {
      this.logger.error('Lỗi khi nạp dữ liệu động:', error.message);
      return { status: 'Lỗi', message: error.message };
    }
  }
}