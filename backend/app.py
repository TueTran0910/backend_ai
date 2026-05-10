from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv

import base64
import traceback
import json
import re
import os

# =========================
# LOAD ENV
# =========================
load_dotenv()

# =========================
# FLASK APP
# =========================
app = Flask(__name__)
CORS(app)

# =========================
# GEMINI CONFIG
# =========================
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("Không tìm thấy GEMINI_API_KEY trong file .env")

# Tạo client mới
client = genai.Client(api_key=api_key)

# =========================
# API ANALYZE
# =========================
@app.route('/api/analyze', methods=['POST'])
def analyze_food():
    try:
        data = request.json

        image_b64 = data.get('imageBase64', '')
        user_profile = data.get('userProfile', {})

        if not image_b64:
            return jsonify({
                "error": "Không nhận được ảnh"
            }), 400

        profile_text = (
            f"Tuổi: {user_profile.get('age')}, "
            f"Giới tính: {user_profile.get('gender')}, "
            f"Cân nặng: {user_profile.get('weight')}kg, "
            f"Chiều cao: {user_profile.get('height')}cm"
        )

        # Xóa phần base64 header
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]

        # Decode ảnh
        image_bytes = base64.b64decode(image_b64)

        prompt = f"""
        Bạn là Chuyên gia Dinh dưỡng AI. Hãy nhìn bức ảnh nhãn dán thực phẩm này và đối chiếu với thể trạng người dùng sau:
        THỂ TRẠNG NGƯỜI DÙNG: {profile_text}
        
        LUẬT PHÂN TÍCH (BẮT BUỘC TUÂN THỦ THEO THỨ TỰ):
        1. PHÂN TÍCH THỰC PHẨM TRƯỚC: Bắt buộc trích xuất (hoặc tự ước tính) các chỉ số calo, đường, đạm, béo... của CHÍNH SẢN PHẨM TRONG ẢNH. Khối "stats" tuyệt đối chỉ chứa thông tin của món ăn, không được nhầm lẫn với nhu cầu calo của người dùng.
        2. ĐỐI CHIẾU & TƯ VẤN: Dựa vào các chỉ số thực phẩm vừa tìm được, so sánh với chiều cao, cân nặng, giới tính của người dùng để đánh giá. (Ví dụ: cân nặng này kết hợp với việc học tập hoặc đi làm thêm di chuyển nhiều thì bù đắp calo thế nào cho hợp lý).
        3. ĐỀ XUẤT THAY THẾ: Gợi ý vài món lành mạnh hơn nếu sản phẩm này không tốt.
        4. Dịch sang tiếng Việt.

        Trả về DUY NHẤT mã JSON chuẩn:
        {{
            "product_name": "Tên sản phẩm",
            "stats": {{"calories": "...", "sugar": "...", "protein": "...", "calcium": "...", "fat": "...", "carb": "..."}},
            "health_score": "1-10",
            "short_advice": ["Lời khuyên 1 (đối chiếu thể trạng)", "Lời khuyên 2"],
            "alternatives": ["Món thay thế"]
        }}
        """

        # =========================
        # GỌI GEMINI
        # =========================
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type="image/jpeg"
                )
            ]
        )

        response_text = response.text

        # =========================
        # PARSE JSON
        # =========================
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

        if json_match:
            result = json.loads(json_match.group())
            return jsonify(result)

        return jsonify({
            "error": "AI trả về dữ liệu sai cấu trúc",
            "raw": response_text
        }), 500

    except Exception as e:
        print("\n===== LỖI PYTHON =====")
        print(traceback.format_exc())

        error_msg = str(e)

        return jsonify({
            "error": error_msg
        }), 500

# =========================
# RUN SERVER
# =========================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)