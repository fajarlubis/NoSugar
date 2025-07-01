package deepl

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	domain "github.com/fajarlubis/nosugar/internal/domain/translation"
)

const apiURL = "https://api-free.deepl.com/v2/translate"

type Engine struct {
	key    string
	client *http.Client
}

func New(key string) *Engine {
	return &Engine{
		key:    key,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (e *Engine) Translate(ctx context.Context, req *domain.Request) (*domain.Response, int, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, 0, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, 0, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "DeepL-Auth-Key "+e.key)

	resp, err := e.client.Do(httpReq)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	var out domain.Response
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, 0, err
	}

	return &out, resp.StatusCode, nil
}
