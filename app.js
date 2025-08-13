const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Import services
const SMSParser = require('./services/sms-parser');
const PushbulletListener = require('./services/pushbullet-listener');
const SupabaseService = require('./services/supabase-service');
const CONSTANTS = require('./constants');

class SMSNotificationApp {
    constructor() {
        this.mainWindow = null;
        this.popupWindows = [];
        this.tray = null;
        this.pushbulletListener = null;
        this.supabaseService = null;
        this.config = this.loadConfig();
        this.isConnected = false;
        
        this.setupApp();
    }

    loadConfig() {
        const defaultConfig = {
            ...CONSTANTS.DEFAULT_CONFIG,
            pushbullet: {
                ...CONSTANTS.DEFAULT_CONFIG.pushbullet,
                apiKey: process.env.PUSHBULLET_API_KEY || ''
            },
            supabase: {
                ...CONSTANTS.DEFAULT_CONFIG.supabase,
                url: process.env.SUPABASE_URL || '',
                key: process.env.SUPABASE_KEY || ''
            }
        };

        try {
            const configPath = path.join(__dirname, CONSTANTS.PATHS.CONFIG);
            if (fsSync.existsSync(configPath)) {
                const fileConfig = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
                return this.mergeConfig(defaultConfig, fileConfig);
            }
        } catch (error) {
            console.warn(CONSTANTS.ERRORS.CONFIG_LOAD_FAILED + ':', error.message);
        }

        return defaultConfig;
    }

