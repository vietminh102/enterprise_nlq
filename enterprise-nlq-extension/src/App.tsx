import { useState } from 'react';
import axios from 'axios';
import { Send, Database, Loader2, FileJson, LineChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// 1. Định nghĩa Interface để loại bỏ lỗi "Unexpected any" ở useState
interface QueryResponse {
  data?: Record<string, string | number>[];
  chart_type?: string;
  explanation?: string;
  error?: string;
}

export default function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  // Khai báo kiểu thay vì <any>
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3000/api/query', {
        question: question
      });
      setResponse(res.data);
    } catch (error) {
      console.error('Lỗi truy vấn:', error);
      setResponse({ error: 'Không thể kết nối đến máy chủ hoặc có lỗi xảy ra.' });
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!response?.data || response.data.length === 0) return null;

    const keys = Object.keys(response.data[0]);
    if (keys.length < 2) return <p className="text-sm text-gray-500 italic">Dữ liệu không đủ 2 cột để vẽ biểu đồ.</p>;
    
    const xAxisKey = keys[0]; 
    const yAxisKey = keys[1]; 

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8B5CF6'];

    if (response.chart_type === 'bar') {
      return (
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={response.data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px' }} />
              <Bar dataKey={yAxisKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (response.chart_type === 'pie') {
      return (
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
<Pie
  data={response.data}
  cx="50%"
  cy="50%"
  labelLine={false}
  outerRadius={80}
  fill="#8884d8"
  dataKey={yAxisKey}
  nameKey={xAxisKey}
  // Thêm dấu ? vào name và cấp kiểu string | number
  label={({ name, percent }: { name?: string | number; percent?: number }) => 
    `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
  }
>
                {/* 3. Khai báo rõ kiểu cho tham số '_' và 'index' */}
                {response.data.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null; 
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-blue-700 text-white p-4 shadow-md flex items-center gap-2">
        <Database size={20} />
        <h1 className="font-semibold text-lg">Enterprise Assistant</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {response && !response.error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-fade-in">
            
            {response.explanation && (
              <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                <h3 className="text-blue-800 font-semibold text-sm mb-1">AI Nhận xét:</h3>
                <p className="text-blue-900 text-sm">{response.explanation}</p>
              </div>
            )}

            <h2 className="text-gray-700 font-medium mb-3 flex items-center gap-2 border-b pb-2">
              <FileJson size={16} className="text-blue-600" /> Dữ liệu truy xuất
            </h2>

            {response.data && response.data.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                    <tr>
                      {Object.keys(response.data[0]).map((key) => (
                        <th key={key} className="px-4 py-3 border-b">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* 4. Khai báo kiểu cho 'row' và thay thế 'any' bằng 'unknown' cho 'val' */}
                    {response.data.map((row: Record<string, string | number>, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                        {Object.values(row).map((val: unknown, colIdx: number) => (
                          // 5. Thay thế max-w-[150px] thành max-w-37.5 theo gợi ý của Tailwind
                          <td key={colIdx} className="px-4 py-2 truncate max-w-37.5">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Không tìm thấy dữ liệu.</p>
            )}

            {response.chart_type && response.chart_type !== 'table' && (
              <div className="mt-6 border-t pt-4">
                <h2 className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                  <LineChart size={16} className="text-green-600" /> Trực quan hóa
                </h2>
                {renderChart()}
              </div>
            )}
          </div>
        )}

        {response?.error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
            {response.error}
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <div className="relative flex items-center">
          <input
            type="text"
            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-sm transition-all outline-none"
            placeholder="VD: Liệt kê top 3 khách hàng mua nhiều nhất..."
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
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}