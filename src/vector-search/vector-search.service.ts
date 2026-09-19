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

  private async generateEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async findRelevantSchemas(userQuery: string): Promise<string[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(userQuery);
      const vectorString = `[${queryEmbedding.join(',')}]`;

      const sqlQuery = `
        SELECT table_schema_definition 
        FROM enterprise_embeddings 
        ORDER BY embedding <=> $1::vector 
        LIMIT 3;
      `;

      // Gọi hàm executeQuery thay vì getPool
      const rows = await this.dbService.executeQuery(sqlQuery, [vectorString]);

      // Vì executeQuery đã trả về result.rows, chúng ta chỉ cần map trực tiếp biến rows
      return rows.map((row: any) => row.table_schema_definition);
      
    } catch (error: any) { 
      console.error('Lỗi Vector Search:', error.message);
      return ['Table: sales (id, product_id, amount, created_at), Table: customers (id, name, email)'];
    }
  }
}