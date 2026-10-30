import { useState, useRef, useEffect} from 'react';
import axios from 'axios';
import { 
  Send, Database, Loader2, 
  LineChart as LineChartIcon, ShieldAlert, AlertTriangle, User, Bot, Plus, MessageSquare, Menu,Trash2
} from 'lucide-react';
import { 
  BarChart, Bar, 
  LineChart, Line, 
  PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// --- ĐỊNH NGHĨA CẤU TRÚC KIỂU DỮ LIỆU ---
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; 
  data?: Record<string, string | number>[];
  chart_type?: string;
  explanation?: string;
  error?: string;
  error_type?: string; 
}

interface ChatSession {
  session_id: string;
  title: string;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Các state quản lý Sidebar
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


// --- 1. TẢI DANH SÁCH SIDEBAR KHI MỞ TRANG ---
  useEffect(() => {
    let isMounted = true; // Cờ theo dõi trạng thái Component

    const loadSessionsOnMount = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/query/sessions');
        // React sẽ hiểu đây là state update bất đồng bộ (sau khi await) -> Sẽ không báo lỗi
        if (res.data.success && isMounted) {
          setSessions(res.data.sessions);
        }
      } catch (err) {
        console.error("Không tải được danh sách chat", err);
      }
    };

    loadSessionsOnMount();

    // Hàm cleanup (Dọn dẹp khi tắt trang để chống rò rỉ bộ nhớ)
    return () => {
      isMounted = false;
    };
  }, []);

  // --- 2. TẢI LỊCH SỬ CHAT KHI CLICK VÀO SIDEBAR ---
  const loadChatHistory = async (id: string) => {
    setSessionId(id);
    setMessages([]); // Xóa màn hình tạm thời lúc đợi data
    setLoading(true);
    
    try {
      const res = await axios.get(`http://localhost:3000/api/query/history/${id}`);
      if (res.data.success && res.data.history) {
        // Map dữ liệu từ Database lên giao diện
          const loadedMessages: ChatMessage[] = res.data.history.map((msg: Omit<ChatMessage, 'id'>, index: number) => ({
          id: `history-${index}`,
          role: msg.role,
          content: msg.content,
          chart_type: msg.chart_type,          // Lấy loại biểu đồ (bar, line, pie)
          data: msg.data,                      // Lấy CÁC CON SỐ để vẽ biểu đồ
          explanation: msg.content,
          
          error: msg.error,
          error_type: msg.error_type
        }));
        setMessages(loadedMessages);
      }
    } catch (err) {
      console.error("Lỗi tải lịch sử chat", err);
    } finally {
      setLoading(false);
    }
  };


  // --- 3. TẠO ĐOẠN CHAT MỚI ---
  const handleNewChat = () => {
    setSessionId(null); // Trả ID về null để lần gửi tới sẽ tự sinh ID mới
    setMessages([]); 
    if (window.innerWidth < 768) setIsSidebarOpen(false); // Đóng sidebar trên mobile
  };

  // --- 4. HÀM XỬ LÝ GỬI TIN NHẮN ---
  const handleQuery = async () => {
    if (!inputValue.trim()) return;
    
    // Nếu là đoạn chat mới toanh, tự sinh ID. Nếu đang ở đoạn chat cũ, dùng ID cũ.
    const currentSessionId = sessionId || crypto.randomUUID();
    if (!sessionId) setSessionId(currentSessionId);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };
    
    const historyToGửi = [...messages, userMsg];
    setMessages(historyToGửi);
    setInputValue('');
    setLoading(true);
    
    try {
      const res = await axios.post('http://localhost:3000/api/query', {
        sessionId: currentSessionId,
        question: userMsg.content,
        history: messages.map(msg => ({ role: msg.role, content: msg.content })) 
      });
      
      const responseData = res.data;
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseData.explanation || 'Đã truy xuất xong', 
        data: responseData.data,
        chart_type: responseData.chart_type,
        explanation: responseData.explanation,
        error: responseData.error,
        error_type: responseData.error_type
      };
      setMessages(prev => [...prev, assistantMsg]);


