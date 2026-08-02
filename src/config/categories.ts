/** Default UK-friendly document categories. Stored as slugs in the DB. */
export const CATEGORIES = [
  { slug: 'pensions', label: 'Pensions', icon: 'trending-up' },
  { slug: 'insurance', label: 'Insurance', icon: 'shield-outline' },
  { slug: 'home_property', label: 'Home and property', icon: 'home-outline' },
  { slug: 'mortgage', label: 'Mortgage', icon: 'key-outline' },
  { slug: 'tax_hmrc', label: 'Tax and HMRC', icon: 'receipt-outline' },
  { slug: 'banking', label: 'Banking', icon: 'card-outline' },
  { slug: 'utilities', label: 'Utilities', icon: 'flash-outline' },
  { slug: 'medical_nhs', label: 'Medical and NHS', icon: 'medkit-outline' },
  { slug: 'childcare_school', label: 'Childcare and school', icon: 'school-outline' },
  { slug: 'work_employment', label: 'Work and employment', icon: 'briefcase-outline' },
  { slug: 'business', label: 'Business', icon: 'business-outline' },
  { slug: 'vehicle', label: 'Vehicle', icon: 'car-outline' },
  { slug: 'warranties_purchases', label: 'Warranties and purchases', icon: 'pricetag-outline' },
  { slug: 'legal', label: 'Legal', icon: 'document-text-outline' },
  { slug: 'identity_certificates', label: 'Identity and certificates', icon: 'id-card-outline' },
  { slug: 'other', label: 'Other', icon: 'folder-open-outline' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

export function categoryLabel(slug: string | null | undefined): string {
  const found = CATEGORIES.find((c) => c.slug === slug);
  return found ? found.label : 'Other';
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}
