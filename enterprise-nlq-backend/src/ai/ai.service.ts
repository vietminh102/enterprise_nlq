import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly fallbackModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      console.warn('⚠️ Cảnh báo: Chưa tìm thấy GEMINI_API_KEY trong file .env');
    }

    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async generateSql(
    userQuery: string,
    schemaMetadata: string,
    glossaryContext: string = '',
    history: any[] = [],
    dbType: string = 'PostgreSQL',
  ): Promise<any> {
    // 1. Format lại lịch sử chat thành dạng Text cho AI đọc
    let historyPrompt = '';
    if (history && history.length > 1) {
      historyPrompt =
        '\n<CHAT_HISTORY>\nDưới đây là lịch sử các câu hỏi trước đó để bạn hiểu ngữ cảnh (Ví dụ: "trong các sản phẩm trên" nghĩa là áp dụng thêm điều kiện từ lượt trước):\n';

      const previousHistory = history.slice(0, -1);
      previousHistory.forEach((msg, index) => {
        historyPrompt += `Lượt ${index + 1} - ${msg.role === 'user' ? 'Người dùng hỏi' : 'Hệ thống trả lời'}: ${msg.content}\n`;
      });
      historyPrompt += '</CHAT_HISTORY>\n';
    }

    // 2. Định hình chỉ dẫn đặc thù cho từng loại cơ sở dữ liệu
    let databaseSpecificInstructions = '';
    const normalizedDbType = dbType.toLowerCase();

    switch (normalizedDbType) {
      case 'mongodb':
        databaseSpecificInstructions = `
1. QUAN TRỌNG NHẤT: Bạn BẮT BUỘC phải viết mã truy vấn cho **MongoDB** (MongoDB Query Language - MQL, dùng aggregation pipeline hoặc find/filter object JSON).
2. Ví dụ cú pháp hợp lệ: db.products.find({ "product_name": { $regex: "điện tử", $options: "i" } }) hoặc db.orders.aggregate([...]).
3. TUYỆT ĐỐI KHÔNG dùng cú pháp SQL (SELECT, FROM, WHERE, JOIN, GROUP BY...).
4. Trả về toàn bộ chuỗi mã truy vấn MongoDB vào trường "sql_query" của JSON.`;
        break;

      case 'oracle':
        databaseSpecificInstructions = `
1. BẮT BUỘC viết câu lệnh SQL chuẩn xác cho **Oracle Database**.
2. Phải tuân thủ cú pháp Oracle (ví dụ: dùng ROWNUM hoặc FETCH FIRST n ROWS ONLY thay vì LIMIT, dùng hàm NVL, TO_DATE).
3. Trả về câu lệnh vào trường "sql_query" của JSON.`;
        break;

      case 'mysql':
        databaseSpecificInstructions = `
1. BẮT BUỘC viết câu lệnh SQL chuẩn xác cho **MySQL**.
2. Phải tuân thủ cú pháp MySQL (ví dụ: dùng LIMIT/OFFSET, IFNULL, các hàm xử lý ngày tháng của MySQL).
3. Trả về câu lệnh vào trường "sql_query" của JSON.`;
        break;

      case 'sql server':
        databaseSpecificInstructions = `
1. BẮT BUỘC viết câu lệnh T-SQL chuẩn xác cho **Microsoft SQL Server**.
2. Phải tuân thủ cú pháp SQL Server (ví dụ: dùng SELECT TOP n, ISNULL, hàm GETDATE()).
3. Trả về câu lệnh vào trường "sql_query" của JSON.`;
        break;

      default: // PostgreSQL
        databaseSpecificInstructions = `
1. BẮT BUỘC viết câu lệnh SQL chuẩn xác cho **PostgreSQL**.
2. Phải tuân thủ cú pháp PostgreSQL (ví dụ: dùng ILIKE cho chuỗi, COALESCE, LIMIT/OFFSET).
3. Trả về câu lệnh vào trường "sql_query" của JSON.`;
        break;
    }

    // 3. Xây dựng Prompt (Đã nhúng databaseSpecificInstructions trực tiếp)
    const prompt = `
Bạn là một chuyên gia phân tích dữ liệu và lập trình viên cơ sở dữ liệu.
Nhiệm vụ của bạn là chuyển đổi câu hỏi tự nhiên thành câu truy vấn chuẩn xác cho hệ quản trị cơ sở dữ liệu: **${dbType.toUpperCase()}**.

<SCHEMA>
${schemaMetadata}
</SCHEMA>

<BUSINESS_GLOSSARY>
Chú ý các định nghĩa nghiệp vụ nội bộ sau đây để áp dụng vào logic truy vấn:
${glossaryContext}
</BUSINESS_GLOSSARY>
${historyPrompt}

<USER_QUERY>
${userQuery}
</USER_QUERY>

BẮT BUỘC TUÂN THỦ (NẾU SAI HỆ THỐNG SẼ SẬP):
${databaseSpecificInstructions}
- BƯỚC ĐỐI CHIẾU: Trước khi tạo truy vấn, bạn phải dò từng tên trường/cột dự định viết xem có KHỚP CHÍNH XÁC TỪNG KÝ TỰ với danh sách cột/thuộc tính trong phần <SCHEMA> không.
- CHỐNG ẢO GIÁC: Tuyệt đối không tự động nối tên bảng vào tên cột (Ví dụ: Nếu Schema chỉ ghi là 'name', phải dùng 'name', KHÔNG được tự ý đổi thành 'product_name').
- Nếu câu hỏi có chứa từ khóa trong BUSINESS_GLOSSARY, hãy sử dụng chính xác logic được cung cấp.
- Nếu câu hỏi yêu cầu lọc từ "các kết quả trên", hãy kết hợp điều kiện lọc của câu hỏi trước đó để giữ đúng luồng phân tích.
`;

    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        sql_query: {
          type: SchemaType.STRING,
          description:
            'Mã truy vấn hoàn chỉnh (MongoDB query/pipeline hoặc câu lệnh SQL tương ứng với CSDL được chọn)',
        },
        chart_type: {
          type: SchemaType.STRING,
          description: 'bar, pie, line hoặc table',
        },
      },
      required: ['sql_query', 'chart_type'],
    };

    for (const modelName of this.fallbackModels) {
      try {
        const currentModel = this.genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
        const result = await currentModel.generateContent(prompt);
        return JSON.parse(result.response.text());
      } catch (error: any) {
        if (
          error.message
            ?.toLowerCase()
            .match(/(429|503|quota|limit|overloaded|high demand)/)
        ) {
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

      // SỬA LỖI BIGINT: Ép kiểu BigInt về String an toàn trước khi nạp cho AI
      const safeJsonString = JSON.stringify(dataToAnalyze, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      );

      const prompt = `
Bạn là một Giám đốc Kinh doanh (Business Analyst).
Câu hỏi của sếp: "${userQuery}"
Dưới đây là BẢNG SỐ LIỆU THỰC TẾ vừa truy xuất được:
${safeJsonString}

Hãy viết một đoạn nhận xét về dữ liệu một cách nhìn tổng quát và phân tích thật hoàn hảo (Tổng quát và cụ thể không lan man 4 - 5 câu).
YÊU CẦU:
1. Phân tích trực tiếp vào các CON SỐ nổi bật.
2. Đưa ra định hướng kinh doanh.
3. TUYỆT ĐỐI KHÔNG giải thích biểu đồ hay code SQL.
4. Hãy viết như một con người một cách tự nhiên nhất.
`;

      for (const modelName of this.fallbackModels) {
        try {
          console.log(`[AI Insights] Đang nhờ model ${modelName} viết nhận xét... (vui lòng đợi)`);

          const currentModel = this.genAI.getGenerativeModel({ model: modelName });
          const result = await currentModel.generateContent(prompt);
          const insightText = result.response.text();

          console.log(`[AI Insights] Hoàn thành phân tích!`);
          return insightText;
        } catch (error: any) {
          console.warn(`[AI Insights] Model ${modelName} thất bại:`, error.message);
          if (
            error.message
              ?.toLowerCase()
              .match(/(429|503|quota|limit|overloaded)/)
          ) {
            continue;
          }
        }
      }
      return 'Hệ thống AI hiện đang quá tải, không thể đưa ra nhận xét chiến lược lúc này.';
    } catch (fatalError: any) {
      console.error('[AI Insights] Lỗi nghiêm trọng khi dịch dữ liệu:', fatalError.message);
      return 'Không thể nhận xét do dữ liệu trả về chứa định dạng phức tạp.';
    }
  }
}