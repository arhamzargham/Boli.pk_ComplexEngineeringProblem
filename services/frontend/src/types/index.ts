// Domain types matching Go API responses exactly.
// All monetary values are integers (Paisa) — INVARIANT-09 from CLAUDE.md.

export interface Listing {
  listing_id: string
  seller_id: string
  category: string
  imei: string
  make: string
  model: string
  storage_gb?: number
  color_variant?: string
  condition_rating: number
  reserve_price_paisa: number
  reserve_price_visible: boolean
  category_metadata: Record<string, unknown>
  pta_status?: 'REGISTERED_CLEAN' | 'UNREGISTERED' | 'BLACKLISTED'
  status:
    | 'PENDING_REVIEW'
    | 'ACTIVE'
    | 'SOLD'
    | 'UNSOLD_EXPIRED'
    | 'REJECTED'
    | 'CANCELLED_BY_SELLER'
    | 'CANCELLED_BY_ADMIN'
  ntn_required: boolean
  resubmission_count: number
  created_at: string
  published_at?: string
  expires_at?: string
  vetting_classification?: 'VERIFIED' | 'REVIEWED' | 'PENDING_REVIEW' | 'REJECTED'
  composite_score?: number
}

export interface ListingImage {
  image_id: string
  storage_url: string
  sort_order: number
  uploaded_at: string
}

export interface ListingDetail extends Listing {
  images: ListingImage[]
}

export interface Auction {
  auction_id: string
  listing_id: string
  make: string
  model: string
  storage_gb?: number
  condition_rating: number
  reserve_price_paisa: number
  status:
    | 'DRAFT'
    | 'SCHEDULED'
    | 'ACTIVE'
    | 'CLOSING'
    | 'CLOSED_WITH_BIDS'
    | 'CLOSED_NO_BIDS'
    | 'CANCELLED'
  start_time: string
  end_time: string
  closing_window_start: string
  closed_at?: string
  total_bid_count: number
  highest_bid_paisa?: number
  winner_bid_id?: string
}

export interface Wallet {
  wallet_id: string
  available_paisa: number
  reserved_paisa: number
  locked_paisa: number
  total_deposited_paisa: number
  daily_escrow_exposure_paisa: number
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  user_id: string
  role: 'BUYER' | 'SELLER' | 'ADMIN'
  kyc_tier: 'BASIC' | 'FULL'
  profile_complete?: boolean
}

export interface ListingsResponse {
  data: Listing[]
  count: number
  limit: number
  offset: number
}

export interface Bid {
  bid_id: string
  auction_id: string
  bidder_id: string
  bid_amount_paisa: number
  status: 'ACTIVE' | 'OUTBID' | 'WINNING' | 'WON' | 'CANCELLED'
  placed_at: string
  rank?: number
}

export interface BidResponse {
  bid_id: string
  auction_id: string
  bid_amount_paisa: number
  status: string
  placed_at: string
  message: string
}

export interface BidsListResponse {
  data: Bid[]
  count: number
}

export interface Transaction {
  transaction_id: string
  listing_id: string
  auction_id: string
  buyer_id: string
  seller_id: string
  winning_bid_paisa: number
  buyer_fee_paisa: number
  seller_fee_paisa: number
  wht_paisa: number
  ict_paisa: number
  net_to_seller_paisa: number
  status:
    | 'PENDING_MEETUP'
    | 'MEETUP_CONFIRMED'
    | 'QR_SCANNED'
    | 'SETTLED'
    | 'DISPUTED'
    | 'REFUNDED'
    | 'CANCELLED'
  created_at: string
  settled_at?: string
  meetup_confirmed_at?: string
  qr_expires_at?: string
  settlement_receipt_hash?: string
  make: string
  model: string
}

export interface AdminListingRow {
  listing_id: string
  make: string
  model: string
  storage_gb?: number
  condition_rating: number
  reserve_price_paisa: number
  pta_status?: 'REGISTERED_CLEAN' | 'UNREGISTERED' | 'BLACKLISTED'
  status: string
  vetting_classification?: string
  composite_score?: number
  created_at: string
  seller_id: string
}

export interface AdminUserRow {
  user_id: string
  phone: string
  role: 'BUYER' | 'SELLER' | 'ADMIN'
  kyc_tier: 'BASIC' | 'FULL'
  is_suspended: boolean
  created_at: string
  total_listings: number
  total_transactions: number
}
