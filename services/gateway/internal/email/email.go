package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// Service sends transactional email via the SendGrid v3 API.
// Falls back to stdout logging when apiKey is empty (CEP mock mode).
type Service struct {
	apiKey    string
	fromEmail string
	fromName  string
}

// NewService reads credentials from environment variables.
func NewService() *Service {
	return &Service{
		apiKey:    os.Getenv("SENDGRID_API_KEY"),
		fromEmail: os.Getenv("SENDGRID_FROM_EMAIL"),
		fromName:  os.Getenv("SENDGRID_FROM_NAME"),
	}
}

// SendOTP delivers a 6-digit OTP to toEmail via SendGrid.
// Returns an error if apiKey is empty or the API call fails.
func (s *Service) SendOTP(toEmail, otp string) error {
	if s.apiKey == "" {
		return fmt.Errorf("SENDGRID_API_KEY not set")
	}

	fromEmail := s.fromEmail
	fromName  := s.fromName
	if fromEmail == "" { fromEmail = "noreply@boli.pk" }
	if fromName  == "" { fromName  = "Boli.pk" }

	htmlBody := fmt.Sprintf(
		`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">`+
			`<h2 style="color:#1C1917">Your Boli.pk login code</h2>`+
			`<div style="background:#1C1917;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">`+
			`<span style="font-family:monospace;font-size:36px;font-weight:bold;color:#B87333;letter-spacing:8px;">%s</span>`+
			`</div>`+
			`<p style="color:#9E9993;font-size:12px">Valid for 5 minutes. Never share this code.</p>`+
			`</div>`, otp,
	)

	payload := map[string]interface{}{
		"personalizations": []map[string]interface{}{
			{"to": []map[string]string{{"email": toEmail}}},
		},
		"from":    map[string]string{"email": fromEmail, "name": fromName},
		"subject": "Your Boli.pk Login Code",
		"content": []map[string]string{{"type": "text/html", "value": htmlBody}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("email: marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost,
		"https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("email: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("email: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("email: sendgrid status %d", resp.StatusCode)
	}
	return nil
}
