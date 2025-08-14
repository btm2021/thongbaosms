# INIT.md - Tài liệu Chi tiết Ứng dụng SMS Notification

## 📋 Tổng quan Ứng dụng

**SMS Notification App** là một ứng dụng Electron được thiết kế để nhận và xử lý tin nhắn SMS từ Pushbullet, đặc biệt tập trung vào việc parse và hiển thị thông báo giao dịch ngân hàng từ VietinBank và Vietcombank.

### 🎯 Mục đích chính
- Nhận SMS từ điện thoại thông qua Pushbullet WebSocket
- Parse thông tin giao dịch ngân hàng từ SMS
- Hiển thị popup thông báo đẹp mắt với thông tin giao dịch
- Lưu trữ dữ liệu giao dịch vào Supabase (tùy chọn)
- Quản lý cấu hình linh hoạt

---

## 🏗️ Kiến trúc Ứng dụng

### Cấu trúc thư mục
```
├── app.js                      # Main Electron process - Điều khiển chính
├── index.html                  # Giao diện chính của ứng dụng
├── popup.html                  # Giao diện popup thông báo
├── constants.js                # Hằng số và cấu hình mặc định
├── package.json                # Thông tin package và dependencies
├── README.md                   # Hướng dẫn sử dụng
├── config.json.example         # File cấu hình mẫu
├── tingting.mp3               # File âm thanh thông báo
├── assets/                     # Tài nguyên tĩnh
│   ├── icon.ico               # Icon Windows
│   └── icon.png               # Icon chung
├── database/                   # Database schema
│   └── schema.sql             # Supabase database schema
├── services/                   # Các service chính
│   ├── pushbullet-listener.js # Kết nối và lắng nghe Pushbullet
│   ├── sms-parser.js          # Parse SMS ngân hàng
│   └── supabase-service.js    # Kết nối và lưu trữ Supabase
├── utils/                      # Tiện ích hỗ trợ
│   ├── config-manager.js      # Quản lý cấu hình
│   ├── helpers.js             # Các hàm tiện ích
│   └── logger.js              # Hệ thống logging
└── scripts/                    # Scripts hỗ trợ
    ├── create-icon.js         # Tạo icon
    ├── setup-config.js        # Setup cấu hình
    ├── test-shutdown.js       # Test thoát ứng dụng
    └── validate-config.js     # Validate cấu hình
```

---

## 📁 Chi tiết từng Module

### 1. **app.js** - Main Process
**Chức năng chính:** Điều khiển toàn bộ ứng dụng Electron

#### Các class và method chính:

##### `SMSNotificationApp` Class
- **Constructor**: Khởi tạo ứng dụng, setup các service
- **initializeApp()**: Khởi tạo async, load config, setup services
- **setupApp()**: Setup Electron app events và handlers
- **createTray()**: Tạo system tray icon với menu
- **showMainWindow()**: Hiển thị cửa sổ chính
- **createPopupWindow(smsData)**: Tạo popup thông báo
- **calculatePopupPosition(index)**: Tính toán vị trí popup (hỗ trợ height khác nhau)
- **cleanupOldPopups()**: Dọn dẹp popup cũ khi vượt giới hạn
- **repositionAllPopups()**: Sắp xếp lại vị trí tất cả popup
- **setupIPC()**: Setup Inter-Process Communication
- **startServices()**: Khởi động Pushbullet và Supabase services
- **stopServices()**: Dừng tất cả services
- **handleSMSReceived(smsData)**: Xử lý khi nhận SMS mới
- **gracefulShutdown()**: Thoát ứng dụng một cách an toàn

#### IPC Handlers được đăng ký:
- `get-config`: Lấy cấu hình hiện tại
- `save-config`: Lưu cấu hình mới
- `start-services`: Khởi động services
- `stop-services`: Dừng services
- `get-status`: Lấy trạng thái kết nối
- `parse-sms`: Parse SMS thủ công
- `show-popup`: Hiển thị popup test
- `test-pushbullet`: Test kết nối Pushbullet
- `test-supabase`: Test kết nối Supabase
- `close-all-popups`: Đóng tất cả popup

### 2. **services/pushbullet-listener.js** - Pushbullet Service
**Chức năng:** Kết nối WebSocket với Pushbullet để nhận SMS

#### `PushbulletListener` Class
##### Properties:
- `apiKey`: API key của Pushbullet
- `pusher`: Instance của PushBullet client
- `ws`: WebSocket connection
- `isConnected`: Trạng thái kết nối
- `callbacks`: Object chứa các callback functions

