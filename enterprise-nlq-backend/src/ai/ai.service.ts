import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ Cảnh báo: Chưa tìm thấy GEMINI_API_KEY trong file .env');
    }
    
    
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    
    
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  async generateSql(userQuery: string, schemaMetadata: string): Promise<any> {
    const prompt = `
Bạn là chuyên gia phân tích dữ liệu Enterprise PostgreSQL. 
Hãy chuyển đổi câu hỏi của người dùng thành câu lệnh SQL dựa trên lược đồ cơ sở dữ liệu sau:

Lược đồ (Schema):
${schemaMetadata}

Câu hỏi của người dùng: "${userQuery}"

Quy tắc BẮT BUỘC:
1. CHỈ sử dụng lệnh SELECT.
2. KHÔNG sử dụng DROP, DELETE, UPDATE, INSERT, ALTER.
3. Cấu trúc JSON trả về bắt buộc phải đúng định dạng sau:
{
  "sql_query": "câu lệnh SQL ở đây",
  "chart_type": "pie | bar | line | table",
  "explanation": "Giải thích ngắn gọn logic bạn dùng"
}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Chuyển chuỗi JSON text thành Object Javascript
      return JSON.parse(responseText);
    } catch (error: any) {
      console.error('❌ Lỗi khi gọi Gemini API:', error.message);
      throw new Error('Lỗi AI: ' + error.message);
    }
  }
}