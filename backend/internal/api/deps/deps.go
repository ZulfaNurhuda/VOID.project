package deps

import (
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
	"github.com/void-project/void-backend/internal/repository"
)

// Deps holds shared dependencies injected into all handlers.
type Deps struct {
	DB      *pgxpool.Pool
	Redis   *goredis.Client
	Queries *repository.Queries
}
