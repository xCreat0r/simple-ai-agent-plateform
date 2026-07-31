package docparser

import (
	"bytes"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

const maxBodySize = 50 << 20 // 50MB

func Register(r *gin.RouterGroup) {
	r.POST("/parse", handleParse)
}

func handleParse(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxBodySize))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "读取请求体失败"})
		return
	}

	conf := model.NewDefaultConfiguration()
	ctx, err := api.ReadValidateAndOptimize(bytes.NewReader(body), conf)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": "PDF 解析失败: " + err.Error(),
		})
		return
	}

	var buf bytes.Buffer
	for i := 1; i <= ctx.PageCount; i++ {
		r, err := pdfcpu.ExtractPageContent(ctx, i)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error": "PDF 解析失败: " + err.Error(),
			})
			return
		}
		if r == nil {
			continue
		}
		if _, err := io.Copy(&buf, r); err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error": "PDF 解析失败: " + err.Error(),
			})
			return
		}
		buf.WriteByte('\n')
	}

	c.String(http.StatusOK, buf.String())
}
