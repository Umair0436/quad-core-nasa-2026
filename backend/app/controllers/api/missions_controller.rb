module Api
  class MissionsController < ApplicationController
    rescue_from ActionController::ParameterMissing do |error|
      render json: { error: error.message }, status: :bad_request
    end
    rescue_from ActiveSupport::MessageVerifier::InvalidSignature do
      render json: { error: "Your mission expired or could not be verified. Start a new mission." }, status: :unprocessable_entity
    end
    rescue_from MissionEngine::InvalidAction do |error|
      render json: { error: error.message }, status: :unprocessable_entity
    end

    def create
      render_mission(MissionEngine.start)
    end

    def decision
      state = verifier.verify(params.require(:token), purpose: "mission")
      render_mission(MissionEngine.resolve(state, params.require(:action_id)))
    end

    private

    # Signed state avoids a database. Replaying an old token is allowed in this
    # local prototype; persistent sessions are needed before adding a leaderboard.
    def verifier
      Rails.application.message_verifier("luna-01-mission-v1")
    end

    def render_mission(result)
      render json: result.merge(
        decision: MissionEngine.decision_for(result[:state]),
        token: verifier.generate(result[:state], purpose: "mission", expires_in: 2.hours)
      )
    end
  end
end
