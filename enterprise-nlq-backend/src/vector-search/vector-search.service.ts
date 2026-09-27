import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VectorSearchService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // 1. Khởi tạo model nhúng
  private async generateEmbedding(text: string): Promise<number[]> {
    // Sử dụng text-embedding-004 chuẩn của Gemini (tự động trả về 768 chiều)
    const model = this.genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    const result = await model.embedContent(text);
    return result.embedding.values.slice(0, 768);
  }

  // 2. Tìm kiếm ngữ nghĩa dựa trên cột description (Tìm trong CORE_DB)
  async findRelevantSchemas(userQuery: string): Promise<string[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(userQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      const sqlQuery = `
        SELECT description 
        FROM schema_metadata 
        ORDER BY embedding <=> $1::vector 
        LIMIT 3;
      `;

      const rows = await this.dbService.executeCoreQuery(sqlQuery, [vectorString]);
      return rows.map((row: any) => row.description);
    } catch (error: any) {
      console.error('Lỗi Vector Search:', error.message);
      return [];
    }
  }

  // 3. Tự động quét và nhúng toàn bộ bảng trong Database (Được gọi từ Radar hoặc API)
  async seedAllSchemas() {
    try {
      console.log('Đang quét cấu trúc Database động...');
      
      const schemaQuery = `
        SELECT 
            table_name, 
            string_agg(column_name || ' ' || data_type, ', ') as columns
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name != 'schema_metadata' 
        GROUP BY table_name;
      `;
      
      // BƯỚC ĐỌC: Đọc cấu trúc từ BIZ_DB
      const tables = await this.dbService.executeBizQuery(schemaQuery);

      if (!tables || tables.length === 0) {
        return { status: 'Lỗi', message: 'Không tìm thấy bảng dữ liệu nào trong Database Doanh nghiệp.' };
      }

      console.log('Bắt đầu làm sạch Vector DB cũ...');
      // BƯỚC GHI CHUẨN BỊ: Xóa bảng Vector bên CORE_DB
      await this.dbService.executeCoreQuery('TRUNCATE TABLE schema_metadata RESTART IDENTITY;');

      console.log(`Đã tìm thấy ${tables.length} bảng. Bắt đầu Embedding...`);
      let count = 0;

      for (const table of tables) {
        const tableName = table.table_name;
        const ddl = `CREATE TABLE ${tableName} (${table.columns});`;

        const embedding = await this.generateEmbedding(ddl);
        const vectorString = `[${embedding.join(',')}]`;

        const sql = `
          INSERT INTO schema_metadata (table_name, description, embedding)
          VALUES ($1, $2, $3::vector)
        `;
        
        // BƯỚC GHI: Ghi Vector Embeddings vào CORE_DB
        await this.dbService.executeCoreQuery(sql, [tableName, ddl, vectorString]);
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