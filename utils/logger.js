const fs = require('fs').promises;
const path = require('path');

class Logger {
    constructor(options = {}) {
        this.logLevel = options.logLevel || 'info';
        this.logToFile = options.logToFile || false;
        this.logFile = options.logFile || path.join(__dirname, '..', 'logs', 'app.log');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };

        this.colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[37m', // White
            reset: '\x1b[0m'
        };

        if (this.logToFile) {
            this.ensureLogDirectory();
        }
    }

    async ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.logFile);
            await fs.mkdir(logDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }

    async writeToFile(formattedMessage) {
        if (!this.logToFile) return;

        try {
            // Check file size and rotate if necessary
            try {
                const stats = await fs.stat(this.logFile);
                if (stats.size > this.maxFileSize) {
                    await this.rotateLogFile();
                }
            } catch (error) {
                // File doesn't exist, which is fine
            }

            await fs.appendFile(this.logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    async rotateLogFile() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
            await fs.rename(this.logFile, rotatedFile);
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console output with colors
        const color = this.colors[level] || this.colors.reset;
        console.log(`${color}${formattedMessage}${this.colors.reset}`);

        // File output
        this.writeToFile(formattedMessage);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Create child logger with context
    child(context = {}) {
        const childLogger = new Logger({
            logLevel: this.logLevel,
            logToFile: this.logToFile,
            logFile: this.logFile,
            maxFileSize: this.maxFileSize
        });

        // Override log method to include context
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, meta = {}) => {
            originalLog(level, message, { ...context, ...meta });
        };

        return childLogger;
    }
}

// Create default logger instance
const logger = new Logger({
    logLevel: process.env.LOG_LEVEL || 'info',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logFile: process.env.LOG_FILE
});

module.exports = { Logger, logger };