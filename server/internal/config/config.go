package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Engine       string
	DeepLKey     string
	GoogleKey    string
	ClientAPIKey string
}

func Load() *Config {
	_ = godotenv.Load()
	cfg := &Config{
		Engine:       strings.ToLower(os.Getenv("TRANSLATION_ENGINE")),
		DeepLKey:     os.Getenv("DEEPL_AUTH_KEY"),
		GoogleKey:    os.Getenv("GOOGLE_API_KEY"),
		ClientAPIKey: os.Getenv("CLIENT_API_KEY"),
	}
	if cfg.Engine == "" {
		cfg.Engine = "deepl"
	}
	return cfg
}
