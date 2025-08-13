// Application constants
const CONSTANTS = {
    // Window dimensions
    POPUP: {
        WIDTH: 550,
        HEIGHT: 210,
        MARGIN: 10,
        SPACING: 220
    },

    MAIN_WINDOW: {
        WIDTH: 800,
        HEIGHT: 700
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
            apiKey: '',
            enabled: true,
            autoStart: true
        },
        popup: {
            position: 'top-right',
            soundEnabled: true,
            maxPopups: 4,
            autoCloseDelay: 8000
        },
        supabase: {
            url: '',
            key: '',
            enabled: false,
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