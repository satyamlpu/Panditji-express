/** Shapes mirrored from the backend API schemas. */

export interface CategoryRef {
  id: string;
  slug: string;
  name: string;
}

/** Compact thumbnail embedded in service/category payloads (public + admin). */
export interface Thumbnail {
  url: string;
  thumb_url: string | null;
  alt: string | null;
}

export interface ServiceListItem {
  slug: string;
  title: string;
  title_hi?: string | null;
  summary: string | null;
  price_rupees: number | null;
  price_display: string;
  duration_label: string | null;
  category: CategoryRef | null;
  thumbnail: Thumbnail | null;
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
  title_hi?: string | null;
  summary: string | null;
  description: string | null;
  price_rupees: number | null;
  price_display: string;
  duration_label: string | null;
  inclusions: string[];
  samagri: string[];
  is_featured: boolean;
  category: CategoryRef | null;
  thumbnail: Thumbnail | null;
  faqs: FaqPublic[];
  seo: SeoResolved;
}

export interface CategoryPublic {
  slug: string;
  name: string;
  description: string | null;
  service_count: number;
  thumbnail: Thumbnail | null;
}

export interface ServiceCard {
  slug: string;
  title: string;
  title_hi?: string | null;
  summary: string | null;
  price_display: string;
  duration_label: string | null;
  thumbnail: Thumbnail | null;
}

export interface CategoryDetail {
  slug: string;
  name: string;
  description: string | null;
  thumbnail: Thumbnail | null;
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
  thumbnail_media_id: string | null;
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

/** Media Library asset. */
export interface MediaAsset {
  id: string;
  url: string;
  thumb_url: string | null;
  filename: string;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaUploadResult extends MediaAsset {
  warnings: string[];
}

export interface ContentRevision {
  id: string;
  entity_type: string;
  entity_id: string;
  version: number;
  action: string;
  snapshot: Record<string, unknown> | null;
  actor_email: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  entity: string | null;
  entity_id: string | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface SyncStatus {
  revalidation_configured: boolean;
  frontend_revalidate_url: string;
  revalidation_reachable: boolean;
  revalidation_detail: string;
  revalidation_secret_is_default: boolean;
  last_result: { ok: boolean; detail: string; tags: string[]; at: number } | null;
  database: string;
  media_storage_backend: string;
  environment: string;
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
