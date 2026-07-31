package health

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Register(r *gin.RouterGroup) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}