##### Methods chính:
- **connect()**: Kết nối WebSocket với Pushbullet
- **setupWebSocketHandlers()**: Setup các event handler cho WebSocket
- **handleMessage(message)**: Xử lý message từ WebSocket
- **handlePush(push)**: Xử lý push notification
- **handleSMSChanged(push)**: Xử lý khi có SMS mới
- **handleMirroredSMS(push)**: Xử lý SMS mirror từ điện thoại
- **processSMS(smsData)**: Parse và xử lý SMS data
- **isSMSApp(appName)**: Kiểm tra xem app có phải SMS app không
- **attemptReconnect()**: Thử kết nối lại khi bị disconnect
- **testConnection()**: Test kết nối Pushbullet
- **disconnect()**: Ngắt kết nối

##### Callbacks:
- `onSMSReceived`: Được gọi khi nhận SMS hợp lệ
- `onConnected`: Được gọi khi kết nối thành công
- `onDisconnected`: Được gọi khi mất kết nối
- `onError`: Được gọi khi có lỗi

### 3. **services/sms-parser.js** - SMS Parser Service
**Chức năng:** Parse SMS từ các ngân hàng Việt Nam

#### `SMSParser` Class (Static methods)
##### Patterns được hỗ trợ:
- **VIETINBANK**: Parse SMS từ VietinBank
- **VIETCOMBANK**: Parse SMS từ Vietcombank

##### Methods chính:
- **parseSMS(smsText, sender)**: Method chính để parse SMS
- **detectBank(smsText)**: Phát hiện ngân hàng từ nội dung SMS
- **parseViettinBankSMS(smsText)**: Parse SMS VietinBank cụ thể
- **parseVietcombankSMS(smsText)**: Parse SMS Vietcombank cụ thể
- **validateSMS(smsText)**: Validate format SMS
- **getSampleSMS()**: Lấy SMS mẫu để test

##### Thông tin được parse:
- `bank`: Tên ngân hàng (vietinbank/vietcombank)
- `sender`: Người gửi SMS
- `transactionType`: Loại giao dịch (credit/debit)
- `transactionAmount`: Số tiền giao dịch
- `balance`: Số dư tài khoản
- `description`: Mô tả giao dịch
- `timestamp`: Thời gian giao dịch
- `accountNumber`: Số tài khoản
- `isValid`: SMS có hợp lệ không

##### Regex Patterns:
**VietinBank:**
- Time: `(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})`
- Account: `TK:(\d+)`
- Amount: `GD:([\+\-]?)([\d,]+)VND`
- Balance: `SDC:([\d,]+)VND`
- Description: `ND:(.+)$`

**Vietcombank:**
- Time: `luc (\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})`
- Account: `TK (\d+)`
- Amount: `([\+\-])([\d,]+)VND`
- Balance: `SD ([\d,]+)VND`
- Description: `Ref (.+)$`

### 4. **services/supabase-service.js** - Supabase Service
**Chức năng:** Kết nối và lưu trữ dữ liệu lên Supabase

#### `SupabaseService` Class
##### Properties:
- `supabase`: Supabase client instance
- `isConnected`: Trạng thái kết nối
- `tableName`: Tên bảng ('banking_transactions')

##### Methods chính:
- **testConnection()**: Test kết nối Supabase
- **saveTransaction(smsData)**: Lưu giao dịch lên database
- **getTransactionHistory(limit, offset, filters)**: Lấy lịch sử giao dịch
- **getTransactionStats(days)**: Lấy thống kê giao dịch
- **getTransactionsByBank(bank, limit)**: Lấy giao dịch theo ngân hàng
- **getRecentTransactions(limit)**: Lấy giao dịch gần đây
- **searchTransactions(searchTerm, limit)**: Tìm kiếm giao dịch
- **prepareTransactionData(smsData)**: Chuẩn bị dữ liệu để lưu
- **validateTransactionData(data)**: Validate dữ liệu trước khi lưu
- **determineTransactionType(smsData)**: Xác định loại giao dịch

##### Database Schema:
```sql
banking_transactions (
    id UUID PRIMARY KEY,
    bank VARCHAR(50),
    sender VARCHAR(20),
    transaction_type VARCHAR(20), -- 'incoming'/'outgoing'
    amount DECIMAL(15,2),
    balance DECIMAL(15,2),
    description TEXT,
    content TEXT,
    transaction_time TIMESTAMP,
    received_at TIMESTAMP,
    raw_sms TEXT,
    parsed_data JSONB
)
```

### 5. **utils/config-manager.js** - Config Manager
**Chức năng:** Quản lý cấu hình ứng dụng

