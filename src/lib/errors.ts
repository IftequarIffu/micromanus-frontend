const MESSAGES: Record<string, string> = {
  unauthorized: "Please sign in again.",
  invalid_body: "Please check your input and try again.",
  invalid_provider: "Choose a valid provider.",
  invalid_api_key: "That API key looks invalid.",
  api_key_not_configured: "Add an API key for this model’s provider first.",
  unknown_model: "Unknown model. Refresh and try again.",
  invalid_package: "Unknown credit package.",
  coupon_inactive: "This coupon is inactive.",
  coupon_expired: "This coupon has expired.",
  coupon_exhausted: "This coupon has no redemptions left.",
  coupon_not_found: "Coupon not found.",
  coupon_already_redeemed: "You already redeemed this coupon.",
  insufficient_credits: "You’re out of credits. Buy or redeem more to continue.",
  chat_not_found: "Chat not found.",
  api_key_not_found: "API key not found.",
  empty_response: "The model returned an empty response.",
  credit_error: "Could not charge credits for this chat.",
  llm_failed: "The model failed to respond. Try again.",
  service_unavailable: "Service temporarily unavailable.",
}

export function messageForCode(code: string, fallback?: string) {
  return MESSAGES[code] ?? fallback ?? "Something went wrong."
}
