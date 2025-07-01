package main

import (
	app "github.com/fajarlubis/nosugar/internal/application/translation"
	"github.com/fajarlubis/nosugar/internal/config"
	domain "github.com/fajarlubis/nosugar/internal/domain/translation"
	"github.com/fajarlubis/nosugar/internal/infrastructure/deepl"
	"github.com/fajarlubis/nosugar/internal/infrastructure/google"
	serverpkg "github.com/fajarlubis/nosugar/internal/server"
	httpServer "github.com/fajarlubis/nosugar/internal/server/http"
	ws "github.com/fajarlubis/nosugar/internal/server/websocket"
)

func main() {
	cfg := config.Load()

	var engine domain.Engine
	switch cfg.Engine {
	case "google":
		engine = google.New(cfg.GoogleKey)
	default:
		engine = deepl.New(cfg.DeepLKey)
	}

	service := app.NewService(engine)
	httpHandler := httpServer.New(service, cfg.ClientAPIKey)
	wsHandler := ws.Handler()
	srv := serverpkg.New(httpHandler, wsHandler)
	if err := srv.ListenAndServe(); err != nil {
		panic(err)
	}
}
