/**
 * Icon system — a single curated set of vector icons (lucide-react-native) with
 * a consistent default size and stroke. Screens reference semantic names
 * (`"home"`, `"verified"`, …) so the underlying icon library stays swappable and
 * the visual language stays uniform. NO emoji anywhere in the UI.
 * Shared design system — mirrored into both apps.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRing,
  BadgeCheck,
  CalendarDays,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  CreditCard,
  Flame,
  Gift,
  Headset,
  Home,
  Languages,
  LifeBuoy,
  ListChecks,
  LogOut,
  MapPin,
  Minus,
  Moon,
  Navigation,
  Phone,
  Plus,
  Power,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  TriangleAlert,
  User,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useColors } from "./theme";

/** Semantic icon registry — the project's vocabulary, not lucide's. */
export const ICONS = {
  // nav / tabs
  home: Home,
  bookings: ListChecks,
  pujas: ScrollText,
  alerts: Bell,
  alertsActive: BellRing,
  profile: User,
  earnings: Wallet,
  // actions / chrome
  location: MapPin,
  search: Search,
  filters: SlidersHorizontal,
  back: ArrowLeft,
  forward: ArrowRight,
  chevron: ChevronRight,
  expand: ChevronDown,
  close: X,
  add: Plus,
  remove: Minus,
  check: Check,
  checkCircle: CheckCircle2,
  refresh: RefreshCw,
  share: Share2,
  signout: LogOut,
  settings: Settings,
  power: Power,
  // domain
  verified: BadgeCheck,
  shield: ShieldCheck,
  security: Shield,
  payments: CreditCard,
  wallet: Wallet,
  calendar: CalendarDays,
  schedule: CalendarClock,
  clock: Clock,
  navigation: Navigation,
  rating: Star,
  support: Headset,
  help: CircleHelp,
  lifebuoy: LifeBuoy,
  phone: Phone,
  language: Languages,
  camera: Camera,
  samagri: Gift,
  offer: Tag,
  havan: Flame,
  blessing: Sparkles,
  warning: TriangleAlert,
  offline: WifiOff,
  night: Moon,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 2,
  fill,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const colors = useColors();
  const Cmp = ICONS[name];
  return (
    <Cmp size={size} color={color ?? colors.ink} strokeWidth={strokeWidth} fill={fill ?? "none"} />
  );
}
