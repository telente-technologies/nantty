defmodule Realtime.Events.AmqpBrokerClientTest do
  use ExUnit.Case, async: true

  alias Realtime.Events.AmqpBrokerClient

  test "correlates publisher returns to the retry and treats them as unroutable" do
    assert AmqpBrokerClient.classify_publish_result(
             {:basic_return, "body", %{message_id: "retry-1"}},
             12,
             "retry-1"
           ) == {:error, :unroutable}
  end

  test "accepts only the matching publisher acknowledgement" do
    assert AmqpBrokerClient.classify_publish_result({:basic_ack, 12, false}, 12, "retry-1") ==
             :ok

    assert AmqpBrokerClient.classify_publish_result({:basic_nack, 12, false}, 12, "retry-1") ==
             {:error, :nacked}
  end
end
