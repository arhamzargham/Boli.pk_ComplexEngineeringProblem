package auth

import (
	"testing"
)

func TestGenerateOTP(t *testing.T) {
	for i := 0; i < 100; i++ {
		otp, err := generateOTP()
		if err != nil {
			t.Fatalf("generateOTP() error: %v", err)
		}
		if len(otp) != 6 {
			t.Errorf("expected 6-digit OTP, got %q (len=%d)", otp, len(otp))
		}
		for _, c := range otp {
			if c < '0' || c > '9' {
				t.Errorf("OTP %q contains non-digit character %q", otp, c)
			}
		}
	}
}

func TestGenerateOTPUniqueness(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 1000; i++ {
		otp, err := generateOTP()
		if err != nil {
			t.Fatalf("generateOTP() error: %v", err)
		}
		seen[otp] = true
	}
	if len(seen) < 990 {
		t.Errorf("expected > 990 unique OTPs in 1000 samples, got %d", len(seen))
	}
	t.Logf("Uniqueness check passed: %d unique OTPs in 1000 samples", len(seen))
}