#### `ConfigManager` Class
##### Properties:
- `configDir`: Thư mục config ('C:\\tinhansms')
- `configPath`: Đường dẫn file config
- `defaultConfig`: Cấu hình mặc định

##### Methods chính:
- **ensureConfigExists()**: Đảm bảo file config tồn tại
- **loadConfig()**: Load cấu hình từ file
- **saveConfig(config)**: Lưu cấu hình ra file
- **convertToAppConfig(flatConfig)**: Chuyển đổi flat config thành app config
- **convertToFlatConfig(appConfig)**: Chuyển đổi app config thành flat config
- **getConfigPath()**: Lấy đường dẫn file config
- **configExists()**: Kiểm tra file config có tồn tại không

##### Cấu trúc Config:
```javascript
{
    pushbullet: {
        apiKey: string,
        enabled: boolean,
        autoStart: boolean
    },
    popup: {
        position: string, // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
        soundEnabled: boolean,
        maxPopups: number, // 1-8
        autoCloseDelay: number, // milliseconds
        hideTransactionDetails: boolean // Ẩn nội dung chuyển khoản
    },
    supabase: {
        url: string,
        key: string,
        enabled: boolean,
        autoSave: boolean
    },
    app: {
        startWithWindows: boolean,
        minimizeToTray: boolean,
        showNotifications: boolean
    }
}
```

### 6. **utils/helpers.js** - Helper Functions
**Chức năng:** Các hàm tiện ích chung

#### `Helpers` Class (Static methods)
##### Formatting:
- **formatCurrency(amount)**: Format số tiền theo định dạng Việt Nam
- **formatDateTime(timestamp)**: Format ngày giờ theo định dạng Việt Nam
- **formatTime(timestamp)**: Format thời gian ngắn gọn
- **parseNumber(value)**: Parse số từ string, loại bỏ dấu phẩy

##### Validation:
- **isValidEmail(email)**: Validate email format
- **isValidUrl(url)**: Validate URL format

##### Utilities:
- **deepMerge(target, source)**: Merge sâu 2 object
- **debounce(func, wait)**: Debounce function calls
- **throttle(func, limit)**: Throttle function calls
- **sleep(ms)**: Sleep function
- **retry(fn, maxRetries, baseDelay)**: Retry với exponential backoff
- **sanitizeString(str)**: Sanitize string để hiển thị an toàn
- **generateId()**: Tạo unique ID
- **isEmpty(obj)**: Kiểm tra object rỗng
- **get(obj, path, defaultValue)**: Lấy nested property an toàn

### 7. **utils/logger.js** - Logging System
**Chức năng:** Hệ thống logging có cấp độ

#### `Logger` Class
##### Properties:
- `logLevel`: Cấp độ log ('error', 'warn', 'info', 'debug')
- `logToFile`: Có ghi log ra file không
- `logFile`: Đường dẫn file log
- `maxFileSize`: Kích thước tối đa file log

##### Methods chính:
- **log(level, message, meta)**: Log message với cấp độ
- **error(message, meta)**: Log error
- **warn(message, meta)**: Log warning
- **info(message, meta)**: Log info
- **debug(message, meta)**: Log debug
- **child(context)**: Tạo child logger với context
- **rotateLogFile()**: Rotate log file khi quá lớn

---

## 🔧 Cấu hình và Constants

### constants.js
Chứa tất cả hằng số cấu hình:

#### Window Dimensions:
```javascript
POPUP: {
    WIDTH: 550,
    HEIGHT: 210,
    HEIGHT_COMPACT: 150, // Height khi ẩn nội dung chuyển khoản
    MARGIN: 10,
    SPACING: 220,
    SPACING_COMPACT: 160 // Spacing khi ẩn nội dung
},
MAIN_WINDOW: {
    WIDTH: 800,
    HEIGHT: 700
}
```

#### Connection Settings:
```javascript
RECONNECT: {
    MAX_ATTEMPTS: 5,
    DELAY: 5000,
    BACKOFF_MULTIPLIER: 2
}
```

#### SMS Processing:
```javascript
SMS: {
    MIN_LENGTH: 10,
    SUPPORTED_BANKS: ['vietinbank', 'vietcombank'],
    SMS_APP_NAMES: ['Messages', 'Messaging', 'SMS', 'Android Messages']
}
```

#### Default Configuration:
- Pushbullet API key mặc định
- Supabase URL và key mặc định
- Cấu hình popup mặc định
- Cấu hình ứng dụng mặc định

---

## 🎨 Giao diện (UI)

