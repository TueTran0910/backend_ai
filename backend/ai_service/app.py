import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re
import traceback
import base64
import os # Thêm thư viện hệ thống
from dotenv import load_dotenv # Thêm thư viện nạp biến môi trường

# 1. Nạp các biến từ file .env vào hệ thống
load_dotenv()

app = Flask(__name__)
CORS(app)

# 2. Lấy API Key từ file .env thay vì viết trực tiếp
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

model = genai.GenerativeModel('gemini-2.5-flash') 

@app.route('/process', methods=['POST'])
def process_text():
    try:
        data = request.json
        image_b64 = data.get('image', '')
        user_profile = data.get('userProfile', {}) # Lấy thông tin thể trạng
        
        if not image_b64:
            return jsonify({"error": "Không nhận được ảnh"}), 400

        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]
            
        image_bytes = base64.b64decode(image_b64)
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_bytes
        }
        
        # Đóng gói thông tin cá nhân
        profile_text = f"Giới tính: {user_profile.get('gender', 'Nam')}, Tuổi: {user_profile.get('age', 20)}, Cân nặng: {user_profile.get('weight', 60)}kg, Chiều cao: {user_profile.get('height', 170)}cm."
        
        # Prompt ép AI phải đọc chỉ số thực phẩm trước khi tư vấn
        prompt = f"""
        Bạn là Chuyên gia Dinh dưỡng AI. Hãy nhìn bức ảnh nhãn dán thực phẩm này và đối chiếu với thể trạng người dùng sau:
        THỂ TRẠNG NGƯỜI DÙNG: {profile_text}
        
        LUẬT PHÂN TÍCH (BẮT BUỘC TUÂN THỦ THEO THỨ TỰ):
        1. PHÂN TÍCH THỰC PHẨM TRƯỚC: Bắt buộc trích xuất (hoặc tự ước tính) các chỉ số calo, đường, đạm, béo... của CHÍNH SẢN PHẨM TRONG ẢNH (trên 100g). Khối "stats" tuyệt đối chỉ chứa thông tin của món ăn, không được nhầm lẫn với nhu cầu calo của người dùng.
        2. ĐỐI CHIẾU & TƯ VẤN: Dựa vào các chỉ số thực phẩm vừa tìm được, so sánh với chiều cao, cân nặng, giới tính của người dùng để đánh giá. (Ví dụ: cân nặng này kết hợp với việc học tập hoặc đi làm thêm di chuyển nhiều thì bù đắp calo thế nào cho hợp lý).
        3. ĐỀ XUẤT THAY THẾ: Gợi ý 2 món lành mạnh hơn nếu sản phẩm này không tốt.
        4. Dịch sang tiếng Việt.

        Trả về DUY NHẤT mã JSON chuẩn:
        {{
            "product_name": "Tên sản phẩm",
            "stats": {{"calories": "...", "sugar": "...", "protein": "...", "calcium": "...", "fat": "...", "carb": "..."}},
            "health_score": "1-10",
            "short_advice": ["Lời khuyên 1 (đối chiếu thể trạng)", "Lời khuyên 2"],
            "alternatives": ["Món thay thế 1", "Món thay thế 2"]
        }}
        """
        
        response = model.generate_content([prompt, image_part])
        
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            return jsonify(json.loads(json_match.group()))
        else:
            return jsonify({"error": "AI trả về dữ liệu sai cấu trúc"}), 500
            
    except Exception as e:
        print("\n--- PHÁT HIỆN LỖI TẠI PYTHON ---")
        error_msg = str(e)
        print(traceback.format_exc())
        
        if "429" in error_msg or "ResourceExhausted" in error_msg:
            return jsonify({"error": "Bạn đã hết 20 lượt quét miễn phí hôm nay!"}), 429
            
        return jsonify({"error": error_msg}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)