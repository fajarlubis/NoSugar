# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o nosugar ./cmd/nosugar

# Final stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/nosugar ./
EXPOSE 8080
CMD ["./nosugar"]
