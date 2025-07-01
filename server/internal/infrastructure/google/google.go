package google

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	domain "github.com/fajarlubis/nosugar/internal/domain/translation"
)

const apiURL = "https://translation.googleapis.com/language/translate/v2"

type Engine struct {
	key    string
	client *http.Client
}

func New(key string) *Engine {
	return &Engine{key: key, client: &http.Client{Timeout: 15 * time.Second}}
}

func (e *Engine) Translate(ctx context.Context, req *domain.Request) (*domain.Response, int, error) {
	googleReq := map[string]interface{}{
		"q":      req.Text,
		"target": strings.ToLower(req.TargetLang),
		"format": "text",
	}
	if req.SourceLang != "" {
		googleReq["source"] = strings.ToLower(req.SourceLang)
	}

	body, err := json.Marshal(googleReq)
	if err != nil {
		return nil, 0, err
	}

	u := apiURL + "?key=" + url.QueryEscape(e.key)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, u, bytes.NewBuffer(body))
	if err != nil {
		return nil, 0, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(httpReq)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}

	var googleResp struct {
		Data struct {
			Translations []struct {
				TranslatedText         string `json:"translatedText"`
				DetectedSourceLanguage string `json:"detectedSourceLanguage,omitempty"`
			} `json:"translations"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &googleResp); err != nil {
		return nil, 0, err
	}

	out := domain.Response{}
	for _, t := range googleResp.Data.Translations {
		out.Translations = append(out.Translations, domain.Item{
			DetectedSourceLanguage: t.DetectedSourceLanguage,
			Text:                   t.TranslatedText,
		})
	}

	return &out, resp.StatusCode, nil
}
