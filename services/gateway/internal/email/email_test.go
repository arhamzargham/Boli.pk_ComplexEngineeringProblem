package email

import (
	"os"
	"testing"
)

func TestNewService(t *testing.T) {
	os.Setenv("SENDGRID_API_KEY",    "SG.test")
	os.Setenv("SENDGRID_FROM_EMAIL", "test@example.com")
	os.Setenv("SENDGRID_FROM_NAME",  "Test")
	defer func() {
		os.Unsetenv("SENDGRID_API_KEY")
		os.Unsetenv("SENDGRID_FROM_EMAIL")
		os.Unsetenv("SENDGRID_FROM_NAME")
	}()

	svc := NewService()
	if svc.apiKey != "SG.test" {
		t.Errorf("expected apiKey SG.test, got %q", svc.apiKey)
	}
	if svc.fromEmail != "test@example.com" {
		t.Errorf("expected fromEmail test@example.com, got %q", svc.fromEmail)
	}
	if svc.fromName != "Test" {
		t.Errorf("expected fromName Test, got %q", svc.fromName)
	}
}

func TestSendOTPMissingKey(t *testing.T) {
	svc := &Service{} // empty — no API key
	err := svc.SendOTP("user@example.com", "123456")
	if err == nil {
		t.Error("expected error when SENDGRID_API_KEY is empty")
	}
	if err.Error() != "SENDGRID_API_KEY not set" {
		t.Errorf("unexpected error message: %v", err)
	}
}
