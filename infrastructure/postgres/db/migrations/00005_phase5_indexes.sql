-- +goose Up
-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_risk_audit_user_id ON risk_audit(user_id);

-- +goose Down
DROP INDEX IF EXISTS idx_transactions_buyer_id;
DROP INDEX IF EXISTS idx_transactions_seller_id;
DROP INDEX IF EXISTS idx_ledger_transaction_id;
DROP INDEX IF EXISTS idx_bids_auction_id;
DROP INDEX IF EXISTS idx_listings_status;
DROP INDEX IF EXISTS idx_risk_audit_user_id;
