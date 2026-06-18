package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/void-project/void-backend/internal/api"
	"github.com/void-project/void-backend/internal/api/deps"
	"github.com/void-project/void-backend/internal/repository"
)

func main() {
	ctx := context.Background()

	pool, err := repository.NewPool(ctx)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("connected to PostgreSQL")

	redisClient, err := repository.NewRedis(ctx)
	if err != nil {
		log.Fatalf("connect to redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("connected to Redis")

	d := &deps.Deps{
		DB:      pool,
		Redis:   redisClient,
		Queries: repository.New(pool),
	}

	if os.Getenv("ENVIRONMENT") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := api.SetupRouter(d)

	port := getenv("PORT", "8000")
	log.Printf("void-backend listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
