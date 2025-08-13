class SMSParser {
    // Regex patterns for better maintainability
    static PATTERNS = {
        VIETINBANK: {
            TIME: /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/,
            TIME_PARTS: /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/,
            ACCOUNT: /TK:(\d+)/,
            AMOUNT: /GD:([\+\-]?)([\d,]+)VND/,
            BALANCE: /SDC:([\d,]+)VND/,
            DESCRIPTION: /ND:(.+)$/
        },
        VIETCOMBANK: {
            TIME: /luc (\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})/,
            TIME_PARTS: /(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
            ACCOUNT: /TK (\d+)/,
            AMOUNT: /([\+\-])([\d,]+)VND/,
            BALANCE: /SD ([\d,]+)VND/g,
            BALANCE_SINGLE: /\. SD ([\d,]+)VND/,
            DESCRIPTION: /Ref (.+)$/
        }
    };

    static parseViettinBankSMS(smsText) {
        const result = this.createBaseResult('vietinbank', 'VietinBank', smsText);
        const patterns = this.PATTERNS.VIETINBANK;

        try {
            // Parse timestamp
            result.timestamp = this.parseViettinBankTime(smsText, patterns);
            
            // Parse account
            result.accountNumber = this.extractMatch(smsText, patterns.ACCOUNT, 1);
            
            // Parse amount and type
            const amountData = this.parseViettinBankAmount(smsText, patterns);
            Object.assign(result, amountData);
            
            // Parse balance
            result.balance = this.parseNumber(this.extractMatch(smsText, patterns.BALANCE, 1));
            
            // Parse description
            result.description = this.extractMatch(smsText, patterns.DESCRIPTION, 1, '').trim();

            result.isValid = this.validateViettinBankResult(result);
        } catch (error) {
            console.error('Error parsing VietinBank SMS:', error);
        }

        return result;
    }

    static createBaseResult(bank, sender, rawContent) {
        return {
            bank,
            sender,
            rawContent,
            timestamp: null,
            transactionAmount: 0,
            transactionType: 'unknown',
            balance: 0,
            description: '',
            isValid: false,
            parsedAt: Date.now()
        };
    }

    static extractMatch(text, pattern, groupIndex, defaultValue = null) {
        const match = text.match(pattern);
        return match ? match[groupIndex] : defaultValue;
    }

    static parseNumber(numberStr) {
        if (!numberStr) return 0;
        return parseInt(numberStr.replace(/,/g, '')) || 0;
    }

    static parseViettinBankTime(smsText, patterns) {
        const timeMatch = smsText.match(patterns.TIME);
        if (!timeMatch) return null;

        const parts = timeMatch[1].match(patterns.TIME_PARTS);
        if (!parts) return null;

        const [, day, month, year, hour, minute] = parts;
        return new Date(year, month - 1, day, hour, minute).getTime();
    }

    static parseViettinBankAmount(smsText, patterns) {
        const amountMatch = smsText.match(patterns.AMOUNT);
        if (!amountMatch) return { transactionAmount: 0, transactionType: 'unknown' };

        const [, sign, amountStr] = amountMatch;
        return {
            transactionAmount: this.parseNumber(amountStr),
            transactionType: sign === '-' ? 'debit' : 'credit'
        };
    }

    static validateViettinBankResult(result) {
        return !!(result.timestamp && result.accountNumber && 
                 result.transactionAmount > 0 && result.balance >= 0);
    }

    static parseVietcombankSMS(smsText) {
        const result = this.createBaseResult('vietcombank', 'Vietcombank', smsText);
        const patterns = this.PATTERNS.VIETCOMBANK;

        try {
            // Parse timestamp
            result.timestamp = this.parseVietcombankTime(smsText, patterns);
            
            // Parse account
            result.accountNumber = this.extractMatch(smsText, patterns.ACCOUNT, 1);
            
            // Parse amount and type
            const amountData = this.parseVietcombankAmount(smsText, patterns);
            Object.assign(result, amountData);
            
            // Parse balance
            result.balance = this.parseVietcombankBalance(smsText, patterns);
            
            // Parse description
            result.description = this.extractMatch(smsText, patterns.DESCRIPTION, 1, '').trim();

            result.isValid = this.validateVietcombankResult(result);
        } catch (error) {
            console.error('Error parsing Vietcombank SMS:', error);
        }

        return result;
    }

    static parseVietcombankTime(smsText, patterns) {
        const timeMatch = smsText.match(patterns.TIME);
        if (!timeMatch) return null;

        const parts = timeMatch[1].match(patterns.TIME_PARTS);
        if (!parts) return null;

        const [, day, month, year, hour, minute, second] = parts;
        return new Date(year, month - 1, day, hour, minute, second).getTime();
    }

    static parseVietcombankAmount(smsText, patterns) {
        const amountMatch = smsText.match(patterns.AMOUNT);
        if (!amountMatch) return { transactionAmount: 0, transactionType: 'unknown' };

        const [, sign, amountStr] = amountMatch;
        return {
            transactionAmount: this.parseNumber(amountStr),
            transactionType: sign === '+' ? 'credit' : 'debit'
        };
    }

    static parseVietcombankBalance(smsText, patterns) {
        const balanceMatches = smsText.match(patterns.BALANCE);
        
        if (balanceMatches && balanceMatches.length >= 2) {
            // Multiple balance matches, take the second one (final balance)
            const balanceMatch = balanceMatches[1].match(/SD ([\d,]+)VND/);
            return balanceMatch ? this.parseNumber(balanceMatch[1]) : 0;
        } else if (balanceMatches && balanceMatches.length === 1) {
            // Single balance match, look for the specific pattern
            const singleMatch = smsText.match(patterns.BALANCE_SINGLE);
            return singleMatch ? this.parseNumber(singleMatch[1]) : 0;
        }
        
        return 0;
    }

    static validateVietcombankResult(result) {
        return !!(result.timestamp && result.accountNumber && 
                 result.transactionAmount > 0 && result.balance >= 0);
    }

    static detectBank(smsText) {
        const bankSignatures = {
            vietinbank: ['TK:', 'GD:', 'SDC:'],
            vietcombank: ['SD TK', 'luc', 'Ref']
        };

        for (const [bank, signatures] of Object.entries(bankSignatures)) {
            if (signatures.every(sig => smsText.includes(sig))) {
                return bank;
            }
        }
        
        return 'unknown';
    }

    static parseSMS(smsText, sender = '') {
        if (!this.validateInput(smsText)) {
            return this.createInvalidResult(smsText, sender, 'Invalid input');
        }

        const bank = this.detectBank(smsText);
        
        const parsers = {
            vietinbank: () => this.parseViettinBankSMS(smsText),
            vietcombank: () => this.parseVietcombankSMS(smsText),
            unknown: () => this.createInvalidResult(smsText, sender, 'Unknown bank format')
        };

        const result = parsers[bank]();
        result.parsedAt = Date.now();
        return result;
    }

    static validateInput(smsText) {
        return smsText && typeof smsText === 'string' && smsText.trim().length > 0;
    }

    static createInvalidResult(smsText, sender, reason) {
        return {
            bank: 'unknown',
            sender: sender || 'Unknown Bank',
            rawContent: smsText || '',
            timestamp: Date.now(),
            transactionAmount: 0,
            transactionType: 'unknown',
            balance: 0,
            description: smsText || '',
            isValid: false,
            error: reason,
            parsedAt: Date.now()
        };
    }

    static validateSMS(smsText) {
        if (!smsText || typeof smsText !== 'string') {
            return { isValid: false, error: 'SMS text is required' };
        }

        if (smsText.trim().length < 10) {
            return { isValid: false, error: 'SMS text is too short' };
        }

        const bank = this.detectBank(smsText);
        if (bank === 'unknown') {
            return { isValid: false, error: 'Unknown bank format' };
        }

        return { isValid: true, bank };
    }

    static getSampleSMS() {
        return {
            vietinbank: '11/08/2025 10:33|TK:103811795555|GD:-4,000,000VND|SDC:63,908,063VND|ND:CT DI:610K2580GPLHU0GZ TRINH MINH THOM chuyen tien; tai iPay',
            vietcombank: 'SD TK 0811000010904 +1,400,000VND luc 11-08-2025 11:26:18. SD 29,796,653VND. Ref TKP#NP82501242920449VCB#5223IBT1jQNIAZK3.MCF8BG45FPZ5PNP 490235910-110825-11...'
        };
    }
}

module.exports = SMSParser;