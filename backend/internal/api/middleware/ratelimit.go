package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func RateLimit(redisClient *redis.Client, keyFn func(*gin.Context) string, max int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "rate:" + keyFn(c)
		ctx := context.Background()

		count, err := redisClient.Incr(ctx, key).Result()
		if err != nil {
			c.Next()
			return
		}
		if count == 1 {
			redisClient.Expire(ctx, key, window)
		}
		if count > int64(max) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": fmt.Sprintf("rate limit exceeded: max %d requests per %s", max, window),
			})
			return
		}
		c.Next()
	}
}

func LoginRateLimit(redisClient *redis.Client) gin.HandlerFunc {
	return RateLimit(redisClient, func(c *gin.Context) string {
		return "login:" + c.ClientIP()
	}, 5, time.Minute)
}

func APIRateLimit(redisClient *redis.Client) gin.HandlerFunc {
	return RateLimit(redisClient, func(c *gin.Context) string {
		user := GetUser(c)
		if user == nil {
			return "anon:" + c.ClientIP()
		}
		return "api:" + user.ID
	}, 100, time.Minute)
}
