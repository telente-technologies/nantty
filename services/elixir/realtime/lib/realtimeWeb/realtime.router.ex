defmodule RealtimeWeb.Router do
  use RealtimeWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", RealtimeWeb do
    pipe_through :api
    get "/healthz", HealthController, :show
  end
end
