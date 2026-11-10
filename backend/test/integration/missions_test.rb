require "test_helper"

class MissionsTest < ActionDispatch::IntegrationTest
  test "start a mission and process a decision through the API" do
    post "/api/missions", as: :json
    assert_response :success
    mission = response.parsed_body
    assert_equal "habitat", mission["decision"]["module"]
    assert_not mission["decision"]["choices"][0].key?("explanation")
    post "/api/missions/decision", params: { token: mission["token"], action_id: "recycle" }, as: :json
    assert_response :success
    assert_equal 2, response.parsed_body["state"]["day"]
    assert_equal 73, response.parsed_body["state"]["oxygen"]
    assert_equal 40, response.parsed_body["state"]["power"]
  end

  test "tampered mission state is rejected" do
    post "/api/missions/decision", params: { token: "tampered", action_id: "recycle" }, as: :json
    assert_response :unprocessable_entity
  end

  test "missing fields return a client error" do
    post "/api/missions/decision", params: { action_id: "recycle" }, as: :json
    assert_response :bad_request
  end
end
