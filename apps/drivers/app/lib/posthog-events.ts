export const posthogEvents = {
  driver_onboarding_completed: "driver:onboarding_completed",
  driver_onboarding_failed: "driver:onboarding_failed",
  driver_onboarding_validation_failed: "driver:onboarding_validation_failed",

  driver_login_succeeded: "driver:login_succeeded",
  driver_login_failed: "driver:login_failed",
  driver_logout_succeeded: "driver:logout_succeeded",

  driver_profile_update_succeeded: "driver:profile_update_succeeded",
  driver_profile_update_failed: "driver:profile_update_failed",
  driver_bank_details_update_succeeded: "driver:bank_details_update_succeeded",
  driver_bank_details_update_failed: "driver:bank_details_update_failed",
  driver_google_disconnect_succeeded: "driver:google_disconnect_succeeded",
  driver_google_disconnect_failed: "driver:google_disconnect_failed",
  driver_password_set_succeeded: "driver:password_set_succeeded",
  driver_password_set_failed: "driver:password_set_failed",
  driver_account_delete_succeeded: "driver:account_delete_succeeded",
  driver_account_delete_failed: "driver:account_delete_failed",

  driver_route_created_succeeded: "driver:route_created_succeeded",
  driver_route_create_failed: "driver:route_create_failed",
  driver_route_updated_succeeded: "driver:route_updated_succeeded",
  driver_route_update_failed: "driver:route_update_failed",
  driver_route_delete_succeeded: "driver:route_delete_succeeded",
  driver_route_delete_failed: "driver:route_delete_failed",

  cookie_consent_accepted: "cookie:consent_accepted",
  cookie_consent_declined: "cookie:consent_declined",
} as const;
