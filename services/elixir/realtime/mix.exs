defmodule Realtime.MixProject do
  use Mix.Project

  def project do
    [
      app: :realtime,
      version: "0.1.0",
      elixir: "~> 1.19",
      elixirc_paths: ["lib"],
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      listeners: [Phoenix.CodeReloader]
    ]
  end

  def application do
    [mod: {Realtime.Application, []}, extra_applications: [:logger, :runtime_tools, :inets, :ssl]]
  end

  defp deps do
    [
      {:phoenix, "~> 1.8.15"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.0"},
      {:telemetry_metrics_prometheus_core, "~> 1.2"},
      {:jason, "~> 1.4"},
      {:jose, github: "potatosalad/erlang-jose", tag: "1.11.13"},
      {:dns_cluster, "~> 0.2.0"},
      {:bandit, github: "mtrudel/bandit", tag: "1.15.0", override: true},
      {:plug, github: "elixir-plug/plug", tag: "v1.20.4", override: true},
      {:plug_crypto, github: "elixir-plug/plug_crypto", tag: "v2.2.1", override: true},
      {:amqp, "~> 4.2"}
    ]
  end
end
