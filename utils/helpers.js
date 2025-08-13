/**
 * Utility helper functions
 */

class Helpers {
    /**
     * Format currency number to Vietnamese format
     * @param {number} amount 
     * @returns {string}
     */
    static formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) return '0';
        return new Intl.NumberFormat('vi-VN').format(amount);
    }

    /**
     * Format timestamp to Vietnamese date/time format
     * @param {number|Date} timestamp 
     * @returns {string}
     */
    static formatDateTime(timestamp) {
        if (!timestamp) return '--:--';
        
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '--:--';
            
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '--:--';
        }
    }

    /**
     * Format time only
     * @param {number|Date} timestamp 
     * @returns {string}
     */
    static formatTime(timestamp) {
        if (!timestamp) return '--:--';
        
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '--:--';
            
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '--:--';
        }
    }

    /**
     * Parse number from string, removing commas
     * @param {string|number} value 
     * @returns {number}
     */
    static parseNumber(value) {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        
        const cleanValue = value.toString().replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleanValue);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Validate email format
     * @param {string} email 
     * @returns {boolean}
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL format
     * @param {string} url 
     * @returns {boolean}
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Deep merge two objects
     * @param {object} target 
     * @param {object} source 
     * @returns {object}
     */
    static deepMerge(target, source) {
        const result = { ...target };
        
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = this.deepMerge(target[key] || {}, value);
            } else {
                result[key] = value;
            }
        }
        
        return result;
    }

    /**
     * Debounce function calls
     * @param {Function} func 
     * @param {number} wait 
     * @returns {Function}
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     * @param {Function} func 
     * @param {number} limit 
     * @returns {Function}
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms 
     * @returns {Promise}
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry function with exponential backoff
     * @param {Function} fn 
     * @param {number} maxRetries 
     * @param {number} baseDelay 
     * @returns {Promise}
     */
    static async retry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (i === maxRetries) break;
                
                const delay = baseDelay * Math.pow(2, i);
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * Sanitize string for safe display
     * @param {string} str 
     * @returns {string}
     */
    static sanitizeString(str) {
        if (!str) return '';
        return str.toString()
            .replace(/[<>]/g, '')
            .trim();
    }

    /**
     * Generate unique ID
     * @returns {string}
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Check if object is empty
     * @param {object} obj 
     * @returns {boolean}
     */
    static isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    }

    /**
     * Get nested object property safely
     * @param {object} obj 
     * @param {string} path 
     * @param {*} defaultValue 
     * @returns {*}
     */
    static get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result == null || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    }
}

module.exports = Helpers;