### index.html - Main Window
**Chức năng:** Giao diện chính để cấu hình và quản lý ứng dụng

#### Các section chính:
1. **Header**: Tiêu đề và trạng thái kết nối
2. **Configuration**: Form cấu hình API keys
3. **Popup Settings**: Cài đặt popup (vị trí, âm thanh, số lượng)
4. **Test Section**: Các nút test chức năng
5. **SMS Parser**: Parse SMS thủ công
6. **Transaction History**: Lịch sử giao dịch từ Supabase

#### JavaScript Functions:
- **loadConfig()**: Load cấu hình từ main process
- **saveConfig()**: Lưu cấu hình
- **updateStatus()**: Cập nhật trạng thái kết nối
- **testPushbullet()**: Test kết nối Pushbullet
- **testSupabase()**: Test kết nối Supabase
- **parseSMS()**: Parse SMS thủ công
- **loadTransactionHistory()**: Load lịch sử giao dịch

### popup.html - Popup Window
**Chức năng:** Hiển thị thông báo giao dịch

#### Cấu trúc:
- **Header**: Logo ngân hàng và trạng thái "NEW"
- **Amount**: Số tiền giao dịch với màu sắc (xanh: nhận, đỏ: chuyển)
- **Balance**: Số dư tài khoản
- **Description**: Mô tả giao dịch
- **Time**: Thời gian giao dịch
- **Close Button**: Nút đóng popup

#### JavaScript Functions:
- **formatCurrency()**: Format số tiền
- **formatTime()**: Format thời gian
- **closePopup()**: Đóng popup
- **playSound()**: Phát âm thanh thông báo

---

## 🗄️ Database Schema

### banking_transactions Table
```sql
CREATE TABLE banking_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bank VARCHAR(50) NOT NULL,
    sender VARCHAR(20) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance DECIMAL(15,2),
    description TEXT NOT NULL,
    content TEXT NOT NULL,
    transaction_time TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_sms TEXT,
    parsed_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Indexes:
- `idx_banking_transactions_bank`: Index trên cột bank
- `idx_banking_transactions_type`: Index trên cột transaction_type
- `idx_banking_transactions_received_at`: Index trên cột received_at
- `idx_banking_transactions_transaction_time`: Index trên cột transaction_time
- `idx_banking_transactions_amount`: Index trên cột amount

---

## 🚀 Scripts và Build

### package.json Scripts:
- **start**: Chạy ứng dụng với validate config
- **dev**: Chạy ở chế độ development
- **build**: Build ứng dụng với icon
- **build:win**: Build cho Windows
- **build:portable**: Build portable version
- **clean**: Dọn dẹp build files
- **validate-config**: Validate cấu hình
- **create-icon**: Tạo icon từ PNG
- **setup**: Copy config mẫu

### Build Configuration:
- **Target**: Windows NSIS installer và portable
- **Icon**: assets/icon.ico
- **Output**: dist/ directory
- **Compression**: Maximum
- **Extra Resources**: assets/ folder

---

## 🔄 Luồng hoạt động (Workflow)

### 1. Khởi động ứng dụng:
1. Load cấu hình từ `C:\tinhansms\config.txt`
2. Tạo system tray icon
3. Setup IPC handlers
4. Khởi động services nếu có API key

### 2. Kết nối Pushbullet:
1. Tạo WebSocket connection
2. Setup event handlers
3. Lắng nghe push notifications
4. Filter SMS từ các app tin nhắn

### 3. Xử lý SMS:
1. Nhận SMS từ Pushbullet
2. Parse nội dung SMS
3. Xác định ngân hàng và thông tin giao dịch
4. Tạo popup thông báo
5. Lưu vào Supabase (nếu enabled)

### 4. Hiển thị popup:
1. Tính toán vị trí popup
2. Tạo BrowserWindow popup
3. Load popup.html với dữ liệu
4. Hiển thị với animation
5. Tự động đóng sau thời gian cấu hình

### 5. Quản lý popup:
1. Giới hạn số lượng popup tối đa
2. Sắp xếp lại vị trí khi có popup mới
3. Đóng popup cũ nhất khi vượt giới hạn
4. Cleanup khi popup bị đóng

---

## 🛠️ Tính năng nâng cao

### 1. Graceful Shutdown:
- Cleanup tất cả resources
- Đóng WebSocket connections
- Remove IPC handlers
- Force quit sau timeout

### 2. Error Handling:
- Try-catch cho tất cả async operations
- Retry mechanism với exponential backoff
- Fallback cho các tính năng không critical

### 3. Configuration Management:
- Persistent config tại `C:\tinhansms\`
- Flat config structure cho dễ đọc/ghi
- Validation và default values
- Auto-create config directory

### 4. Performance Optimization:
- Debounce cho config saves
- Throttle cho UI updates
- Efficient popup positioning
- Memory cleanup

### 5. Security:
- Sanitize user inputs
- Validate API keys
- Safe file operations
- No sensitive data in logs

---

## 📊 Monitoring và Debugging

### Logging:
- Console logs với colors
- File logging (optional)
- Log rotation
- Different log levels

### Status Monitoring:
- Connection status tracking
- Service health checks
- Error counting
- Performance metrics

### Debug Features:
- Test buttons cho tất cả services
- Sample SMS data
- Manual SMS parsing
- Config validation

---

## 🔒 Bảo mật

### API Keys:
- Stored trong config file local
- Masked trong logs (chỉ hiện 4 ký tự cuối)
- Validated trước khi sử dụng

### Data Protection:
- Local config storage
- No sensitive data transmission
- Sanitized inputs
- Safe file operations

### Network Security:
- HTTPS/WSS connections only
- API key authentication
- Connection validation

---

## 🆕 Tính năng mới: Ẩn nội dung chuyển khoản

### Mô tả:
Tính năng cho phép ẩn nội dung chi tiết của giao dịch, chỉ hiển thị số tiền và thông tin cơ bản. Hữu ích khi muốn bảo mật thông tin hoặc giảm kích thước popup.

### Cách hoạt động:
1. **Config**: Thêm `hideTransactionDetails: boolean` vào popup config
2. **UI**: Checkbox trong giao diện cấu hình
3. **Popup**: Tự động điều chỉnh height từ 210px xuống 150px
4. **Spacing**: Giảm khoảng cách giữa các popup từ 220px xuống 160px

### Thay đổi kỹ thuật:
- **constants.js**: Thêm `HEIGHT_COMPACT` và `SPACING_COMPACT`
- **config-manager.js**: Hỗ trợ `hideTransactionDetails` trong config
- **app.js**: Logic tính toán height và spacing động
- **popup.html**: CSS class `.hidden` để ẩn nội dung
- **index.html**: Checkbox cấu hình mới

### Code changes:
```javascript
// Tính toán height động
const actualHeight = this.config.popup.hideTransactionDetails ? HEIGHT_COMPACT : HEIGHT;

