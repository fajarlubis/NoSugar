package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const (
	deeplURL  = "https://api-free.deepl.com/v2/translate"
	googleURL = "https://translation.googleapis.com/language/translate/v2"
)

type translationRequest struct {
	Text       []string `json:"text"`
	TargetLang string   `json:"target_lang"`
	SourceLang string   `json:"source_lang"`
}

type translationItem struct {
	DetectedSourceLanguage string `json:"detected_source_language,omitempty"`
	Text                   string `json:"text"`
}

type translationResponse struct {
	Translations []translationItem `json:"translations"`
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-NoSugar-App")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
}

func callDeepL(body []byte) ([]byte, int, error) {
	key := os.Getenv("DEEPL_AUTH_KEY")
	if key == "" {
		return nil, 0, fmt.Errorf("DEEPL_AUTH_KEY not set")
	}

	req, err := http.NewRequest(http.MethodPost, deeplURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "DeepL-Auth-Key "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, err
	}
	return respBody, resp.StatusCode, nil
}

func callGoogle(reqData *translationRequest) ([]byte, int, error) {
	key := os.Getenv("GOOGLE_API_KEY")
	if key == "" {
		return nil, 0, fmt.Errorf("GOOGLE_API_KEY not set")
	}

	googleReq := map[string]interface{}{
		"q":      reqData.Text,
		"target": strings.ToLower(reqData.TargetLang),
		"format": "text",
	}
	if reqData.SourceLang != "" {
		googleReq["source"] = strings.ToLower(reqData.SourceLang)
	}

	gBody, err := json.Marshal(googleReq)
	if err != nil {
		return nil, 0, err
	}

	u := googleURL + "?key=" + url.QueryEscape(key)
	req, err := http.NewRequest(http.MethodPost, u, bytes.NewBuffer(gBody))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
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

	out := translationResponse{}
	for _, t := range googleResp.Data.Translations {
		out.Translations = append(out.Translations, translationItem{
			DetectedSourceLanguage: t.DetectedSourceLanguage,
			Text:                   t.TranslatedText,
		})
	}

	outBytes, err := json.Marshal(out)
	if err != nil {
		return nil, 0, err
	}

	return outBytes, resp.StatusCode, nil
}

func translateHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	log.Println("Client Request Body:")
	log.Println(string(body))

	engine := strings.ToLower(os.Getenv("TRANSLATION_ENGINE"))
	if engine == "" {
		engine = "deepl"
	}

	var respBody []byte
	var status int

	switch engine {
	case "google":
		var reqData translationRequest
		if err := json.Unmarshal(body, &reqData); err != nil {
			http.Error(w, "Invalid request", http.StatusBadRequest)
			return
		}
		respBody, status, err = callGoogle(&reqData)
	default:
		respBody, status, err = callDeepL(body)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(respBody)
}

func computeAcceptKey(key string) string {
	const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + magic))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		http.Error(w, "Upgrade required", http.StatusBadRequest)
		return
	}

	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	hij, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Hijacking not supported", http.StatusInternalServerError)
		return
	}

	conn, _, err := hij.Hijack()
	if err != nil {
		http.Error(w, "Hijack failed", http.StatusInternalServerError)
		return
	}

	accept := computeAcceptKey(key)
	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"
	if _, err := conn.Write([]byte(response)); err != nil {
		conn.Close()
		return
	}

	// send a text frame "ok"
	msg := []byte("ok")
	frame := []byte{0x81, byte(len(msg))}
	frame = append(frame, msg...)
	conn.Write(frame)

	go func(c net.Conn) {
		defer c.Close()
		buf := make([]byte, 1024)
		for {
			if _, err := c.Read(buf); err != nil {
				return
			}
		}
	}(conn)

	// keep connection alive
	for {
		time.Sleep(time.Minute)
	}
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	http.HandleFunc("/", translateHandler)
	http.HandleFunc("/ws", wsHandler)

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
