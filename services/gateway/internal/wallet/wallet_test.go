package wallet

import "testing"

func paisaToRupees(paisa int64) float64 {
	return float64(paisa) / 100.0
}

func TestPaisaArithmetic(t *testing.T) {
	tests := []struct {
		paisa    int64
		expected float64
	}{
		{0,        0.0},
		{100,      1.0},
		{10000,    100.0},
		{50000000, 500000.0},
		{1,        0.01},
	}
	for _, tt := range tests {
		result := paisaToRupees(tt.paisa)
		if result != tt.expected {
			t.Errorf("paisaToRupees(%d) = %f, want %f", tt.paisa, result, tt.expected)
		}
	}
}

func TestFeeCalculation(t *testing.T) {
	// Platform fee = 2% of bid; WHT = 1% of bid. Integer arithmetic only.
	bidPaisa    := int64(10_000_000) // Rs. 100,000
	platformFee := bidPaisa * 2 / 100
	wht         := bidPaisa * 1 / 100
	total       := bidPaisa + platformFee + wht

	if platformFee != 200_000 {
		t.Errorf("platform fee = %d, want 200000", platformFee)
	}
	if wht != 100_000 {
		t.Errorf("WHT = %d, want 100000", wht)
	}
	if total != 10_300_000 {
		t.Errorf("total = %d, want 10300000", total)
	}
}

func TestZeroSumSettlement(t *testing.T) {
	// Verify settlement math zero-sum for Rs. 200,000 bid
	bid          := int64(20_000_000)
	buyerFee     := bid * 2 / 100       // 400,000
	sellerFee    := bid * 2 / 100       // 400,000
	wht          := bid * 1 / 100       // 200,000
	ictTax       := (buyerFee + sellerFee) * 15 / 100 // 120,000
	sellerNet    := bid - sellerFee - wht              // 19,400,000
	platformRev  := buyerFee + sellerFee - ictTax      // 680,000
	buyerTotal   := bid + buyerFee                     // 20,400,000

	// Zero-sum: buyerTotal == sellerNet + wht + ictTax + platformRev
	sum := sellerNet + wht + ictTax + platformRev
	if sum != buyerTotal {
		t.Errorf("zero-sum FAIL: buyerTotal=%d, out=%d", buyerTotal, sum)
	}
}
