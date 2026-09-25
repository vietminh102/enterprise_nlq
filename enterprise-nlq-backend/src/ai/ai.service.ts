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
      model: 'gemini-3.5-flash-lite', 
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  async generateSql(userQuery: string, schemaMetadata: string): Promise<any> {

    console.log('--- SCHEMA ĐANG ĐƯỢC BƠM CHO AI ---');
    console.log(schemaMetadata);
    console.log('-----------------------------------');
    const prompt = `
Bạn là một chuyên gia phân tích dữ liệu và viết mã SQL (PostgreSQL) xuất sắc.
Nhiệm vụ của bạn là chuyển đổi câu hỏi bằng ngôn ngữ tự nhiên của người dùng thành câu lệnh SQL để truy vấn dữ liệu.

<SCHEMA>
${schemaMetadata}
</SCHEMA>

<USER_QUERY>
${userQuery}
</USER_QUERY>

BẮT BUỘC TUÂN THỦ (NẾU SAI HỆ THỐNG SẼ SẬP):
1. BƯỚC ĐỐI CHIẾU: Trước khi viết SELECT, bạn phải dò từng tên cột dự định viết xem có KHỚP CHÍNH XÁC TỪNG KÝ TỰ với danh sách cột trong phần <SCHEMA> không.
2. CHỐNG ẢO GIÁC: Tuyệt đối không tự động nối tên bảng vào tên cột (Ví dụ: Nếu Schema chỉ ghi là 'name', phải dùng 'name', KHÔNG được tự ý viết thành 'product_name').
3. Trả về kết quả dưới dạng JSON thuần túy, định dạng như sau:
{
   "sql_query": "Câu lệnh SQL chuẩn PostgreSQL",
   "chart_type": "bar", // Chọn "bar", "pie", "line" hoặc "table"
   "explanation": "Mô tả và nhận xét tổng quát"
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