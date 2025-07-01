package server

import (
	"net/http"
	"time"
)

func New(httpHandler http.Handler, wsHandler http.Handler) *http.Server {
	mux := http.NewServeMux()
	mux.Handle("/", httpHandler)
	mux.Handle("/ws", wsHandler)

	return &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}
