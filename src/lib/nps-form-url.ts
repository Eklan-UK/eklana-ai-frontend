/** Google Forms view URLs (docs.google.com/forms or forms.gle short links). */
export const GOOGLE_FORMS_URL_PATTERN =
  /^https:\/\/(docs\.google\.com\/forms\/d(\/e)?\/[a-zA-Z0-9_-]+\/viewform(\?[^\s]*)?|forms\.gle\/[a-zA-Z0-9_-]+(\?[^\s]*)?)$/i;

export function isValidGoogleFormsUrl(url: string): boolean {
  return GOOGLE_FORMS_URL_PATTERN.test(url.trim());
}
