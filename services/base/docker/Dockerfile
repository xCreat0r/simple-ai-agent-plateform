FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /base .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=builder /base /usr/local/bin/base
EXPOSE 8080
CMD ["base"]
