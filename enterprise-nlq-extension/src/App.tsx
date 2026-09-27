import { useState } from 'react';
import axios from 'axios';
// Import các Icon từ lucide-react (Lưu ý đổi tên LineChart thành LineChartIcon)
import { 
  Send, Database, Loader2, FileJson, 
  LineChart as LineChartIcon, ShieldAlert, AlertTriangle 
} from 'lucide-react';
// Import thư viện vẽ biểu đồ recharts
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// Định nghĩa kiểu dữ liệu trả về từ API
interface QueryResponse {
  data?: Record<string, string | number>[];
  chart_type?: string;
  explanation?: string;
  error?: string;
  error_type?: string; 
}

export default function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const handleQuery = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    setResponse(null); // Reset kết quả cũ khi hỏi câu mới
    
    try {
      const res = await axios.post('http://localhost:3000/api/query', {
        question: question
      });
      setResponse(res.data);
    } catch (error) {
      console.error('Lỗi truy vấn:', error);
      setResponse({ 
        error: 'Không thể kết nối đến máy chủ hoặc có lỗi xảy ra.',
        error_type: 'UNKNOWN'
      });
    } finally {
      setLoading(false);
    }
  };

  // Hàm render Biểu đồ tự động
  const renderChart = () => {
    if (!response?.data || response.data.length === 0) return null;

    const keys = Object.keys(response.data[0]);
    if (keys.length < 2) return <p className="text-sm text-gray-500 italic">Dữ liệu không đủ 2 cột để vẽ biểu đồ.</p>;
    
    // 1. Nhận diện trục X (nhãn) và trục Y (số liệu)
    const xAxisKey = keys[0]; 
    let yAxisKey = keys[1]; 
    
    // Tự động tìm cột chứa số liệu để làm trục Y
    for (let i = 1; i < keys.length; i++) {
      const sampleValue = response.data[0][keys[i]];
      if (sampleValue !== null && sampleValue !== '' && !isNaN(Number(sampleValue))) {
        yAxisKey = keys[i];
      }
    }

    // 2. Chuẩn bị dữ liệu cho biểu đồ (ép kiểu Y về dạng Số)
    const chartData = response.data.map(item => ({
      ...item,
      [yAxisKey]: Number(item[yAxisKey]) || 0
    }));

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8B5CF6'];
    const chartType = response.chart_type?.toLowerCase();

    // 3. Render BIỂU ĐỒ CỘT (Bar Chart)
    if (chartType === 'bar') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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

    // 4. Render BIỂU ĐỒ ĐƯỜNG (Line Chart)
    if (chartType === 'line') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Line 
                type="monotone" 
                dataKey={yAxisKey} 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 5. Render BIỂU ĐỒ TRÒN (Pie Chart)
    if (chartType === 'pie') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={90}
                fill="#8884d8"
                dataKey={yAxisKey}
                nameKey={xAxisKey}
                label={({ name, percent }: { name?: string | number; percent?: number }) => 
                  `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
                }
              >
                {chartData.map((_, index: number) => (
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
      {/* HEADER */}
      <header className="bg-blue-700 text-white p-4 shadow-md flex items-center gap-2">
        <Database size={20} />
        <h1 className="font-semibold text-lg">Enterprise Assistant</h1>
      </header>

      {/* KHU VỰC HIỂN THỊ KẾT QUẢ */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        
        {/* NẾU CÓ DỮ LIỆU THÀNH CÔNG */}
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

            {/* BẢNG DỮ LIỆU */}
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
                    {response.data.map((row: Record<string, string | number>, idx: number) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                        {Object.values(row).map((val: unknown, colIdx: number) => (
                          <td key={colIdx} className="px-4 py-2 truncate max-w-50" title={String(val)}>
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

            {/* KHU VỰC BIỂU ĐỒ */}
            {response.chart_type && response.chart_type !== 'table' && (
              <div className="mt-6 border-t pt-4">
                <h2 className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                  <LineChartIcon size={16} className="text-green-600" /> Trực quan hóa
                </h2>
                {renderChart()}
              </div>
            )}
          </div>
        )}

        {/* 🚀 KHU VỰC HIỂN THỊ LỖI CHUYÊN BIỆT */}
        {response?.error && (
          <div className="animate-fade-in mb-4">
            
            {/* Giao diện 1: Lỗi Guardrails chặn Thêm/Sửa/Xóa */}
            {response.error_type === 'SAFETY_VIOLATION' ? (
              <div className="bg-red-50 text-red-800 p-5 rounded-xl border border-red-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-red-200 pb-2">
                  <ShieldAlert className="text-red-600" size={24} />
                  <h2 className="font-bold text-lg">Hành động bị từ chối (Bảo vệ Dữ liệu)</h2>
                </div>
                <p className="text-sm mb-4">
                  Hệ thống phát hiện bạn đang yêu cầu thực hiện các thao tác làm thay đổi cơ sở dữ liệu. Trợ lý AI này chỉ được cấp quyền <strong>ĐỌC</strong> để trích xuất báo cáo.
                </p>
                <div className="bg-white p-4 rounded-lg text-sm border border-red-100">
                  <h3 className="font-semibold text-gray-800 mb-2">Quy định thao tác Hệ thống:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li><strong>Tuyệt đối không</strong> yêu cầu thực thi lệnh <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>, <code>DROP</code> hoặc <code>ALTER</code>.</li>
                    <li>Chỉ đặt các câu hỏi truy vấn dữ liệu, thống kê, hoặc lấy danh sách.</li>
                    <li>Mọi hành vi cố tình can thiệp trái phép vào cấu trúc dữ liệu đều bị chặn và lưu log bảo mật.</li>
                  </ul>
                </div>
              </div>
            ) : 
            
            /* Giao diện 2: Lỗi Quá tải AI (Limit Reached) */
            response.error_type === 'LIMIT_REACHED' ? (
              <div className="bg-orange-50 text-orange-800 p-4 rounded-xl border border-orange-200 flex gap-3 items-start">
                <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold">Hệ thống đang quá tải</h3>
                  <p className="text-sm mt-1">{response.error}</p>
                </div>
              </div>
            ) : 
            
            /* Giao diện 3: Các lỗi chung khác (VD: Sai cú pháp) */
            (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex gap-3 items-start">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div>{response.error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KHU VỰC NHẬP CÂU HỎI */}
      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <div className="relative flex items-center max-w-5xl mx-auto">
          <input
            type="text"
            className="w-full pl-4 pr-12 py-3.5 bg-gray-50 border border-gray-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl text-sm transition-all outline-none shadow-sm"
            placeholder="VD: Liệt kê top 3 khách hàng mua nhiều nhất..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            disabled={loading}
          />
          <button
            onClick={handleQuery}
            disabled={loading || !question.trim()}
            className="absolute right-2 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}