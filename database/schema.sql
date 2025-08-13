-- Supabase Schema for SMS Banking Notifications
-- Table to store banking transaction information
CREATE TABLE banking_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic transaction info
    bank VARCHAR(50) NOT NULL,
    sender VARCHAR(20) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'incoming' or 'outgoing'
    amount DECIMAL(15,2) NOT NULL,
    balance DECIMAL(15,2),
    
    -- Transaction details
    description TEXT NOT NULL,
    content TEXT NOT NULL, -- Full SMS content
    
    -- Timestamps
    transaction_time TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional metadata
    raw_sms TEXT, -- Original SMS text
    parsed_data JSONB, -- Store full parsed SMS data as JSON
    
    -- Indexing for better performance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_banking_transactions_bank ON banking_transactions(bank);
CREATE INDEX idx_banking_transactions_type ON banking_transactions(transaction_type);
CREATE INDEX idx_banking_transactions_received_at ON banking_transactions(received_at);
CREATE INDEX idx_banking_transactions_transaction_time ON banking_transactions(transaction_time);
CREATE INDEX idx_banking_transactions_amount ON banking_transactions(amount);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_banking_transactions_updated_at 
    BEFORE UPDATE ON banking_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE banking_transactions IS 'Store SMS banking transaction notifications';
COMMENT ON COLUMN banking_transactions.bank IS 'Bank name (vietinbank, vietcombank, etc.)';
COMMENT ON COLUMN banking_transactions.sender IS 'SMS sender (usually bank short code)';
COMMENT ON COLUMN banking_transactions.transaction_type IS 'Transaction direction: incoming or outgoing';
COMMENT ON COLUMN banking_transactions.amount IS 'Transaction amount in VND';
COMMENT ON COLUMN banking_transactions.balance IS 'Account balance after transaction';
COMMENT ON COLUMN banking_transactions.description IS 'Transaction description/memo';
COMMENT ON COLUMN banking_transactions.content IS 'Full SMS content';
COMMENT ON COLUMN banking_transactions.transaction_time IS 'When the transaction occurred';
COMMENT ON COLUMN banking_transactions.received_at IS 'When the SMS was received';
COMMENT ON COLUMN banking_transactions.raw_sms IS 'Original raw SMS text';
COMMENT ON COLUMN banking_transactions.parsed_data IS 'Full parsed SMS data as JSON';

-- Enable Row Level Security (RLS) for better security
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
-- You may want to customize this based on your security requirements
CREATE POLICY "Allow all operations for authenticated users" ON banking_transactions
    FOR ALL USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT ALL ON banking_transactions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;