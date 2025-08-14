
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Import services
const SMSParser = require('./services/sms-parser');
const PushbulletListener = require('./services/pushbullet-listener');
const SupabaseService = require('./services/supabase-service');
const ConfigManager = require('./utils/config-manager');
const CONSTANTS = require('./constants');

class SMSNotificationApp {
    constructor() {
        this.mainWindow = null;
        this.mainWindowHidden = false;
        this.popupWindows = [];
        this.tray = null;
        this.pushbulletListener = null;
        this.supabaseService = null;
        this.configManager = new ConfigManager();
        this.config = null;
        this.isConnected = false;
        this.isShuttingDown = false;
        
        // Balance data for tray menu
        this.balanceData = {
            vietcombank: 0,
            vietinbank: 0,
            total: 0
        };

        // Initialize app asynchronously
        this.initializeApp().catch(error => {
            console.error('Failed to initialize app:', error);
        });
    }

    async initializeApp() {
        try {
            // Run setup to ensure config directory exists
            const setupConfig = require('./scripts/setup-config');
            const setupSuccess = setupConfig();

            if (!setupSuccess) {
                console.warn('⚠️ Config setup had issues, but continuing...');
            }

            // Load config from C:\tinhansms\config.txt
            const flatConfig = await this.configManager.ensureConfigExists();
            this.config = this.configManager.convertToAppConfig(flatConfig);

            console.log('✅ Config loaded from:', this.configManager.getConfigPath());
            console.log('📋 Current config structure:');
            console.log('  - Pushbullet API:', this.config.pushbullet?.apiKey ? '***' + this.config.pushbullet.apiKey.slice(-4) : 'Not set');
            console.log('  - Supabase URL:', this.config.supabase?.url || 'Not set');
            console.log('  - Supabase enabled:', this.config.supabase?.enabled || false);
            console.log('  - Popup position:', this.config.popup?.position || 'top-right');
        } catch (error) {
            console.error('❌ Error initializing config:', error);
            // Use default config if loading fails
            this.config = this.configManager.convertToAppConfig(this.configManager.defaultConfig);
        }

        this.setupApp();
    }

