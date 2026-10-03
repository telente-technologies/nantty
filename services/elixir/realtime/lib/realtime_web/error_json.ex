defmodule RealtimeWeb.ErrorJSON do
  def render(template, _assigns),
    do: %{code: "HTTP_ERROR", message: Phoenix.Controller.status_message_from_template(template)}
end
