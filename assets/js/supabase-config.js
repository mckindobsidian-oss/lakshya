const SUPABASE_URL = "https://jkmdaioxrthsvylfzefi.supabase.co";
const SUPABASE_KEY = "sb_publishable_67JNTIUUK5MKT5DbfXwdrg_ABbG6FUg";

function initSharedSupabase() {
  if (typeof window.supabase !== "undefined" && !window.supabaseClient) {
    // Increased timeout to 15s to be more resilient to slow networks
    const TIMEOUT_MS = 15000;

    const customFetch = (url, options) => {
      const controller = new AbortController();
      const { signal } = controller;

      const fetchPromise = fetch(url, { ...options, signal });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              "Connection Timed Out. Please disable adblockers or check your internet connection.",
            ),
          );
        }, TIMEOUT_MS),
      );

      return Promise.race([fetchPromise, timeoutPromise]);
    };

    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          detectSessionFromUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: customFetch,
        },
      },
    );
    console.log("Supabase Client Initialized.");
  }
}

// Immediate attempt
initSharedSupabase();

// Fallback attempt
window.addEventListener("DOMContentLoaded", initSharedSupabase);
window.addEventListener("load", initSharedSupabase);
