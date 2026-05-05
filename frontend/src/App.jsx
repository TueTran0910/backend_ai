import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import axios from 'axios';

function App() {

  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [nutrition, setNutrition] = useState(null);

  // =========================
  // USER PROFILE
  // =========================
  const [userProfile, setUserProfile] = useState({
    age: '20',
    weight: '60',
    height: '170',
    gender: 'Nam'
  });

  // =========================
  // HANDLE INPUT
  // =========================
  const handleInputChange = (e) => {
    setUserProfile({
      ...userProfile,
      [e.target.name]: e.target.value
    });
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

    if (!imageFile) {
      alert("Chọn ảnh trước");
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
        'http://localhost:5000/api/analyze',
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
      setNutrition({
        ...response.data,
        isOffline: false
      });

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

        setLoading(false);

      }).catch((ocrError) => {

        console.error(ocrError);

        alert("Lỗi OCR Offline");

        setLoading(false);
      });
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-slate-100 p-4 flex flex-col items-center font-sans pb-10">

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-6 border border-white">

        {/* HEADER */}
        <header className="text-center mb-6">
          <h1 className="text-3xl font-black italic text-slate-900 leading-none">
            NUTRITION <span className="text-green-500">AI</span>
          </h1>

          <p className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase mt-1">
            Personal Dietitian v4.0
          </p>
        </header>

        {/* PROFILE */}
        <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">

          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-3 tracking-widest">
            Thông số thể trạng
          </h3>

          <div className="grid grid-cols-2 gap-3">

            <input
              type="number"
              name="age"
              value={userProfile.age}
              onChange={handleInputChange}
              placeholder="Tuổi"
              className="p-2 text-sm font-bold border rounded-xl"
            />

            <select
              name="gender"
              value={userProfile.gender}
              onChange={handleInputChange}
              className="p-2 text-sm font-bold border rounded-xl"
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>

            <input
              type="number"
              name="weight"
              value={userProfile.weight}
              onChange={handleInputChange}
              placeholder="Cân nặng"
              className="p-2 text-sm font-bold border rounded-xl"
            />

            <input
              type="number"
              name="height"
              value={userProfile.height}
              onChange={handleInputChange}
              placeholder="Chiều cao"
              className="p-2 text-sm font-bold border rounded-xl"
            />

          </div>
        </div>

        {/* IMAGE */}
        <div className="mb-6 relative aspect-video bg-slate-50 rounded-[2rem] border-4 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">

          <input
            type="file"
            accept="image/*"
            className="absolute inset-0 opacity-0 z-10 cursor-pointer"

            onChange={(e) => {

              const file = e.target.files[0];

              if (!file) return;

              setImage(
                URL.createObjectURL(file)
              );

              setImageFile(file);
            }}
          />

          {
            image
              ? (
                <img
                  src={image}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              )
              : (
                <div className="text-center">
                  <span className="text-4xl">📸</span>

                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">
                    Chụp nhãn sản phẩm
                  </p>
                </div>
              )
          }

        </div>

        {/* BUTTON */}
        <button
          onClick={handleScan}
          disabled={loading}
          className={`w-full py-5 rounded-2xl font-black text-white uppercase tracking-widest shadow-lg transition-transform active:scale-95 ${
            loading
              ? 'bg-slate-400'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {
            loading
              ? "ĐANG PHÂN TÍCH..."
              : "QUÉT & PHÂN TÍCH"
          }
        </button>

        {/* OCR PROGRESS */}
        {
          loading && progress > 0 && (
            <div className="mt-4">

              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full"
                  style={{
                    width: `${progress}%`
                  }}
                />
              </div>

              <p className="text-[10px] text-center mt-2">
                OCR: {progress}%
              </p>

            </div>
          )
        }

        {/* RESULT */}
        {
          nutrition && (

            <div className="mt-8 space-y-4">

              {/* MODE */}
              <div className={`text-center py-2 rounded-full text-[10px] font-black uppercase ${
                nutrition.isOffline
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {
                  nutrition.isOffline
                    ? 'OFFLINE MODE'
                    : 'AI MODE'
                }
              </div>

              {/* PRODUCT */}
              <div className="bg-slate-900 text-white p-5 rounded-[2rem]">

                <p className="text-[10px] opacity-50 uppercase">
                  Sản phẩm
                </p>

                <h2 className="text-xl font-black mt-1">
                  {nutrition.product_name}
                </h2>

              </div>

              {/* STATS */}
              <div className="grid grid-cols-3 gap-2">

                {
                  Object.entries(
                    nutrition.stats || {}
                  ).map(([key, value]) => (

                    <div
                      key={key}
                      className="bg-white p-3 rounded-2xl border"
                    >
                      <p className="text-[9px] uppercase text-slate-400 font-bold">
                        {key}
                      </p>

                      <p className="text-sm font-black mt-1">
                        {value}
                      </p>
                    </div>
                  ))
                }

              </div>

              {/* ADVICE */}
              <div className="bg-blue-50 border border-blue-100 p-5 rounded-[2rem]">

                <h3 className="font-black text-blue-700 mb-3">
                  🧑‍⚕️ Tư vấn
                </h3>

                <ul className="space-y-2">

                  {
                    nutrition.short_advice?.map((item, index) => (
                      <li key={index}>
                        • {item}
                      </li>
                    ))
                  }

                </ul>

              </div>

              {/* ALTERNATIVES */}
              <div className="bg-orange-50 border border-orange-100 p-5 rounded-[2rem]">

                <h3 className="font-black text-orange-700 mb-3">
                  💡 Gợi ý thay thế
                </h3>

                <ul className="space-y-2">

                  {
                    nutrition.alternatives?.map((item, index) => (
                      <li key={index}>
                        » {item}
                      </li>
                    ))
                  }

                </ul>

              </div>

            </div>
          )
        }

      </div>

      <footer className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Trần Thiên Tuệ - STU
      </footer>

    </div>
  );
}

export default App;