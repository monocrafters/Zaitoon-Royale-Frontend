"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, getAdminToken } from "@/lib/admin-auth";
import {
  RestaurantSettings,
  defaultRestaurantSettings,
  fetchAdminRestaurantSettings,
  updateAdminRestaurantSettings,
} from "@/lib/restaurant-settings";

export default function AdminSettingsPage() {
  const [form, setForm] = useState<RestaurantSettings>(defaultRestaurantSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const data = await fetchAdminRestaurantSettings();
        setForm(data);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const canSave = useMemo(() => form.brandName.trim().length > 0, [form.brandName]);

  const setField = (key: keyof RestaurantSettings, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setSocial = (key: keyof RestaurantSettings["socialLinks"], value: string) => {
    setForm((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: value } }));
  };

  const onUploadLogo = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    setFeedback("");
    try {
      const token = getAdminToken();
      const fd = new FormData();
      fd.append("image", file);
      const up = await fetch(`${API_BASE_URL}/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const upData = await up.json();
      if (!up.ok || !upData.url) throw new Error(upData.message || "Unable to upload logo.");
      setForm((prev) => ({ ...prev, adminLogoUrl: String(upData.url) }));
      setFeedback("Logo uploaded. Save settings to publish.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Unable to upload logo.");
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const saved = await updateAdminRestaurantSettings(form);
      setForm(saved);
      setFeedback("Settings updated successfully.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="-m-4 p-4 text-sm text-[#6f5647] sm:-m-6 sm:p-6">Loading settings…</main>;
  }

  return (
    <main className="-m-4 h-[calc(100vh-64px)] overflow-y-auto bg-white p-4 sm:-m-6 sm:h-[calc(100vh-74px)] sm:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <form onSubmit={onSubmit} className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Brand name</label>
            <input value={form.brandName} onChange={(e) => setField("brandName", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Tagline</label>
            <input value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Admin logo (Support avatar)</label>
            <div className="flex items-center gap-3">
              {form.adminLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.adminLogoUrl} alt="Admin logo" className="h-12 w-12 rounded-full object-cover border border-[#dccbbb]" />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#dccbbb] bg-[#f3e4d7] text-sm font-semibold text-[#5b2d17]">A</span>
              )}
              <input type="file" accept="image/*" onChange={(e) => void onUploadLogo(e.target.files?.[0] || null)} className="text-sm" />
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">WhatsApp number</label>
            <input value={form.whatsappNumber} onChange={(e) => setField("whatsappNumber", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Contact phone</label>
            <input value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Contact email</label>
            <input value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Contact hours</label>
            <input value={form.contactHours} onChange={(e) => setField("contactHours", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Address / Location text</label>
            <input value={form.contactAddress} onChange={(e) => setField("contactAddress", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Map embed URL</label>
            <input value={form.mapEmbedUrl} onChange={(e) => setField("mapEmbedUrl", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Instagram link</label>
            <input value={form.socialLinks.instagram} onChange={(e) => setSocial("instagram", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">YouTube link</label>
            <input value={form.socialLinks.youtube} onChange={(e) => setSocial("youtube", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">TikTok link</label>
            <input value={form.socialLinks.tiktok} onChange={(e) => setSocial("tiktok", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8a6f5e]">Facebook link</label>
            <input value={form.socialLinks.facebook} onChange={(e) => setSocial("facebook", e.target.value)} className="w-full rounded-xl border border-[#dccbbb] px-3 py-2 text-sm outline-none focus:border-[#b84a2b]" />
          </div>
        </section>

        <div className="sticky bottom-0 z-10 border-t border-[#e4d5c7] bg-white/95 px-0 py-3 backdrop-blur">
          <button disabled={!canSave || saving} className="rounded-xl bg-[#5b2d17] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save settings"}
          </button>
          {feedback ? <p className="mt-2 text-sm text-[#7a3f22]">{feedback}</p> : null}
        </div>
      </form>
    </main>
  );
}