    async loadConfig() {
        const flatConfig = await this.configManager.loadConfig();
        return this.configManager.convertToAppConfig(flatConfig);
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
            const flatConfig = this.configManager.convertToFlatConfig(this.config);
            return await this.configManager.saveConfig(flatConfig);
        } catch (error) {
            console.error(CONSTANTS.ERRORS.CONFIG_SAVE_FAILED + ':', error);
            return false;
        }
    }

    setupApp() {
        app.whenReady().then(async () => {
            // Wait for config to be loaded if not already
            if (!this.config) {
                const flatConfig = await this.configManager.ensureConfigExists();
                this.config = this.configManager.convertToAppConfig(flatConfig);
                console.log('Config loaded from:', this.configManager.getConfigPath());
            }

            this.createTray();
            this.setupIPC();

            if (this.config.pushbullet.enabled && this.config.pushbullet.apiKey) {
                this.startServices();
            }
        });

        app.on('window-all-closed', (e) => {
            e.preventDefault();
        });

        app.on('before-quit', (e) => {
            console.log('App is quitting...');
            e.preventDefault(); // Prevent immediate quit
            this.gracefulShutdown().then(() => {
                app.exit(0);
            }).catch((error) => {
                console.error('Error during graceful shutdown:', error);
                app.exit(1);
            });
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.gracefulShutdown().then(() => {
                process.exit(1);
            });
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }

    createTray() {
        const trayIcon = this.loadTrayIcon();
        this.tray = new Tray(trayIcon);
        this.tray.setToolTip('SMS Notification');
        this.updateTrayMenu();

        this.tray.on('double-click', () => {
            console.log('Tray double-clicked');
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
        // Don't update menu during shutdown
        if (this.isShuttingDown || !this.tray || this.tray.isDestroyed()) {
            return;
        }

        try {
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
                    click: () => {
                        if (!this.isShuttingDown) {
                            console.log('Tray menu: Open clicked');
                            this.showMainWindow();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: `Vietcombank: ${this.formatCurrency(this.balanceData.vietcombank)} VND`,
                    enabled: false
                },
                {
                    label: `VietinBank: ${this.formatCurrency(this.balanceData.vietinbank)} VND`,
                    enabled: false
                },
                {
                    label: `Tổng tiền: ${this.formatCurrency(this.balanceData.total)} VND`,
                    enabled: false
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => {
                        if (!this.isShuttingDown) {
                            console.log('Quit clicked from tray menu');
                            this.gracefulShutdown().then(() => {
                                app.quit();
                            }).catch((error) => {
                                console.error('Error during quit:', error);
                                app.quit();
                            });
                        }
                    }
                }
            ]);

            this.tray.setContextMenu(contextMenu);
        } catch (error) {
            console.warn('Error updating tray menu:', error);
        }
    }

    formatCurrency(amount) {
        if (!amount) return '0';
        return new Intl.NumberFormat('vi-VN').format(amount);
    }

    updateBalanceData(vietcombankBalance, vietinBalance) {
        this.balanceData.vietcombank = vietcombankBalance || 0;
        this.balanceData.vietinbank = vietinBalance || 0;
        this.balanceData.total = this.balanceData.vietcombank + this.balanceData.vietinbank;
        
        // Update tray menu with new balance data
        this.updateTrayMenu();
    }

    showMainWindow() {
        console.log('Show main window requested');
        console.log('Window hidden state:', this.mainWindowHidden);

        // If window exists and is not destroyed
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log('Main window exists, showing and focusing');
            // Show the window and update state
            this.mainWindow.show();
            this.mainWindow.focus();
            this.mainWindowHidden = false;
            // Send signal to reload transactions when window opens
            this.mainWindow.webContents.send('window-opened');
            return;
        }

        console.log('Creating new main window');

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
            show: false,
            frame: false,
            titleBarStyle: 'hidden',
            autoHideMenuBar: true
        });

        this.mainWindow.loadFile('index.html');

        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindowHidden = false;
            // Send signal to reload transactions when window opens
            this.mainWindow.webContents.send('window-opened');
        });

        this.mainWindow.on('close', (e) => {
            console.log('Main window close event triggered');
            // Always minimize to tray instead of closing the app
            e.preventDefault();
            this.mainWindow.hide();
            this.mainWindowHidden = true;
            console.log('Main window hidden');
        });

        // Don't set mainWindow to null when closed since we're preventing close
        this.mainWindow.on('closed', () => {
            console.log('Main window closed event - this should not happen if we prevent close');
            this.mainWindow = null;
        });
    }

    calculatePopupPosition(index) {
        const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
        const { WIDTH: popupWidth, HEIGHT: popupHeight, HEIGHT_COMPACT, MARGIN: margin, SPACING: spacing, SPACING_COMPACT } = CONSTANTS.POPUP;

        // Sử dụng height và spacing khác nhau dựa trên config
        const actualHeight = this.config.popup.hideTransactionDetails ? HEIGHT_COMPACT : popupHeight;
        const actualSpacing = this.config.popup.hideTransactionDetails ? SPACING_COMPACT : spacing;

        const positions = {
            'top-right': {
                x: screenWidth - popupWidth - margin,
                y: margin + (index * actualSpacing)
            },
            'top-left': {
                x: margin,
                y: margin + (index * actualSpacing)
            },
            'bottom-right': {
                x: screenWidth - popupWidth - margin,
                y: screenHeight - actualHeight - margin - (index * actualSpacing)
            },
            'bottom-left': {
                x: margin,
                y: screenHeight - actualHeight - margin - (index * actualSpacing)
            }
        };

        return positions[this.config.popup.position] || positions['top-right'];
    }

    createPopupWindow(smsData) {
        // Don't create popups during shutdown
        if (this.isShuttingDown) {
            console.log('Skipping popup creation - app is shutting down');
            return null;
        }

        // Remove oldest popup if we exceed max limit
        this.cleanupOldPopups();

        // Create new popup at position 0 (top)
        const { x, y } = this.calculatePopupPosition(0);
        const { WIDTH, HEIGHT, HEIGHT_COMPACT } = CONSTANTS.POPUP;

        // Sử dụng height khác nhau dựa trên config
        const actualHeight = this.config.popup.hideTransactionDetails ? HEIGHT_COMPACT : HEIGHT;

        const popupWindow = new BrowserWindow({
            width: WIDTH,
            height: actualHeight,
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
                popupIndex: 0,
                hideTransactionDetails: this.config.popup.hideTransactionDetails
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
        const { WIDTH, HEIGHT, HEIGHT_COMPACT } = CONSTANTS.POPUP;
        const actualHeight = this.config.popup.hideTransactionDetails ? HEIGHT_COMPACT : HEIGHT;

        this.popupWindows.forEach((popup, index) => {
            if (!popup.isDestroyed()) {
                const { x, y } = this.calculatePopupPosition(index);
                popup.setBounds({ x, y, width: WIDTH, height: actualHeight });

                // Update popup data to reflect new position and "NEW" status
                const isNewest = index === 0;
                popup.webContents.send('update-popup-status', {
                    isNewest: isNewest,
                    popupIndex: index,
                    hideTransactionDetails: this.config.popup.hideTransactionDetails
                });
            }
        });
    }

    setupIPC() {
        const handlers = {
            // Config handlers
            'get-config': () => this.config,
            'save-config': async (event, newConfig) => {
                try {
                    // Merge new config with existing config
                    this.config = this.mergeConfig(this.config, newConfig);

                    // Save to file using ConfigManager
                    const flatConfig = this.configManager.convertToFlatConfig(this.config);
                    const saved = await this.configManager.saveConfig(flatConfig);

                    if (saved) {
                        console.log('Config saved successfully to:', this.configManager.getConfigPath());

                        // Restart services if needed
                        if (this.config.pushbullet?.apiKey && !this.isConnected) {
                            await this.startServices();
                        }

                        // Reinitialize Supabase if settings changed
                        if (this.shouldInitializeSupabase()) {
                            await this.initializeSupabase();
                        }
                    }

                    return saved;
                } catch (error) {
                    console.error('Error in save-config handler:', error);
                    return false;
                }
            },
            'get-config-path': () => this.configManager.getConfigPath(),

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
            'validate-sms': (event, smsText) => SMSParser.validateSMS(smsText),
            'update-balance': (event, vietcombankBalance, vietinBalance) => {
                this.updateBalanceData(vietcombankBalance, vietinBalance);
            }
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

        // Window control handlers
        ipcMain.on('minimize-window', () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.minimize();
            }
        });

        ipcMain.on('close-window', () => {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.close();
            }
        });

        // Hide window handler - hides window to tray instead of closing app
        ipcMain.on('hide-window', () => {
            console.log('Hide window requested');
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                console.log('Hiding main window');
                this.mainWindow.hide();
                this.mainWindowHidden = true;
            } else {
                console.log('Main window not available for hiding');
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
        try {
            console.log('Initializing Supabase service...');
            this.supabaseService = new SupabaseService(
                this.config.supabase.url,
                this.config.supabase.key
            );

            const result = await this.supabaseService.testConnection();
            if (result.success) {
                console.log('✅ Supabase connected successfully');
            } else {
                console.warn('⚠️ Supabase connection failed:', result.error);
                // Don't set service to null, keep it for retry attempts
            }

            return result.success;
        } catch (error) {
            console.error('❌ Error initializing Supabase:', error);
            return false;
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

        // Save to Supabase if enabled and configured
        if (this.supabaseService && this.config.supabase?.enabled) {
            try {
                console.log('Attempting to save transaction to Supabase...');
                const result = await this.supabaseService.saveTransaction(smsData);
                supabaseSaved = result.success;

                if (result.success) {
                    console.log('✅ Transaction saved to Supabase successfully:', result.data?.id);
                } else {
                    console.error('❌ Failed to save to Supabase:', result.error);

                    // Try to reconnect Supabase if connection failed
                    if (result.error.includes('connection') || result.error.includes('network')) {
                        console.log('Attempting to reconnect to Supabase...');
                        await this.initializeSupabase();
                    }
                }
            } catch (error) {
                console.error('❌ Supabase save error:', error);

                // Try to reinitialize Supabase service
                try {
                    await this.initializeSupabase();
                } catch (reinitError) {
                    console.error('Failed to reinitialize Supabase:', reinitError);
                }
            }
        } else {
            console.log('Supabase save skipped - Service:', !!this.supabaseService, 'Enabled:', this.config.supabase?.enabled);
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

    async gracefulShutdown() {
        console.log('🔄 Starting graceful shutdown...');

        // Set overall timeout for shutdown
        const shutdownTimeout = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Shutdown timeout after 5 seconds'));
            }, 5000);
        });

        try {
            await Promise.race([
                this.performShutdown(),
                shutdownTimeout
            ]);
            console.log('✅ Graceful shutdown completed');
        } catch (error) {
            console.error('❌ Error during graceful shutdown:', error);
            // Force cleanup even if there was an error
            this.forceCleanup();
            throw error;
        }
    }

    async performShutdown() {
        // 1. Stop accepting new operations
        this.isShuttingDown = true;

        // 2. Stop services first (with timeout)
        console.log('🛑 Stopping services...');
        await this.stopServicesGracefully();

        // 3. Close all popups
        console.log('🗑️ Closing popups...');
        await this.closeAllPopupsGracefully();

        // 4. Close main window
        console.log('🪟 Closing main window...');
        await this.closeMainWindowGracefully();

        // 5. Remove IPC handlers
        console.log('📡 Removing IPC handlers...');
        this.removeIPCHandlers();

        // 6. Destroy tray (last)
        console.log('🗂️ Destroying tray...');
        await this.destroyTrayGracefully();
    }

    forceCleanup() {
        console.log('🚨 Force cleanup initiated...');

        try {
            // Force close all windows
            this.popupWindows.forEach(popup => {
                if (!popup.isDestroyed()) {
                    popup.destroy();
                }
            });
            this.popupWindows = [];

            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.destroy();
                this.mainWindow = null;
            }

            // Force destroy tray
            if (this.tray && !this.tray.isDestroyed()) {
                this.tray.destroy();
                this.tray = null;
            }

            // Force stop services
            this.pushbulletListener = null;
            this.supabaseService = null;
            this.isConnected = false;

            console.log('🚨 Force cleanup completed');
        } catch (error) {
            console.error('Error in force cleanup:', error);
        }
    }

    async stopServicesGracefully() {
        const promises = [];

        if (this.pushbulletListener) {
            promises.push(new Promise((resolve) => {
                try {
                    this.pushbulletListener.disconnect();
                    this.pushbulletListener = null;
                    resolve();
                } catch (error) {
                    console.warn('Error stopping Pushbullet:', error);
                    resolve();
                }
            }));
        }

        if (this.supabaseService) {
            promises.push(new Promise((resolve) => {
                try {
                    this.supabaseService.disconnect();
                    this.supabaseService = null;
                    resolve();
                } catch (error) {
                    console.warn('Error stopping Supabase:', error);
                    resolve();
                }
            }));
        }

        // Wait for all services to stop with timeout
        await Promise.race([
            Promise.all(promises),
            new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
        ]);

        this.isConnected = false;
    }

    async closeAllPopupsGracefully() {
        const popupsToClose = [...this.popupWindows];
        this.popupWindows = [];

        const closePromises = popupsToClose.map(popup => {
            return new Promise((resolve) => {
                if (!popup.isDestroyed()) {
                    popup.once('closed', resolve);
                    try {
                        popup.close();
                    } catch (error) {
                        console.warn('Error closing popup:', error);
                        resolve();
                    }
                    // Timeout fallback
                    setTimeout(resolve, 1000);
                } else {
                    resolve();
                }
            });
        });

        await Promise.all(closePromises);
    }

    async closeMainWindowGracefully() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            return new Promise((resolve) => {
                this.mainWindow.once('closed', () => {
                    this.mainWindow = null;
                    resolve();
                });

                try {
                    this.mainWindow.close();
                } catch (error) {
                    console.warn('Error closing main window:', error);
                    this.mainWindow = null;
                    resolve();
                }

                // Timeout fallback
                setTimeout(() => {
                    this.mainWindow = null;
                    resolve();
                }, 1000);
            });
        }
    }

    removeIPCHandlers() {
        try {
            // Remove all IPC handlers
            ipcMain.removeAllListeners('close-popup');

            // Remove handle listeners
            const channels = [
                'get-config', 'save-config', 'get-config-path',
                'start-services', 'stop-services', 'get-status',
                'parse-sms', 'show-popup', 'close-all-popups',
                'test-pushbullet', 'test-supabase', 'test-popup', 'test-multiple-popups',
                'get-sample-sms', 'validate-sms'
            ];

            channels.forEach(channel => {
                try {
                    ipcMain.removeHandler(channel);
                } catch (error) {
                    // Handler might not exist, ignore
                }
            });
        } catch (error) {
            console.warn('Error removing IPC handlers:', error);
        }
    }

    async destroyTrayGracefully() {
        if (this.tray && !this.tray.isDestroyed()) {
            return new Promise((resolve) => {
                try {
                    // Remove all event listeners first
                    this.tray.removeAllListeners();

                    // Set empty context menu to prevent clicks
                    this.tray.setContextMenu(null);

                    // Destroy tray
                    this.tray.destroy();
                    this.tray = null;

                    resolve();
                } catch (error) {
                    console.warn('Error destroying tray:', error);
                    this.tray = null;
                    resolve();
                }
            });
        }
    }

    // Legacy cleanup method for compatibility
    cleanup() {
        console.log('⚠️ Legacy cleanup called, using graceful shutdown...');
        this.gracefulShutdown().catch(error => {
            console.error('Error in legacy cleanup:', error);
        });
    }
}

// Create and start app
new SMSNotificationApp();