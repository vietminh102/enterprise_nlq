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
Bạn là một chuyên gia phân tích dữ liệu và viết mã SQL (PostgreSQL) xuất sắc.
Nhiệm vụ của bạn là chuyển đổi câu hỏi bằng ngôn ngữ tự nhiên của người dùng thành câu lệnh SQL để truy vấn dữ liệu.

=== LƯỢC ĐỒ CƠ SỞ DỮ LIỆU (SCHEMA) ===
${schemaMetadata}
=======================================

=== CÂU HỎI CỦA NGƯỜI DÙNG ===
${userQuery}
=======================================

⚠️ CÁC QUY TẮC BẮT BUỘC PHẢI TUÂN THỦ:
1. TUYỆT ĐỐI KHÔNG TỰ BỊA RA TÊN CỘT HOẶC TÊN BẢNG. Chỉ được phép sử dụng CHÍNH XÁC các bảng và cột được liệt kê trong Schema ở trên.
2. Ví dụ: Nếu Schema ghi cột là 'id', bạn PHẢI dùng 'id', không được tự ý đổi thành 'customer_id'. Nếu Schema ghi là 'name', không được đổi thành 'customer_name'.
3. Trả về kết quả dưới dạng JSON thuần túy, có các khóa sau:
   - "sql_query": Câu lệnh SQL chuẩn PostgreSQL.
   - "chart_type": "bar", "pie", "line" hoặc "table" tùy thuộc vào dữ liệu.
   - "explanation": Giải thích ngắn gọn bằng tiếng Việt.
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