package translation

import "context"

type Engine interface {
	Translate(ctx context.Context, req *Request) (*Response, int, error)
}
