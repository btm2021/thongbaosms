const PushBullet = require('pushbullet');
const WebSocket = require('ws');
const SMSParser = require('./sms-parser');

class PushbulletListener {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Pushbullet API key is required');
        }

        this.apiKey = apiKey;
        this.pusher = new PushBullet(apiKey);
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.reconnectTimer = null;
        
        // Callbacks
        this.callbacks = {
            onSMSReceived: null,
            onConnected: null,
            onDisconnected: null,
            onError: null
        };

        // SMS app names for filtering
        this.smsAppNames = ['Messages', 'Messaging', 'SMS', 'Android Messages'];
    }

    // Getter/setter for callbacks
    set onSMSReceived(callback) { this.callbacks.onSMSReceived = callback; }
    set onConnected(callback) { this.callbacks.onConnected = callback; }
    set onDisconnected(callback) { this.callbacks.onDisconnected = callback; }
    set onError(callback) { this.callbacks.onError = callback; }

    get onSMSReceived() { return this.callbacks.onSMSReceived; }
    get onConnected() { return this.callbacks.onConnected; }
    get onDisconnected() { return this.callbacks.onDisconnected; }
    get onError() { return this.callbacks.onError; }

    connect() {
        if (this.isConnected) {
            console.warn('Already connected to Pushbullet');
            return;
        }

        try {
            this.ws = new WebSocket(`wss://stream.pushbullet.com/websocket/${this.apiKey}`);
            this.setupWebSocketHandlers();
        } catch (error) {
            this.handleError(error);
        }
    }

    setupWebSocketHandlers() {
        this.ws.on('open', () => this.handleConnectionOpen());
        this.ws.on('message', (data) => this.handleWebSocketMessage(data));
        this.ws.on('close', () => this.handleConnectionClose());
        this.ws.on('error', (error) => this.handleWebSocketError(error));
    }

    handleConnectionOpen() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        console.log('Connected to Pushbullet');
        this.triggerCallback('onConnected');
    }

    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            this.handleMessage(message);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    handleConnectionClose() {
        this.isConnected = false;
        console.log('Disconnected from Pushbullet');
        this.triggerCallback('onDisconnected');
        this.attemptReconnect();
    }

    handleWebSocketError(error) {
        this.isConnected = false;
        console.error('WebSocket error:', error);
        this.handleError(error);
    }

    handleError(error) {
        this.triggerCallback('onError', error);
    }

    triggerCallback(callbackName, ...args) {
        const callback = this.callbacks[callbackName];
        if (typeof callback === 'function') {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${callbackName} callback:`, error);
            }
        }
    }

    handleMessage(message) {
        if (message.type === 'push') {
            this.handlePush(message.push);
        } else if (message.type === 'tickle') {
            this.fetchRecentPushes();
        }
    }

    handlePush(push) {
        const handlers = {
            'sms_changed': () => this.handleSMSChanged(push),
            'mirror': () => this.handleMirroredPush(push)
        };

        const handler = handlers[push.type];
        if (handler) {
            handler();
        }
    }

    handleMirroredPush(push) {
        if (push.application_name && this.isSMSApp(push.application_name)) {
            this.handleMirroredSMS(push);
        }
    }

    isSMSApp(appName) {
        return this.smsAppNames.some(smsApp => appName.includes(smsApp));
    }

    handleSMSChanged(push) {
        if (push.notifications?.length > 0) {
            push.notifications.forEach(notification => {
                if (this.isValidNotification(notification)) {
                    const smsData = this.createSMSDataFromNotification(notification);
                    this.processSMS(smsData);
                }
            });
        } else if (this.isValidPush(push)) {
            const smsData = this.createSMSDataFromPush(push);
            this.processSMS(smsData);
        }
    }

    isValidNotification(notification) {
        return notification && notification.title && notification.body;
    }

    isValidPush(push) {
        return push && (push.body || push.title);
    }

    createSMSDataFromNotification(notification) {
        return {
            sender: notification.title,
            body: notification.body,
            timestamp: (notification.timestamp || Date.now() / 1000) * 1000,
            phoneNumber: notification.thread_id || ''
        };
    }

    createSMSDataFromPush(push) {
        return {
            sender: push.title || push.sender_name || 'Unknown',
            body: push.body || '',
            timestamp: (push.created || Date.now() / 1000) * 1000,
            phoneNumber: push.sender_number || ''
        };
    }

    handleMirroredSMS(push) {
        if (!this.isValidPush(push)) return;

        const smsData = {
            sender: push.title,
            body: push.body,
            timestamp: push.created * 1000,
            phoneNumber: ''
        };

        this.processSMS(smsData);
    }

    processSMS(smsData) {
        if (!this.isValidSMSData(smsData)) return;

        const parsedSMS = SMSParser.parseSMS(smsData.body, smsData.sender);
        
        // Enrich parsed data with original SMS info
        this.enrichParsedSMS(parsedSMS, smsData);

        if (this.shouldProcessSMS(parsedSMS)) {
            this.triggerCallback('onSMSReceived', parsedSMS);
        }
    }

    isValidSMSData(smsData) {
        return smsData && smsData.body && smsData.body.trim() !== '';
    }

    enrichParsedSMS(parsedSMS, originalData) {
        parsedSMS.originalSender = originalData.sender;
        parsedSMS.phoneNumber = originalData.phoneNumber;
        parsedSMS.receivedAt = originalData.timestamp;
    }

    shouldProcessSMS(parsedSMS) {
        return parsedSMS.isValid && 
               ['vietinbank', 'vietcombank'].includes(parsedSMS.bank);
    }

    async fetchRecentPushes() {
        try {
            const response = await this.pusher.history({
                limit: 5,
                modified_after: (Date.now() / 1000) - 300
            });

            if (response && response.pushes) {
                response.pushes.forEach(push => {
                    this.handlePush(push);
                });
            }
        } catch (error) {
            console.error('Error fetching recent pushes:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    disconnect() {
        this.clearReconnectTimer();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        console.log('Pushbullet listener disconnected');
    }

    async testConnection() {
        try {
            const user = await this.pusher.me();
            return { success: true, user: user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            apiKey: this.apiKey ? '***' + this.apiKey.slice(-4) : null
        };
    }
}

module.exports = PushbulletListener;