if (messages.length === 0) {
        setSessions(prev => [
          { session_id: currentSessionId, title: userMsg.content },
          ...prev
        ]);
      }

    } catch (error) { 
      console.error('Lỗi truy vấn:', error);
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
  // --- HÀM XÓA LỊCH SỬ CHAT ---
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Ngăn sự kiện click nhảy sang hàm loadChatHistory
    const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa đoạn chat này không?");
    if (!confirmDelete) return;

    try {
      const res = await axios.delete(`http://localhost:3000/api/query/history/${id}`);
      if (res.data.success) {
        // Xóa ngay lập tức khỏi Sidebar mà không cần load lại API
        setSessions(prev => prev.filter(s => s.session_id !== id));
        
        // NẾU người dùng đang mở đúng cái đoạn chat vừa bị xóa -> Reset về màn hình trắng
        if (sessionId === id) {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error("Lỗi khi xóa chat:", err);
      alert("Không thể xóa đoạn chat. Vui lòng thử lại!");
    }
  };

  // --- HÀM RENDER BIỂU ĐỒ ---
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
        <div className="w-full mt-4">
          {/* TRICK 1: Dùng width="99%" thay vì 100%, và gán thẳng height={300} vào đây */}
          <ResponsiveContainer width="99%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px' }} />
              {/* TRICK 2: Thêm isAnimationActive={false} để không bị lỗi khi render nhiều hình cùng lúc */}
              <Bar dataKey={yAxisKey} fill="#8B5CF6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'line') {
      return (
        <div className="w-full mt-4">
          <ResponsiveContainer width="99%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Line type="monotone" dataKey={yAxisKey} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'pie') {
      return (
        <div className="w-full mt-4">
          <ResponsiveContainer width="99%" height={300}>
            <PieChart>
              <Pie
                data={chartData} cx="50%" cy="50%" labelLine={true} outerRadius={90}
                dataKey={yAxisKey} nameKey={xAxisKey}
                label={({ name, percent }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                isAnimationActive={false}
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
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      
      {/* ===================== SIDEBAR (Cột trái) ===================== */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-gray-900 text-white transition-all duration-300 flex flex-col shrink-0 overflow-hidden`}>
        {/* Nút Tạo Chat Mới */}
        <div className="p-3">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors text-sm font-medium text-gray-200"
          >
            <Plus size={18} /> Đoạn chat mới
          </button>
        </div>

        {/* Danh sách Lịch sử */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-gray-500 font-semibold mb-2 px-2 uppercase tracking-wider">Gần đây</p>
          
          {sessions.length === 0 && (
            <p className="text-sm text-gray-500 px-2 italic">Chưa có dữ liệu</p>
          )}

{sessions.map((session) => (
            <div 
              key={session.session_id}
              className={`group relative w-full flex items-center justify-between rounded-lg transition-colors cursor-pointer ${
                sessionId === session.session_id ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
              onClick={() => loadChatHistory(session.session_id)}
            >
              {/* Nút hiển thị tiêu đề */}
              <div className="flex-1 flex items-center gap-3 p-3 truncate">
                <MessageSquare size={16} className="shrink-0" />
                <span className="truncate">{session.title}</span>
              </div>

              {/* Nút Xóa (Mặc định ẩn, rê chuột vào mới hiện) */}
              <button
                onClick={(e) => handleDeleteSession(e, session.session_id)}
                className="opacity-0 group-hover:opacity-100 p-2 mr-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-md transition-all"
                title="Xóa đoạn chat"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ===================== KHU VỰC CHAT CHÍNH (Cột phải) ===================== */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Header (Có nút bấm mở/đóng Sidebar) */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center gap-3 shadow-sm z-10">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Database size={20} className="text-purple-600" />
            <h1 className="font-bold text-lg text-gray-800">Enterprise Assistant</h1>
          </div>
        </header>

        {/* Danh sách tin nhắn Chat */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50">
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <Bot size={48} className="text-purple-300" />
              <p className="text-center text-sm">Xin chào! Tôi là Trợ lý Dữ liệu Doanh nghiệp.<br/>Hãy đặt câu hỏi để tôi phân tích số liệu cho bạn nhé.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Tin nhắn USER */}
              {msg.role === 'user' && (
                <div className="flex gap-2 max-w-[85%] md:max-w-[70%]">
                  <div className="bg-purple-100 text-purple-900 px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm">
                    {msg.content}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
                    <User size={16} className="text-purple-700" />
                  </div>
                </div>
              )}

              {/* Tin nhắn ASSISTANT */}
              {msg.role === 'assistant' && (
                <div className="flex gap-3 w-full max-w-4xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={18} className="text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {msg.error ? (
                      <div className="animate-fade-in w-full">
                        {msg.error_type === 'SAFETY_VIOLATION' ? (
                          <div className="bg-red-50 text-red-800 p-5 rounded-xl border border-red-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 border-b border-red-200 pb-2">
                              <ShieldAlert className="text-red-600" size={24} />
                              <h2 className="font-bold text-lg">Hành động bị từ chối</h2>
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
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-fade-in w-full overflow-hidden">
                        {msg.explanation && (
                          <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                            <h3 className="text-blue-800 font-semibold text-sm mb-1">AI Nhận xét:</h3>
                            <p className="text-blue-900 text-sm whitespace-pre-wrap">{msg.explanation}</p>
                          </div>
                        )}

                        {msg.data && msg.data.length > 0 && (
                          <div className="overflow-x-auto rounded-lg border border-gray-100">
                            <table className="w-full text-left text-sm text-gray-600">
                              <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                                <tr>
                                  {Object.keys(msg.data[0]).map((key) => (
                                    <th key={key} className="px-4 py-3 border-b whitespace-nowrap">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.data.map((row, idx) => (
                                  <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                    {Object.values(row).map((val: unknown, colIdx) => (
                                      <td key={colIdx} className="px-4 py-2 truncate max-w-xs" title={String(val)}>{String(val)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

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

          {loading && (
            <div className="flex gap-3 w-full max-w-4xl">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Bot size={18} className="text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-xl flex items-center gap-2 text-gray-500 text-sm shadow-sm animate-pulse">
                <Loader2 size={16} className="animate-spin text-purple-600" /> Hệ thống đang xử lý...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Khung Input (Giữ nguyên) */}
        <div className="p-4 bg-white border-t z-10">
          <div className="relative flex items-center max-w-4xl mx-auto rounded-full bg-gray-50 border border-gray-300 focus-within:ring-2 ring-purple-400 focus-within:bg-white transition-all overflow-hidden p-1">
            <input
              type="text"
              className="w-full pl-4 pr-12 py-2.5 bg-transparent text-sm outline-none text-gray-800"
              placeholder="Nhập câu hỏi bằng ngôn ngữ tự nhiên..."
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
    </div>
  );
}