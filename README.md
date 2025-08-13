# SMS Notification App

Ứng dụng Electron nhận thông báo SMS từ Pushbullet và hiển thị popup thông báo số dư tài khoản ngân hàng.

## Tính năng chính

- 📱 Nhận SMS từ Pushbullet WebSocket
- 💰 Parse SMS ngân hàng (VietinBank, Vietcombank)
- 🔔 Hiển thị popup thông báo đẹp mắt
- ⚙️ Cấu hình linh hoạt (vị trí, âm thanh, tự đóng)
- 🧪 Chế độ test với nhiều tùy chọn
- 💾 Lưu trữ dữ liệu với Supabase (tùy chọn)

## Cải tiến mới

### 🔧 Quản lý cửa sổ popup
- Sửa lỗi đóng cửa sổ không đúng cách
- Thêm animation mượt mà khi hiển thị/ẩn popup
- Tự động đóng popup sau thời gian cấu hình
- Click anywhere để đóng popup
- Ngăn popup chiếm focus không mong muốn

### 🎨 Giao diện cải thiện
- Thêm nút test popup tùy chỉnh
- Cấu hình thời gian tự đóng popup
- Layout grid cho các nút test
- Hiệu ứng hover cho nút đóng
- Hiển thị tooltip cho nội dung dài

### 🧪 Chức năng test mở rộng
- Test popup đơn lẻ (VietinBank/Vietcombank)
- Test nhiều popup liên tiếp
- Test popup tùy chỉnh với dữ liệu mẫu
- Đóng tất cả popup cùng lúc

## Cách sử dụng

### 1. Cài đặt
```bash
npm install
```

### 2. Cấu hình Database (Tùy chọn)
Nếu bạn muốn lưu trữ dữ liệu giao dịch, hãy tạo bảng trong Supabase:

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Tạo project mới hoặc chọn project hiện có
3. Vào SQL Editor và chạy script trong file `database/schema.sql`
4. Lấy URL và API Key từ Settings > API

### 3. Cấu hình
Sao chép file cấu hình mẫu:
```bash
cp config.json.example config.json
```

Chỉnh sửa `config.json` với API keys của bạn:
```json
{
  "pushbullet": {
    "apiKey": "your-pushbullet-api-key",
    "enabled": true
  },
  "supabase": {
    "url": "your-supabase-url",
    "key": "your-supabase-key", 
    "enabled": true
  }
}
```

### 3. Chạy ứng dụng
```bash
npm start
```

## Cấu hình popup

- **Vị trí**: Góc trên phải, trên trái, dưới phải, dưới trái
- **Âm thanh**: Bật/tắt âm thanh thông báo
- **Số popup tối đa**: 1-8 popup cùng lúc
- **Tự đóng**: 0-30 giây (0 = không tự đóng)

## Test popup

### Các nút test có sẵn:
- 📱 **VietinBank**: Test popup VietinBank mẫu
- 📱 **Vietcombank**: Test popup Vietcombank mẫu  
- 🔄 **Test 3 popup**: Hiển thị 3 popup liên tiếp
- ❌ **Đóng tất cả**: Đóng tất cả popup đang mở
- 🎯 **Test popup tùy chỉnh**: Popup với dữ liệu test

### Parse SMS thủ công:
1. Nhập nội dung SMS vào ô text
2. Click "Parse & Show" để hiển thị popup
3. Click "Load Sample" để load SMS mẫu

## Phím tắt

- **Double-click tray icon**: Mở cửa sổ chính
- **Click popup**: Đóng popup
- **Hover popup**: Hiện nút đóng

## Build ứng dụng

```bash
# Tạo icon (tự động chạy khi build)
npm run create-icon

# Build cho Windows
npm run build:win

# Build portable
npm run build:portable

# Clean build files
npm run clean
```

### Lưu ý về Icon
- Ứng dụng sẽ tự động tạo icon khi build
- Icon sẽ hiển thị trong system tray
- Nếu không tìm thấy icon, sẽ sử dụng icon mặc định

## Cấu trúc project

```
├── app.js                 # Main Electron process
├── index.html            # Giao diện chính
├── popup.html            # Giao diện popup
├── constants.js          # Hằng số cấu hình
├── database/
│   └── schema.sql        # Supabase database schema
├── services/
│   ├── pushbullet-listener.js  # WebSocket Pushbullet
│   ├── sms-parser.js          # Parse SMS ngân hàng
│   └── supabase-service.js    # Lưu trữ dữ liệu
├── utils/
│   ├── helpers.js        # Utility functions
│   └── logger.js         # Logging
└── assets/
    └── icon.png          # Icon ứng dụng
```

## Database Schema

Ứng dụng sử dụng bảng `banking_transactions` với các trường:

- **id**: UUID primary key
- **bank**: Tên ngân hàng (vietinbank, vietcombank)
- **sender**: Số điện thoại gửi SMS
- **transaction_type**: Loại giao dịch (incoming/outgoing)
- **amount**: Số tiền giao dịch
- **balance**: Số dư sau giao dịch
- **description**: Mô tả giao dịch
- **content**: Nội dung SMS đầy đủ
- **transaction_time**: Thời gian giao dịch
- **received_at**: Thời gian nhận SMS
- **raw_sms**: SMS gốc
- **parsed_data**: Dữ liệu đã parse (JSON)

## Troubleshooting

### Popup không hiển thị
- Kiểm tra cấu hình vị trí popup
- Đảm bảo không có popup nào đang che khuất
- Thử test popup thủ công

### Không nhận được SMS
- Kiểm tra Pushbullet API key
- Đảm bảo điện thoại đã kết nối Pushbullet
- Kiểm tra kết nối internet

### Lỗi đóng cửa sổ
- Các lỗi đóng cửa sổ đã được sửa trong phiên bản này
- Popup sẽ tự đóng sau thời gian cấu hình
- Click anywhere trên popup để đóng thủ công

## Changelog

### v1.1.0
- ✅ Sửa lỗi đóng cửa sổ popup
- ✅ Thêm animation cho popup
- ✅ Cấu hình tự đóng popup
- ✅ Cải thiện giao diện test
- ✅ Thêm nút test tùy chỉnh
- ✅ Click anywhere để đóng popup
- ✅ Ngăn popup chiếm focus
- ✅ Cải thiện cleanup khi thoát app