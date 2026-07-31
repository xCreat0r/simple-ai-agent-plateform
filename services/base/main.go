package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/jhl/simple-ai-agent-plateform/services/base/internal/docparser"
	"github.com/jhl/simple-ai-agent-plateform/services/base/internal/health"
)

const defaultPort = "8080"

func main() {
	r := gin.Default()

	health.Register(r.Group("/"))
	docparser.Register(r.Group("/doc-parser"))

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	if err := r.Run(":" + port); err != nil {
		log.Fatalln("服务启动失败:", err)
	}
}
