/**
 * Central brand configuration.
 *
 * "Paperkeep" is a working title. Changing the product name, tagline or
 * brand colours here updates the whole app — nothing else should hard-code
 * these values. (app.json `name`/`slug` must be updated alongside for
 * native builds.)
 */
export const brand = {
  /** Product display name. */
  name: 'Paperkeep',
  /** Short strapline used on onboarding and auth screens. */
  tagline: 'Your household paperwork, remembered.',
  /** One-line description used in settings/about. */
  description:
    'A private place for household paperwork. Photograph letters or import PDFs, and ask for the details whenever you need them.',
  /** Support contact shown in settings (placeholder for MVP). */
  supportEmail: 'support@example.com',
  /** URL scheme for deep links; keep aligned with app.json `scheme`. */
  urlScheme: 'paperkeep',
} as const;

export type Brand = typeof brand;
