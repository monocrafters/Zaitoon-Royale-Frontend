"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  House,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  ShoppingCart,
  TicketPercent,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/admin-auth";
import { addItemToCart, useCartUnreadCount } from "@/lib/cart-client";
import { useCustomerSession } from "@/lib/customer-auth";
import { fetchPublicReviewSummariesByTitles, type ProductReviewSummary } from "@/lib/reviews-client";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

type PublicProduct = {
  _id: string;
  name: string;
  price?: number;
  hasSizePricing?: boolean;
  sizePrices?: {
    small?: number;
    medium?: number;
    large?: number;
    xlarge?: number;
  };
  imageUrl?: string;
  description?: string;
  badge?:
    | ""
    | "Trending"
    | "Most Ordered"
    | "Best Seller"
    | "New Arrival"
    | "Chef's Special"
    | "Limited Deal";
  category?: {
    name?: string;
  };
};

const getProductCardPrice = (product: PublicProduct) => {
  if (product.hasSizePricing) return Number(product.sizePrices?.medium) || Number(product.price) || 0;
  return Number(product.price) || 0;
};

const shuffleArray = <T,>(arr: T[]) => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const baseHomeNavLinks = [
  { href: "#home", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact-us", label: "Contact" },
  { href: "/support", label: "Support" },
];

// NOTE: don't cache popular products aggressively on the homepage
// so badge changes in admin reflect immediately.
const POPULAR_PRODUCTS_CACHE_KEY = "restaurant_public_products_cache_v1";
const POPULAR_PRODUCTS_CACHE_TS_KEY = "restaurant_public_products_cache_ts_v1";
const CATEGORIES_CACHE_KEY = "restaurant_public_categories_cache_v1";
const CATEGORIES_CACHE_TS_KEY = "restaurant_public_categories_cache_ts_v1";
const DEALS_CACHE_KEY = "restaurant_public_deals_cache_v1";
const DEALS_CACHE_TS_KEY = "restaurant_public_deals_cache_ts_v1";
const HOME_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const fallbackCategories = [
  {
    name: "Pizza",
    image:
      "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Burger",
    image:
      "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "BBQ",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Drinks",
    image:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80",
  },
];

const fallbackReviews = [
  {
    name: "Ali Raza",
    productTitle: "Zaitoon Special",
    review: "Amazing taste and super quick delivery. Their burgers are always fresh and juicy.",
    rating: 4.5,
  },
  {
    name: "Ayesha Khan",
    productTitle: "Family Deal",
    review: "Family deal was worth it. Portion size, quality, and packaging were all top-notch.",
    rating: 4.9,
  },
  {
    name: "Hamza Sheikh",
    productTitle: "BBQ Platter",
    review: "Premium vibe and consistent flavor every time. Highly recommended for BBQ lovers.",
    rating: 4.7,
  },
];

type PublicDeal = {
  _id: string;
  items?: Array<{
    product: {
      _id: string;
      name: string;
      price?: number;
      imageUrl?: string;
      description?: string;
      hasSizePricing?: boolean;
      sizePrices?: { small?: number; medium?: number; large?: number; xlarge?: number };
    };
    qty: number;
    size?: "small" | "medium" | "large" | "xlarge" | "";
  }>;
  products?: Array<{
    _id: string;
    name: string;
    price?: number;
    imageUrl?: string;
    description?: string;
  }>;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  discountType?: "percent" | "flat" | "none";
  discountValue?: number;
  couponCode?: string;
  imageUrl?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  theme?: "warm" | "dark" | "green" | "purple" | "blue";
  ctaLabel?: string;
  ctaHref?: string;
  detailHref?: string;
  pricing?: { originalPrice: number; finalPrice: number };
};

type HeroProduct = {
  _id: string;
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
};

type HeroDeal = {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  endsAt?: string | null;
  discountType?: "percent" | "flat" | "none";
  discountValue?: number;
  items?: Array<{
    product: HeroProduct & { hasSizePricing?: boolean; sizePrices?: any };
    qty: number;
    size?: string;
  }>;
  products?: HeroProduct[];
};

type HeroSlide = {
  _id: string;
  kind: "product" | "deal";
  product?: HeroProduct | null;
  deal?: HeroDeal | null;
  headline?: string;
  subheadline?: string;
  badge?: string;
  dealEndsAt?: string | null;
  isActive?: boolean;
  order?: number;
};

type HomeReview = {
  name: string;
  productTitle: string;
  imageUrl?: string;
  review: string;
  rating: number;
};

const HERO_CACHE_KEY = "restaurant_public_hero_cache_v1";

const fallbackHeroSlides: HeroSlide[] = [
  {
    _id: "fallback-1",
    kind: "product",
    badge: "Best Seller",
    headline: "Smash Truffle Burger",
    subheadline: "Premium beef patty, rich sauce, and a clean modern finish.",
    dealEndsAt: null,
    product: {
      _id: "fallback-p1",
      name: "Smash Truffle Burger",
      description: "Premium beef patty, rich sauce, and a clean modern finish.",
      price: 1050,
      imageUrl:
        "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    _id: "fallback-2",
    kind: "deal",
    badge: "Limited Deal",
    headline: "Family Feast Deal",
    subheadline: "2 burgers, 1 pizza, fries, and drinks — perfect for a family night.",
    dealEndsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    product: {
      _id: "fallback-p2",
      name: "Family Feast Deal",
      description: "2 burgers, 1 pizza, fries, and drinks — perfect for a family night.",
      price: 2999,
      imageUrl:
        "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    _id: "fallback-3",
    kind: "product",
    badge: "Trending",
    headline: "Charcoal BBQ Platter",
    subheadline: "Smoky charcoal BBQ with premium marinades and sides.",
    dealEndsAt: null,
    product: {
      _id: "fallback-p3",
      name: "Charcoal BBQ Platter",
      description: "Smoky charcoal BBQ with premium marinades and sides.",
      price: 2350,
      imageUrl:
        "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80",
    },
  },
];

function formatCountdown(ms: number) {
  if (ms <= 0) return { days: "00", hours: "00", minutes: "00", seconds: "00" };
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / 86400)).padStart(2, "0");
  const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return { days, hours, minutes, seconds };
}

function formatDealCountdown(endIso: string | null | undefined) {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return { days: "00", hours: "00", minutes: "00", seconds: "00", ended: true };
  const totalSeconds = Math.floor(ms / 1000);
  const days = String(Math.floor(totalSeconds / 86400)).padStart(2, "0");
  const hours = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return { days, hours, minutes, seconds, ended: false };
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const cartUnreadCount = useCartUnreadCount();
  const { hasSession, profile } = useCustomerSession();
  const settings = useRestaurantSettings();
  const [isMounted, setIsMounted] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const showSessionActions = isMounted && hasSession;
  const customerName = useMemo(() => String(profile?.name || "").trim(), [profile?.name]);
  const customerPhone = useMemo(() => String(profile?.phone || "").trim(), [profile?.phone]);
  const customerInitial = customerName ? customerName.charAt(0).toUpperCase() : "U";
  const customerAvatar = String(profile?.profileImageUrl || "").trim();
  // Hydration safety: only render dynamic profile info after mount.
  const displayName = isMounted ? customerName : "";
  const displayPhone = isMounted ? customerPhone : "";
  const displayAvatar = isMounted ? customerAvatar : "";
  const displayInitial = isMounted ? customerInitial : "U";
  const [activeCategory, setActiveCategory] = useState("All");
  const [timeLeft, setTimeLeft] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroTick, setHeroTick] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const heroThumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heroThumbStripRef = useRef<HTMLDivElement | null>(null);
  const handleAddToCart = async (productId: string, clickedEl?: HTMLElement | null) => {
    if (!productId) return;
    await addItemToCart(productId, "", 1, clickedEl);
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const target = new Date();
    target.setHours(target.getHours() + 18);

    const tick = () => setTimeLeft(target.getTime() - Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const slider = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % Math.max(1, heroSlides.length));
    }, 5200);
    return () => clearInterval(slider);
  }, [heroSlides.length]);

  useEffect(() => {
    const el = heroThumbRefs.current[heroIndex];
    if (!el) return;
    // Only auto-scroll thumbnails when the strip is visible.
    // Otherwise it causes the whole page to jump while user is scrolled down.
    const strip = heroThumbStripRef.current;
    if (strip) {
      const r = strip.getBoundingClientRect();
      const isInViewport = r.bottom > 0 && r.top < window.innerHeight;
      if (!isInViewport) return;
    }
    if (!strip) return;
    const elRect = el.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const elCenter = elRect.left - stripRect.left + elRect.width / 2;
    const target = elCenter - stripRect.width / 2;
    strip.scrollTo({ left: Math.max(0, target + strip.scrollLeft), behavior: "smooth" });
  }, [heroIndex]);

  useEffect(() => {
    const tick = setInterval(() => setHeroTick((v) => v + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [popularProducts, setPopularProducts] = useState<PublicProduct[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState("");

  const [publicCategories, setPublicCategories] = useState<Array<{ _id?: string; name: string; imageUrl?: string; image?: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");

  const [publicDeals, setPublicDeals] = useState<PublicDeal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState("");
  const [dealCarouselIndex, setDealCarouselIndex] = useState(0);
  const [homeReviews, setHomeReviews] = useState<HomeReview[]>(fallbackReviews);
  const reviewsStripRef = useRef<HTMLDivElement | null>(null);
  const [reviewSummaryByTitle, setReviewSummaryByTitle] = useState<Record<string, ProductReviewSummary>>({});

  useEffect(() => {
    const loadPopularProducts = async () => {
      try {
        const now = Date.now();
        const cached = typeof window !== "undefined" ? window.sessionStorage.getItem(POPULAR_PRODUCTS_CACHE_KEY) : null;
        const cachedTs = typeof window !== "undefined" ? Number(window.sessionStorage.getItem(POPULAR_PRODUCTS_CACHE_TS_KEY) || 0) : 0;
        const isFresh = cached && cachedTs && now - cachedTs < HOME_CACHE_TTL_MS;

        if (cached) {
          try {
            const parsed = JSON.parse(cached) as PublicProduct[];
            if (Array.isArray(parsed)) setPopularProducts(shuffleArray(parsed));
          } catch {
            // ignore
          }
        }

        if (isFresh) {
          setPopularLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/products/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load products.");
        const loaded: PublicProduct[] = payload.products || [];
        setPopularProducts(shuffleArray(loaded));
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(POPULAR_PRODUCTS_CACHE_KEY, JSON.stringify(loaded));
          window.sessionStorage.setItem(POPULAR_PRODUCTS_CACHE_TS_KEY, String(Date.now()));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load products.";
        setPopularError(message);
      } finally {
        setPopularLoading(false);
      }
    };

    loadPopularProducts();
  }, []);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const now = Date.now();
        const cached = typeof window !== "undefined" ? window.sessionStorage.getItem(DEALS_CACHE_KEY) : null;
        const cachedTs = typeof window !== "undefined" ? Number(window.sessionStorage.getItem(DEALS_CACHE_TS_KEY) || 0) : 0;
        const isFresh = cached && cachedTs && now - cachedTs < HOME_CACHE_TTL_MS;
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as PublicDeal[];
            if (Array.isArray(parsed)) setPublicDeals(parsed);
          } catch {
            // ignore bad cache
          }
        }
        if (isFresh) {
          setDealsLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/deals/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load deals.");
        const loaded: PublicDeal[] = payload.deals || [];
        setPublicDeals(loaded);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(DEALS_CACHE_KEY, JSON.stringify(loaded));
          window.sessionStorage.setItem(DEALS_CACHE_TS_KEY, String(Date.now()));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load deals.";
        setDealsError(message);
      } finally {
        setDealsLoading(false);
      }
    };

    loadDeals();
  }, []);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/reviews/public?limit=9`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load reviews.");
        const incoming = Array.isArray(payload.reviews) ? (payload.reviews as Array<Record<string, unknown>>) : [];
        const mapped: HomeReview[] = incoming
          .map((r) => ({
            name: String(r.customerName || "Customer"),
            productTitle: String(r.productTitle || "Product"),
            imageUrl: String(r.productImageUrl || ""),
            review: String(r.reviewText || "").trim() || "Great food and smooth delivery experience.",
            rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
          }))
          .filter((r) => r.name && r.review);
        if (mapped.length > 0) setHomeReviews(mapped);
      } catch {
        // keep fallback reviews
      }
    };
    void loadReviews();
  }, []);

  useEffect(() => {
    const titles = new Set<string>();
    for (const p of popularProducts) {
      const name = String(p.name || "").trim();
      if (name) titles.add(name);
    }
    for (const d of publicDeals) {
      for (const it of d.items || []) {
        const name = String(it?.product?.name || "").trim();
        if (name) titles.add(name);
      }
      for (const p of d.products || []) {
        const name = String(p?.name || "").trim();
        if (name) titles.add(name);
      }
    }
    if (!titles.size) return;
    let cancelled = false;
    const run = async () => {
      try {
        const data = await fetchPublicReviewSummariesByTitles(Array.from(titles));
        if (cancelled) return;
        const map: Record<string, ProductReviewSummary> = {};
        for (const s of data.summaries || []) map[s.productTitle] = s;
        setReviewSummaryByTitle(map);
      } catch {
        if (!cancelled) setReviewSummaryByTitle({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [popularProducts, publicDeals]);

  const scrollReviews = (dir: "left" | "right") => {
    const node = reviewsStripRef.current;
    if (!node) return;
    const amount = Math.max(220, Math.floor(node.clientWidth * 0.7));
    node.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  useEffect(() => {
    if (!publicDeals || publicDeals.length < 2) return;
    const timer = setInterval(() => {
      setDealCarouselIndex((i) => (i + 1) % publicDeals.length);
    }, 6200);
    return () => clearInterval(timer);
  }, [publicDeals]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const now = Date.now();
        const cached = typeof window !== "undefined" ? window.sessionStorage.getItem(CATEGORIES_CACHE_KEY) : null;
        const cachedTs = typeof window !== "undefined" ? Number(window.sessionStorage.getItem(CATEGORIES_CACHE_TS_KEY) || 0) : 0;
        const isFresh = cached && cachedTs && now - cachedTs < HOME_CACHE_TTL_MS;

        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Array<{ _id?: string; name: string; imageUrl?: string; image?: string }>;
            if (Array.isArray(parsed)) setPublicCategories(parsed);
          } catch {
            // ignore
          }
        }

        if (isFresh) {
          setCategoriesLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/categories/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.message || "Unable to load categories.");
        const loaded = payload.categories || [];
        const mapped = loaded.map((c: any) => ({
          _id: c._id,
          name: c.name,
          imageUrl: c.imageUrl,
          image: c.imageUrl,
        }));
        setPublicCategories(mapped);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(mapped));
          window.sessionStorage.setItem(CATEGORIES_CACHE_TS_KEY, String(Date.now()));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load categories.";
        setCategoriesError(message);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadHero = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/hero/public`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) return;
        const loaded: HeroSlide[] = payload.slides || [];
        if (Array.isArray(loaded) && loaded.length > 0) {
          setHeroSlides(loaded);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(HERO_CACHE_KEY, JSON.stringify(loaded));
          }
        }
      } catch {
        // keep empty; skeleton remains if backend fails
      } finally {
        setHeroLoading(false);
      }
    };

    loadHero();
  }, []);

  const countdown = useMemo(() => formatCountdown(timeLeft), [timeLeft]);

  const visibleItems = useMemo(() => {
    if (activeCategory === "All") return popularProducts;
    return popularProducts.filter((item) => item.category?.name === activeCategory);
  }, [activeCategory, popularProducts]);

  const activeHero = heroSlides[heroIndex] || heroSlides[0];
  const dealCountdown = useMemo(() => {
    // depends on heroTick to re-render each second
    void heroTick;
    if (!activeHero || activeHero.kind !== "deal") return null;
    const end = activeHero.dealEndsAt || activeHero.deal?.endsAt || null;
    return formatDealCountdown(end);
  }, [activeHero, heroTick]);

  const getHeroDealProducts = (deal?: HeroDeal | null) => {
    if (!deal) return "";
    const items = deal.items || [];
    if (items.length) {
      const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
      return items
        .filter((it) => it?.product?._id)
        .map((it) => {
          const qty = Math.max(1, Number(it.qty) || 1);
          const size = String(it.size || "").trim();
          const label = size ? `${cap(size)} ${it.product.name}` : it.product.name;
          return `${qty}x ${label}`;
        })
        .join(" • ");
    }
    const legacy = deal.products || [];
    return legacy.map((p) => `1x ${p.name}`).join(" • ");
  };

  const computeDealPrice = (deal?: HeroDeal | null) => {
    if (!deal) return { finalPrice: 0, originalPrice: 0 };
    const items = deal.items || [];
    const base =
      items.length > 0
        ? items.reduce((s, it) => s + (Number(it.product?.price) || 0) * Math.max(1, Number(it.qty) || 1), 0)
        : (deal.products || []).reduce((s, p) => s + (Number(p.price) || 0), 0);

    const discountType = deal.discountType || "none";
    const v = Number(deal.discountValue) || 0;
    if (discountType === "percent") return { originalPrice: base, finalPrice: Math.max(0, Math.round(base - (base * Math.max(0, v)) / 100)) };
    if (discountType === "flat") return { originalPrice: base, finalPrice: Math.max(0, Math.round(base - Math.max(0, v))) };
    return { originalPrice: base, finalPrice: Math.max(0, Math.round(base)) };
  };

  const getBadgePill = (badge?: PublicProduct["badge"]) => {
    const normalized = (badge || "").trim();
    if (!normalized) return { label: "", className: "" };

    const lower = normalized.toLowerCase();
    if (lower.includes("best")) return { label: normalized, className: "bg-[#1f7a3a]" };
    if (lower.includes("most")) return { label: normalized, className: "bg-[#b84a2b]" };
    if (lower.includes("trend")) return { label: normalized, className: "bg-[#e07a2f]" };
    if (lower.includes("new arrival")) return { label: normalized, className: "bg-[#5b2d17]" };
    if (lower.includes("chef")) return { label: normalized, className: "bg-[#7a3f22]" };
    if (lower.includes("limited")) return { label: normalized, className: "bg-[#ff4d4d]" };

    // Unknown/extra badges still show (premium fallback).
    return { label: normalized, className: "bg-[#5b2d17]" };
  };

  const getProductReviewSummary = (title?: string) => {
    const key = String(title || "").trim();
    if (!key) return undefined;
    return reviewSummaryByTitle[key];
  };

  const getDealReviewMeta = (deal: PublicDeal) => {
    const names: string[] = [];
    for (const it of deal.items || []) {
      const n = String(it?.product?.name || "").trim();
      if (n) names.push(n);
    }
    for (const p of deal.products || []) {
      const n = String(p?.name || "").trim();
      if (n) names.push(n);
    }
    const summaries = names.map((n) => getProductReviewSummary(n)).filter(Boolean) as ProductReviewSummary[];
    if (!summaries.length) return { avgRating: 0, count: 0, orderCount: 0, latestReviewText: "" };
    const totalCount = summaries.reduce((s, x) => s + (Number(x.count) || 0), 0);
    const totalOrders = summaries.reduce((s, x) => s + (Number(x.orderCount) || 0), 0);
    if (!totalCount) return { avgRating: 0, count: 0, orderCount: totalOrders, latestReviewText: summaries[0]?.latestReviewText || "" };
    const weighted = summaries.reduce((s, x) => s + (Number(x.avgRating) || 0) * (Number(x.count) || 0), 0);
    return { avgRating: weighted / totalCount, count: totalCount, orderCount: totalOrders, latestReviewText: summaries[0]?.latestReviewText || "" };
  };

  const getDealProductsSummary = (deal: PublicDeal) => {
    const items = deal.items || [];
    if (items.length) {
      const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
      return items
        .filter((it) => it?.product?._id)
        .map((it) => {
          const qty = Math.max(1, Number(it.qty) || 1);
          const size = String(it.size || "").trim();
          const label = size ? `${cap(size)} ${it.product.name}` : it.product.name;
          return `${qty}x ${label}`;
        })
        .join(" • ");
    }

    // Backward compat (older responses might still send products[])
    const legacy = deal.products || [];
    if (legacy.length === 0) return "";
    const map = new Map<string, { name: string; qty: number }>();
    for (const p of legacy) {
      const id = p?._id || p?.name || "";
      if (!id) continue;
      const prev = map.get(id);
      if (prev) prev.qty += 1;
      else map.set(id, { name: p?.name || "Item", qty: 1 });
    }
    return Array.from(map.values()).map((x) => `${x.qty}x ${x.name}`).join(" • ");
  };
  const mobileItems = [
    { href: "/", label: "Home", icon: House, active: pathname === "/" },
    { href: "/menu", label: "Menu", icon: UtensilsCrossed, active: pathname === "/menu" || pathname?.startsWith("/product") || pathname?.startsWith("/category") },
    { href: "/offers", label: "Deals", icon: TicketPercent, active: pathname === "/offers" || pathname?.startsWith("/deal") },
    { href: "/cart", label: "Cart", icon: ShoppingCart, active: pathname === "/cart" || pathname === "/checkout" || pathname === "/confirmation" },
    ...(showSessionActions
      ? [{ href: "/orders", label: "Orders", icon: Package, active: pathname === "/orders" || pathname?.startsWith("/orders/") }]
      : []),
  ];

  return (
    <main className="bg-[#f5efe8] text-[#2f1c12] antialiased">
      <header
        className={[
          "fixed top-0 z-50 w-full transition-all duration-200",
          scrolled
            ? "border-b border-[#cfb9a6] bg-[#e5cfbc]/96 shadow-[0_10px_28px_rgba(72,44,26,0.16)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#e5cfbc]/90"
            : "border-b border-transparent bg-transparent",
        ].join(" ")}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="#home" className="flex items-center gap-3">
            <div className="flex h-10 w-auto items-center">
              {settings.adminLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.adminLogoUrl} alt={settings.brandName} className="h-10 w-auto max-w-[220px] object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5b2d17] text-white">
                  ZR
                </div>
              )}
            </div>
            <div>
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold">{settings.brandName}</p>
              <p className="text-xs text-[#7f6757]">{settings.tagline}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {baseHomeNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-[family-name:var(--font-poppins)] text-sm text-[#6f5647] transition hover:text-[#2f1c12]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {showSessionActions ? (
              <Link
                href="/orders"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#dccbbb] bg-white px-2.5 py-2 text-sm font-semibold text-[#5b2d17] transition hover:bg-[#f6ece2] sm:px-3"
              >
                <Package className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" aria-hidden />
                Orders
              </Link>
            ) : null}
            <Link
              href="/cart"
              className="relative rounded-xl border border-[#dccbbb] bg-white p-2.5 text-[#5b2d17] transition hover:bg-[#f6ece2]"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartUnreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#b84a2b] px-1.5 text-[10px] font-bold leading-5 text-white">
                  {cartUnreadCount > 99 ? "99+" : cartUnreadCount}
                </span>
              ) : null}
            </Link>
            {showSessionActions ? (
              <Link
                href="/profile/edit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17] transition hover:bg-[#f6ece2]"
                aria-label="Edit profile"
              >
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayAvatar} alt={displayName || "Profile"} className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e4d7] text-xs font-semibold text-[#5b2d17]">
                    {displayInitial}
                  </span>
                )}
              </Link>
            ) : null}
          </div>
          <div className="inline-flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <div className={`fixed inset-0 z-[70] transition-opacity duration-300 lg:hidden ${isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}>
        <button
          type="button"
          aria-label="Close menu"
          className="absolute inset-0 bg-black/35"
          onClick={() => setSidebarOpen(false)}
        />
        <aside className={`absolute right-0 top-0 flex h-full w-[80%] max-w-[295px] flex-col border-l border-[#dccbbb] bg-[#fffaf4] px-4 pb-5 pt-4 shadow-2xl transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-start justify-between gap-2 rounded-2xl border border-[#e7d7c9] bg-[#fff3e7] p-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayAvatar} alt={displayName || "Profile"} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f3e4d7] text-base font-semibold text-[#5b2d17]">
                  {displayInitial}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#2f1c12]">{displayName || "Guest Customer"}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#6f5647]">
                  <Phone className="h-3.5 w-3.5" />
                  {displayPhone || "+92 300 1234567"}
                </p>
              </div>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1.5">
              <Link href="/profile/edit" onClick={() => setSidebarOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-white text-[#5b2d17]">
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dccbbb] bg-white text-[#5b2d17]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a6f5e]">Quick menu</p>
            <nav className="mt-2 space-y-2">
              <Link onClick={() => setSidebarOpen(false)} href="/about" className="block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">About</Link>
              <Link onClick={() => setSidebarOpen(false)} href="/contact-us" className="block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">Contact Us</Link>
              <Link onClick={() => setSidebarOpen(false)} href="/support" className="block rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-[#2f1c12]">Support</Link>
            </nav>
          </div>
          <div className="mt-auto pt-4">
            <p className="text-sm font-semibold text-[#5b2d17]">{settings.brandName}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[#6f5647]"><MapPin className="h-3.5 w-3.5 shrink-0" /> {settings.contactAddress}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-[#6f5647]"><Phone className="h-3.5 w-3.5 shrink-0" /> {settings.contactPhone}</p>
            <div className="mt-3 flex items-center gap-3 text-[#7a3f22]">
              <a href={settings.socialLinks.instagram || "https://instagram.com"} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
              </a>
              <a href={settings.socialLinks.youtube || "https://youtube.com"} target="_blank" rel="noreferrer" aria-label="YouTube" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M21 8.5a2.4 2.4 0 0 0-1.7-1.7C17.8 6.4 12 6.4 12 6.4s-5.8 0-7.3.4A2.4 2.4 0 0 0 3 8.5 25 25 0 0 0 2.6 12c0 1.2.1 2.3.4 3.5a2.4 2.4 0 0 0 1.7 1.7c1.5.4 7.3.4 7.3.4s5.8 0 7.3-.4a2.4 2.4 0 0 0 1.7-1.7c.3-1.2.4-2.3.4-3.5 0-1.2-.1-2.3-.4-3.5ZM10.2 14.8V9.2L15 12l-4.8 2.8Z"/></svg>
              </a>
              <a href={settings.socialLinks.tiktok || "https://www.tiktok.com"} target="_blank" rel="noreferrer" aria-label="TikTok" className="rounded-xl bg-white p-2.5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M14.5 3c.4 1.9 1.5 3.1 3.5 3.4v2.6c-1.4 0-2.6-.4-3.5-1v6c0 3-2.2 5-5.1 5-2.7 0-4.9-2-4.9-4.8s2.2-4.8 4.9-4.8c.3 0 .7 0 1 .1V12a2.7 2.7 0 0 0-1-.2c-1.5 0-2.5 1-2.5 2.4s1 2.4 2.5 2.4c1.6 0 2.5-1 2.5-2.8V3h2.6Z"/></svg>
              </a>
            </div>
          </div>
        </aside>
      </div>

      <section
        id="home"
        className="mx-auto max-w-7xl px-4 pb-5 pt-[88px] sm:px-6 sm:pb-8 sm:pt-[104px]"
      >
        <div className="relative flex min-h-0 flex-col sm:min-h-[calc(100vh-104px)]">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]">
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,#000_0,transparent_50%),radial-gradient(circle_at_80%_30%,#000_0,transparent_55%),radial-gradient(circle_at_40%_80%,#000_0,transparent_55%)]" />
          </div>

          <div className="min-h-0 flex-none sm:flex-none">
            {heroLoading || !activeHero ? (
              <div className="grid grid-cols-[0.85fr_1.15fr] items-center gap-2 sm:gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:min-h-[380px]">
                <div className="flex items-center justify-center">
                  <div className="h-[132px] w-[132px] animate-pulse rounded-full bg-[#e9ded3] sm:h-[380px] sm:w-[380px] lg:h-[430px] lg:w-[430px]" />
                </div>
                <div className="space-y-3">
                  <div className="h-6 w-24 animate-pulse rounded-full bg-[#e9ded3]" />
                  <div className="h-10 w-4/5 animate-pulse rounded-2xl bg-[#e9ded3]" />
                  <div className="h-16 w-full animate-pulse rounded-2xl bg-[#e9ded3]" />
                  <div className="h-10 w-48 animate-pulse rounded-2xl bg-[#e9ded3]" />
                </div>
              </div>
            ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`hero-${activeHero?._id || heroIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.26 }}
                className="grid grid-cols-[0.85fr_1.15fr] items-center gap-2 sm:gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:min-h-[380px]"
              >
                {/* Left: main product image (no box) */}
                <div className="relative flex items-center justify-center">
                  <motion.div
                    key={`hero-img-${activeHero?._id || heroIndex}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="relative h-[132px] w-[132px] sm:h-[380px] sm:w-[380px] lg:h-[430px] lg:w-[430px]"
                  >
                    {activeHero?.kind === "deal" ? (
                      activeHero?.deal?.imageUrl || activeHero?.deal?.items?.[0]?.product?.imageUrl ? (
                        <Image
                          src={(activeHero.deal?.imageUrl || activeHero.deal?.items?.[0]?.product?.imageUrl) as string}
                          alt={activeHero.deal?.title || "Hero deal"}
                          fill
                          className="object-contain"
                          priority
                          unoptimized
                        />
                      ) : null
                    ) : activeHero?.product?.imageUrl ? (
        <Image
                        src={activeHero.product.imageUrl}
                        alt={activeHero.product.name || "Hero product"}
                        fill
                        className="object-contain"
          priority
                        unoptimized
                      />
                    ) : null}
                  </motion.div>
                </div>

                {/* Right: details */}
                <div className="min-w-0 lg:min-h-[360px] lg:flex lg:flex-col lg:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {activeHero?.badge ? (
                      <span className="rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white sm:px-3 sm:py-1 sm:text-xs">
                        {activeHero.badge}
                      </span>
                    ) : null}
                    {activeHero?.kind === "deal" ? (
                      <span className="rounded-full bg-[#ff4d4d] px-2 py-0.5 text-[10px] font-medium text-white sm:px-3 sm:py-1 sm:text-xs">
                        Deal
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-0.5 truncate pb-0.5 font-[family-name:var(--font-poppins)] text-[16px] font-semibold leading-[1.15] tracking-tight text-[#111] sm:mt-3 sm:text-5xl">
                    {(activeHero?.kind === "deal" ? activeHero?.deal?.title : activeHero?.product?.name) || "Featured"}
          </h1>
                  <p className="hidden max-w-xl overflow-hidden text-[10.5px] leading-4 text-[#6b625a] sm:mt-3 sm:block sm:h-[72px] sm:text-base sm:leading-6 sm:line-clamp-3">
                    {(activeHero?.kind === "deal"
                      ? activeHero?.deal?.description || getHeroDealProducts(activeHero?.deal)
                      : activeHero?.product?.description) || "—"}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-4">
                    <div className="flex items-end gap-2">
                      <div>
                        <p className="text-[10px] leading-3 text-[#6b625a] sm:text-sm">Price</p>
                        <p className="mt-0.5 font-[family-name:var(--font-poppins)] text-[20px] font-semibold leading-none text-[#b84a2b] sm:mt-1 sm:text-3xl lg:text-4xl">
                          {activeHero?.kind === "deal"
                            ? `PKR ${computeDealPrice(activeHero?.deal).finalPrice}`
                            : `PKR ${activeHero?.product?.price || 0}`}
                        </p>
                        <p className="text-[8px] leading-3 text-[#8b8178] sm:text-xs">Free delivery</p>
                      </div>

                      {activeHero?.kind === "deal" && dealCountdown ? (
                        <div className="mb-[2px] inline-flex items-center gap-1 rounded-xl border border-black/10 bg-white px-2 py-1 text-[9px] font-semibold text-[#111] shadow-sm sm:hidden">
                          <Clock3 className="h-3 w-3 text-[#5b2d17]" />
                          {dealCountdown.ended
                            ? "00:00:00"
                            : `${dealCountdown.hours}:${dealCountdown.minutes}:${dealCountdown.seconds}`}
                        </div>
                      ) : null}
                    </div>

                    {activeHero?.kind === "deal" && dealCountdown ? (
                      <div className="hidden rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm sm:block">
                        <p className="text-xs font-medium uppercase tracking-wide text-[#6b625a]">Ends in</p>
                        <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#111]">
                          {dealCountdown.ended
                            ? "00d 00h 00m 00s"
                            : `${dealCountdown.days}d ${dealCountdown.hours}h ${dealCountdown.minutes}m ${dealCountdown.seconds}s`}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-5 sm:gap-3">
                    <Link
                      href={
                        activeHero?.kind === "deal"
                          ? activeHero?.deal?._id
                            ? `/deal/${activeHero.deal._id}`
                            : "/#offers"
                          : activeHero?.product?._id
                            ? `/product/${activeHero.product._id}`
                            : "/#popular-items"
                      }
                      className="rounded-xl bg-[#111] px-3 py-1.5 text-[10px] font-semibold !text-white transition hover:bg-black hover:!text-white sm:px-6 sm:py-3 sm:text-sm"
                    >
                      Order Now
                    </Link>
                    <a
                      href="/offers"
                      className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-[10px] font-semibold text-[#111] transition hover:bg-[#f4efe8] sm:px-6 sm:py-3 sm:text-sm"
                    >
                      See Offers
                    </a>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            )}
          </div>

          {/* Bottom: product cards (reference-like) */}
          <div
            ref={heroThumbStripRef}
            className="hero-thumb-strip -mx-4 mt-2 flex flex-none items-start gap-3 overflow-x-auto overflow-y-visible px-4 py-3 sm:-mx-6 sm:mt-6 sm:gap-4 sm:px-6"
          >
            {heroSlides.slice(0, 8).map((slide, idx) => {
              const isActive = idx === heroIndex;
              const isDeal = slide.kind === "deal";
              const thumbImg = isDeal
                ? slide.deal?.imageUrl || slide.deal?.items?.[0]?.product?.imageUrl
                : slide.product?.imageUrl;
              const title = isDeal ? slide.deal?.title : slide.product?.name;
              const price = isDeal ? computeDealPrice(slide.deal).finalPrice : slide.product?.price || 0;
              return (
                <button
                  key={slide._id}
                  type="button"
                  onClick={() => setHeroIndex(idx)}
                  ref={(node) => {
                    heroThumbRefs.current[idx] = node;
                  }}
                  className={[
                    "relative flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#d8c3b1] bg-white text-left text-[#2f1c12] transition sm:h-[112px] sm:w-[340px] sm:items-stretch sm:justify-start sm:rounded-3xl sm:px-4 sm:py-4",
                    isActive
                      ? "ring-2 ring-[#b84a2b] ring-offset-2 ring-offset-[#f5efe8] border-[#b84a2b]/60"
                      : "opacity-95 hover:opacity-100 hover:border-[#b84a2b]/60 hover:ring-1 hover:ring-[#b84a2b]/35 hover:ring-offset-2 hover:ring-offset-[#f5efe8]",
                  ].join(" ")}
                  aria-label={`Select ${title || "slide"}`}
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-xl border border-[#eadccf] bg-[#fffaf4] sm:hidden">
                    {thumbImg ? (
                      <Image src={thumbImg} alt={title || "Slide"} fill className="object-cover" unoptimized />
                    ) : null}
                  </div>
                  <div className="hidden h-full w-full flex-col justify-center sm:flex">
                    <div className="text-2xl font-semibold text-[#5b2d17]">PKR {price}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#eadccf] bg-[#fffaf4]">
                        {thumbImg ? (
                          <Image src={thumbImg} alt={title || "Slide"} fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold text-[#2f1c12]">{title || "Item"}</p>
                        <p className="mt-0.5 text-xs text-[#6f5647]">{slide.badge || (slide.kind === "deal" ? "Deal" : "Best in")}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="popular-items" className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold">Popular Items</h2>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-xl border border-[#2f1c12]/15 bg-white px-4 py-2 text-xs font-semibold text-[#111] transition hover:bg-[#f4efe8] lg:hidden"
          >
            View All
          </Link>
        </div>

        {popularError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {popularError}
          </div>
        ) : null}

        {popularLoading ? (
          <>
            <div className="hide-scrollbar mt-6 -mx-4 flex gap-1.5 overflow-x-auto overflow-y-hidden pb-1 pr-0 scroll-pl-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={`pop-mobile-skel-${i}`}
                  className={[
                    "h-[220px] w-[150px] shrink-0 animate-pulse rounded-3xl bg-[#e9ded3]",
                    i === 0 ? "ml-5" : "",
                  ].join(" ")}
                />
              ))}
            </div>
            <div className="mt-6 hidden grid-cols-6 gap-3 lg:grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`pop-desktop-skel-${i}`} className="h-[260px] animate-pulse rounded-3xl bg-[#e9ded3]" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Mobile: horizontal scroll (full-bleed), scrollbar hidden */}
            <div className="hide-scrollbar mt-6 -mx-4 flex gap-1.5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory pb-1 pr-0 scroll-pl-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:hidden">
              {visibleItems.slice(0, 10).map((item, idx) => {
                const badgePill = getBadgePill(item.badge);
                const showBadge = Boolean(badgePill.label);
                const summary = getProductReviewSummary(item.name);
                return (
                  <article
                    key={item._id}
                    onClick={() => router.push(`/product/${item._id}`)}
                    className={[
                      "snap-start w-[150px] shrink-0 cursor-pointer overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-2",
                      idx === 0 ? "ml-5" : "",
                    ].join(" ")}
                  >
                    <div className="relative h-[110px] w-full overflow-hidden rounded-2xl border border-white/70 bg-white/60">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                      ) : null}
                      {showBadge ? (
                        <span
                          className={[
                            "absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white",
                            badgePill.className,
                          ].join(" ")}
                        >
                          {badgePill.label}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1 px-2 pb-1 pt-2">
                      <h3 className="line-clamp-1 font-[family-name:var(--font-poppins)] text-[11px] font-semibold text-[#24130c]">
                        {item.name}
                      </h3>

                      <p className="line-clamp-1 text-left text-[10px] leading-3 text-[#6f5647]">
                        {item.description || ""}
                      </p>

                      <div className="flex items-center gap-0.5 pt-0.5">
                        <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                        <span className="text-[10px] font-semibold text-[#6f5647]">
                          ({Number(summary?.avgRating || 0).toFixed(1)}) · {Number(summary?.count || 0)} reviews
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <p className="text-[12px] font-semibold text-[#5b2d17] leading-none whitespace-nowrap">
                          PKR {getProductCardPrice(item)}
                        </p>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await handleAddToCart(item._id, event.currentTarget);
                          }}
                          aria-label="Add to cart"
                          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 py-1 text-white transition hover:brightness-[1.05] whitespace-nowrap leading-none sm:px-3 sm:py-1.5"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          <span className="ml-1 text-[10px] font-semibold leading-none sm:text-xs">Add</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {/* Desktop: up to 2 rows (6 per row) */}
            <div className="mt-6 hidden grid-cols-6 gap-4 lg:grid">
              {visibleItems.slice(0, 12).map((item) => {
                const badgePill = getBadgePill(item.badge);
                const showBadge = Boolean(badgePill.label);
                const summary = getProductReviewSummary(item.name);
                return (
                  <article
                    key={item._id}
                    onClick={() => router.push(`/product/${item._id}`)}
                    className="flex h-[300px] cursor-pointer flex-col overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-3"
                  >
                    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/60">
                      <div className="relative h-28 sm:h-32 lg:h-36">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                      {showBadge ? (
                        <span
                          className={[
                            "absolute left-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-semibold text-white",
                            badgePill.className,
                          ].join(" ")}
                        >
                          {badgePill.label}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-1 flex-col">
                      <h3 className="line-clamp-1 font-[family-name:var(--font-poppins)] text-[14px] font-semibold text-[#24130c]">
                        {item.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-left text-[12px] leading-4 text-[#6f5647]">
                        {item.description || ""}
                      </p>

                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] leading-none text-[#ffb347]">★★★★★</span>
                        <span className="text-[10px] font-semibold text-[#6f5647]">
                          ({Number(summary?.avgRating || 0).toFixed(1)}) · {Number(summary?.count || 0)} reviews
                        </span>
                      </div>

                      <div className="mt-auto flex flex-nowrap items-center justify-between gap-2 pt-2">
                        <p className="text-sm font-semibold text-[#5b2d17] whitespace-nowrap">
                          PKR {getProductCardPrice(item)}
                        </p>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            await handleAddToCart(item._id, event.currentTarget);
                          }}
                          aria-label="Add to cart"
                          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#5b2d17] to-[#8b3f1c] px-2 py-1 text-white transition hover:brightness-[1.05] whitespace-nowrap leading-none sm:px-3 sm:py-1.5"
                        >
                          <ShoppingCart className="h-4 w-4" />
                          <span className="ml-1 text-[10px] font-semibold leading-none sm:text-xs">Add</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleItems.length > 12 ? (
              <div className="mt-6 hidden justify-center lg:flex">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-xl border border-[#2f1c12]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[#111] transition hover:bg-[#f4efe8]"
                >
                  See More
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section id="categories" className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:py-12">
        <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold">Categories</h2>
        <p className="mt-2 text-sm text-[#6f5647]">Pick a category to instantly filter your menu experience.</p>
        {categoriesError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {categoriesError}
          </div>
        ) : null}

        {/* Mobile: horizontal scroll with hidden scrollbar */}
        <div className="hide-scrollbar mt-6 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-0 scroll-pl-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:hidden">
          {categoriesLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`cat-mobile-skel-${i}`}
                  className={[
                    "h-32 w-[220px] shrink-0 animate-pulse rounded-3xl bg-[#e9ded3]",
                    i === 0 ? "ml-5" : "",
                  ].join(" ")}
                />
              ))
            : publicCategories.map((category: any, idx: number) => {
            const name = category.name;
            const imageSrc = category.imageUrl || category.image;
            const id = category._id || category.id || "";
            return (
              <button
                key={id || `${name}-${idx}`}
                type="button"
                onClick={() => {
                  if (!id) return;
                  router.push(`/category/${id}`);
                }}
                disabled={!id}
                className={[
                  "group w-[220px] shrink-0 snap-start overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-2.5 transition hover:brightness-[1.02]",
                  idx === 0 ? "ml-5" : "",
                  !id ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              >
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="relative h-32">
                    <Image
                      src={imageSrc}
                      alt={name}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <p className="absolute bottom-3 left-3 right-3 font-[family-name:var(--font-poppins)] text-lg font-semibold text-white">
                    {name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop */}
        <div className="mt-6 hidden grid-cols-6 gap-4 lg:grid">
          {categoriesLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={`cat-desktop-skel-${i}`} className="h-40 animate-pulse rounded-3xl bg-[#e9ded3]" />
              ))
            : publicCategories.map((category: any, idx: number) => {
            const name = category.name;
            const imageSrc = category.imageUrl || category.image;
            const id = category._id || category.id || "";
            return (
              <button
                key={id || `${name}-${idx}`}
                type="button"
                onClick={() => {
                  if (!id) return;
                  router.push(`/category/${id}`);
                }}
                disabled={!id}
                className={[
                  "group relative overflow-hidden rounded-3xl border border-[#eadccf] bg-gradient-to-b from-[#fff7ea] via-white to-[#f6ece2] p-2 transition hover:brightness-[1.02]",
                  !id ? "cursor-not-allowed opacity-70" : "",
                ].join(" ")}
              >
                <div className="relative overflow-hidden rounded-2xl">
                  <div className="relative h-36">
                    <Image
                      src={imageSrc}
                      alt={name}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <p className="absolute bottom-3 left-3 right-3 font-[family-name:var(--font-poppins)] text-xl font-semibold text-white">
                    {name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section id="offers" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold">Offers / Deals</h2>
        {dealsError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {dealsError}
          </div>
        ) : null}

        {dealsLoading ? (
          <div className="mt-6">
            <div className="hidden min-h-[370px] overflow-visible py-3 lg:block">
              <div className="relative h-[332px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`deal-skel-desktop-${i}`}
                    className={[
                      "absolute top-3 h-[332px] w-[32%] min-w-[320px] -translate-x-1/2 animate-pulse rounded-3xl bg-[#e9ded3]",
                      i === 0 ? "left-[17%]" : i === 1 ? "left-1/2" : "left-[83%]",
                    ].join(" ")}
                  />
                ))}
              </div>
            </div>
            <div className="relative min-h-[224px] overflow-visible py-2 lg:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`deal-skel-mobile-${i}`}
                  className={[
                    "absolute top-2 h-[206px] w-[38%] min-w-[126px] -translate-x-1/2 animate-pulse rounded-2xl bg-[#e9ded3]",
                    i === 0 ? "left-[20%]" : i === 1 ? "left-1/2" : "left-[80%]",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {publicDeals.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#eadccf] bg-white p-10 text-center text-sm text-[#6f5647]">
                No deals available right now.
              </div>
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute -inset-x-4 -top-6 h-16 bg-gradient-to-b from-[#f5efe8] to-transparent sm:-inset-x-6" />
                <div className="pointer-events-none absolute -inset-x-4 -bottom-6 h-16 bg-gradient-to-t from-[#f5efe8] to-transparent sm:-inset-x-6" />
                {(() => {
                  const len = publicDeals.length;
                  const idx = ((dealCarouselIndex % len) + len) % len;
                  const premiumPalettes = [
                    "from-[#3f1f15] via-[#6a2f1c] to-[#b25f2f]",
                    "from-[#1f2a44] via-[#2f4f7a] to-[#5c8ac7]",
                    "from-[#1f3c33] via-[#275b4e] to-[#59a88f]",
                    "from-[#3c244d] via-[#5b2f7c] to-[#9a6ccc]",
                    "from-[#4a3020] via-[#795134] to-[#c48a5a]",
                  ];

                  return (
                    <div className="relative hidden min-h-[386px] overflow-visible py-3 lg:block">
                      {publicDeals.map((deal, index) => {
                          const raw = (index - idx + len) % len;
                          const signed = raw > len / 2 ? raw - len : raw; // circular shortest distance
                          const isVisible = len <= 3 ? true : Math.abs(signed) <= 1;
                          const isCenter = signed === 0;
                          const slotX = signed === 0 ? "0%" : signed < 0 ? "-104%" : "104%";
                          const heroImg = deal.imageUrl || deal.items?.[0]?.product?.imageUrl || deal.products?.[0]?.imageUrl || "";
                          const live = deal.endsAt ? formatDealCountdown(deal.endsAt || null) : null;
                          const productsSummary = getDealProductsSummary(deal);
                          const dealReview = getDealReviewMeta(deal);
                          const discountLabel =
                            deal.discountType === "percent"
                              ? `${deal.discountValue || 0}% OFF`
                              : deal.discountType === "flat"
                                ? `PKR ${deal.discountValue || 0} OFF`
                                : "";

                          return (
                            <motion.div
                              key={deal._id}
                              initial={false}
                              animate={{
                                x: isVisible ? slotX : signed < 0 ? "-208%" : "208%",
                                scale: isCenter ? 1.03 : 0.9,
                                opacity: isVisible ? (isCenter ? 1 : 0.86) : 0,
                              }}
                              transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
                              className={[
                                "absolute left-1/2 top-3 h-[348px] w-[32%] min-w-[320px] -translate-x-1/2 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-[0_20px_55px_rgba(26,20,15,0.25)]",
                                premiumPalettes[index % premiumPalettes.length],
                                isCenter ? "ring-2 ring-white/25" : "ring-1 ring-white/10",
                              ].join(" ")}
                            >
                              {heroImg ? (
                                <div className="pointer-events-none absolute inset-0 opacity-22">
                                  <Image src={heroImg} alt={deal.title} fill className="object-cover" unoptimized />
                                </div>
                              ) : null}
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/18 via-black/8 to-black/48" />

                              <div className="relative flex h-full min-h-0 flex-col">
                                <div className="flex flex-wrap items-center gap-2">
                                  {deal.badge ? (
                                    <span className="rounded-full bg-white/22 px-3 py-1 text-xs font-semibold backdrop-blur">
                                      {deal.badge}
                                    </span>
                                  ) : null}
                                  {discountLabel ? (
                                    <span className="rounded-full bg-black/28 px-3 py-1 text-xs font-semibold backdrop-blur">
                                      {discountLabel}
                                    </span>
                                  ) : null}
                                </div>

                                <h3 className="mt-2.5 min-h-[3rem] pb-0.5 font-[family-name:var(--font-poppins)] text-[1.9rem] font-semibold leading-[1.08]">
                                  {deal.title}
                                </h3>

                                {productsSummary ? (
                                  <p className="mt-3 text-xs font-semibold leading-5 text-white/95">
                                    {productsSummary}
                                  </p>
                                ) : (
                                  <div className="mt-3" />
                                )}

                                <p className="mt-1.5 line-clamp-2 min-h-[2.35rem] text-sm text-white/92">
                                  {deal.description || deal.subtitle || " "}
                                </p>
                                <p className="mt-1 text-xs text-white/92">
                                  ★ {Number(dealReview.avgRating || 0).toFixed(1)} · {Number(dealReview.count || 0)} reviews
                                </p>

                                <div className="mt-auto pt-2">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    {live ? (
                                      <div className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm backdrop-blur">
                                        <Clock3 className="h-4 w-4" />
                                        {live.ended
                                          ? "00d 00h 00m 00s"
                                          : `${live.days}d ${live.hours}h ${live.minutes}m ${live.seconds}s`}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-white/85">Limited time</div>
                                    )}

                                    {deal.pricing ? (
                                      <div className="text-right text-sm">
                                        <div className="font-[family-name:var(--font-poppins)] text-lg font-semibold">
                                          PKR {deal.pricing.finalPrice}
                                        </div>
                                        <div className="text-xs text-white/75 line-through">PKR {deal.pricing.originalPrice}</div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <Link
                                      href={deal.detailHref || `/deal/${deal._id}`}
                                      className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold !text-[#111] transition hover:bg-[#f8efe6] hover:!text-[#111]"
                                    >
                                      See Offer
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-black/35 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/45"
                                    >
                                      <ShoppingCart className="h-4 w-4" />
                                      Add to Cart
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  );
                })()}

                {/* Mobile: same animation, compact 3 cards row */}
                    <div className="relative min-h-[224px] overflow-visible py-2 lg:hidden">
                  {publicDeals.map((deal, index) => {
                    const len = publicDeals.length;
                    const raw = (index - dealCarouselIndex + len) % len;
                    const signed = raw > len / 2 ? raw - len : raw;
                    const isVisible = len <= 3 ? true : Math.abs(signed) <= 1;
                    const isCenter = signed === 0;
                    const slotX = signed === 0 ? "0%" : signed < 0 ? "-103%" : "103%";
                    const dealHref = deal._id ? (deal.detailHref || `/deal/${deal._id}`) : "";
                    const heroImg = deal.imageUrl || deal.items?.[0]?.product?.imageUrl || deal.products?.[0]?.imageUrl || "";
                    const live = deal.endsAt ? formatDealCountdown(deal.endsAt || null) : null;
                    const productsSummary = getDealProductsSummary(deal);
                    const dealReview = getDealReviewMeta(deal);
                    const premiumPalettes = [
                      "from-[#3f1f15] via-[#6a2f1c] to-[#b25f2f]",
                      "from-[#1f2a44] via-[#2f4f7a] to-[#5c8ac7]",
                      "from-[#1f3c33] via-[#275b4e] to-[#59a88f]",
                      "from-[#3c244d] via-[#5b2f7c] to-[#9a6ccc]",
                    ];

                    return (
                      <motion.article
                        key={`m-${deal._id}`}
                        initial={false}
                        animate={{
                          x: isVisible ? slotX : signed < 0 ? "-206%" : "206%",
                          scale: isCenter ? 1.02 : 0.9,
                          opacity: isVisible ? (isCenter ? 1 : 0.82) : 0,
                        }}
                        transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
                        className={[
                          "absolute left-1/2 top-2 h-[206px] w-[38%] min-w-[126px] -translate-x-1/2 overflow-hidden rounded-2xl bg-gradient-to-br p-2 text-white shadow-[0_14px_36px_rgba(26,20,15,0.22)]",
                          premiumPalettes[index % premiumPalettes.length],
                        ].join(" ")}
                      >
                        {heroImg ? (
                          <div className="pointer-events-none absolute inset-0 opacity-20">
                            <Image src={heroImg} alt={deal.title} fill className="object-cover" unoptimized />
                          </div>
                        ) : null}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/20 via-black/8 to-black/45" />
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!dealHref) return;
                            router.push(dealHref);
                          }}
                          onKeyDown={(e) => {
                            if (!dealHref) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(dealHref);
                            }
                          }}
                          className="relative flex h-full w-full cursor-pointer flex-col text-left"
                        >
                          <h3 className="mt-5 line-clamp-2 min-h-[1.85rem] text-[11.5px] font-semibold leading-tight">
                            {deal.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-[8.5px] leading-3.5 text-white/95">
                            {productsSummary}
                          </p>
                          <p className="mt-1 text-[8.5px] text-white/90">
                            ★ {Number(dealReview.avgRating || 0).toFixed(1)} · {Number(dealReview.count || 0)} reviews
                          </p>

                          <div className="mt-auto space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[8.5px] font-semibold leading-tight text-white/90">
                                {live
                                  ? live.ended
                                    ? "00d 00h 00m 00s"
                                    : `${live.days}d ${live.hours}h ${live.minutes}m ${live.seconds}s`
                                  : "Limited"}
                              </div>
                              {deal.pricing ? (
                                <div className="text-right leading-tight">
                                  <div className="whitespace-nowrap text-[10px] font-semibold text-white">
                                    PKR {deal.pricing.finalPrice}
                                  </div>
                                  <div className="text-[8px] text-white/70 line-through">PKR {deal.pricing.originalPrice}</div>
                                </div>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-black/35 px-2 text-[8.5px] font-semibold text-white backdrop-blur"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section id="about" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b8178]">About</p>
            <h2 className="mt-2 font-[family-name:var(--font-poppins)] text-3xl font-semibold sm:text-4xl">
              Crafted flavors, premium experience.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#6f5647] sm:text-base">
              Zaitoon Royale blends Pakistani classics with modern culinary craft. Every order is prepared fresh,
              using quality ingredients, signature sauces, and consistent portioning — so it tastes premium every time.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-[#eadccf] bg-white p-4 shadow-[0_10px_28px_rgba(47,28,18,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8b8178]">Fresh daily</p>
                <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#2f1c12]">
                  Always made to order
                </p>
              </div>
              <div className="rounded-3xl border border-[#eadccf] bg-white p-4 shadow-[0_10px_28px_rgba(47,28,18,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8b8178]">Premium packaging</p>
                <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold text-[#2f1c12]">
                  Neat, clean & safe
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#eadccf] bg-[#fffaf4] px-3 py-1 text-xs font-semibold text-[#5b2d17]">
                Fast delivery
              </span>
              <span className="rounded-full border border-[#eadccf] bg-[#fffaf4] px-3 py-1 text-xs font-semibold text-[#5b2d17]">
                Signature sauces
              </span>
              <span className="rounded-full border border-[#eadccf] bg-[#fffaf4] px-3 py-1 text-xs font-semibold text-[#5b2d17]">
                Family deals
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-[#eadccf] bg-white p-3 shadow-[0_14px_35px_rgba(47,28,18,0.1)]">
            <div className="relative h-[360px] overflow-hidden rounded-2xl sm:h-[420px]">
              <Image
                src="https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1400&q=80"
                alt="Premium food preparation"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/15 p-4 text-white backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Zaitoon Royale</p>
                <p className="mt-1 font-[family-name:var(--font-poppins)] text-lg font-semibold leading-snug">
                  Premium taste with a clean modern finish.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold">Reviews</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollReviews("left")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17]"
              aria-label="Scroll reviews left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollReviews("right")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dccbbb] bg-white text-[#5b2d17]"
              aria-label="Scroll reviews right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          ref={reviewsStripRef}
          className="hide-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {homeReviews.map((review, idx) => (
            <article
              key={`home-${review.name}-${review.productTitle}-${idx}`}
              className="w-[66%] min-w-[66%] snap-start rounded-3xl border border-[#eadccf] bg-white p-4 md:w-[32%] md:min-w-[32%] lg:w-[24%] lg:min-w-[24%]"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-[#fffaf4]">
                  {review.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={review.imageUrl} alt={review.productTitle} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-[family-name:var(--font-poppins)] text-xs font-semibold text-[#2f1c12]">{review.name}</p>
                  <p className="truncate text-[11px] text-[#8b8178]">{review.productTitle}</p>
                </div>
              </div>
              <div className="mb-2 flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 text-[#ffb347]">
                  {"★★★★★".split("").map((s, i) => (
                    <span key={`home-${review.name}-${idx}-star-${i}`} className="text-[12px] leading-none">
                      {s}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-semibold text-[#6f5647]">({review.rating?.toFixed(1)})</span>
              </div>
              <p className="line-clamp-4 text-xs leading-5 text-[#6f5647]">{review.review}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#eadccf] bg-white p-6 shadow-[0_12px_30px_rgba(47,28,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b8178]">Contact</p>
            <h2 className="mt-2 font-[family-name:var(--font-poppins)] text-3xl font-semibold sm:text-4xl">
              Location & support
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#6f5647] sm:text-base">
              Visit us or order for delivery. For quick help, call or WhatsApp — we reply fast.
            </p>

            <div className="mt-5 space-y-3 text-sm text-[#6f5647]">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#5b2d17]" />
                <div>
                  <p className="font-semibold text-[#2f1c12]">MM Alam Road, Gulberg</p>
                  <p className="text-xs text-[#8b8178]">Lahore, Pakistan</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#5b2d17]" />
                <div>
                  <p className="font-semibold text-[#2f1c12]">Open daily</p>
                  <p className="text-xs text-[#8b8178]">12:00 PM — 12:00 AM</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#5b2d17]" />
                <div>
                  <p className="font-semibold text-[#2f1c12]">+92 3313269415</p>
                  <p className="text-xs text-[#8b8178]">Orders & support</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="https://maps.google.com/?q=MM+Alam+Road+Lahore"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-[#5b2d17] px-4 py-2 text-sm font-semibold !text-white transition hover:bg-[#462110] hover:!text-white"
              >
                Open in Google Maps
              </a>
              <a
                href="tel:+923313269415"
                className="inline-flex items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#111] transition hover:bg-[#f4efe8]"
              >
                Call now
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#eadccf] bg-white p-3 shadow-[0_12px_30px_rgba(47,28,18,0.08)]">
            <div className="relative overflow-hidden rounded-2xl">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(91,45,23,0.18),transparent_40%),radial-gradient(circle_at_90%_80%,rgba(184,74,43,0.12),transparent_45%)]" />
              <iframe
                title="Restaurant Location Map"
                src="https://www.google.com/maps?q=MM+Alam+Road+Lahore&output=embed"
                loading="lazy"
                className="h-[360px] w-full border-0"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-3xl bg-gradient-to-r from-[#5b2d17] via-[#7a3f22] to-[#b0612f] px-6 py-9 text-white shadow-[0_16px_40px_rgba(47,28,18,0.25)]">
          <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold">Hungry? Order now and enjoy!</h2>
          <p className="mt-2 text-sm text-white/90 sm:text-base">
            Fast delivery, tasty food and easy checkout
          </p>
          <a
            href="#popular-items"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-2.5 text-sm font-semibold !text-[#2f1c12] transition hover:bg-[#f4efe8] hover:!text-[#2f1c12]"
          >
            Order Now
          </a>
     
        </div>
      </section>

      <footer className="border-t border-[#e4d3c4] bg-gradient-to-b from-[#f3e8dd] to-[#eadbcc]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-7 md:grid-cols-3">
            <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
              <p className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#2f1c12]">Zaitoon Royale</p>
              <p className="mt-2 text-sm leading-6 text-[#6f5647]">
                Premium taste, clean quality, and fast delivery. Crafted for families and food lovers in Lahore.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold uppercase tracking-wide text-[#5b2d17]">
                Quick Links
              </p>
              <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
                <a href="#home" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Home</a>
                <a href="/menu" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Menu</a>
                <a href="/offers" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Offers</a>
                <a href="#contact" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Contact</a>
                <a href="/privacy-policy" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Privacy Policy</a>
                <a href="/terms-and-conditions" className="block rounded-lg px-2 py-1 transition hover:bg-[#f7efe6] hover:text-[#2f1c12]">Terms & Conditions</a>
              </div>
            </div>
            <div className="rounded-3xl border border-[#e7d6c6] bg-white/65 p-5 backdrop-blur">
              <p className="font-[family-name:var(--font-poppins)] text-sm font-semibold uppercase tracking-wide text-[#5b2d17]">
                Contact
              </p>
              <div className="mt-3 space-y-2 text-sm text-[#6f5647]">
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> +92 3313269415</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> hello@zaitoonroyale.com</p>
                <div className="flex items-center gap-3 pt-1 text-[#5b2d17]">
                  <a href="#" aria-label="Website"><Globe className="h-5 w-5" /></a>
                  <a href="#" aria-label="Social"><MessageCircle className="h-5 w-5" /></a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-[#e5d2c1] pt-4 text-center text-xs text-[#7a6a5d]">
            <p>© {new Date().getFullYear()} Zaitoon Royale — All rights reserved.</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <a href="/privacy-policy" className="underline-offset-2 hover:underline">Privacy Policy</a>
              <span>•</span>
              <a href="/terms-and-conditions" className="underline-offset-2 hover:underline">Terms & Conditions</a>
            </div>
          </div>
        </div>
      </footer>

      <a
        href={`https://wa.me/${String(settings.whatsappNumber || "")
          .replaceAll("+", "")
          .replaceAll(" ", "")
          .replaceAll("-", "")}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.03] hover:bg-[#1eb85a]"
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M19.11 17.34c-.27-.14-1.61-.8-1.86-.89-.25-.09-.43-.14-.61.14s-.7.89-.85 1.08c-.16.18-.31.2-.58.07-.27-.14-1.12-.41-2.13-1.31-.79-.7-1.33-1.56-1.48-1.83-.16-.27-.02-.41.11-.55.12-.12.27-.31.41-.46.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.98 2.64 1.11 2.82c.14.18 1.9 2.9 4.6 4.06.64.28 1.14.45 1.53.58.64.2 1.22.17 1.68.1.51-.08 1.61-.66 1.84-1.31.23-.64.23-1.19.16-1.3-.07-.11-.25-.18-.52-.32z" />
          <path d="M16.02 3.2C9.02 3.2 3.34 8.88 3.34 15.88c0 2.23.58 4.41 1.69 6.33L3.2 28.8l6.74-1.77a12.64 12.64 0 0 0 6.08 1.55h.01c6.99 0 12.67-5.69 12.67-12.69 0-3.39-1.32-6.58-3.72-8.98a12.6 12.6 0 0 0-8.96-3.71zm0 23.2h-.01a10.5 10.5 0 0 1-5.35-1.47l-.38-.22-4 .98 1.07-3.9-.25-.4a10.48 10.48 0 0 1-1.62-5.52c0-5.81 4.73-10.54 10.55-10.54 2.82 0 5.47 1.1 7.46 3.09a10.49 10.49 0 0 1 3.09 7.46c0 5.82-4.73 10.55-10.56 10.55z" />
        </svg>
        WhatsApp
      </a>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dccbbb] bg-[#fffaf4]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <ul className="flex items-end justify-around gap-1">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition [&_span]:text-current",
                    item.active
                      ? "bg-[#5b2d17] !text-white [&_svg]:text-white [&_span]:!text-white"
                      : "text-[#6f5647] hover:bg-[#f3e8dc]",
                  ].join(" ")}
                >
                  <span className="relative">
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.href === "/cart" && cartUnreadCount > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-[#b84a2b] px-1 text-[9px] font-bold leading-4 text-white">
                        {cartUnreadCount > 99 ? "99+" : cartUnreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      </main>
  );
}
