package centrifugo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type Publisher struct {
	apiURL string
	apiKey string
	client *http.Client
}

func NewPublisher() *Publisher {
	return &Publisher{
		apiURL: os.Getenv("CENTRIFUGO_API_URL"),
		apiKey: os.Getenv("CENTRIFUGO_API_KEY"),
		client: &http.Client{},
	}
}

type publishRequest struct {
	Method string        `json:"method"`
	Params publishParams `json:"params"`
}

type publishParams struct {
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
}

func (p *Publisher) PublishBid(ctx context.Context, auctionID string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("centrifugo: marshal: %w", err)
	}
	req := publishRequest{
		Method: "publish",
		Params: publishParams{
			Channel: "auction:" + auctionID,
			Data:    payload,
		},
	}
	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("centrifugo: marshal req: %w", err)
	}
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, p.apiURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("centrifugo: new request: %w", err)
	}
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-API-Key", p.apiKey)
	resp, err := p.client.Do(r)
	if err != nil {
		return fmt.Errorf("centrifugo: publish: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("centrifugo: unexpected status: %d", resp.StatusCode)
	}
	return nil
}
