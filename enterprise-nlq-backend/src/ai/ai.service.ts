import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Schema} from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly fallbackModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ Cảnh báo: Chưa tìm thấy GEMINI_API_KEY trong file .env');
    }
    
    
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async generateSql(userQuery: string, schemaMetadata: string): Promise<any> {
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
`;

   
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        sql_query: { type: SchemaType.STRING },
        chart_type: { type: SchemaType.STRING, description: "bar, pie, line hoặc table" },
      },
      required: ["sql_query", "chart_type"],
    };

    for (const modelName of this.fallbackModels) {
      try {
        const currentModel = this.genAI.getGenerativeModel({ 
          model: modelName, 
          generationConfig: { responseMimeType: "application/json", responseSchema }
        });
        const result = await currentModel.generateContent(prompt);
        return JSON.parse(result.response.text());
      } catch (error: any) {
        if (error.message?.toLowerCase().match(/(429|503|quota|limit|overloaded|high demand)/)) {
          console.warn(`⏳ Model ${modelName} đang bận, thử model khác...`);
          continue; 
        }
        throw new Error('Lỗi AI: ' + error.message);
      }
    }
    throw new Error('ALL_MODELS_OVERLOADED');
  }

  // AI ĐỌC DỮ LIỆU THẬT VÀ PHÂN TÍCH 
  async generateDataInsights(userQuery: string, dbData: any[]): Promise<string> {
    try {
      const dataToAnalyze = dbData.length > 50 ? dbData.slice(0, 50) : dbData;

      // 1. SỬA LỖI BIGINT: Ép kiểu BigInt về String an toàn trước khi nạp cho AI
      const safeJsonString = JSON.stringify(dataToAnalyze, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      const prompt = `
Bạn là một Giám đốc Kinh doanh (Business Analyst).
Câu hỏi của sếp: "${userQuery}"
Dưới đây là BẢNG SỐ LIỆU THỰC TẾ vừa truy xuất được:
${safeJsonString}

Hãy viết một đoạn nhận xét về dữ liệu một cách nhìn tổng quát và phân tích thật hoàn hảo (Tổng quát và cự thể không lan man 4 - 5 câu).
YÊU CẦU:
1. Phân tích trực tiếp vào các CON SỐ nổi bật.
2. Đưa ra định hướng kinh doanh.
3. TUYỆT ĐỐI KHÔNG giải thích biểu đồ hay code SQL.
4. Hãy viết như một con người một cách tự nhiên nhất.
`;

      for (const modelName of this.fallbackModels) {
        try {
          // 2. THÊM LOG ĐỂ THEO DÕI AI CÓ BỊ TREO HAY KHÔNG
          console.log(`[AI Insights] Đang nhờ model ${modelName} viết nhận xét... (vui lòng đợi)`);
          
          const currentModel = this.genAI.getGenerativeModel({ model: modelName });
          const result = await currentModel.generateContent(prompt);
          const insightText = result.response.text();
          
          console.log(`[AI Insights] Hoàn thành phân tích!`);
          return insightText;
          
        } catch (error: any) {
          console.warn(`[AI Insights] Model ${modelName} thất bại:`, error.message);
          // Nếu quá tải thì chạy tiếp vòng lặp sang model khác
          if (error.message?.toLowerCase().match(/(429|503|quota|limit|overloaded)/)) continue;
        }
      }
      return "Hệ thống AI hiện đang quá tải, không thể đưa ra nhận xét chiến lược lúc này.";
    } catch (fatalError: any) {
      console.error('[AI Insights] Lỗi nghiêm trọng khi dịch dữ liệu:', fatalError.message);
      return "Không thể nhận xét do dữ liệu trả về chứa định dạng phức tạp.";
    }
}}