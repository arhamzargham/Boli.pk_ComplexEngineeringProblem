package listing

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

// Listing is the domain model returned by the public listing endpoints.
// raw_metadata_json is intentionally absent — it is NEVER exposed via any
// public API endpoint (CLAUDE.md Section 16).
type Listing struct {
	ListingID           string          `json:"listing_id"`
	SellerID            string          `json:"seller_id"`
	Category            string          `json:"category"`
	IMEI                string          `json:"imei"`
	Make                string          `json:"make"`
	Model               string          `json:"model"`
	StorageGB           *int64          `json:"storage_gb,omitempty"`
	ColorVariant        *string         `json:"color_variant,omitempty"`
	ConditionRating     int64           `json:"condition_rating"`
	ReservePricePaisa   int64           `json:"reserve_price_paisa"`
	ReservePriceVisible bool            `json:"reserve_price_visible"`
	CategoryMetadata    json.RawMessage `json:"category_metadata"`
	PTAStatus           *string         `json:"pta_status,omitempty"`
	Status              string          `json:"status"`
	NTNRequired         bool            `json:"ntn_required"`
	ResubmissionCount   int64           `json:"resubmission_count"`
	CreatedAt           time.Time       `json:"created_at"`
	PublishedAt         *time.Time      `json:"published_at,omitempty"`
	ExpiresAt           *time.Time      `json:"expires_at,omitempty"`
	// Joined from listing_vettings (most recent COMPLETED record)
	VettingClassification *string `json:"vetting_classification,omitempty"`
	CompositeScore        *int64  `json:"composite_score,omitempty"`
}

// Image is the safe projection of listing_images (no EXIF metadata).
type Image struct {
	ImageID    string    `json:"image_id"`
	StorageURL string    `json:"storage_url"`
	SortOrder  int64     `json:"sort_order"`
	UploadedAt time.Time `json:"uploaded_at"`
}

// ListingDetail embeds Listing with its associated images.
type ListingDetail struct {
	Listing
	Images []Image `json:"images"`
}

// Store wraps the PostgreSQL connection for listing queries.
type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

// listingCols is the shared SELECT projection used by both List and Get.
// search_vector is intentionally excluded (internal tsvector, not JSON-serialisable).
const listingCols = `
	l.listing_id, l.seller_id, l.category::text,
	l.imei, l.make, l.model, l.storage_gb, l.color_variant,
	l.condition_rating, l.reserve_price_paisa, l.reserve_price_visible,
	l.category_metadata, l.pta_status::text, l.status::text,
	l.ntn_required, l.resubmission_count,
	l.created_at, l.published_at, l.expires_at,
	lv.classification::text, lv.composite_score`

// vettingJoin picks the most recent COMPLETED vetting record per listing.
const vettingJoin = `
	LEFT JOIN LATERAL (
		SELECT classification, composite_score
		FROM listing_vettings
		WHERE listing_id = l.listing_id
		  AND status = 'COMPLETED'
		ORDER BY submitted_at DESC
		LIMIT 1
	) lv ON TRUE`

// List returns paginated listings filtered by status.
// When q is non-empty, PostgreSQL full-text search is applied (CLAUDE.md Section 10).
func (s *Store) List(ctx context.Context, status, q string, limit, offset int) ([]Listing, error) {
	var (
		rows *sql.Rows
		err  error
	)

	if q != "" {
		rows, err = s.db.QueryContext(ctx, `
			SELECT`+listingCols+`
			FROM listings l`+vettingJoin+`
			WHERE l.status = $1::listing_status
			  AND l.search_vector @@ plainto_tsquery('english', $4)
			ORDER BY ts_rank(l.search_vector, plainto_tsquery('english', $4)) DESC,
			         l.created_at DESC
			LIMIT $2 OFFSET $3`,
			status, limit, offset, q)
	} else {
		rows, err = s.db.QueryContext(ctx, `
			SELECT`+listingCols+`
			FROM listings l`+vettingJoin+`
			WHERE l.status = $1::listing_status
			ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC
			LIMIT $2 OFFSET $3`,
			status, limit, offset)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Listing
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// Get returns a single listing by UUID with its images.
func (s *Store) Get(ctx context.Context, id string) (*ListingDetail, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT`+listingCols+`
		FROM listings l`+vettingJoin+`
		WHERE l.listing_id = $1::uuid`,
		id)

	l, err := scanListing(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Fetch images — raw_metadata_json intentionally excluded
	imgRows, err := s.db.QueryContext(ctx, `
		SELECT image_id, storage_url, sort_order, uploaded_at
		FROM listing_images
		WHERE listing_id = $1::uuid
		ORDER BY sort_order ASC`,
		id)
	if err != nil {
		return nil, err
	}
	defer imgRows.Close()

	var imgs []Image
	for imgRows.Next() {
		var img Image
		if err := imgRows.Scan(&img.ImageID, &img.StorageURL, &img.SortOrder, &img.UploadedAt); err != nil {
			return nil, err
		}
		imgs = append(imgs, img)
	}
	if err := imgRows.Err(); err != nil {
		return nil, err
	}

	return &ListingDetail{Listing: l, Images: imgs}, nil
}

// scanner is satisfied by both *sql.Row and *sql.Rows.
type scanner interface {
	Scan(dest ...any) error
}

func scanListing(s scanner) (Listing, error) {
	var (
		l             Listing
		storageGB     sql.NullInt64
		colorVariant  sql.NullString
		rawMeta       []byte
		ptaStatus     sql.NullString
		publishedAt   sql.NullTime
		expiresAt     sql.NullTime
		classification sql.NullString
		compositeScore sql.NullInt64
	)

	err := s.Scan(
		&l.ListingID, &l.SellerID, &l.Category,
		&l.IMEI, &l.Make, &l.Model, &storageGB, &colorVariant,
		&l.ConditionRating, &l.ReservePricePaisa, &l.ReservePriceVisible,
		&rawMeta, &ptaStatus, &l.Status,
		&l.NTNRequired, &l.ResubmissionCount,
		&l.CreatedAt, &publishedAt, &expiresAt,
		&classification, &compositeScore,
	)
	if err != nil {
		return l, err
	}

	if storageGB.Valid    { l.StorageGB    = &storageGB.Int64 }
	if colorVariant.Valid { l.ColorVariant = &colorVariant.String }
	if ptaStatus.Valid    { l.PTAStatus    = &ptaStatus.String }
	if publishedAt.Valid  { l.PublishedAt  = &publishedAt.Time }
	if expiresAt.Valid    { l.ExpiresAt    = &expiresAt.Time }
	if classification.Valid  { l.VettingClassification = &classification.String }
	if compositeScore.Valid  { l.CompositeScore = &compositeScore.Int64 }

	if rawMeta == nil {
		rawMeta = []byte("{}")
	}
	l.CategoryMetadata = json.RawMessage(rawMeta)

	return l, nil
}