    mergeConfig(defaultConfig, fileConfig) {
        const merged = { ...defaultConfig };
        for (const [key, value] of Object.entries(fileConfig)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                merged[key] = { ...defaultConfig[key], ...value };
            } else {
                merged[key] = value;
            }
        }
        return merged;
    }

    async saveConfig() {
        try {
            const configPath = path.join(__dirname, CONSTANTS.PATHS.CONFIG);
            await fs.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(CONSTANTS.ERRORS.CONFIG_SAVE_FAILED + ':', error);
            return false;
        }
    }

    setupApp() {
        app.whenReady().then(() => {
            this.createTray();
            this.setupIPC();
            
            if (this.config.pushbullet.enabled && this.config.pushbullet.apiKey) {
                this.startServices();
            }
        });

        app.on('window-all-closed', (e) => {
            e.preventDefault();
        });

        app.on('before-quit', () => {
            this.cleanup();
        });
    }

    createTray() {
        const trayIcon = this.loadTrayIcon();
        this.tray = new Tray(trayIcon);
        this.tray.setToolTip('SMS Notification');
        this.updateTrayMenu();
        
        this.tray.on('double-click', () => {
            this.showMainWindow();
        });
    }

    loadTrayIcon() {
        // Determine icon file based on platform
        const isWindows = process.platform === 'win32';
        const iconFile = isWindows ? CONSTANTS.PATHS.ICON_ICO : CONSTANTS.PATHS.ICON;
        
        // Try multiple icon paths for different environments
        const iconPaths = [
            // Development path
            path.join(__dirname, iconFile),
            path.join(__dirname, CONSTANTS.PATHS.ICON), // Fallback to PNG
            // Production path (when packaged)
            path.join(process.resourcesPath, iconFile),
            path.join(process.resourcesPath, CONSTANTS.PATHS.ICON),
            // Alternative production path
            path.join(process.resourcesPath, 'app', iconFile),
            path.join(process.resourcesPath, 'app', CONSTANTS.PATHS.ICON),
            // Electron-builder extraResources path
            path.join(process.resourcesPath, 'assets', 'icon.ico'),
            path.join(process.resourcesPath, 'assets', 'icon.png')
        ];
        
        for (const iconPath of iconPaths) {
            try {
                if (fsSync.existsSync(iconPath)) {
                    console.log('Loading tray icon from:', iconPath);
                    const icon = nativeImage.createFromPath(iconPath);
                    if (!icon.isEmpty()) {
                        return icon;
                    }
                }
            } catch (error) {
                console.warn(`Failed to load icon from ${iconPath}:`, error.message);
            }
        }
        
        console.warn('Using fallback icon - no custom icon found');
        
        // Create a simple text-based icon as fallback
        return this.createTextIcon('SMS');
    }

    createTextIcon(text) {
        // Create a simple 16x16 icon with text
        const canvas = document.createElement ? null : require('canvas');
        
        if (!canvas) {
            // Fallback to a simple colored square icon
            return nativeImage.createFromBuffer(Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
                0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF, 0x61, 0x00, 0x00, 0x00,
                0x85, 0x49, 0x44, 0x41, 0x54, 0x38, 0x8D, 0x63, 0x64, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x60,
                0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
            ]));
        }
        
        // If canvas is available, create a proper text icon
        try {
            const { createCanvas } = canvas;
            const canvasElement = createCanvas(16, 16);
            const ctx = canvasElement.getContext('2d');
            
            // Fill background
            ctx.fillStyle = '#4A90E2';
            ctx.fillRect(0, 0, 16, 16);
            
            // Draw text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(text, 8, 11);
            
            return nativeImage.createFromBuffer(canvasElement.toBuffer());
        } catch (error) {
            console.warn('Failed to create text icon:', error.message);
            return nativeImage.createEmpty();
        }
    }

    updateTrayMenu() {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'SMS Notification',
                enabled: false
            },
            { type: 'separator' },
            {
                label: this.isConnected ? '🟢 Connected' : '🔴 Disconnected',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Open',
                click: () => this.showMainWindow()
            },
            {
                label: this.isConnected ? 'Stop' : 'Start',
                click: () => {
                    if (this.isConnected) {
                        this.stopServices();
                    } else {
                        this.startServices();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    this.cleanup();
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    showMainWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.focus();
            return;
        }

        const { WIDTH, HEIGHT } = CONSTANTS.MAIN_WINDOW;
        this.mainWindow = new BrowserWindow({
            width: WIDTH,
            height: HEIGHT,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: false
            },
            icon: path.join(__dirname, 'assets', 'icon.png'),
            title: 'SMS Notification',
            show: false
        });

        this.mainWindow.loadFile('index.html');

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            // Send signal to reload transactions when window opens
            this.mainWindow.webContents.send('window-opened');
        });

        this.mainWindow.on('close', (e) => {
            if (this.config.app.minimizeToTray) {
                e.preventDefault();
                this.mainWindow.hide();
            }
        });

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    calculatePopupPosition(index) {
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
        const { WIDTH: popupWidth, HEIGHT: popupHeight, MARGIN: margin, SPACING: spacing } = CONSTANTS.POPUP;

        const positions = {
            'top-right': {
                x: screenWidth - popupWidth - margin,
                y: margin + (index * spacing)
            },
            'top-left': {
                x: margin,
                y: margin + (index * spacing)
            },
            'bottom-right': {
                x: screenWidth - popupWidth - margin,
                y: screenHeight - popupHeight - margin - (index * spacing)
            },
            'bottom-left': {
                x: margin,
                y: screenHeight - popupHeight - margin - (index * spacing)
            }
        };

        return positions[this.config.popup.position] || positions['top-right'];
    }

    createPopupWindow(smsData) {
        // Remove oldest popup if we exceed max limit
        this.cleanupOldPopups();

        // Create new popup at position 0 (top)
        const { x, y } = this.calculatePopupPosition(0);
        const { WIDTH, HEIGHT } = CONSTANTS.POPUP;

        const popupWindow = new BrowserWindow({
            width: WIDTH,
            height: HEIGHT,
            frame: false,
            alwaysOnTop: true,
            resizable: false,
            skipTaskbar: true,
            focusable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: false
            },
            x, y,
            show: false,
            transparent: false,
            backgroundColor: '#ffffff'
        });

        // Prevent popup from stealing focus
        popupWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        
        popupWindow.loadFile('popup.html');

        popupWindow.once('ready-to-show', () => {
            // Mark as newest popup and send data
            const popupData = {
                ...smsData,
                isNewest: true,
                popupIndex: 0
            };
            
            popupWindow.webContents.send('sms-data', popupData);
            popupWindow.show();
            popupWindow.setAlwaysOnTop(true, 'screen-saver');
            
            // Auto close after configured time
            if (this.config.popup.autoCloseDelay > 0) {
                setTimeout(() => {
                    if (!popupWindow.isDestroyed()) {
                        this.removePopupWindow(popupWindow);
                        popupWindow.close();
                    }
                }, this.config.popup.autoCloseDelay);
            }
        });

        popupWindow.on('closed', () => {
            this.removePopupWindow(popupWindow);
        });

        // Prevent popup from being minimized or maximized
        popupWindow.on('minimize', (e) => e.preventDefault());
        popupWindow.on('maximize', (e) => e.preventDefault());

        // Add new popup to the beginning of array (newest first)
        this.popupWindows.unshift(popupWindow);
        
        // Reposition all existing popups and remove "NEW" label from old ones
        this.repositionAllPopups();
        
        return popupWindow;
    }

    cleanupOldPopups() {
        // Remove oldest popups (from the end of array) if we exceed max limit
        while (this.popupWindows.length >= this.config.popup.maxPopups) {
            const oldestPopup = this.popupWindows.pop(); // Remove from end (oldest)
            if (oldestPopup && !oldestPopup.isDestroyed()) {
                oldestPopup.close();
            }
        }
    }

    removePopupWindow(popupWindow) {
        const index = this.popupWindows.indexOf(popupWindow);
        if (index > -1) {
            this.popupWindows.splice(index, 1);
            // Delay repositioning to avoid visual glitches
            setTimeout(() => {
                this.repositionAllPopups();
            }, 100);
        }
    }

    repositionAllPopups() {
        const { WIDTH, HEIGHT } = CONSTANTS.POPUP;
        this.popupWindows.forEach((popup, index) => {
            if (!popup.isDestroyed()) {
                const { x, y } = this.calculatePopupPosition(index);
                popup.setBounds({ x, y, width: WIDTH, height: HEIGHT });
                
                // Update popup data to reflect new position and "NEW" status
                const isNewest = index === 0;
                popup.webContents.send('update-popup-status', {
                    isNewest: isNewest,
                    popupIndex: index
                });
            }
        });
    }

    setupIPC() {
        const handlers = {
            // Config handlers
            'get-config': () => this.config,
            'save-config': async (event, newConfig) => {
                this.config = this.mergeConfig(this.config, newConfig);
                return await this.saveConfig();
            },

            // Service handlers
            'start-services': () => this.startServices(),
            'stop-services': () => this.stopServices(),
            'get-status': () => ({ 
                connected: this.isConnected,
                popupCount: this.popupWindows.length,
                services: {
                    pushbullet: !!this.pushbulletListener,
                    supabase: !!this.supabaseService
                },
                config: {
                    supabaseEnabled: this.config.supabase?.enabled === true,
                    supabaseConfigured: !!(this.config.supabase?.url && this.config.supabase?.key)
                }
            }),

            // SMS handlers
            'parse-sms': (event, smsText, sender) => SMSParser.parseSMS(smsText, sender),
            'show-popup': (event, smsData) => this.createPopupWindow(smsData),
            'close-all-popups': () => this.closeAllPopups(),

            // Test handlers
            'test-pushbullet': async (event, apiKey) => this.testPushbullet(apiKey),
            'test-supabase': async (event, url, key) => this.testSupabase(url, key),
            'test-popup': (event, smsData) => this.createPopupWindow(smsData),
            'test-multiple-popups': () => this.testMultiplePopups(),

            // Utility handlers
            'get-sample-sms': () => SMSParser.getSampleSMS(),
            'validate-sms': (event, smsText) => SMSParser.validateSMS(smsText)
        };

        // Register all handlers
        Object.entries(handlers).forEach(([channel, handler]) => {
            ipcMain.handle(channel, handler);
        });

        // Special event handlers
        ipcMain.on('close-popup', (event) => {
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            if (senderWindow) {
                this.removePopupWindow(senderWindow);
                senderWindow.close();
            }
        });
    }

    closeAllPopups() {
        // Create a copy of the array to avoid issues during iteration
        const popupsToClose = [...this.popupWindows];
        this.popupWindows = [];
        
        popupsToClose.forEach(popup => {
            if (!popup.isDestroyed()) {
                try {
                    popup.close();
                } catch (error) {
                    console.warn('Error closing popup:', error.message);
                }
            }
        });
    }

    async testPushbullet(apiKey) {
        try {
            const tempListener = new PushbulletListener(apiKey);
            return await tempListener.testConnection();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testSupabase(url, key) {
        try {
            const tempService = new SupabaseService(url, key);
            return await tempService.testConnection();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    testMultiplePopups() {
        const testSMSList = [
            {
                bank: 'vietinbank',
                sender: 'VietinBank',
                transactionType: 'credit',
                transactionAmount: 1500000,
                balance: 65408063,
                description: 'Nhan tien tu NGUYEN VAN ALuong thang 8/2025Luong thang 8/2025Luong thang 8/2025Luong thang 8/2025',
                timestamp: Date.now()
            },
            {
                bank: 'vietcombank',
                sender: 'Vietcombank',
                transactionType: 'debit',
                transactionAmount: 800000,
                balance: 28996653,
                description: 'ATM WITHDRAW ATM001Luong thang 8/2025Luong thang8/2025Luong thang8/2025Luong thang 8/2025Luong thang 8/2025',
                timestamp: Date.now() + 1000
            },
            {
                bank: 'vietinbank',
                sender: 'VietinBank',
                transactionType: 'credit',
                transactionAmount: 2200000,
                balance: 67608063,
                description: 'Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025Luongthang8/2025',
                timestamp: Date.now() + 2000
            }
        ];

        testSMSList.forEach((smsData, index) => {
            setTimeout(() => {
                this.createPopupWindow(smsData);
            }, index * 800);
        });

        return { success: true, count: testSMSList.length };
    }

    async startServices() {
        if (this.isConnected) {
            console.warn('Services already running');
            return false;
        }

        try {
            // Initialize Supabase if enabled
            if (this.shouldInitializeSupabase()) {
                await this.initializeSupabase();
            }

            // Connect to Pushbullet
            if (this.config.pushbullet.apiKey) {
                return await this.initializePushbullet();
            }

            console.warn('No Pushbullet API key configured');
            return false;
        } catch (error) {
            console.error('Service startup error:', error);
            return false;
        }
    }

    shouldInitializeSupabase() {
        return this.config.supabase.enabled && 
               this.config.supabase.url && 
               this.config.supabase.key;
    }

    async initializeSupabase() {
        this.supabaseService = new SupabaseService(
            this.config.supabase.url, 
            this.config.supabase.key
        );
        const result = await this.supabaseService.testConnection();
        if (!result.success) {
            console.warn('Supabase connection failed:', result.error);
        }
    }

    async initializePushbullet() {
        this.pushbulletListener = new PushbulletListener(this.config.pushbullet.apiKey);
        
        // Setup event handlers
        this.pushbulletListener.onSMSReceived = (smsData) => this.handleSMSReceived(smsData);
        this.pushbulletListener.onConnected = () => this.handleConnectionChange(true);
        this.pushbulletListener.onDisconnected = () => this.handleConnectionChange(false);
        this.pushbulletListener.onError = (error) => console.error('Pushbullet error:', error);

        const testResult = await this.pushbulletListener.testConnection();
        if (testResult.success) {
            this.pushbulletListener.connect();
            return true;
        } else {
            console.error('Pushbullet connection test failed:', testResult.error);
            return false;
        }
    }

    handleConnectionChange(connected) {
        this.isConnected = connected;
        this.updateTrayMenu();
        
        // Notify main window if open
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('connection-status', { connected });
        }
    }

    stopServices() {
        if (this.pushbulletListener) {
            this.pushbulletListener.disconnect();
            this.pushbulletListener = null;
        }

        if (this.supabaseService) {
            this.supabaseService.disconnect();
            this.supabaseService = null;
        }

        this.isConnected = false;
        this.updateTrayMenu();
        return true;
    }

    async handleSMSReceived(smsData) {
        console.log('SMS received:', smsData.bank, smsData.transactionAmount);

        let supabaseSaved = false;
        
        // Save to Supabase if enabled
        if (this.supabaseService && this.config.supabase.enabled) {
            try {
                const result = await this.supabaseService.saveTransaction(smsData);
                supabaseSaved = result.success;
                if (result.success) {
                    console.log('Transaction saved to Supabase:', result.data?.id);
                } else {
                    console.error('Failed to save to Supabase:', result.error);
                }
            } catch (error) {
                console.error('Supabase save error:', error);
            }
        }

        // Show popup
        this.createPopupWindow(smsData);

        // Notify main window if open
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('sms-received', {
                ...smsData,
                supabaseSaved: supabaseSaved,
                supabaseEnabled: this.config.supabase?.enabled === true
            });
        }
    }

    cleanup() {
        console.log('Cleaning up application...');
        
        // Stop services first
        this.stopServices();
        
        // Close all popups
        this.closeAllPopups();
        
        // Destroy tray
        if (this.tray && !this.tray.isDestroyed()) {
            this.tray.destroy();
            this.tray = null;
        }
        
        // Close main window
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.close();
            this.mainWindow = null;
        }
        
        console.log('Application cleanup completed');
    }
}

// Create and start app
new SMSNotificationApp();