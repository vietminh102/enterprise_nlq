import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  // Hàm chuyển đổi mảng JSON thành file Excel (Buffer)
  async generateExcelReport(data: any[], sheetName: string = 'Báo Cáo'): Promise<Buffer> {
    this.logger.log(`Đang tạo file Excel cho ${data.length} dòng dữ liệu...`);

    if (!data || data.length === 0) {
      throw new Error('Không có dữ liệu để tạo báo cáo.');
    }

    // 1. Khởi tạo Workbook và Worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Enterprise NLQ Assistant';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet(sheetName);

    // 2. Tự động lấy tên cột (Header) từ các key của object đầu tiên
    const keys = Object.keys(data[0]);
    worksheet.columns = keys.map((key) => ({
      header: key.toUpperCase(), // Viết hoa tên cột
      key: key,
      width: 25, // Độ rộng cột
    }));

    // Style cho dòng Header (In đậm, nền xám)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' } // Màu xanh doanh nghiệp
    };

    // 3. Đổ dữ liệu vào các dòng tiếp theo
    data.forEach((row) => {
      worksheet.addRow(row);
    });

    // 4. Xuất ra Buffer (Để lưu thành file hoặc đính kèm qua mạng)
    const buffer = await workbook.xlsx.writeBuffer();
    this.logger.log('Tạo file Excel thành công!');
    
    return buffer as unknown as Buffer;
  }
}