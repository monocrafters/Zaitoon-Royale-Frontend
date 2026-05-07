"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/public/site-header";
import { fetchCustomerMe, getCustomerToken, updateCustomerMe, uploadCustomerAvatar, useCustomerSession } from "@/lib/customer-auth";

export default function EditProfilePage() {
  const { hasSession, profile } = useCustomerSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultAddress, setDefaultAddress] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setName(String(profile?.name || ""));
    setEmail(String(profile?.email || ""));
    setDefaultAddress(String(profile?.defaultAddress || ""));
    setDefaultCity(String(profile?.defaultCity || ""));
    setProfileImageUrl(String(profile?.profileImageUrl || ""));
  }, [profile?.defaultAddress, profile?.defaultCity, profile?.email, profile?.name, profile?.profileImageUrl]);

  useEffect(() => {
    const token = getCustomerToken();
    if (!token) return;
    void fetchCustomerMe();
  }, []);

  const canSave = useMemo(() => Boolean(name.trim()) && !busy, [name, busy]);

  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback("");
    try {
      const url = await uploadCustomerAvatar(file);
      setProfileImageUrl(url);
      setFeedback("Profile picture uploaded.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setFeedback("");
    try {
      await updateCustomerMe({ name, email, defaultAddress, defaultCity, profileImageUrl });
      setFeedback("Profile updated successfully.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5efe8] text-[#2f1c12]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-[90px] sm:px-6 sm:pt-[102px]">
        <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold text-[#1c130e]">Edit Profile</h1>
        {!hasSession ? (
          <p className="mt-4 text-sm text-[#6f5647]">Pehle checkout/register karein, phir profile edit available hogi.</p>
        ) : (
          <form onSubmit={onSave} className="mt-5 rounded-2xl border border-[#e1d2c4] bg-white p-6">
            <div className="flex items-center gap-4">
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#f3e4d7] text-xl font-semibold text-[#5b2d17]">
                  {name.trim().charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <label className="cursor-pointer rounded-xl border border-[#dccbbb] bg-[#fffaf4] px-4 py-2 text-sm font-medium text-[#5b2d17]">
                Upload picture
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-xl border border-[#dccbbb] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-xl border border-[#dccbbb] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]" />
            </div>
            <input value={defaultAddress} onChange={(e) => setDefaultAddress(e.target.value)} placeholder="Default address" className="mt-3 w-full rounded-xl border border-[#dccbbb] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]" />
            <input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} placeholder="Default city" className="mt-3 w-full rounded-xl border border-[#dccbbb] px-3 py-2.5 text-sm outline-none focus:border-[#b84a2b]" />

            <button disabled={!canSave} className="mt-4 rounded-xl bg-[#5b2d17] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Saving..." : "Save profile"}
            </button>
            {feedback ? <p className="mt-3 text-sm text-[#7a3f22]">{feedback}</p> : null}
          </form>
        )}
      </section>
    </main>
  );
}

