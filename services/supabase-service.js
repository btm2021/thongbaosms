const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor(supabaseUrl, supabaseKey) {
        this.validateConfig(supabaseUrl, supabaseKey);
        
        this.supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });
        this.isConnected = false;
        this.tableName = 'banking_transactions';
    }

    validateConfig(url, key) {
        if (!url || !key) {
            throw new Error('Supabase URL and Key are required');
        }
        
        if (!url.startsWith('https://')) {
            throw new Error('Supabase URL must be a valid HTTPS URL');
        }
    }

    async testConnection() {
        try {
            // Test with a simple query to check table existence and structure
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('id', { count: 'exact', head: true })
                .limit(1);
            
            if (error) {
                this.isConnected = false;
                console.error('Supabase connection test failed:', error.message);
                
                // Check if it's a table not found error
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    return { 
                        success: false, 
                        error: `Table '${this.tableName}' does not exist. Please create it using the provided schema.`,
                        needsTableCreation: true
                    };
                }
                
                return { success: false, error: error.message };
            }
            
            this.isConnected = true;
            console.log('Supabase connection test successful');
            return { success: true, message: 'Connected successfully to banking_transactions table' };
        } catch (error) {
            this.isConnected = false;
            console.error('Supabase connection error:', error);
            return { success: false, error: error.message };
        }
    }

    async getTransactionHistory(limit = 50, offset = 0, filters = {}) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            let query = this.supabase
                .from(this.tableName)
                .select('*')
                .order('received_at', { ascending: false });

            // Apply filters
            if (filters.bank) {
                query = query.eq('bank', filters.bank);
            }
            if (filters.transaction_type) {
                query = query.eq('transaction_type', filters.transaction_type);
            }
            if (filters.from_date) {
                query = query.gte('transaction_time', filters.from_date);
            }
            if (filters.to_date) {
                query = query.lte('transaction_time', filters.to_date);
            }

            const { data, error } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data, count: data.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTransactionStats(days = 30) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('transaction_type, amount, bank, received_at')
                .gte('received_at', fromDate.toISOString());

            if (error) {
                return { success: false, error: error.message };
            }

            // Calculate statistics
            const stats = {
                total_transactions: data.length,
                incoming_count: data.filter(t => t.transaction_type === 'incoming').length,
                outgoing_count: data.filter(t => t.transaction_type === 'outgoing').length,
                total_incoming: data
                    .filter(t => t.transaction_type === 'incoming')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
                total_outgoing: data
                    .filter(t => t.transaction_type === 'outgoing')
                    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
                net_amount: 0,
                banks: [...new Set(data.map(t => t.bank))],
                period_days: days,
                from_date: fromDate.toISOString(),
                to_date: new Date().toISOString()
            };

            stats.net_amount = stats.total_incoming - stats.total_outgoing;

            return { success: true, data: stats };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTransactionsByBank(bank, limit = 50) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .eq('bank', bank)
                .order('received_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data, count: data.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRecentTransactions(limit = 10) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('id, bank, transaction_type, amount, description, received_at')
                .order('received_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data, count: data.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async searchTransactions(searchTerm, limit = 50) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const { data, error } = await this.supabase
                .from(this.tableName)
                .select('*')
                .or(`description.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,raw_sms.ilike.%${searchTerm}%`)
                .order('received_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, data, count: data.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async saveTransaction(smsData) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected to Supabase' };
        }

        try {
            const transactionData = this.prepareTransactionData(smsData);
            
            // Validate required fields
            const validation = this.validateTransactionData(transactionData);
            if (!validation.isValid) {
                return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
            }

            const { data, error } = await this.supabase
                .from(this.tableName)
                .insert([transactionData])
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                return { success: false, error: error.message };
            }

            console.log('Transaction saved successfully:', data[0]?.id);
            return { success: true, data: data[0] };

        } catch (error) {
            console.error('Save transaction error:', error);
            return { success: false, error: error.message };
        }
    }

    validateTransactionData(data) {
        const errors = [];
        
        // Check required fields
        if (!data.bank) errors.push('bank is required');
        if (!data.sender) errors.push('sender is required');
        if (!data.transaction_type) errors.push('transaction_type is required');
        if (data.amount === null || data.amount === undefined) errors.push('amount is required');
        if (!data.description) errors.push('description is required');
        if (!data.content) errors.push('content is required');
        
        // Validate transaction_type values
        if (data.transaction_type && !['incoming', 'outgoing'].includes(data.transaction_type)) {
            errors.push('transaction_type must be either "incoming" or "outgoing"');
        }
        
        // Validate amount is a number
        if (data.amount !== null && isNaN(parseFloat(data.amount))) {
            errors.push('amount must be a valid number');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    prepareTransactionData(smsData) {
        return {
            // Basic transaction info
            bank: smsData.bank || 'unknown',
            sender: smsData.sender || smsData.originalSender || 'unknown',
            transaction_type: this.determineTransactionType(smsData),
            amount: this.parseAmount(smsData.transactionAmount || smsData.amount),
            balance: this.parseAmount(smsData.balance),
            
            // Transaction details
            description: smsData.description || smsData.content || 'No description',
            content: this.getFullSMSContent(smsData),
            
            // Timestamps
            transaction_time: this.parseTransactionTime(smsData.timestamp || smsData.transactionTime),
            received_at: new Date().toISOString(),
            
            // Additional metadata
            raw_sms: this.getRawSMS(smsData),
            parsed_data: this.sanitizeParsedData(smsData)
        };
    }

    getFullSMSContent(smsData) {
        // Get the full SMS content from various possible fields
        return smsData.body || 
               smsData.content || 
               smsData.rawContent || 
               smsData.rawSMS || 
               smsData.originalContent || 
               smsData.description || 
               'No content available';
    }

    getRawSMS(smsData) {
        // Get the original raw SMS text
        return smsData.body || 
               smsData.rawContent || 
               smsData.rawSMS || 
               smsData.originalContent || 
               smsData.content || 
               'No raw SMS available';
    }

    sanitizeParsedData(smsData) {
        // Create a clean copy of parsed data for JSON storage
        const sanitized = {
            bank: smsData.bank,
            sender: smsData.sender,
            originalSender: smsData.originalSender,
            phoneNumber: smsData.phoneNumber,
            transactionType: smsData.transactionType,
            transactionAmount: smsData.transactionAmount,
            balance: smsData.balance,
            description: smsData.description,
            timestamp: smsData.timestamp,
            receivedAt: smsData.receivedAt,
            isValid: smsData.isValid,
            accountNumber: smsData.accountNumber,
            referenceNumber: smsData.referenceNumber,
            location: smsData.location,
            parseSuccess: smsData.parseSuccess || true,
            parseErrors: smsData.parseErrors || []
        };

        // Remove undefined values
        Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === undefined) {
                delete sanitized[key];
            }
        });

        return sanitized;
    }

    determineTransactionType(smsData) {
        // First check the parsed transaction type
        if (smsData.transactionType === 'credit') return 'incoming';
        if (smsData.transactionType === 'debit') return 'outgoing';

        // Get all text content for analysis
        const allContent = [
            smsData.description || '',
            smsData.content || '',
            smsData.body || '',
            smsData.rawContent || '',
            smsData.rawSMS || ''
        ].join(' ').toLowerCase();
        
        // Vietnamese banking keywords for incoming transactions
        const incomingKeywords = [
            'nhan', 'nhan tien', 'chuyen den', 'gui den', 'nap tien', 
            'chuyen khoan den', 'nop tien', 'ck den', 'luong', 'thuong',
            'hoan tien', 'tra lai', 'bonus', 'lai suat', 'dividend'
        ];
        
        // Vietnamese banking keywords for outgoing transactions  
        const outgoingKeywords = [
            'chuyen di', 'thanh toan', 'rut tien', 'mua', 'tra', 'chi tieu',
            'atm', 'withdraw', 'payment', 'ck di', 'chuyen khoan di',
            'phi', 'cuoc', 'hoa don', 'bill', 'purchase'
        ];

        // Check for incoming keywords
        if (incomingKeywords.some(keyword => allContent.includes(keyword))) {
            return 'incoming';
        }
        
        // Check for outgoing keywords
        if (outgoingKeywords.some(keyword => allContent.includes(keyword))) {
            return 'outgoing';
        }
        
        // Check SMS patterns for VietinBank and Vietcombank
        if (allContent.includes('gd:+') || allContent.includes('giao dich:+')) {
            return 'incoming';
        }
        
        if (allContent.includes('gd:-') || allContent.includes('giao dich:-')) {
            return 'outgoing';
        }
        
        // Check amount sign in the raw content
        if (allContent.includes('+') && /\+[\d,]+/.test(allContent)) {
            return 'incoming';
        }
        
        if (allContent.includes('-') && /-[\d,]+/.test(allContent)) {
            return 'outgoing';
        }
        
        // Default to incoming if unclear (most SMS notifications are for incoming money)
        return 'incoming';
    }

    parseAmount(amountStr) {
        if (!amountStr) return null;
        
        const cleanAmount = amountStr.toString()
            .replace(/[^\d.,]/g, '')
            .replace(/,/g, '');
        
        const amount = parseFloat(cleanAmount);
        return isNaN(amount) ? null : amount;
    }

    parseTransactionTime(timestamp) {
        if (!timestamp) return null;
        
        try {
            if (timestamp instanceof Date) {
                return timestamp.toISOString();
            }
            
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? null : date.toISOString();
        } catch (error) {
            return null;
        }
    }

    disconnect() {
        this.isConnected = false;
    }
}

module.exports = SupabaseService;