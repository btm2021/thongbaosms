// Simple config validation script
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'config.json');

try {
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ Config file is valid JSON');
        
        // Check for required fields
        if (!config.pushbullet || !config.popup || !config.supabase) {
            console.warn('⚠️ Config missing required sections');
        } else {
            console.log('✅ Config structure looks good');
        }
    } else {
        console.log('ℹ️ No config.json found - will use defaults');
    }
} catch (error) {
    console.error('❌ Config validation failed:', error.message);
    process.exit(1);
}

console.log('✅ Config validation completed');