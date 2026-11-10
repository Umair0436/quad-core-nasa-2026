Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  namespace :api do
    post "missions", to: "missions#create"
    post "missions/decision", to: "missions#decision"
  end
end
