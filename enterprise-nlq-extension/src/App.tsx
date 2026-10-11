import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Send, Database, Loader2, 
  LineChart as LineChartIcon, ShieldAlert, AlertTriangle, User, Bot 
} from 'lucide-react';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// --- ĐỊNH NGHĨA CẤU TRÚC 1 LƯỢT CHAT ---
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // Nội dung câu hỏi (User) hoặc nội dung Lỗi (Assistant)
  data?: Record<string, string | number>[];
  chart_type?: string;
  explanation?: string;
  error?: string;
  error_type?: string; 
}

export default function App() {
  // Thay vì lưu 1 response, ta lưu một mảng các lượt hội thoại
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Tham chiếu để tự động cuộn xuống tin nhắn mới nhất
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- HÀM XỬ LÝ GỬI TIN NHẮN VÀ GỌI API ---
  const handleQuery = async () => {
    if (!inputValue.trim()) return;
    
    // 1. Tạo tin nhắn của người dùng và đưa ngay lên màn hình
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };
    
    // Lưu tạm lịch sử cũ để truyền xuống DB (Nếu Backend của bạn đã hỗ trợ FR-03 nhận history)
    const historyToGửi = [...messages, userMsg];
    
    setMessages(historyToGửi);
    setInputValue('');
    setLoading(true);
    
    try {
      // 2. Gọi API (Có thể gửi kèm history nếu cần thiết)
      const res = await axios.post('http://localhost:3000/api/query', {
        question: userMsg.content,
        // Ép kiểu chỉ gửi lịch sử là text để tránh làm phình to Request
        history: historyToGửi.map(msg => ({ 
           role: msg.role, 
           content: msg.content 
        })) 
      });
      
      const responseData = res.data;

      // 3. Tạo tin nhắn của Trợ lý từ kết quả trả về
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseData.generated_sql || responseData.explanation || 'Đã truy xuất xong',
        data: responseData.data,
        chart_type: responseData.chart_type,
        explanation: responseData.explanation,
        error: responseData.error,
        error_type: responseData.error_type
      };

      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) { // Xóa chữ ': any' ở đây
      console.error('Lỗi truy vấn:', error);
      
      // Xử lý khi lỗi gọi API theo chuẩn TypeScript an toàn
      let errorMessage = 'Không thể kết nối đến máy chủ hoặc có lỗi xảy ra.';
      let errorType = 'UNKNOWN';

      if (axios.isAxiosError(error) && error.response?.data) {
        errorMessage = error.response.data.error || errorMessage;
        errorType = error.response.data.error_type || errorType;
      }
      
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        error: errorMessage,
        error_type: errorType
      };
      setMessages(prev => [...prev, errorMsg]);
      
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM RENDER BIỂU ĐỒ (Dùng chung cho từng tin nhắn) ---
  const renderChart = (msg: ChatMessage) => {
    if (!msg.data || msg.data.length === 0) return null;

    const keys = Object.keys(msg.data[0]);
    if (keys.length < 2) return <p className="text-sm text-gray-500 italic">Dữ liệu không đủ 2 cột để vẽ biểu đồ.</p>;
    
    const xAxisKey = keys[0]; 
    let yAxisKey = keys[1]; 
    
    for (let i = 1; i < keys.length; i++) {
      const sampleValue = msg.data[0][keys[i]];
      if (sampleValue !== null && sampleValue !== '' && !isNaN(Number(sampleValue))) {
        yAxisKey = keys[i];
      }
    }

    const chartData = msg.data.map(item => ({
      ...item,
      [yAxisKey]: Number(item[yAxisKey]) || 0
    }));

    const COLORS = ['#8B5CF6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const chartType = msg.chart_type?.toLowerCase();

    if (chartType === 'bar') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px' }} />
              <Bar dataKey={yAxisKey} fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Line type="monotone" dataKey={yAxisKey} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'pie') {
      return (
        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData} cx="50%" cy="50%" labelLine={true} outerRadius={90}
                dataKey={yAxisKey} nameKey={xAxisKey}
                label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
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
      {/* HEADER TÍM - GIỐNG TRONG ẢNH SDS */}
      <header className="bg-purple-600 text-white p-4 shadow-md flex items-center gap-2 z-10">
        <Database size={20} />
        <h1 className="font-bold text-lg">Enterprise Assistant</h1>
      </header>

      {/* KHU VỰC HIỂN THỊ CHAT LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Tin nhắn chào mừng ban đầu */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <Bot size={48} className="text-purple-300" />
            <p className="text-center text-sm">Xin chào! Tôi là Trợ lý Dữ liệu Doanh nghiệp.<br/>Hãy đặt câu hỏi để tôi phân tích số liệu cho bạn nhé.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            
            {/* 1. HIỂN THỊ TIN NHẮN CỦA USER */}
            {msg.role === 'user' && (
              <div className="flex gap-2 max-w-[80%]">
                <div className="bg-purple-100 text-purple-900 px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                  {msg.content}
                </div>
                <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
                  <User size={16} className="text-purple-700" />
                </div>
              </div>
            )}

            {/* 2. HIỂN THỊ KẾT QUẢ CỦA ASSISTANT */}
            {msg.role === 'assistant' && (
              <div className="flex gap-3 w-full max-w-4xl">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={18} className="text-blue-600" />
                </div>
                
                <div className="flex-1">
                  {/* Nếu gặp lỗi */}
                  {msg.error ? (
                    <div className="animate-fade-in w-full">
                      {msg.error_type === 'SAFETY_VIOLATION' ? (
                        <div className="bg-red-50 text-red-800 p-5 rounded-xl border border-red-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3 border-b border-red-200 pb-2">
                            <ShieldAlert className="text-red-600" size={24} />
                            <h2 className="font-bold text-lg">Hành động bị từ chối (Bảo vệ Dữ liệu)</h2>
                          </div>
                          <p className="text-sm mb-4">Hệ thống phát hiện bạn đang yêu cầu thực hiện các thao tác làm thay đổi cơ sở dữ liệu.</p>
                        </div>
                      ) : (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex gap-3 items-start">
                          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                          <div>{msg.error}</div>
                        </div>
                      )}
                    </div>
                  ) : 
                  
                  /* Nếu thành công (Hiện Bảng & Biểu đồ - KHUNG TRẮNG GIỐNG ẢNH SDS) */
                  (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-fade-in w-full">
                      {msg.explanation && (
                        <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                          <h3 className="text-blue-800 font-semibold text-sm mb-1">AI Nhận xét:</h3>
                          <p className="text-blue-900 text-sm">{msg.explanation}</p>
                        </div>
                      )}

                      {/* Bảng dữ liệu */}
                      {msg.data && msg.data.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-gray-100">
                          <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                              <tr>
                                {Object.keys(msg.data[0]).map((key) => (
                                  <th key={key} className="px-4 py-3 border-b">{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.data.map((row, idx) => (
                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                  {Object.values(row).map((val: unknown, colIdx) => (
                                    <td key={colIdx} className="px-4 py-2 truncate max-w-50" title={String(val)}>{String(val)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Biểu đồ (Như ảnh SDS) */}
                      {msg.chart_type && msg.chart_type !== 'table' && (
                        <div className="mt-6 border-t pt-4">
                          <h2 className="text-gray-700 font-medium flex items-center gap-2 mb-2">
                            <LineChartIcon size={16} className="text-green-600" /> Trực quan hóa
                          </h2>
                          {renderChart(msg)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Cục quay vòng vòng khi đang Loading */}
        {loading && (
          <div className="flex gap-3 w-full max-w-4xl">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Bot size={18} className="text-blue-600" />
            </div>
            <div className="bg-gray-100 px-4 py-3 rounded-xl flex items-center gap-2 text-gray-500 text-sm italic shadow-sm">
              <Loader2 size={16} className="animate-spin text-purple-600" /> Hệ thống đang phân tích số liệu...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* KHU VỰC NHẬP CÂU HỎI (Thanh trắng dưới cùng) */}
      <div className="p-4 bg-white border-t shadow-lg z-10">
        <div className="relative flex items-center max-w-4xl mx-auto rounded-full bg-gray-50 border border-gray-300 focus-within:ring-2 ring-purple-400 focus-within:bg-white transition-all overflow-hidden p-1">
          <input
            type="text"
            className="w-full pl-4 pr-12 py-2.5 bg-transparent text-sm outline-none text-gray-800"
            placeholder="Lập thống kê top 5 sản phẩm có số lượng bán ra chạy nhất"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            disabled={loading}
          />
          <button
            onClick={handleQuery}
            disabled={loading || !inputValue.trim()}
            className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed ml-2 mr-1"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}