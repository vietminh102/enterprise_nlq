import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  
  // 1. Rút gọn số lượng Model (Chỉ giữ 2 bản: Nhanh và Thông minh)
  private readonly FAST_MODEL = 'gemini-3.5-flash-lite';
  private readonly SMART_MODEL = 'gemini-3.5-flash';

  // 2. Cache Text-to-SQL để tránh gọi LLM lại với cùng một câu hỏi & schema
  private readonly sqlCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 500; 

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) this.logger.warn('⚠️ Chưa tìm thấy GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  // Tiện ích: Tạo MD5 key cho Cache
  private generateCacheKey(query: string, schema: string): string {
    return crypto.createHash('md5').update((query + schema).toLowerCase()).digest('hex');
  }

  // Tiện ích: Ép Timeout ngắt lượt gọi AI nếu bị treo
  private async executeWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  // Đánh giá nhanh độ phức tạp để chọn Model
  private isComplexQuery(query: string): boolean {
    const complexKeywords = ['thống kê', 'tổng', 'trung bình', 'phân tích', 'tỷ lệ', 'nhóm', 'so sánh'];
    return query.length > 50 || complexKeywords.some(k => query.toLowerCase().includes(k));
  }

  /* --- BƯỚC 1: SINH SQL --- */
  async generateSql(userQuery: string, schemaMetadata: string): Promise<any> {
    const cacheKey = this.generateCacheKey(userQuery, schemaMetadata);
    if (this.sqlCache.has(cacheKey)) {
      this.logger.log(`[AI Cache Hit] Trả về SQL ngay lập tức cho câu hỏi.`);
      return this.sqlCache.get(cacheKey);
    }

    // 3. Prompt cực ngắn gọn (Tiết kiệm Token & Thời gian đọc)
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

    // 4. Chọn model dựa trên độ khó (Đơn giản dùng Lite, Phức tạp dùng Flash thường)
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

        // Quản lý bộ nhớ Cache chống Memory Leak
        if (this.sqlCache.size >= this.MAX_CACHE_SIZE) this.sqlCache.clear();
        this.sqlCache.set(cacheKey, parsedResult);

        return parsedResult;
      } catch (error: any) {
        if (error.message.includes('AI_TIMEOUT') || error.message.match(/(429|503|overloaded)/)) {
          this.logger.warn(`⏳ Model ${modelName} bận/timeout. Chuyển fallback...`);
          continue; 
        }
        throw new Error(`Lỗi sinh SQL: ${error.message}`);
      }
    }
    throw new Error('ALL_MODELS_OVERLOADED');
  }

  /* --- BƯỚC 2: PHÂN TÍCH SỐ LIỆU --- */
  async generateDataInsights(userQuery: string, dbData: any[]): Promise<string> {
    if (!dbData || dbData.length === 0) return "";
    
    try {
      const dataToAnalyze = dbData.length > 50 ? dbData.slice(0, 50) : dbData;
      const safeJsonString = JSON.stringify(dataToAnalyze, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      // Prompt cực ngắn gọn, định hướng trực tiếp
      const prompt = `Phân tích kinh doanh.
Hỏi: "${userQuery}"
Data: ${safeJsonString}
Yêu cầu: Viết 3-4 câu nhận xét trực tiếp vào con số nổi bật và định hướng kinh doanh. Không giải thích kỹ thuật/SQL.`;

      const modelsToTry = [this.FAST_MODEL, this.SMART_MODEL]; // Luôn ưu tiên Fast model cho Text generation

      for (const modelName of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          // Timeout 4 giây cho quá trình viết nhận xét
          const result = await this.executeWithTimeout(model.generateContent(prompt), 4000);
          return result.response.text();
        } catch (error: any) {
          if (error.message.includes('AI_TIMEOUT') || error.message.match(/(429|503|overloaded)/)) continue;
        }
      }
      return "Hệ thống AI hiện đang bận, không thể đưa ra nhận xét lúc này.";
    } catch (error: any) {
      this.logger.error('[AI Insights] Lỗi xử lý:', error.message);
      return "Không thể nhận xét do định dạng dữ liệu quá phức tạp.";
    }
  }
}