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
  driver_account_deactivate_succeeded: "driver:account_deactivate_succeeded",
  driver_account_deactivate_failed: "driver:account_deactivate_failed",


  driver_vehicle_created_succeeded: "driver:vehicle_created_succeeded",
  driver_vehicle_updated_succeeded: "driver:vehicle_updated_succeeded",
  driver_vehicle_updated_failed: "driver:vehicle_updated_failed",
  driver_vehicle_deleted_succeeded: "driver:vehicle_deleted_succeeded",

  cookie_consent_accepted: "cookie:consent_accepted",
  cookie_consent_declined: "cookie:consent_declined",
} as const;
