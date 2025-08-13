const fs = require('fs');
const path = require('path');
const ConfigManager = require('../utils/config-manager');

// Validate configuration file
async function validateConfig() {
    console.log('🔍 Validating configuration...\n');
    
    const configManager = new ConfigManager();
    
    try {
        // Check if config exists and load it
        const flatConfig = await configManager.ensureConfigExists();
        const appConfig = configManager.convertToAppConfig(flatConfig);
        
        console.log('📁 Config file location:', configManager.getConfigPath());
        console.log('📄 Config file exists:', configManager.configExists());
        console.log('\n📋 Current configuration:');
        console.log('   Supabase URL:', flatConfig.supabase_url || '(not set)');
        console.log('   Supabase Key:', flatConfig.supabase_key ? '***' + flatConfig.supabase_key.slice(-4) : '(not set)');
        console.log('   Pushbullet API:', flatConfig.pushbullet_api ? '***' + flatConfig.pushbullet_api.slice(-4) : '(not set)');
        console.log('   Max Popups:', flatConfig.maxPopups);
        console.log('   Auto Close Delay:', flatConfig.autoCloseDelay + 'ms');
        console.log('   Position:', flatConfig.position);
        console.log('   Sound Enabled:', flatConfig.soundEnabled);
        console.log('   Supabase Enabled:', flatConfig.supabaseEnabled);
        
        // Check for warnings
        let hasWarnings = false;
        
        if (!flatConfig.pushbullet_api) {
            console.warn('\n⚠️  Pushbullet API key not set');
            console.warn('   Get API key from: https://www.pushbullet.com/#settings/account');
            hasWarnings = true;
        }
        
        if (flatConfig.supabaseEnabled && (!flatConfig.supabase_url || !flatConfig.supabase_key)) {
            console.warn('\n⚠️  Supabase is enabled but credentials are missing');
            console.warn('   Get credentials from your Supabase project dashboard');
            hasWarnings = true;
        }
        
        if (hasWarnings) {
            console.warn('\n📝 You can configure these settings in the app interface');
            console.log('✅ Configuration loaded successfully (with warnings)');
            return true;
        }
        
        console.log('\n✅ Configuration is valid and complete');
        return true;
        
    } catch (error) {
        console.error('❌ Error validating config:', error.message);
        return false;
    }
}

// Legacy function for backward compatibility
function validateConfigLegacy() {
    const configPath = path.join(__dirname, '..', 'config.json');
    
    if (!fs.existsSync(configPath)) {
        console.warn('⚠️  Legacy config file not found. Using new config system.');
        return true; // Not an error, just using new system
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('📄 Found legacy config.json file');
        console.log('💡 Consider migrating to the new config system at C:\\tinhansms\\config.txt');
        return true;
    } catch (error) {
        console.error('❌ Invalid JSON in legacy config.json:', error.message);
        return false;
    }
}

if (require.main === module) {
    validateConfig().then(isValid => {
        process.exit(isValid ? 0 : 1);
    }).catch(error => {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    });
}

module.exports = { validateConfig, validateConfigLegacy };