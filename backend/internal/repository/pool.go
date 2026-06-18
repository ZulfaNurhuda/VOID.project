package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool creates a pgxpool.Pool, retrying until PostgreSQL is ready.
func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := buildDSN()

	const maxRetries = 10
	const retryDelay = 2 * time.Second

	var (
		pool    *pgxpool.Pool
		lastErr error
	)
	for i := range maxRetries {
		pool, lastErr = pgxpool.New(ctx, dsn)
		if lastErr == nil {
			if pingErr := pool.Ping(ctx); pingErr == nil {
				return pool, nil
			} else {
				pool.Close()
				lastErr = pingErr
			}
		}
		if i < maxRetries-1 {
			log.Printf("postgres not ready (attempt %d/%d): %v — retrying in %s...",
				i+1, maxRetries, lastErr, retryDelay)
			time.Sleep(retryDelay)
		}
	}
	return nil, fmt.Errorf("failed to connect to postgres after %d attempts: %w", maxRetries, lastErr)
}

func buildDSN() string {
	host := getenv("DB_HOST", "localhost")
	port := getenv("DB_PORT", "5432")
	user := getenv("DB_USER", "void")
	pass := getenv("DB_PASSWORD", "void")
	name := getenv("DB_NAME", "void")
	sslmode := getenv("DB_SSLMODE", "disable")
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, pass, name, sslmode)
}
