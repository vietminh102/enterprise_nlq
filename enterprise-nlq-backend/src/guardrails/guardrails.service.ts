import { Injectable, BadRequestException } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

@Injectable()
export class GuardrailsService {
  private parser = new Parser();
  
  // Định nghĩa options dùng cho PostgreSQL để tránh lỗi syntax backtick (`)
  private opt = { database: 'PostgresQL' };

  validateAndSanitize(sqlQuery: string): string {
    try {
      // 1. Làm sạch câu lệnh (bỏ dấu chấm phẩy ở cuối nếu có)
      const cleanSql = sqlQuery.replace(/;+$/, ''); 
      
      // 2. Phân tích cú pháp với tuỳ chọn PostgreSQL
      const ast: any = this.parser.astify(cleanSql, this.opt);
      
      const statements = Array.isArray(ast) ? ast : [ast];

      // BẢO MẬT BỔ SUNG: Chặn thực thi nhiều câu lệnh cùng lúc
      if (statements.length > 1) {
        throw new BadRequestException('Vi phạm bảo mật: Hệ thống chỉ cho phép thực thi 1 câu lệnh SQL duy nhất mỗi lần truy vấn.');
      }

      // KIỂM TRA LOẠI TRUY VẤN
      for (const stmt of statements) {
        if (stmt.type !== 'select') {
          throw new BadRequestException(
            `Vi phạm bảo mật: Hệ thống chỉ cho phép lệnh SELECT. Phát hiện lệnh độc hại: ${stmt.type.toUpperCase()}`
          );
        }
      }

      // 3. Đóng gói lại thành chuỗi SQL chuẩn với tùy chọn PostgreSQL
      let sanitizedSql = this.parser.sqlify(ast, this.opt);

      // BẢO VỆ DATABASE: Tự động gắn LIMIT nếu AI quên
      if (!sanitizedSql.toLowerCase().includes('limit')) {
        sanitizedSql += ' LIMIT 100';
      }

      return sanitizedSql;
      
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error; 
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Cú pháp SQL sai';
      throw new BadRequestException('Lỗi kiểm duyệt SQL Guardrails: ' + errorMessage);
    }
  }
}