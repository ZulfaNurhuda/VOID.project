package repository

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func NewRedis(ctx context.Context) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", getenv("REDIS_HOST", "localhost"), getenv("REDIS_PORT", "6379")),
		Password: getenv("REDIS_PASSWORD", ""),
		DB:       0,
	})

	// Retry loop — wait for Redis to be ready
	const maxRetries = 10
	const retryDelay = 2 * time.Second

	var lastErr error
	for i := range maxRetries {
		lastErr = client.Ping(ctx).Err()
		if lastErr == nil {
			return client, nil
		}
		if i < maxRetries-1 {
			log.Printf("redis not ready (attempt %d/%d): %v — retrying in %s...",
				i+1, maxRetries, lastErr, retryDelay)
			time.Sleep(retryDelay)
		}
	}

	client.Close()
	return nil, fmt.Errorf("failed to connect to redis after %d attempts: %w", maxRetries, lastErr)
}
