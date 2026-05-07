"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { Clock3, Mail, MapPin, PhoneCall, Send } from "lucide-react";
import SiteHeader from "@/components/public/site-header";
import { API_BASE_URL } from "@/lib/admin-auth";
import { useRestaurantSettings } from "@/lib/restaurant-settings";

export default function ContactUsPage() {
  const settings = useRestaurantSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const canSubmit = useMemo(() => name.trim().length > 0 && message.trim().length > 0, [name, message]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setFeedback("");
    try {
      const res = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to send message.");
      setMessage("");
      setFeedback("Message sent. We will contact you soon.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-[90px] sm:px-6 sm:pt-[102px]">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-0 sm:rounded-3xl sm:border sm:border-[#e1d2c4] sm:bg-white sm:p-6">
            <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#1c130e]">Contact Us</h1>
            <p className="mt-2 text-sm leading-6 text-[#6f5647]">
              We are here to help with orders, bookings, and feedback. Reach us by phone, email, or visit our location.
            </p>
            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-3">
                <PhoneCall className="mt-0.5 h-4 w-4 text-[#7a3f22]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6f5e]">Phone</p>
                  <p className="text-sm font-semibold text-[#2f1c12]">{settings.contactPhone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-3">
                <Mail className="mt-0.5 h-4 w-4 text-[#7a3f22]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6f5e]">Email</p>
                  <p className="text-sm font-semibold text-[#2f1c12]">{settings.contactEmail}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-[#eadccf] bg-[#fffaf4] p-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-[#7a3f22]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6f5e]">Hours</p>
                  <p className="text-sm font-semibold text-[#2f1c12]">{settings.contactHours}</p>
                </div>
              </div>
            </div>
            <form onSubmit={onSubmit} className="mt-5 rounded-2xl border border-[#eadccf] bg-[#fffaf4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6f5e]">Quick Message</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="sm:col-span-2 rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
                />
              </div>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us how we can help..."
                className="mt-2 w-full rounded-xl border border-[#dccbbb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]"
              />
              <button disabled={!canSubmit || saving} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#5b2d17] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Send message
                <Send className="h-4 w-4" />
              </button>
              {feedback ? <p className="mt-2 text-sm text-[#7a3f22]">{feedback}</p> : null}
            </form>
          </div>

          <div className="overflow-hidden sm:rounded-3xl sm:border sm:border-[#e1d2c4] sm:bg-white">
            <div className="relative h-[210px] sm:h-[250px]">
              <Image
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80"
                alt="Contact restaurant"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="px-0 py-5 sm:p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f1c12]">
                <MapPin className="h-4 w-4 text-[#7a3f22]" />
                {settings.contactAddress}
              </p>
              <p className="mt-1 text-sm text-[#6f5647]">Near Liberty Roundabout, opposite main parking.</p>
              <iframe
                title="Restaurant Location"
                src={settings.mapEmbedUrl}
                loading="lazy"
                className="mt-3 h-[180px] w-full rounded-2xl border border-[#eadccf]"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

