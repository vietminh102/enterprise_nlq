import { useState } from 'react';
import axios from 'axios';
import { Send, Database, Loader2, FileJson } from 'lucide-react';

interface QueryResponse {
  error?: string;
  generated_sql?: string;
  data?: Record<string, unknown>[];
}

export default function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2. Sử dụng Interface đã định nghĩa cho State
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    try {
      // Gọi API sang Backend NestJS
      const res = await axios.post('http://localhost:3000/api/query', {
        question: question
      });
      setResponse(res.data);
    } catch (error: unknown) {
      console.error('Lỗi truy vấn:', error);
      setResponse({ error: 'Không thể kết nối đến máy chủ hoặc có lỗi xảy ra.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-blue-700 text-white p-4 shadow-md flex items-center gap-2">
        <Database size={20} />
        <h1 className="font-semibold text-lg">Enterprise Assistant</h1>
      </header>

      {/* Vùng hiển thị kết quả */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {response && !response.error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-fade-in">
            <h2 className="text-gray-700 font-medium mb-2 flex items-center gap-2">
              <FileJson size={16} className="text-blue-600" /> Kết quả dữ liệu:
            </h2>
            
            {/* Hiển thị SQL đã sinh ra để User review */}
            <div className="bg-gray-80 text-gray-600 text-xs p-2 rounded bg-gray-100 mb-3 font-mono">
              {response.generated_sql}
            </div>

            {/* Hiển thị bảng dữ liệu (Dynamic Table) */}
            {response.data && response.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                    <tr>
                      {Object.keys(response.data[0]).map((key) => (
                        <th key={key} className="px-3 py-2 border-b">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* 3. Thay thế "any" bằng kiểu đối tượng linh hoạt Record<string, unknown> */}
                    {response.data.map((row: Record<string, unknown>, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {/* 4. Thay thế "any" bằng "unknown" vì ở đây ta ép kiểu về String(val) */}
                        {Object.values(row).map((val: unknown, colIdx) => (
                          <td key={colIdx} className="px-3 py-2 truncate max-w-[150px]">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Không tìm thấy dữ liệu phù hợp.</p>
            )}
          </div>
        )}

        {response?.error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
            {response.error}
          </div>
        )}
      </div>

      {/* Khu vực nhập liệu (Input) */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="relative flex items-center">
          <input
            type="text"
            className="w-full pl-4 pr-12 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl text-sm transition-all outline-none"
            placeholder="VD: Liệt kê 5 khách hàng mới nhất..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            disabled={loading}
          />
          <button
            onClick={handleQuery}
            disabled={loading}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          AI có thể mắc sai lầm. Hãy kiểm tra lại SQL sinh ra.
        </p>
      </div>
    </div>
  );
}