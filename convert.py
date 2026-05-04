import pandas as pd
import json
import os

def export_excel_to_js():
    # 1. Tên file Excel sếp vừa tạo
    excel_file = 'danh_sach_du_lich.xlsx'
    
    if not os.path.exists(excel_file):
        print(f"❌ Không tìm thấy file {excel_file} trong thư mục!")
        return

    try:
        # 2. Đọc dữ liệu từ Excel
        df = pd.read_excel(excel_file)
        
        # Làm sạch dữ liệu: xóa khoảng trắng, chuyển tên thành phố về chữ thường
        df['City'] = df['City'].str.lower().str.strip()
        
        database = {}
        for _, row in df.iterrows():
            city_name = row['City']
            database[city_name] = {
                "images": [str(row['Image1']), str(row['Image2'])],
                "main_place": str(row['Main_Place']),
                "desc": str(row['Description']),
                "cafe": str(row['Cafe'])
            }
        
        # 3. Ghi đè vào file database.js
        with open('database.js', 'w', encoding='utf-8') as f:
            f.write("// DỮ LIỆU TỰ ĐỘNG TỪ EXCEL - KHÔNG SỬA TAY Ở ĐÂY\n")
            f.write("const TRAVEL_DATABASE = ")
            f.write(json.dumps(database, ensure_ascii=False, indent=4))
            f.write(";")
            
        print(f"✅ Đã cập nhật thành công {len(database)} địa điểm vào App!")
        
    except Exception as e:
        print(f"❌ Lỗi rồi sếp ơi: {e}")

if __name__ == "__main__":
    export_excel_to_js()
