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
      {:jason, "~> 1.4"},
      {:jose, "~> 1.11"},
      {:dns_cluster, "~> 0.2.0"},
      {:bandit, "~> 1.5"},
      {:amqp, "~> 4.2"}
    ]
  end
end
