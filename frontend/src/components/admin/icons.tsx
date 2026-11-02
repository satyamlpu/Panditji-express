/**
 * Centralized admin icon registry. Every admin surface (nav, shell, kit, pages)
 * renders icons through <Icon name="..." /> so the icon set stays consistent and
 * swapping one icon is a single edit here. All icons are Lucide (clean vector
 * SVG, consistent stroke). Do NOT import lucide-react directly in admin UI.
 */
import {
  Activity,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  FileText,
  FolderTree,
  Globe,
  Headset,
  HelpCircle,
  Images,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  MapPin,
  Menu,
  MessageSquareQuote,
  PanelLeft,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Star,
  Users,
  UserRoundCheck,
  X,
  type LucideIcon,
} from "lucide-react";

export const ICONS = {
  // Modules
  dashboard: LayoutDashboard,
  website: Globe,
  app: Smartphone,
  // Website module
  services: BriefcaseBusiness,
  categories: FolderTree,
  locations: MapPin,
  testimonials: MessageSquareQuote,
  faqs: HelpCircle,
  pages: FileText,
  homepage: LayoutTemplate,
  media: Images,
  seo: Search,
  enquiries: Inbox,
  settings: Settings,
  // App & CRM module
  operations: Activity,
  customers: Users,
  partners: UserRoundCheck,
  bookings: CalendarCheck,
  finance: IndianRupee,
  reviews: Star,
  support: Headset,
  analytics: ChartNoAxesCombined,
  security: ShieldCheck,
  // Shell chrome
  logout: LogOut,
  bell: Bell,
  help: CircleHelp,
  search: Search,
  menu: Menu,
  close: X,
  collapse: PanelLeftClose,
  expand: PanelLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  switcher: ChevronsUpDown,
  arrowRight: ArrowRight,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
