/** Shapes mirrored from the backend API schemas. */

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

export interface ServiceListItem {
  slug: string;
  title: string;
  summary: string | null;
  price_rupees: number | null;
  price_display: string;
  duration_label: string | null;
  category: CategoryRef | null;
  is_featured: boolean;
}

export interface FaqPublic {
  question: string;
  answer: string;
}

export interface SeoResolved {
  title: string;
  description: string | null;
  og_title: string;
  og_description: string | null;
  canonical_path: string;
}

export interface ServiceDetail {
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  price_rupees: number | null;
  price_display: string;
  duration_label: string | null;
  inclusions: string[];
  samagri: string[];
  is_featured: boolean;
  category: CategoryRef | null;
  faqs: FaqPublic[];
  seo: SeoResolved;
}

export interface CategoryPublic {
  slug: string;
  name: string;
  description: string | null;
  service_count: number;
}

export interface ServiceCard {
  slug: string;
  title: string;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
}

export interface CategoryDetail {
  slug: string;
  name: string;
  description: string | null;
  services: ServiceCard[];
  seo: SeoResolved;
}

export interface LocationListItem {
  slug: string;
  city: string;
  region: string | null;
  service_count: number;
}

export interface LocationDetail {
  slug: string;
  city: string;
  region: string | null;
  description: string | null;
  services: ServiceCard[];
  seo: SeoResolved;
}

export interface Testimonial {
  author_name: string;
  author_location: string | null;
  service_label: string | null;
  quote: string;
  rating: number | null;
}

export interface FaqGroup {
  topic: string;
  items: FaqPublic[];
}

export interface PageContent {
  slug: string;
  title: string;
  body: string | null;
  seo: SeoResolved;
}

export interface HomepageSection {
  kind: string;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  sort_order: number;
}

/** Admin shapes */
export interface ServiceAdmin extends ServiceListItem {
  id: string;
  description: string | null;
  inclusions: string[];
  samagri: string[];
  sort_order: number;
  status: "draft" | "published" | "unpublished";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Me {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
}
