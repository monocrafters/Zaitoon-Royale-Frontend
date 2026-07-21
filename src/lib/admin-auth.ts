export const ADMIN_TOKEN_KEY = "restaurant_admin_token";
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://zaitoon-royale-production.up.railway.app";

export const setAdminAuth = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  document.cookie = `admin_token=${token}; path=/; max-age=86400; samesite=lax`;
};

export const getAdminToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
};

export const clearAdminAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ADMIN_TOKEN_KEY);
  document.cookie = "admin_token=; path=/; max-age=0; samesite=lax";
};
