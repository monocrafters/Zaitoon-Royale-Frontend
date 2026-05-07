import {
  BadgePercent,
  BarChart3,
  Boxes,
  LayoutTemplate,
  LayoutDashboard,
  ListOrdered,
  Mail,
  MessageCircleMore,
  Bell,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminMenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

export const adminMenuItems: AdminMenuItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Hero", href: "/admin/hero", icon: LayoutTemplate, enabled: true },
  { label: "Products", href: "/admin/products", icon: Boxes, enabled: true },
  { label: "Categories", href: "/admin/categories", icon: Tag, enabled: true },
  { label: "Menu", href: "/admin/menu", icon: ListOrdered, enabled: true },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart, enabled: true },
  { label: "Customers", href: "/admin/customers", icon: Users, enabled: true },
  { label: "Support", href: "/admin/support", icon: MessageCircleMore, enabled: true },
  { label: "Contact Messages", href: "/admin/contact", icon: Mail, enabled: true },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, enabled: true },
  { label: "Offers / Deals", href: "/admin/deals", icon: BadgePercent, enabled: true },
  { label: "Reviews", href: "/admin/reviews", icon: Star, enabled: true },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3, enabled: true },
  { label: "Settings", href: "/admin/settings", icon: Settings, enabled: true },
];

export const adminPageTitleMap: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/hero": "Hero",
  "/admin/categories": "Categories",
  "/admin/categories/detail": "Category Details",
  "/admin/products": "Products",
  "/admin/products/detail": "Product Details",
  "/admin/menu": "Menu",
  "/admin/orders": "Orders",
  "/admin/orders/detail": "Order Details",
  "/admin/customers": "Customers",
  "/admin/support": "Support",
  "/admin/contact": "Contact Messages",
  "/admin/notifications": "Notifications",
  "/admin/deals": "Offers / Deals",
  "/admin/reviews": "Reviews",
  "/admin/analytics": "Analytics",
  "/admin/settings": "Settings",
};

