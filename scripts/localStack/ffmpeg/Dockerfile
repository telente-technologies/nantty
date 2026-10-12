# Local-only ffmpeg for machines without one (the media service shells out to ffmpeg/ffprobe to process clips).
FROM alpine:3.22
RUN apk add --no-cache ffmpeg \
 && addgroup -S -g 10001 ffmpeg \
 && adduser -S -D -H -u 10001 -G ffmpeg ffmpeg
USER 10001:10001
