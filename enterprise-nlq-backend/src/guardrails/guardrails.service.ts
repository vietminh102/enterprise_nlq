import { Injectable, BadRequestException } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

@Injectable()
export class GuardrailsService {
  private parser = new Parser();

  validateAndSanitize(sqlQuery: string): string {
    try {
      const cleanSql = sqlQuery.replace(/;+$/, ''); 
      const ast = this.parser.astify(cleanSql);
      
      const statements = Array.isArray(ast) ? ast : [ast];

      // BẢO MẬT BỔ SUNG: Chặn thực thi nhiều câu lệnh cùng lúc (Batch Execution)
      if (statements.length > 1) {
        throw new BadRequestException('Vi phạm bảo mật: Hệ thống chỉ cho phép thực thi 1 câu lệnh SQL duy nhất mỗi lần truy vấn.');
      }

      for (const stmt of statements) {
        if (stmt.type !== 'select') {
          throw new BadRequestException(
            `Vi phạm bảo mật: Hệ thống chỉ cho phép lệnh SELECT. Phát hiện lệnh độc hại: ${stmt.type.toUpperCase()}`
          );
        }
      }

      let sanitizedSql = this.parser.sqlify(ast);

      if (!sanitizedSql.toLowerCase().includes('limit')) {
        sanitizedSql += ' LIMIT 100';
      }

      return sanitizedSql;
      
    // Sửa 'any' thành 'unknown' để tuân thủ chuẩn TypeScript
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error; // Giữ nguyên lỗi bảo mật đã ném ra ở trên
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Cú pháp SQL sai';
      throw new BadRequestException('Lỗi kiểm duyệt SQL Guardrails: ' + errorMessage);
    }
  }
}