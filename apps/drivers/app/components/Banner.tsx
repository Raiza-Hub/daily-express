export function cookieConsentGiven() {
  const value = localStorage.getItem("cookie_consent");
  if (!value) return "undecided";
  return value;
}
