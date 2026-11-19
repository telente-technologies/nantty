# syntax=docker/dockerfile:1
# build context: services (go.work needs contracts and platform)
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY contracts ./contracts
COPY go ./go
WORKDIR /src/go
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./deployables/goIdentity

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/app /app
ENV HTTP_WRITE_TIMEOUT=30s
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
