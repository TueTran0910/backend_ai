import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import axios from 'axios';

function App() {

  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [nutrition, setNutrition] = useState(null);
  const [history, setHistory] = useState(JSON.parse(localStorage.getItem('scanHistory') || '[]'));
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // =========================
  // USER PROFILE
  // =========================
  const [userProfile, setUserProfile] = useState({
    age: '20',
    weight: '60',
    height: '170',
    gender: 'Nam'
  });
  const [errors, setErrors] = useState({ age: '', weight: '', height: '' });

  //const api = "https://backend-ai-rbej.onrender.com"
  const api = "http://127.0.0.1:5000";

  // =========================
  // HANDLE INPUT
  // =========================
  const handleInputChange = (e) => {
    let { name, value } = e.target;

    // Chỉ áp dụng bộ lọc cho các trường cần nhập số dương
    if (['age', 'weight', 'height'].includes(name)) {
      // 1. Dùng Regex \D để xóa sạch mọi ký tự không phải số (chữ, dấu -, ., e...)
      value = value.replace(/\D/g, '');

      // 2. Chặn việc nhập số 0 ở vị trí đầu tiên
      if (value.startsWith('0')) value = value.substring(1);
    }

    setUserProfile({
      ...userProfile,
      [name]: value
    });
  };

  // Hàm lưu kết quả vào lịch sử
  const saveToHistory = (newResult) => {
    const newEntry = {
      ...newResult,
      // Tạo ID duy nhất bằng thời gian thực cộng với số ngẫu nhiên
      id: Date.now() + Math.random(), 
      timestamp: new Date().toLocaleString()
    };

    const updatedHistory = [newEntry, ...history].slice(0, 10);
    
    setHistory(updatedHistory);
    localStorage.setItem('scanHistory', JSON.stringify(updatedHistory));
  };

  const blockInvalidChar = (e) => {
    // Chặn các phím gây ra số âm, số thập phân hoặc số mũ
    if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
      e.preventDefault();
    }
  };

  // =========================
  // OFFLINE PARSER
  // =========================
  const parseLocalData = (rawText) => {

    const cleanText = rawText.toLowerCase().replace(/,/g, '.');

    const findValue = (keywords, unit = "g") => {

      for (let kw of keywords) {

        const index = cleanText.indexOf(kw);

        if (index !== -1) {

          const chunk = cleanText.substring(index, index + 40);

          const match = chunk.match(/([\d.,]+)/);

          if (match) {
            return match[1] + unit;
          }
        }
      }

      return "N/A";
    };

    return {
      product_name: "Nhận diện nội bộ (Offline)",

      stats: {
        calories: findValue(
          ['kcal', 'calo', 'energy', 'năng lượng'],
          ' kcal'
        ),

        sugar: findValue(
          ['sugar', 'đường'],
          'g'
        ),

        protein: findValue(
          ['protein', 'đạm'],
          'g'
        ),

        fat: findValue(
          ['fat', 'béo'],
          'g'
        ),

        calcium: findValue(
          ['calcium', 'canxi'],
          'mg'
        ),

        carb: findValue(
          ['carb', 'carbon', 'hydrat'],
          'g'
        )
      },

      health_score: "?",

      short_advice: [
        "Không kết nối được AI Gemini",
        "Đang sử dụng chế độ OCR Offline"
      ],

      alternatives: [
        "Trái cây tươi",
        "Sữa chua không đường"
      ],

      isOffline: true
    };
  };

  // =========================
  // BASE64
  // =========================
  const getBase64 = (file) => {

    return new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.readAsDataURL(file);

      reader.onload = () => resolve(reader.result);

      reader.onerror = error => reject(error);
    });
  };

  // =========================
  // SCAN
  // =========================
  const handleScan = async () => {

    let newErrors = { age: '', weight: '', height: '' };
    let isValid = true;

    if (!userProfile.age || userProfile.age <= 0) {
      newErrors.age = "Nhập tuổi hợp lệ hoặc không được để trống!";
      isValid = false;
    }
    if (!userProfile.weight || userProfile.weight <= 0) {
      newErrors.weight = "Nhập cân nặng hợp lệ hoặc không được để trống!";
      isValid = false;
    }
    if (!userProfile.height || userProfile.height <= 0) {
      newErrors.height = "Nhập chiều cao hợp lệ hoặc không được để trống!";
      isValid = false;
    }

    setErrors(newErrors);

    if (!isValid) return;

    if (!imageFile) {
      alert("Xin vui lòng chọn hình ảnh để kiểm tra!");
      return;
    }

    setLoading(true);
    setNutrition(null);
    setProgress(0);

    try {

      // convert ảnh
      const base64String = await getBase64(imageFile);

      // call Flask
      const response = await axios.post(
        `${api}/api/analyze`,
        {
          imageBase64: base64String,
          userProfile: userProfile
        },
        {
          timeout: 60000
        }
      );

      // DEBUG
      console.log("DATA:", response.data);

      // success
      const nutritionData = {
        ...response.data,
        isOffline: false
      };

      // 3. Cập nhật giao diện và lưu vào lịch sử
      setNutrition(nutritionData);
      saveToHistory(nutritionData);

      setLoading(false);

    } catch (err) {

      console.error("BACKEND ERROR:", err);

      // show backend error
      if (err.response?.data?.error) {
        console.log(err.response.data.error);
      }

      console.warn("AI lỗi => chuyển sang OCR offline");

      // =========================
      // OCR OFFLINE
      // =========================
      Tesseract.recognize(
        image,
        'eng+vie',
        {
          logger: m => {

            if (m.status === 'recognizing text') {

              setProgress(
                parseInt(m.progress * 100)
              );
            }
          }
        }

      ).then(({ data: { text } }) => {

        console.log(text);

        const offlineData = parseLocalData(text);

        setNutrition(offlineData);

        saveToHistory(offlineData);

        setLoading(false);

      }).catch((ocrError) => {

        console.error(ocrError);

        alert("Lỗi OCR Offline");

        setLoading(false);
      });
    }
  };

  // Hàm xóa đơn lẻ từng mục
  const deleteHistoryItem = (id, e) => {
    // Ngăn sự kiện click lan ra ngoài để không bị mở Popup chi tiết
    if (e) e.stopPropagation();

    if (window.confirm("Bạn có chắc muốn XÓA mục này khỏi nhật ký?")) {
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('scanHistory', JSON.stringify(updatedHistory));
    }
  };

  // Hàm xóa toàn bộ lịch sử
  const clearAllHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn XÓA toàn bộ lịch sử quét?")) {
      setHistory([]);
      localStorage.removeItem('scanHistory');
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col items-center font-sans pb-10">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-6 border border-white">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-black italic text-slate-900 leading-none">NUTRITION <span className="text-green-500">AI</span></h1>
          <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase mt-1">Personal Dietitian v4.0</p>
        </header>

        {/* Bảng nhập thông số thể trạng */}
        <div className="bg-slate-50 p-5 rounded-[2rem] mb-6 border border-slate-100 shadow-inner">
          <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em] ml-1">
            Thông số thể trạng
          </h3>
          
          {/* Grid chính luôn cố định 2 cột */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            
            {/* KHỐI TUỔI */}
            <div className="flex flex-col relative">
              <input 
                type="number" name="age" min="1" 
                onKeyDown={blockInvalidChar} 
                value={userProfile.age} 
                onChange={handleInputChange} 
                placeholder="Tuổi" 
                className={`p-3 text-sm font-bold border rounded-2xl text-center outline-none transition-all ${errors.age ? 'border-red-400 bg-red-50/50' : 'focus:border-green-400 border-slate-200'}`} 
              />
              <span className="absolute right-10 top-3.5 text-[10px] text-slate-500 font-black uppercase">Tuổi</span>
              {errors.age && (
                <span className="text-[7px] text-red-500 font-black mt-1.5 ml-2 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
                  ⚠️ {errors.age}
                </span>
              )}
            </div>

            {/* KHỐI GIỚI TÍNH */}
            <div className="flex flex-col">
              <select 
                name="gender" 
                value={userProfile.gender} 
                onChange={handleInputChange} 
                className="p-3 text-sm font-bold border border-slate-200 rounded-2xl text-center outline-none focus:border-green-400 bg-white appearance-none cursor-pointer"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>

            {/* KHỐI CÂN NẶNG */}
            <div className="flex flex-col relative">
              <div className="relative">
                <input 
                  type="number" name="weight" min="1" 
                  onKeyDown={blockInvalidChar} 
                  value={userProfile.weight} 
                  onChange={handleInputChange} 
                  placeholder="Nặng" 
                  className={`w-full p-3 text-sm font-bold border rounded-2xl text-center outline-none transition-all ${errors.weight ? 'border-red-400 bg-red-50/50' : 'focus:border-green-400 border-slate-200'}`} 
                />
                <span className="absolute right-10 top-3.5 text-[10px] text-slate-500 font-black uppercase">kg</span>
              </div>
              {errors.weight && (
                <span className="text-[7px] text-red-500 font-black mt-1.5 ml-2 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
                  ⚠️ {errors.weight}
                </span>
              )}
            </div>

            {/* KHỐI CHIỀU CAO */}
            <div className="flex flex-col relative">
              <div className="relative">
                <input 
                  type="number" name="height" min="1" 
                  onKeyDown={blockInvalidChar} 
                  value={userProfile.height} 
                  onChange={handleInputChange} 
                  placeholder="Cao" 
                  className={`w-full p-3 text-sm font-bold border rounded-2xl text-center outline-none transition-all ${errors.height ? 'border-red-400 bg-red-50/50' : 'focus:border-green-400 border-slate-200'}`} 
                />
                <span className="absolute right-10 top-3.5 text-[10px] text-slate-500 font-black uppercase">cm</span>
              </div>
              {errors.height && (
                <span className="text-[7px] text-red-500 font-black mt-1.5 ml-2 uppercase tracking-tighter animate-in fade-in slide-in-from-top-1">
                  ⚠️ {errors.height}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Khu vực ảnh */}
        <div className="mb-6 relative aspect-video bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden group">
          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 z-10 cursor-pointer" onChange={(e) => {
            setImage(URL.createObjectURL(e.target.files[0]));
            setImageFile(e.target.files[0]); 
          }} />
          {image ? <img src={image} className="w-full h-full object-cover" alt="preview" /> : 
            <div className="text-center">
              <span className="text-4xl mb-2 block">📸</span>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Chụp nhãn dán đồ ăn / nước uống</p>
            </div>
          }
        </div>

        {/* Nút bấm & Thanh tiến trình */}
        <div className="space-y-3">
          <button onClick={handleScan} disabled={loading} className={`w-full py-5 rounded-2xl font-black text-white uppercase tracking-widest shadow-lg transition-transform active:scale-95 ${loading ? 'bg-slate-400' : 'bg-green-600 hover:bg-green-700'}`}>
            {loading ? "BÁC SĨ AI ĐANG PHÂN TÍCH..." : "QUÉT & NHẬN TƯ VẤN"}
          </button>
          
          {loading && progress > 0 && (
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              <p className="text-[8px] text-center font-bold text-slate-400 mt-1">TIẾN ĐỘ TESSERACT: {progress}%</p>
            </div>
          )}
        </div>

        {/* Kết quả Dashboard */}
        {nutrition && (
          <div className="mt-8 space-y-4 animate-in fade-in zoom-in duration-500">
            <div className={`text-center py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${nutrition.isOffline ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
              {nutrition.isOffline ? '● CHẾ ĐỘ NỘI BỘ (OFFLINE)' : '● TRỢ LÝ DINH DƯỠNG CÁ NHÂN HÓA'}
            </div>

            <div className="bg-slate-900 p-5 rounded-[2rem] text-white flex justify-between items-start gap-3">
              <div className="flex-1 max-w-[75%]">
                <p className="text-[10x] opacity-40 font-bold uppercase mb-1 tracking-tighter">Sản phẩm nhận diện</p>
                <h2 className="text-lg font-black leading-tight uppercase whitespace-normal break-words">{nutrition.product_name}</h2>
              </div>
              <div className="text-center border-l border-white/10 pl-4 flex-shrink-0">
                <div className="text-2xl font-black text-green-400 leading-none">{nutrition.health_score}</div>
                <div className="text-[8px] opacity-40 font-bold uppercase mt-1">Score</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Object.entries(nutrition.stats).map(([key, val]) => (
                <div key={key} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                  <p className="text-[10px] font-black text-slate-400 whitespace-normal break-words mb-1">{key}</p>
                  <p className="text-[12px] font-black text-slate-800 whitespace-normal break-words w-full text-center leading-none">{val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-green-100 shadow-sm mt-4">
              <h3 className="text-[10px] font-black text-green-600 uppercase mb-3 border-b border-green-100 pb-1 flex items-center">
                <span className="mr-1">🏃</span> Vận động để tiêu thụ:
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: "🚶", label: "Đi bộ", val: nutrition.exercise_conversion?.walking },
                  { icon: "🏃", label: "Chạy bộ", val: nutrition.exercise_conversion?.running },
                  { icon: "🚴", label: "Đạp xe", val: nutrition.exercise_conversion?.cycling }
                ].map((ex, i) => (
                  <div key={i} className="text-center bg-slate-50 p-2 rounded-xl">
                    <div className="text-lg">{ex.icon}</div>
                    <p className="text-[10px] font-black text-black">{ex.val || 'N/A'}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">{ex.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Khối Tư Vấn Cá Nhân */}
            <div className="bg-white p-5 rounded-[2rem] border border-blue-100 shadow-sm bg-blue-50/40">
              <h3 className="text-[10px] font-black text-blue-600 uppercase mb-3 border-b border-blue-100 pb-1 flex items-center">
                <span className="mr-1">🧑‍⚕️</span> Đánh giá theo thể trạng:
              </h3>
              <ul className="space-y-2">
                {nutrition.short_advice.map((adv, i) => (
                  <li key={i} className="text-[12px] font-medium text-slate-700 leading-tight">
                    • {adv}
                  </li>
                ))}
              </ul>
            </div>

            {/* Khối Thực Phẩm Thay Thế */}
            <div className="bg-white p-5 rounded-[2rem] border border-orange-100 shadow-sm bg-orange-50/40">
              <h3 className="text-[10px] font-black text-orange-600 uppercase mb-3 border-b border-orange-100 pb-1 flex items-center">
                <span className="mr-1">💡</span> Gợi ý món thay thế:
              </h3>
              <ul className="space-y-2">
                {nutrition.alternatives?.map((alt, i) => (
                  <li key={i} className="text-[12px] font-medium text-slate-700 leading-tight flex items-start">
                    <span className="text-orange-500 mr-2">»</span> {alt}
                  </li>
                ))}
              </ul>
            </div>
            
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-20 w-full max-w-md px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white/40 backdrop-blur-sm rounded-[2.5rem] p-6 border border-slate-200/50 shadow-sm">
            <h3 className="text-[12px] font-black text-green-600 uppercase tracking-[0.4em] mb-6 text-center">
              Nhật ký quét gần đây
            </h3>
            
            <div className="space-y-3">
              {history.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedHistoryItem(item)}
                  className="group bg-white p-5 rounded-[2rem] flex justify-between items-center border border-slate-50 transition-all hover:border-slate-200 shadow-sm cursor-pointer active:scale-95 relative"
                >
                  {/* Nội dung bên trái */}
                  <div className="flex-1 min-w-0 pr-10">
                    <p className="text-[11px] font-black text-black uppercase leading-tight break-words">
                      {item.product_name}
                    </p>
                    <p className="text-[8px] font-bold text-black/30 uppercase mt-1.5 tracking-wider">
                      {item.timestamp}
                    </p>
                  </div>
                  
                  {/* Cụm bên phải: Score và Nút xóa đơn lẻ */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-[14px] font-black text-green-600 leading-none">
                        {item.health_score}
                      </div>
                      <div className="text-[7px] font-bold text-black/20 uppercase mt-1 tracking-tighter text-center">
                        Score
                      </div>
                    </div>

                    {/* Nút xóa từng cái */}
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="p-2 -mr-2 text-black/10 hover:text-red-500 transition-colors"
                      title="Xóa mục này"
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Nút xóa toàn bộ */}
            <button 
              onClick={clearAllHistory}
              className="w-full mt-10 py-2 text-[9px] font-black text-black/20 uppercase tracking-[0.3em] hover:text-red-500 transition-colors"
            >
              — Xóa toàn bộ lịch sử! —
            </button>
          </div>     
        </div>
      )}

      {/* POPUP CHI TIẾT LỊCH SỬ */}
      {selectedHistoryItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelectedHistoryItem(null)} // Nhấn ra ngoài để đóng
        >
          {/* Khối chứa nội dung - Thêm max-h và overflow-y-auto để cuộn được */}
          <div 
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative my-auto animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Ngăn việc đóng khi nhấn vào bên trong popup
          >
            
            {/* Nút đóng cố định ở góc */}
            <button 
              onClick={() => setSelectedHistoryItem(null)}
              className="absolute top-6 right-6 text-black/20 hover:text-black transition-colors z-10"
            >
              <span className="text-2xl">✕</span>
            </button>

            <header className="text-center mb-8">
              <p className="text-[10px] font-black text-black/40 uppercase tracking-[0.4em] mb-2">Chi tiết nhật ký</p>
              <h2 className="text-xl font-black text-black uppercase leading-tight break-words">
                {selectedHistoryItem.product_name}
              </h2>
              <p className="text-[10px] font-bold text-black/20 mt-2">{selectedHistoryItem.timestamp}</p>
            </header>

            {/* Grid thông số - Giống Dashboard chính */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {Object.entries(selectedHistoryItem.stats).map(([key, val]) => (
                <div key={key} className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                  <p className="text-[8px] font-black text-black/30 uppercase mb-1">{key}</p>
                  <p className="text-[10px] font-black text-black leading-tight break-words">{val}</p>
                </div>
              ))}
            </div>

            {/* Phần Tư vấn chi tiết (như trong ảnh bạn gửi) */}
            <div className="space-y-6">
              <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                <h3 className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest border-b border-blue-100 pb-2">
                  🧑‍⚕️ Tư vấn sức khỏe
                </h3>
                <ul className="space-y-3">
                  {selectedHistoryItem.short_advice.map((adv, i) => (
                    <li key={i} className="text-[12px] font-medium text-slate-700 leading-relaxed">
                      • {adv}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gợi ý thay thế */}
              <div className="p-6 bg-orange-50/50 rounded-[2rem] border border-orange-100">
                <h3 className="text-[10px] font-black text-orange-600 uppercase mb-4 tracking-widest border-b border-orange-100 pb-2">
                  💡 Giải pháp thay thế
                </h3>
                <ul className="space-y-2">
                  {selectedHistoryItem.alternatives?.map((alt, i) => (
                    <li key={i} className="text-[12px] font-medium text-slate-700 leading-tight flex items-start">
                      <span className="text-orange-500 mr-2">»</span> {alt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button 
              onClick={() => setSelectedHistoryItem(null)}
              className="w-full mt-10 py-5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-transform"
            >
              Quay lại nhật ký
            </button>
          </div>
        </div>
      )}

      <footer className="mt-10 pb-12 w-full text-center border-t border-slate-100/80 pt-10">
        <div className="flex flex-col items-center space-y-1.5">
          
          <div className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
            Trần Thiên Tuệ • DH52201727 • D22_TH10
          </div>
          
          <div className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
            Lê Hoàng Minh Trí • DH52201618 • D22_TH10
          </div>

          <div className="pt-4 text-[12px] font-bold text-black uppercase tracking-[0.4em]">
            Trường Đại Học Công Nghệ Sài Gòn - AI cơ bản và ứng dụng
          </div>
          
        </div>
      </footer>
    </div>
  );
}

export default App;