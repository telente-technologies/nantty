# syntax=docker/dockerfile:1
FROM elixir:1.20 AS build
ENV MIX_ENV=prod
WORKDIR /app
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && mix deps.compile
COPY config config
COPY lib lib
RUN mix compile && mix release

FROM debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libstdc++6 libzstd1 openssl libncurses6 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PHX_SERVER=true LANG=C.UTF-8
WORKDIR /app
COPY --from=build --chown=nobody:nogroup /app/_build/prod/rel/realtime ./
USER nobody
EXPOSE 4000
CMD ["/app/bin/realtime", "start"]
