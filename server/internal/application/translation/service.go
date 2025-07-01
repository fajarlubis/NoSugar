package translation

import (
	"context"

	domain "github.com/fajarlubis/nosugar/internal/domain/translation"
)

type Service struct {
	engine domain.Engine
}

func NewService(e domain.Engine) *Service {
	return &Service{engine: e}
}

func (s *Service) Translate(ctx context.Context, req *domain.Request) (*domain.Response, int, error) {
	return s.engine.Translate(ctx, req)
}
