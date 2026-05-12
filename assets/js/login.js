// If user is already logged in, go straight to admin
async function checkExistingSession() {
  if (!window.supabaseClient) {
    // If client isn't ready, wait a bit or try to init
    if (typeof initSharedSupabase === "function") initSharedSupabase();
    if (!window.supabaseClient) return;
  }

  try {
    const {
      data: { session },
    } = await window.supabaseClient.auth.getSession();
    if (session) {
      window.location.href = "admin.html";
    }
  } catch (err) {
    console.warn("Session check failed due to network error:", err.message);
  }
}

checkExistingSession();

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = "Signing in...";
      btn.disabled = true;

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const errorMsg = document.getElementById("auth-error");
      errorMsg.textContent = "";

      try {
        if (!window.supabaseClient) {
          throw new Error("Supabase client not initialized. Please refresh.");
        }
        const { data, error } =
          await window.supabaseClient.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          errorMsg.textContent = error.message;
          btn.textContent = originalText;
          btn.disabled = false;
        } else {
          window.location.href = "admin.html";
        }
      } catch (err) {
        errorMsg.textContent =
          "Network error: " + err.message + ". Please check your connection.";
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }
});

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}
