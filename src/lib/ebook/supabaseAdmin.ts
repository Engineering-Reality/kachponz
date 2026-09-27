import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Klien Supabase service-role untuk modul e-book. Server-only — service-role key
 * TIDAK boleh sampai ke browser (tanpa NEXT_PUBLIC_). Dibuat lazy supaya env yang
 * hilang memunculkan pesan jelas saat handler jalan, bukan crash di import.
 *
 * Reuse SUPABASE_URL milik kachponz; butuh SUPABASE_SERVICE_ROLE_KEY (bukan anon
 * key) agar bisa men-sign objek di bucket privat & menulis tabel orders.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
    throw new Error(`Konfigurasi e-book belum lengkap: ${missing.join(", ")}`);
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
