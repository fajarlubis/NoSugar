package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

const deeplURL = "https://api-free.deepl.com/v2/translate"
const authKey = "DeepL-Auth-Key d8e0fb67-0f3b-430e-85bb-924b8c4d8b8d:fx"

func translateHandler(w http.ResponseWriter, r *http.Request) {
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

	log.Println("Client Request Headers:")
	for name, values := range r.Header {
		for _, value := range values {
			log.Printf("  %s: %s\n", name, value)
		}
	}

	log.Println("Client Request Body:")
	log.Println(string(body))

	req, err := http.NewRequest(http.MethodPost, deeplURL, bytes.NewBuffer(body))
	if err != nil {
		http.Error(w, "Failed to create request to DeepL", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to contact DeepL API", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, "Failed to read response from DeepL", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func computeAcceptKey(key string) string {
	const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + magic))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
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
	http.HandleFunc("/", translateHandler)
	http.HandleFunc("/ws", wsHandler)

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
