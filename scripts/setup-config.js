const fs = require('fs');
const path = require('path');

/**
 * Setup script to ensure config directory and file exist
 */
function setupConfig() {
    const configDir = 'C:\\tinhansms';
    const configPath = path.join(configDir, 'config.txt');
    
    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            console.log(`✅ Created config directory: ${configDir}`);
        } else {
            console.log(`📁 Config directory already exists: ${configDir}`);
        }
        
        // Check if config file exists
        if (fs.existsSync(configPath)) {
            console.log(`📄 Config file already exists: ${configPath}`);
            
            // Validate config file
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);
                console.log('✅ Config file is valid JSON');
                console.log('Current config keys:', Object.keys(config));
            } catch (parseError) {
                console.error('❌ Config file exists but is not valid JSON:', parseError.message);
                return false;
            }
        } else {
            console.log(`📄 Config file does not exist, will be created on first save`);
        }
        
        // Test write permissions
        const testFile = path.join(configDir, 'test-write.tmp');
        try {
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ Write permissions OK');
        } catch (writeError) {
            console.error('❌ No write permissions:', writeError.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        return false;
    }
}

// Run setup if called directly
if (require.main === module) {
    console.log('🔧 Setting up config directory...');
    const success = setupConfig();
    process.exit(success ? 0 : 1);
}

module.exports = setupConfig;