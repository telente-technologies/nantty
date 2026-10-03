defmodule Realtime.Events.AwsSignatureV4Test do
  use ExUnit.Case, async: true
  alias Realtime.Events.AwsSignatureV4

  test "produces a deterministic scoped authorization header" do
    request = %{
      host_header: "localhost:14566",
      region: "eu-west-1",
      service: "sqs",
      access_key_id: "test",
      secret_access_key: "test",
      target: "AmazonSQS.ReceiveMessage",
      body: "{}",
      now: ~U[2026-10-03 10:00:00Z]
    }

    headers = AwsSignatureV4.sign_post_request(request)
    assert headers == AwsSignatureV4.sign_post_request(request)
    assert headers["x-amz-date"] == "20261003T100000Z"

    assert headers["authorization"] =~
             "Credential=test/20261003/eu-west-1/sqs/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature="
  end
end
