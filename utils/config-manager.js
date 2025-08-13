const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configDir = 'C:\\tinhansms';
        this.configPath = path.join(this.configDir, 'config.txt');

        // Default config structure
        this.defaultConfig = {


            "supabase_url": "https://ajsrzteoovahabndebyp.supabase.co",

            "supabase_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqc3J6dGVvb3ZhaGFibmRlYnlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNDY4NjI1OCwiZXhwIjoyMDIwMjYyMjU4fQ.Q0lBT-HTcMLxLGpKgJ_-vz-prKH43nV9czOtm2HvMzU",

            "pushbullet_api": "o.0oaU2IBVW85bY9oxPFDUD03NgthBv9mL",

            "maxPopups": 4,

            "autoCloseDelay": 300000,

            "position": "top-right",

            "soundEnabled": true,

            "supabaseEnabled": false




        };
    }

    /**
     * Ensure config directory and file exist
     */
    async ensureConfigExists() {
        try {
            // Check if directory exists, create if not
            if (!fsSync.existsSync(this.configDir)) {
                await fs.mkdir(this.configDir, { recursive: true });
                console.log(`Created config directory: ${this.configDir}`);
            }

            // Check if config file exists, create with defaults if not
            if (!fsSync.existsSync(this.configPath)) {
                await this.saveConfig(this.defaultConfig);
                console.log(`Created default config file: ${this.configPath}`);
                return this.defaultConfig;
            }

            return await this.loadConfig();
        } catch (error) {
            console.error('Error ensuring config exists:', error);
            return this.defaultConfig;
        }
    }

    /**
     * Load config from file
     */
    async loadConfig() {
        try {
            if (!fsSync.existsSync(this.configPath)) {
                return this.defaultConfig;
            }

            const configData = await fs.readFile(this.configPath, 'utf8');
            const parsedConfig = JSON.parse(configData);

            // Merge with defaults to ensure all required fields exist
            const mergedConfig = { ...this.defaultConfig, ...parsedConfig };

            console.log('Config loaded successfully from:', this.configPath);
            return mergedConfig;
        } catch (error) {
            console.error('Error loading config:', error);
            return this.defaultConfig;
        }
    }

    /**
     * Save config to file
     */
    async saveConfig(config) {
        try {
            // Ensure directory exists
            if (!fsSync.existsSync(this.configDir)) {
                await fs.mkdir(this.configDir, { recursive: true });
                console.log(`Created config directory: ${this.configDir}`);
            }

            // Merge with current config to preserve existing values
            const currentConfig = await this.loadConfig();
            const mergedConfig = { ...currentConfig, ...config };

            // Save to file with proper formatting
            const configJson = JSON.stringify(mergedConfig, null, 2);
            await fs.writeFile(this.configPath, configJson, 'utf8');
            
            // Verify the file was written correctly
            if (fsSync.existsSync(this.configPath)) {
                const fileSize = fsSync.statSync(this.configPath).size;
                console.log(`Config saved successfully to: ${this.configPath} (${fileSize} bytes)`);
                return true;
            } else {
                console.error('Config file was not created after write operation');
                return false;
            }
        } catch (error) {
            console.error('Error saving config:', error);
            // Try to create directory with elevated permissions if needed
            try {
                if (!fsSync.existsSync(this.configDir)) {
                    fsSync.mkdirSync(this.configDir, { recursive: true });
                }
                fsSync.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
                console.log('Config saved with fallback method');
                return true;
            } catch (fallbackError) {
                console.error('Fallback save also failed:', fallbackError);
                return false;
            }
        }
    }

    /**
     * Convert flat config to app structure
     */
    convertToAppConfig(flatConfig) {
        return {
            pushbullet: {
                apiKey: flatConfig.pushbullet_api || '',
                enabled: true,
                autoStart: true
            },
            popup: {
                position: flatConfig.position || 'top-right',
                soundEnabled: flatConfig.soundEnabled !== false,
                maxPopups: flatConfig.maxPopups || 4,
                autoCloseDelay: flatConfig.autoCloseDelay || 8000
            },
            supabase: {
                url: flatConfig.supabase_url || '',
                key: flatConfig.supabase_key || '',
                enabled: flatConfig.supabaseEnabled === true,
                autoSave: true
            },
            app: {
                startWithWindows: false,
                minimizeToTray: true,
                showNotifications: true
            }
        };
    }

    /**
     * Convert app config to flat structure
     */
    convertToFlatConfig(appConfig) {
        return {
            supabase_url: appConfig.supabase?.url || '',
            supabase_key: appConfig.supabase?.key || '',
            pushbullet_api: appConfig.pushbullet?.apiKey || '',
            maxPopups: appConfig.popup?.maxPopups || 4,
            autoCloseDelay: appConfig.popup?.autoCloseDelay || 8000,
            position: appConfig.popup?.position || 'top-right',
            soundEnabled: appConfig.popup?.soundEnabled !== false,
            supabaseEnabled: appConfig.supabase?.enabled === true
        };
    }

    /**
     * Get config path for display
     */
    getConfigPath() {
        return this.configPath;
    }

    /**
     * Check if config file exists
     */
    configExists() {
        return fsSync.existsSync(this.configPath);
    }
}

module.exports = ConfigManager;