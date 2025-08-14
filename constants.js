// Application constants
const CONSTANTS = {
    // Window dimensions
    POPUP: {
        WIDTH: 550,
        HEIGHT: 210,
        HEIGHT_COMPACT: 130, // Height khi ẩn nội dung chuyển khoản
        MARGIN: 10,
        SPACING: 220,
        SPACING_COMPACT: 160 // Spacing khi ẩn nội dung
    },

    MAIN_WINDOW: {
        WIDTH: 450,
        HEIGHT: 800
    },

    // Connection settings
    RECONNECT: {
        MAX_ATTEMPTS: 5,
        DELAY: 5000,
        BACKOFF_MULTIPLIER: 2
    },

    // SMS processing
    SMS: {
        MIN_LENGTH: 10,
        SUPPORTED_BANKS: ['vietinbank', 'vietcombank'],
        SMS_APP_NAMES: ['Messages', 'Messaging', 'SMS', 'Android Messages']
    },

    // File paths
    PATHS: {
        CONFIG: 'config.json',
        ICON: 'assets/icon.png',
        ICON_ICO: 'assets/icon.ico',
        SOUND: 'tingting.mp3'
    },

    // Default configuration
    DEFAULT_CONFIG: {
        pushbullet: {
            apiKey: "o.0oaU2IBVW85bY9oxPFDUD03NgthBv9mL",
            enabled: true,
            autoStart: true
        },
        popup: {
            position: "top-right",
            soundEnabled: true,
            maxPopups: 4,
            autoCloseDelay: 300000,
            hideTransactionDetails: false // Ẩn nội dung chuyển khoản
        },
        supabase: {
            url: "https://ajsrzteoovahabndebyp.supabase.co",
            key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqc3J6dGVvb3ZhaGFibmRlYnlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNDY4NjI1OCwiZXhwIjoyMDIwMjYyMjU4fQ.Q0lBT-HTcMLxLGpKgJ_-vz-prKH43nV9czOtm2HvMzU",
            enabled: false, // Tắt tính năng tự động lưu tin nhắn lên Supabase
            autoSave: true
        },
        app: {
            startWithWindows: false,
            minimizeToTray: true,
            showNotifications: true
        }
    },

    // Error messages
    ERRORS: {
        CONFIG_LOAD_FAILED: 'Failed to load configuration',
        CONFIG_SAVE_FAILED: 'Failed to save configuration',
        SERVICE_START_FAILED: 'Failed to start services',
        PUSHBULLET_CONNECTION_FAILED: 'Failed to connect to Pushbullet',
        SUPABASE_CONNECTION_FAILED: 'Failed to connect to Supabase',
        INVALID_SMS_FORMAT: 'Invalid SMS format',
        MISSING_API_KEY: 'API key is required'
    }
};

module.exports = CONSTANTS;