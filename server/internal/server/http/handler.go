package http

import (
	"encoding/json"
	"io"
	"net/http"

	app "github.com/fajarlubis/nosugar/internal/application/translation"
	domain "github.com/fajarlubis/nosugar/internal/domain/translation"
)

type Handler struct {
	service *app.Service
	apiKey  string
}

func New(service *app.Service, key string) *Handler {
	return &Handler{service: service, apiKey: key}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.apiKey != "" && r.Header.Get("Authorization") != h.apiKey {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var req domain.Request
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	resp, status, err := h.service.Translate(r.Context(), &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-NoSugar-App")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
}
