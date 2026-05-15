const SUPABASE_URL = "https://pgodkcoykowrvimjjphb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2RrY295a293cnZpbWpqcGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MTkxNTQsImV4cCI6MjA5NDM5NTE1NH0.8PABMAd5IGj3kvmkZu8kLLatnx9xizE6CUVCWICFZms";

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
