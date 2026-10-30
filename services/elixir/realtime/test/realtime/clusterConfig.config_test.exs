defmodule Realtime.ClusterConfigTest do
  use ExUnit.Case, async: true

  alias Realtime.ClusterConfig

  test "accepts explicit production DNS discovery and a release cookie" do
    settings =
      ClusterConfig.production_settings!(%{
        "DNS_CLUSTER_QUERY" => "  realtime.internal  ",
        "RELEASE_COOKIE" => "a-secret-cookie"
      })

    assert settings.dns_cluster_query == "realtime.internal"
    assert settings.release_cookie == "a-secret-cookie"
  end

  test "fails fast instead of silently starting an isolated production node" do
    assert_raise ArgumentError, ~r/DNS_CLUSTER_QUERY must be configured/, fn ->
      ClusterConfig.production_settings!(%{"RELEASE_COOKIE" => "cookie"})
    end

    assert_raise ArgumentError, ~r/DNS_CLUSTER_QUERY must be configured/, fn ->
      ClusterConfig.production_settings!(%{
        "DNS_CLUSTER_QUERY" => "  ",
        "RELEASE_COOKIE" => "cookie"
      })
    end
  end

  test "fails fast when the production cluster cookie is absent" do
    assert_raise ArgumentError, ~r/RELEASE_COOKIE must be configured/, fn ->
      ClusterConfig.production_settings!(%{"DNS_CLUSTER_QUERY" => "realtime.internal"})
    end
  end

  test "release startup uses a named task node when cluster discovery is configured" do
    {output, status} = run_release_env("10.0.2.17")

    assert status == 0
    assert output =~ "cluster=name|realtime@10.0.2.17"
  end

  test "release startup refuses to silently fall back to an isolated node" do
    {output, status} = run_release_env("")

    assert status == 1
    assert output =~ "Unable to determine task IP for DNS-clustered realtime release"
  end

  defp run_release_env(host_output) do
    directory =
      Path.join(System.tmp_dir!(), "realtime-cluster-test-#{System.unique_integer([:positive])}")

    File.mkdir_p!(directory)
    hostname = Path.join(directory, "hostname")
    File.write!(hostname, "#!/bin/sh\nprintf '%s\\n' '#{host_output}'\n")
    File.chmod!(hostname, 0o755)

    script =
      Path.expand("../../rel/env.sh.eex", __DIR__)
      |> File.read!()
      |> String.replace("<%= @release.name %>", "realtime")

    script = script <> "\nprintf 'cluster=%s|%s\\n' \"$RELEASE_DISTRIBUTION\" \"$RELEASE_NODE\"\n"
    path = directory <> ":" <> System.get_env("PATH", "/usr/bin:/bin")

    try do
      System.cmd("/bin/sh", ["-c", script],
        env: [{"PATH", path}, {"DNS_CLUSTER_QUERY", "realtime.internal"}, {"RELEASE_NODE", ""}],
        stderr_to_stdout: true
      )
    after
      File.rm_rf!(directory)
    end
  end
end
