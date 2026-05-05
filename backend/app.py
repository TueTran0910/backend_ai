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

        # Xóa phần base64 header
        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]

        # Decode ảnh
        image_bytes = base64.b64decode(image_b64)

        # =========================
        # PROFILE
        # =========================
        profile_text = f"""
        Giới tính: {user_profile.get('gender', 'Nam')},
        Tuổi: {user_profile.get('age', 20)},
        Cân nặng: {user_profile.get('weight', 60)}kg,
        Chiều cao: {user_profile.get('height', 170)}cm
        """

        # =========================
        # PROMPT
        # =========================
        prompt = f"""
        Bạn là AI OCR + Chuyên gia phân tích dinh dưỡng.

        NHIỆM VỤ BẮT BUỘC:

        1. PHẢI QUÉT HÌNH ẢNH
        - Hãy thực hiện OCR toàn bộ chữ trong ảnh.
        - Đọc tất cả:
        + bảng Nutrition Facts
        + thành phần
        + calories
        + sugar
        + protein
        + fat
        + carb
        + calcium
        + sodium
        + serving size
        + khối lượng

        2. ƯU TIÊN THÔNG SỐ TRÊN NHÃN
        - Phải lấy số liệu trực tiếp từ hình ảnh.
        - KHÔNG được chỉ nhìn bao bì hoặc tên sản phẩm.
        - KHÔNG tự đoán dinh dưỡng.
        - KHÔNG dùng kiến thức có sẵn.
        - Nếu ảnh không thấy rõ thì ghi:
        "Không xác định"

        3. THỂ TRẠNG NGƯỜI DÙNG
        {profile_text}

        4. ĐÁNH GIÁ
        - So sánh thông số dinh dưỡng đọc được từ ảnh
        với thể trạng người dùng.

        5. GỢI Ý
        - Đưa ra 2 món thay thế lành mạnh hơn.

        6. NGÔN NGỮ
        - Toàn bộ bằng tiếng Việt.

        7. FORMAT
        - Chỉ trả JSON hợp lệ.
        - Không markdown.
        - Không giải thích thêm.

        JSON FORMAT:

        {{
            "product_name": "Tên sản phẩm",

            "ocr_text": "Toàn bộ chữ đọc được từ ảnh",

            "stats": {{
                "serving_size": "...",
                "calories": "...",
                "sugar": "...",
                "protein": "...",
                "calcium": "...",
                "fat": "...",
                "carb": "...",
                "sodium": "..."
            }},

            "health_score": "1-10",

            "short_advice": [
                "...",
                "..."
            ],

            "alternatives": [
                "...",
                "..."
            ]
        }}
        """

        # =========================
        # GỌI GEMINI
        # =========================
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
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