// Ẩn nội dung trong popup
if (smsData.hideTransactionDetails) {
    transactionContent.classList.add('hidden');
}
```

---

## 📈 Khả năng mở rộng

### Thêm ngân hàng mới:
1. Thêm patterns vào `sms-parser.js`
2. Implement parser method
3. Update `detectBank()` function
4. Test với SMS samples

### Thêm tính năng mới:
1. Extend IPC handlers trong `app.js`
2. Update UI trong `index.html`
3. Add configuration options
4. Update constants và helpers

### Database extensions:
1. Modify schema.sql
2. Update SupabaseService methods
3. Add new indexes
4. Migration scripts

---

## 🐛 Troubleshooting

### Common Issues:
1. **Config không lưu được**: Kiểm tra quyền ghi tại `C:\tinhansms\`
2. **Pushbullet không kết nối**: Validate API key
3. **SMS không parse được**: Check format với getSampleSMS()
4. **Popup không hiển thị**: Kiểm tra screen resolution và position
5. **Supabase lỗi**: Verify URL, key và table schema

### Debug Steps:
1. Check console logs
2. Test individual services
3. Validate configuration
4. Check network connectivity
5. Verify file permissions

---

## 📝 Kết luận

Ứng dụng SMS Notification là một hệ thống hoàn chỉnh để nhận, xử lý và hiển thị thông báo SMS ngân hàng. Với kiến trúc modular, error handling tốt và khả năng cấu hình linh hoạt, ứng dụng có thể dễ dàng mở rộng và bảo trì.

### Điểm mạnh:
- ✅ Kiến trúc rõ ràng, dễ hiểu
- ✅ Error handling và recovery tốt
- ✅ Cấu hình linh hoạt
- ✅ UI/UX thân thiện
- ✅ Performance tối ưu
- ✅ Bảo mật tốt
- ✅ Logging và monitoring đầy đủ

### Khả năng phát triển:
- 🔄 Thêm nhiều ngân hàng hơn
- 🔄 Machine learning cho SMS parsing
- 🔄 Mobile app companion
- 🔄 Advanced analytics
- 🔄 Multi-language support
- 🔄 Cloud sync