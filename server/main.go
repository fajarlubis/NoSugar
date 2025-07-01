package main

import (
	"bytes"
	"io"
	"log"
	"net/http"
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

func main() {
	http.HandleFunc("/", translateHandler)

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
