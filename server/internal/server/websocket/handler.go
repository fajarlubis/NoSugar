package websocket

import (
	"crypto/sha1"
	"encoding/base64"
	"net"
	"net/http"
	"strings"
	"time"
)

func computeAcceptKey(key string) string {
	const magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.New()
	h.Write([]byte(key + magic))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		for {
			time.Sleep(time.Minute)
		}
	}
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-NoSugar-App")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
}
