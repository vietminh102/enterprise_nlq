import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  
  private readonly FAST_MODEL = 'gemini-3.5-flash-lite';
  private readonly SMART_MODEL = 'gemini-3.5-flash';

  private readonly sqlCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 500; 

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) this.logger.warn('⚠️ Chưa tìm thấy GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  private generateCacheKey(query: string, schema: string): string {
    return crypto.createHash('md5').update((query + schema).toLowerCase()).digest('hex');
  }

  private async executeWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string = 'AI_TIMEOUT'): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  private isComplexQuery(query: string): boolean {
    const complexKeywords = ['thống kê', 'tổng', 'trung bình', 'phân tích', 'tỷ lệ', 'nhóm', 'so sánh'];
    return query.length > 50 || complexKeywords.some(k => query.toLowerCase().includes(k));
  }

  /* --- BƯỚC 1: SINH SQL --- */
  async generateSql(userQuery: string, schemaMetadata: string): Promise<any> {
    const cacheKey = this.generateCacheKey(userQuery, schemaMetadata);
    if (this.sqlCache.has(cacheKey)) {
      this.logger.log(`[AI Cache Hit] Trả về SQL từ bộ nhớ đệm.`);
      return this.sqlCache.get(cacheKey);
    }

    const prompt = `Viết SQL (PostgreSQL) từ yêu cầu.
Schema: ${schemaMetadata}
Hỏi: "${userQuery}"
Bắt buộc: 1. Cột phải khớp chính xác Schema. 2. Không tự bịa tên cột.`;

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        sql_query: { type: SchemaType.STRING },
        chart_type: { type: SchemaType.STRING, description: "bar, pie, line, table" },
      },
      required: ["sql_query", "chart_type"],
    };

    const modelsToTry = this.isComplexQuery(userQuery) 
      ? [this.SMART_MODEL, this.FAST_MODEL] 
      : [this.FAST_MODEL, this.SMART_MODEL];

    for (const modelName of modelsToTry) {
      try {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName, 
          generationConfig: { responseMimeType: "application/json", responseSchema }
        });
        
        // Timeout 6 giây cho SQL Generation
        const result = await this.executeWithTimeout(model.generateContent(prompt), 6000);
        const parsedResult = JSON.parse(result.response.text());

        if (this.sqlCache.size >= this.MAX_CACHE_SIZE) this.sqlCache.clear();
        this.sqlCache.set(cacheKey, parsedResult);

        return parsedResult;
      } catch (error: any) {
        if (error.message.includes('AI_TIMEOUT') || error.message.match(/(429|503|overloaded)/)) {
          this.logger.warn(`⏳ Model ${modelName} bận/timeout khi sinh SQL. Chuyển fallback...`);
          continue; 
        }
        throw new Error(`Lỗi sinh SQL: ${error.message}`);
      }
    }
    throw new Error('ALL_MODELS_OVERLOADED');
  }

  /* --- BƯỚC 2: PHÂN TÍCH SỐ LIỆU (Optional - Không làm chậm Response) --- */
  async generateDataInsights(userQuery: string, dbData: any[]): Promise<string> {
    // 1. Chỉ gọi khi có dữ liệu thực tế
    if (!dbData || dbData.length === 0) return "";
    
    try {
      const dataToAnalyze = dbData.length > 50 ? dbData.slice(0, 50) : dbData;
      const safeJsonString = JSON.stringify(dataToAnalyze, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      const prompt = `Phân tích kinh doanh. Hỏi: "${userQuery}" Data: ${safeJsonString} Yêu cầu: Viết 2 câu nhận xét con số nổi bật. Không giải thích.`;

      // 2. CHỈ DÙNG MODEL LITE (Nhanh nhất) để sinh Insight, bỏ qua Smart Model
      const model = this.genAI.getGenerativeModel({ model: this.FAST_MODEL });
      
      // 3. MICRO-TIMEOUT (Ép giới hạn cực ngắn: 1.5 giây)
      // Nếu vượt quá 1500ms, hệ thống sẽ ngắt ngang để trả DB Data ngay lập tức cho UI
      const result = await this.executeWithTimeout(model.generateContent(prompt), 1500, 'INSIGHT_TIMEOUT');
      
      return result.response.text();

    } catch (error: any) {
      // 4. Xử lý Lỗi/Timeout im lặng (Optional Pattern)
      if (error.message.includes('INSIGHT_TIMEOUT')) {
        this.logger.log('Bỏ qua tạo Insight để ưu tiên trả Data nhanh cho UI (Quá 1.5s).');
        return ""; // Trả về chuỗi rỗng để không làm gián đoạn UI
      }
      
      this.logger.warn(`[AI Insights] Lỗi xử lý nền: ${error.message}`);
      return ""; 
    }
  }
}