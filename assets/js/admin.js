let quill;
document.addEventListener("DOMContentLoaded", () => {
  const Link = Quill.import("formats/link");
  const originalSanitize = Link.sanitize;
  Link.sanitize = function (url) {
    if (!url) return "";
    let value = url.trim();

    if (/^(https?:\/\/|mailto:|tel:|#|\/)/.test(value)) {
    } else if (value.indexOf(".") > -1 && value.indexOf(" ") === -1) {
      value = "https://" + value;
    }

    return originalSanitize ? originalSanitize(value) : value;
  };

  quill = new Quill("#editor-container", {
    theme: "snow",
    placeholder: "Write your article content here...",
    modules: {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          ["blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ color: [] }, { background: [] }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
    },
  });

  function imageHandler() {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        await uploadAndInsertImage(file);
      }
    };
  }

  quill.root.addEventListener("paste", async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (
      clipboardData &&
      clipboardData.files &&
      clipboardData.files.length > 0
    ) {
      e.preventDefault();
      const file = clipboardData.files[0];
      if (file.type.startsWith("image/")) {
        await uploadAndInsertImage(file);
      }
    }
  });

  async function uploadAndInsertImage(file) {
    const range = quill.getSelection(true);

    quill.insertText(range.index, "Uploading image...", "bold", true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabaseClient.storage
        .from("blog-images")
        .upload(filePath, file);

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabaseClient.storage.from("blog-images").getPublicUrl(filePath);

      quill.deleteText(range.index, "Uploading image...".length);
      quill.insertEmbed(range.index, "image", publicUrl);
    } catch (error) {
      // console.error("Upload failed:", error);
      quill.deleteText(range.index, "Uploading image...".length);
      alert("Image upload failed: " + error.message);
    }
  }

  const urlRegex =
    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}(\/[^\s]*)?)/g;

  quill.on("text-change", function (delta, oldDelta, source) {
    if (source !== "user") return;

    const range = quill.getSelection();
    if (!range) return;

    const leaf = quill.getLeaf(range.index - 1)[0];
    if (!leaf || !leaf.text) return;

    const lastChar = leaf.text.slice(-1);
    if (!/\s/.test(lastChar)) return;

    const [line, offset] = quill.getLine(range.index);
    const text = line.domNode.textContent;

    const words = text.split(/\s+/);

    const lastWord = words[words.length - 2];

    if (lastWord && urlRegex.test(lastWord)) {
      let urlToCheck = lastWord;
      if (!urlToCheck.match(/^https?:\/\//i)) {
        if (urlToCheck.match(/^www\./) || urlToCheck.indexOf(".") > -1) {
          urlToCheck = "https://" + urlToCheck;
        }
      }

      const index = range.index - lastWord.length - 1;
      const format = quill.getFormat(index, lastWord.length);

      if (!format.link) {
        quill.formatText(index, lastWord.length, "link", urlToCheck, "api");
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const dashboard = document.getElementById("dashboard-section");
  const authMsg = document.createElement("div");

  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();
    if (error || !session) {
      window.location.href = "login.html";
      return;
    }

    // Valid session
    if (dashboard) dashboard.classList.remove("hidden");
    fetchPosts();

    // Watch auth state — only redirect on explicit sign-out, not initial load
    supabaseClient.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "login.html";
      }
    });
  } catch (err) {
    if (dashboard) dashboard.classList.add("hidden");
    authMsg.innerHTML = `<div style="text-align:center; padding: 4rem; max-width: 600px; margin: 0 auto; margin-top: 10%;">
      <h2 style="font-family: var(--font-heading); color: var(--text-main); margin-bottom: 1rem;">Network Error</h2>
      <p style="color: var(--text-muted); line-height: 1.6;">Failed to connect to the authentication server at Supabase. This is typically caused by aggressive ad-blockers (like uBlock Origin, Brave Shields) or university/corporate Wi-Fi networks blocking outgoing API connections.</p>
      <br><p style="color: #ef4444; font-weight: 600;">Error: ${err.message}</p>
    </div>`;
    document.body.appendChild(authMsg);
  }
});
window.switchView = function (viewId) {
  const views = [
    "dashboard",
    "blogs",
    "analytics",
    "audience",
    "subscribers",
    "messages",
    "comments",
    "files",
    "settings",
  ];

  views.forEach((id) => {
    const view = document.getElementById(`view-${id}`);
    const nav = document.getElementById(`nav-${id}`);
    if (view) {
      view.classList.add("hidden");
      view.classList.remove("view-section");
    }
    if (nav) nav.classList.remove("active");
  });

  const activeView = document.getElementById(`view-${viewId}`);
  const activeNav = document.getElementById(`nav-${viewId}`);
  if (activeView) {
    activeView.classList.remove("hidden");
    // Force reflow
    void activeView.offsetWidth;
    activeView.classList.add("view-section");
  }
  if (activeNav) activeNav.classList.add("active");

  // Reset/Clear specific views
  if (viewId === "audience") {
    // Clear profile if no search term
    const input = document.getElementById("user-search-input");
    if (input && !input.value) {
      const profileData = document.getElementById("user-profile-data");
      const emptyState = document.getElementById("audience-empty");
      if (profileData) profileData.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
    }
    refreshAudienceList();
  }

  // Trigger data fetches
  const fetchMap = {
    dashboard: () => loadDashboardAnalytics(currentRange),
    blogs: fetchPosts,
    analytics: fetchAnalytics,
    subscribers: fetchSubscribers,
    messages: fetchMessages,
    comments: fetchComments,
    files: fetchFiles,
  };

  if (fetchMap[viewId]) fetchMap[viewId]();
};

let allPosts = [];

// Search filter for blog articles
const searchInput = document.getElementById("search-input");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allPosts.filter((p) =>
      p.title.toLowerCase().includes(term),
    );
    renderTable(filtered);
  });
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function fetchPosts() {
  let posts = [];
  try {
    const { data, error } = await supabaseClient
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching posts:", error);
      return;
    }
    posts = data || [];
  } catch (err) {
    console.warn("Network error fetching posts:", err.message);
    return;
  }

  allPosts = posts;
  updateStats(posts);
  renderTable(posts);
  loadDashboardAnalytics(currentRange);
  if (!document.getElementById("view-analytics").classList.contains("hidden")) {
    fetchAnalytics();
  }
}

async function fetchAnalytics() {
  const container = document.getElementById("analytics-dashboard");

  if (!container) return;

  let rawViews = [];
  try {
    const { data, error: viewError } = await supabaseClient
      .from("page_views")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (viewError) {
      container.innerHTML = `<div class="error-msg">Error loading analytics: ${viewError.message}</div>`;
      return;
    }
    rawViews = data || [];
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Network Error loading analytics: ${err.message}</div>`;
    return;
  }

  const views = rawViews.filter((v) => {
    const isLocalPath =
      v.page_path &&
      (v.page_path.includes("127.0.0.1") || v.page_path.includes("localhost"));
    const isLocalRef =
      v.referrer &&
      (v.referrer.includes("127.0.0.1") || v.referrer.includes("localhost"));
    return !isLocalPath && !isLocalRef;
  });

  if (views.length === 0) {
    container.innerHTML =
      '<div style="text-align: center; padding: 4rem; color: var(--text-muted);">No production traffic recorded yet.</div>';
    return;
  }

  const totalViews = views.length;
  const uniqueUsers = new Set(views.map((v) => v.tracking_id)).size;

  const today = new Date().toDateString();
  const viewsToday = views.filter(
    (v) => new Date(v.created_at).toDateString() === today,
  ).length;

  const pages = {};

  const referrers = {};
  const devices = { Desktop: 0, Mobile: 0 };
  const visitors = {};
  window.currentVisitors = visitors; // For filtering

  views.forEach((v) => {
    const tid = v.tracking_id || "Anonymous";
    if (!visitors[tid]) {
      visitors[tid] = {
        lastSeen: v.created_at,
        pages: [],
        device: "Desktop",
        referrer: v.referrer || "Direct",
      };
    }
    visitors[tid].pages.push({ path: v.page_path, time: v.created_at });

    const path = v.page_path || "/";
    if (!pages[path]) {
      pages[path] = {
        title: formatPathTitle(path),
        views: 0,
        visitors: new Set(),
      };
    }
    pages[path].views++;
    if (v.tracking_id) pages[path].visitors.add(v.tracking_id);

    let ref = v.referrer;
    if (!ref || ref === "Direct" || ref === "") {
      ref = "Direct / None";
    } else {
      try {
        const url = new URL(ref);
        ref = url.hostname.replace("www.", "");
      } catch (e) {
        ref = "Unknown";
      }
    }
    referrers[ref] = (referrers[ref] || 0) + 1;

    if (v.user_agent) {
      const ua = v.user_agent.toLowerCase();
      const isMobile =
        ua.includes("mobile") ||
        ua.includes("android") ||
        ua.includes("iphone");
      if (isMobile) {
        devices.Mobile++;
        visitors[tid].device = "Mobile";
      } else {
        devices.Desktop++;
        visitors[tid].device = "Desktop";
      }
    } else {
      devices.Desktop++;
    }
  });

  const articleRows = [];
  const pageRows = [];

  Object.entries(pages).forEach(([path, stats]) => {
    const isArticle = path.includes("/pulse") || path.includes("?slug=");
    const data = {
      path,
      title: stats.title,
      views: stats.views,
      unique: stats.visitors.size,
    };
    if (isArticle) articleRows.push(data);
    else pageRows.push(data);
  });

  articleRows.sort((a, b) => b.views - a.views);
  pageRows.sort((a, b) => b.views - a.views);
  const topReferrers = Object.entries(referrers)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  let html = "";

  html += `
      <div class="stats-container">
          <div class="stat-box">
             <div class="stat-icon"><i data-lucide="activity"></i></div>
             <div><div class="stat-value">${totalViews}</div><div class="stat-label">Real Views (Last 200)</div></div>
          </div>
          <div class="stat-box">
             <div class="stat-icon"><i data-lucide="users"></i></div>
             <div><div class="stat-value">${uniqueUsers}</div><div class="stat-label">Active Users</div></div>
          </div>
          <div class="stat-box">
             <div class="stat-icon" style="background:#dcfce7; color:#16a34a"><i data-lucide="calendar"></i></div>
             <div><div class="stat-value">${viewsToday}</div><div class="stat-label">Views Today</div></div>
          </div>
      </div>
    `;

  html += `<div class="analytics-section-title"><i data-lucide="file-text" size="20"></i> Top Articles</div>`;
  if (articleRows.length > 0) {
    html += `<div class="content-grid">`;
    articleRows.slice(0, 6).forEach((p) => {
      html += `
            <div class="article-tile">
                <div class="tile-header">${p.title}</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom: auto;">${p.path}</div>
                <div class="tile-stats">
                    <div class="tile-stat-item"><span class="tile-stat-value">${p.views}</span> Views</div>
                    <div class="tile-stat-item"><span class="tile-stat-value">${p.unique}</span> Unique</div>
                </div>
            </div>
            `;
    });
    html += `</div>`;
  } else {
    html += `<p style="color:var(--text-muted); margin-bottom: 2rem;">No article data available.</p>`;
  }

  html += `
      <div class="split-grid" style="margin-top: 2rem;">
          <!-- Top Pages -->
          <div>
               <div class="analytics-section-title"><i data-lucide="layout" size="20"></i> Top Pages</div>
               <div class="list-group">
                  ${pageRows
                    .slice(0, 5)
                    .map(
                      (p) => `
                      <div class="list-item">
                          <div style="display:flex; flex-direction:column;">
                               <span style="font-weight:600">${p.title}</span>
                               <span style="font-size:0.8rem; color:var(--text-muted)">${p.path}</span>
                          </div>
                          <div style="text-align:right">
                               <div style="font-weight:700">${p.views}</div>
                               <div style="font-size:0.75rem; color:var(--text-muted)">views</div>
                          </div>
                      </div>
                  `,
                    )
                    .join("")}
                  ${pageRows.length === 0 ? '<div style="padding:1rem">No page data.</div>' : ""}
               </div>
          </div>
  
          <!-- Audience / Referrers -->
          <div>
               <div class="analytics-section-title"><i data-lucide="globe" size="20"></i> Top Sources</div>
               <div class="list-group">
                  ${topReferrers
                    .map(([ref, count]) => {
                      const percent = Math.round((count / totalViews) * 100);
                      return `
                      <div class="list-item">
                          <div class="progress-bg" style="width: ${percent}%"></div>
                          <div class="list-content">
                               <span>${ref}</span>
                               <span style="font-weight:600">${count}</span>
                          </div>
                      </div>
                      `;
                    })
                    .join("")}
                  ${topReferrers.length === 0 ? '<div style="padding:1rem">No referrer data.</div>' : ""}
               </div>
               
               <!-- Device Stats -->
               <div class="analytics-section-title" style="margin-top: 2rem;"><i data-lucide="smartphone" size="20"></i> Devices</div>
                <div class="list-group">
                   <div class="list-item"><span>Desktop</span> <span style="font-weight:600">${devices.Desktop}</span></div>
                   <div class="list-item"><span>Mobile</span> <span style="font-weight:600">${devices.Mobile}</span></div>
                </div>
          </div>
      </div>

      <!-- Visitor Activity Search & Recent Activity -->
      <div style="margin-top: 2rem;">
          <div class="analytics-section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="history" size="20"></i> Recent Activity</div>
            <div class="input-group" style="margin-bottom: 0">
              <input
                type="text"
                id="search-visitor"
                placeholder="Search Visitor ID..."
                class="form-input"
                style="padding: 0.4rem 0.75rem; font-size: 0.8rem; width: 180px"
                onkeyup="filterVisitorActivity()"
              />
            </div>
          </div>
          <div class="list-group" id="visitor-activity-list">
              ${renderVisitorActivityList(visitors)}
          </div>
      </div>
    `;

  container.innerHTML = html;
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function renderVisitorActivityList(visitors, query = "") {
  return Object.entries(visitors)
    .filter(([tid, data]) => {
      if (!query) return true;
      return tid.toLowerCase().includes(query.toLowerCase());
    })
    .slice(0, 15)
    .map(([tid, data]) => {
      const lastPath = data.pages[0].path;
      const timeStr = new Date(data.lastSeen).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <div class="list-item" style="flex-direction: column; align-items: flex-start; gap: 0.5rem; cursor: pointer;" onclick="showUserProfile('${tid}')">
            <div style="display: flex; justify-content: space-between; width: 100%;">
                <span style="font-weight: 700; color: var(--accent); font-family: monospace;">Visitor ${tid.substring(0, 8)}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
            </div>
            <div style="font-size: 0.85rem;">
                Viewing <span style="font-weight: 600;">${formatPathTitle(lastPath)}</span>
            </div>
            <div style="display: flex; gap: 0.75rem; font-size: 0.7rem; color: var(--text-muted);">
                <span><i data-lucide="${data.device.toLowerCase() === "mobile" ? "smartphone" : "monitor"}" size="10" style="vertical-align: middle;"></i> ${data.device}</span>
                <span><i data-lucide="link" size="10" style="vertical-align: middle;"></i> ${data.referrer.length > 30 ? data.referrer.substring(0, 30) + "..." : data.referrer}</span>
            </div>
        </div>
      `;
    })
    .join("");
}

window.showUserProfile = function (tid) {
  const visitor = window.currentVisitors[tid];
  if (!visitor) return;

  const modal = document.getElementById("user-profile-modal");
  const title = document.getElementById("user-profile-title");
  const details = document.getElementById("user-profile-details");
  const activity = document.getElementById("user-profile-activity");

  title.innerText = `Visitor Profile: ${tid.substring(0, 8)}`;

  details.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
      <div class="stat-box">
        <div class="stat-label">Device</div>
        <div class="stat-value" style="font-size: 1.1rem;"><i data-lucide="${visitor.device.toLowerCase() === "mobile" ? "smartphone" : "monitor"}" size="16"></i> ${visitor.device}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Total Actions</div>
        <div class="stat-value" style="font-size: 1.1rem;">${visitor.pages.length} Pages</div>
      </div>
    </div>
    <div style="margin-bottom: 1rem;">
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">Original Referrer</div>
      <div style="font-size: 0.9rem; font-weight: 600; word-break: break-all;">${visitor.referrer}</div>
    </div>
  `;

  activity.innerHTML = visitor.pages
    .map(
      (p) => `
    <div style="padding: 0.75rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 600; font-size: 0.9rem;">${formatPathTitle(p.path)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${p.path}</div>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(p.time).toLocaleTimeString()}</div>
    </div>
  `,
    )
    .join("");

  modal.classList.add("active");
  lucide.createIcons();
};

window.closeUserProfileModal = function () {
  document.getElementById("user-profile-modal").classList.remove("active");
};

window.filterVisitorActivity = function () {
  const query = document.getElementById("search-visitor").value;
  if (window.currentVisitors) {
    const list = document.getElementById("visitor-activity-list");
    list.innerHTML = renderVisitorActivityList(window.currentVisitors, query);
    lucide.createIcons();
  }
};

let allSubscribers = [];
let allMessages = [];
let allComments = [];

window.filterSubscribers = function () {
  const query = document
    .getElementById("search-subscribers")
    .value.toLowerCase();
  const filtered = allSubscribers.filter((s) =>
    s.email.toLowerCase().includes(query),
  );
  renderSubscriberTable(filtered);
};

window.filterMessages = function () {
  const query = document.getElementById("search-messages").value.toLowerCase();
  const filtered = allMessages.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      m.subject.toLowerCase().includes(query) ||
      m.message.toLowerCase().includes(query),
  );
  renderMessageTable(filtered);
};

window.filterComments = function () {
  const query = document.getElementById("search-comments").value.toLowerCase();
  const filtered = allComments.filter(
    (c) =>
      c.user_name.toLowerCase().includes(query) ||
      c.content.toLowerCase().includes(query) ||
      (c.posts?.title || "").toLowerCase().includes(query),
  );
  renderCommentTable(filtered);
};

function formatPathTitle(path) {
  if (!path || path === "/" || path === "/index.html") return "Home";

  const urlObj = new URL(path, "https://example.com");
  const slug = urlObj.searchParams.get("slug");

  if (slug) {
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  let p = urlObj.pathname.replace(".html", "").replace(/^\/+|\/+$/g, "");
  if (p === "") return "Home";

  return p
    .split("/")
    .map((w) => w.replace(/-/g, " "))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" › ");
}

async function fetchVisitorStats() {
  const { count, error } = await supabaseClient
    .from("visitors")
    .select("*", { count: "exact", head: true });

  if (!error) {
    const el = document.getElementById("total-visitors");
    if (el) el.textContent = count;
  }
}

async function updateStats(posts) {
  const postsEl = document.getElementById("total-posts");
  if (postsEl) postsEl.textContent = posts.length;
}

// Dashboard Analytics with Date Filtering
let dashboardChart = null;
let allPageViews = [];
let currentRange = "today";

async function loadDashboardAnalytics(range) {
  currentRange = range || currentRange;

  // Update active button
  document.querySelectorAll(".date-filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === currentRange);
  });

  // Fetch all page views if not cached
  if (allPageViews.length === 0) {
    try {
      const { data, error } = await supabaseClient
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) return;

      allPageViews = (data || []).filter((v) => {
        const isLocal =
          (v.page_path &&
            (v.page_path.includes("127.0.0.1") ||
              v.page_path.includes("localhost"))) ||
          (v.referrer &&
            (v.referrer.includes("127.0.0.1") ||
              v.referrer.includes("localhost")));
        return !isLocal;
      });
    } catch (err) {
      console.warn("Network error fetching dashboard analytics:", err.message);
      return;
    }
  }

  // Calculate date range
  const now = new Date();
  let startDate;

  switch (currentRange) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "year":
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
    default:
      startDate = new Date(0);
      break;
  }

  const filtered = allPageViews.filter(
    (v) => new Date(v.created_at) >= startDate,
  );

  // Stats
  const totalViews = filtered.length;
  const uniqueVisitors = new Set(filtered.map((v) => v.tracking_id)).size;

  // Group by date
  const dailyMap = {};
  filtered.forEach((v) => {
    const d = new Date(v.created_at).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (!dailyMap[d]) dailyMap[d] = { views: 0, visitors: new Set() };
    dailyMap[d].views++;
    if (v.tracking_id) dailyMap[d].visitors.add(v.tracking_id);
  });

  const days = Object.keys(dailyMap);
  const avgDaily = days.length > 0 ? Math.round(totalViews / days.length) : 0;

  // Update stat cards
  const pvEl = document.getElementById("dash-page-views");
  if (pvEl) pvEl.textContent = totalViews;
  const uvEl = document.getElementById("dash-unique-visitors");
  if (uvEl) uvEl.textContent = uniqueVisitors;
  const avgEl = document.getElementById("dash-avg-daily");
  if (avgEl) avgEl.textContent = avgDaily;

  // Chart
  const chartLabels = days.reverse();
  const chartData = chartLabels.map((d) => dailyMap[d].views);

  const ctx = document.getElementById("dashboardChart");
  if (ctx) {
    if (dashboardChart) dashboardChart.destroy();
    dashboardChart = new Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Page Views",
            data: chartData,
            backgroundColor: "rgba(37, 99, 235, 0.7)",
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // Top pages
  const pages = {};
  filtered.forEach((v) => {
    const path = v.page_path || "/";
    if (!pages[path]) pages[path] = { views: 0 };
    pages[path].views++;
  });

  const topPagesEl = document.getElementById("dash-top-pages");
  if (topPagesEl) {
    const sorted = Object.entries(pages)
      .sort(([, a], [, b]) => b.views - a.views)
      .slice(0, 5);
    if (sorted.length === 0) {
      topPagesEl.innerHTML =
        '<div style="color: var(--text-muted);">No data for this period.</div>';
    } else {
      topPagesEl.innerHTML = sorted
        .map(
          ([path, data]) =>
            `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
              <span style="font-weight: 500; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${formatPathTitle(path)}</span>
              <span style="font-weight: 700; color: var(--text-main);">${data.views}</span>
            </div>`,
        )
        .join("");
    }
  }

  // Top referrers
  const refs = {};
  filtered.forEach((v) => {
    let ref = v.referrer;
    if (!ref || ref === "" || ref === "Direct") ref = "Direct";
    else {
      try {
        ref = new URL(ref).hostname.replace("www.", "");
      } catch (e) {
        ref = "Unknown";
      }
    }
    refs[ref] = (refs[ref] || 0) + 1;
  });

  const topRefsEl = document.getElementById("dash-top-referrers");
  if (topRefsEl) {
    const sorted = Object.entries(refs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    if (sorted.length === 0) {
      topRefsEl.innerHTML =
        '<div style="color: var(--text-muted);">No data for this period.</div>';
    } else {
      topRefsEl.innerHTML = sorted
        .map(
          ([ref, count]) =>
            `<div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
              <span style="font-weight: 500;">${ref}</span>
              <span style="font-weight: 700; color: var(--text-main);">${count}</span>
            </div>`,
        )
        .join("");
    }
  }

  // Daily breakdown table
  const dailyBody = document.getElementById("dash-daily-body");
  if (dailyBody) {
    const sortedDays = Object.entries(dailyMap).sort(
      ([a], [b]) => new Date(b) - new Date(a),
    );
    if (sortedDays.length === 0) {
      dailyBody.innerHTML =
        '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No data for this period.</td></tr>';
    } else {
      dailyBody.innerHTML = sortedDays
        .map(
          ([date, data]) =>
            `<tr>
              <td style="font-weight: 500;">${date}</td>
              <td>${data.views}</td>
              <td>${data.visitors.size}</td>
            </tr>`,
        )
        .join("");
    }
  }

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// Date filter button clicks
document.querySelectorAll(".date-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    allPageViews = []; // Force refresh data on filter change
    loadDashboardAnalytics(btn.dataset.range);
  });
});

function renderTable(posts) {
  const tbody = document.getElementById("posts-body");
  const emptyState = document.getElementById("empty-state");
  tbody.innerHTML = "";

  if (posts.length === 0) {
    emptyState.style.display = "block";
    return;
  } else {
    emptyState.style.display = "none";
  }

  posts.forEach((post) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>
                <div style="font-weight: 600; font-size: 1rem;">${post.title}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">/pulse/${post.slug || post.id}</div>
            </td>
            <td>${new Date(post.created_at).toLocaleDateString()}</td>
            <td>${post.views || 0}</td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                  <button class="icon-btn" title="Stats" onclick="openStatsModal('${post.slug || post.id}', '${post.title.replace(/'/g, "\\'")}', ${post.views || 0})">
                    <i data-lucide="bar-chart-2" size="18"></i>
                  </button>
                  <button class="icon-btn" title="Edit" onclick="editPost('${post.id}')">
                    <i data-lucide="pencil" size="18"></i>
                  </button>
                  <button class="icon-btn" title="Delete" onclick="deletePost('${post.id}')" style="color: var(--danger);">
                    <i data-lucide="trash-2" size="18"></i>
                  </button>
                </div>
            </td>
        `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

let statsChart = null;

async function openStatsModal(slug, title, totalViews) {
  const modal = document.getElementById("stats-modal");
  document.getElementById("stats-modal-title").textContent = title;
  document.getElementById("stats-total-views").textContent = totalViews;
  document.getElementById("stats-unique-visitors").textContent = "Loading...";
  modal.classList.add("active");

  const articleKeyRaw = String(slug || "").trim();
  const articleKey = articleKeyRaw.toLowerCase();
  const articleKeyEncoded = encodeURIComponent(articleKeyRaw).toLowerCase();
  const { data: allPulseViews, error } = await supabaseClient
    .from("page_views")
    .select("created_at, tracking_id, page_path")
    .ilike("page_path", "/pulse/%")
    .order("created_at", { ascending: true });

  if (error) {
    // console.error("Error fetching stats:", error);
    document.getElementById("stats-unique-visitors").textContent = "N/A";
    return;
  }

  const views = (allPulseViews || []).filter((view) => {
    const path = (view.page_path || "").toLowerCase();
    return (
      path.includes(`/pulse/${articleKey}`) ||
      path.includes(`/pulse/${articleKeyEncoded}`) ||
      path.includes(`slug=${articleKey}`) ||
      path.includes(`slug=${articleKeyEncoded}`)
    );
  });

  const uniqueVisitors = new Set(views.map((v) => v.tracking_id)).size;
  document.getElementById("stats-unique-visitors").textContent = uniqueVisitors;

  const grouped = {};
  views.forEach((v) => {
    const date = new Date(v.created_at).toLocaleDateString();
    grouped[date] = (grouped[date] || 0) + 1;
  });

  const labels = Object.keys(grouped);
  const dataPoints = Object.values(grouped);

  const ctx = document.getElementById("viewsChart").getContext("2d");
  if (statsChart) statsChart.destroy();

  statsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Views",
          data: dataPoints,
          backgroundColor: "#2563eb",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

window.closeStatsModal = function () {
  document.getElementById("stats-modal").classList.remove("active");
};

document.getElementById("search-input").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allPosts.filter((p) => p.title.toLowerCase().includes(term));
  renderTable(filtered);
});

const modal = document.getElementById("post-modal");
const form = document.getElementById("post-form");
const imageInput = document.getElementById("p-image");
const imagePreview = document.getElementById("image-preview");

imageInput.addEventListener("input", () => {
  const url = imageInput.value;
  if (url) {
    imagePreview.src = url;
    imagePreview.style.display = "block";
  } else {
    imagePreview.style.display = "none";
    imagePreview.src = "";
  }
});

function openModal(isEdit = false) {
  modal.classList.add("active");
  document.getElementById("modal-title").textContent = isEdit
    ? "Edit Article"
    : "Create Article";

  if (!isEdit) {
    form.reset();
    document.getElementById("post-id").value = "";
    quill.root.innerHTML = "";
    imagePreview.style.display = "none";
    imagePreview.src = "";
    document.getElementById("attachment-preview").style.display = "none";
    document.getElementById("attachment-preview").innerHTML = "";
  }
}

function closeModal() {
  modal.classList.remove("active");
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.background = type === "error" ? "#ef4444" : "#0f172a";

  toast.style.display = "block";
  // Force reflow
  toast.offsetHeight;
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.style.display = "none";
    }, 400);
  }, 3500);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("post-id").value;
  const title = document.getElementById("p-title").value;
  const excerpt = document.getElementById("p-excerpt").value;

  const content = quill.root.innerHTML;

  const image_url = document.getElementById("p-image").value;
  const file_url = document.getElementById("p-file").value;
  const btn = document.getElementById("save-btn");

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    alert("You must be logged in to save posts.");
    return;
  }

  const originalText = btn.textContent;
  btn.textContent = "Saving...";
  btn.disabled = true;

  const postData = { title, excerpt, content, image_url, file_url };

  let error = null;

  if (id) {
    const { error: err } = await supabaseClient
      .from("posts")
      .update(postData)
      .eq("id", id);
    error = err;
  } else {
    postData.slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data: newPost, error: err } = await supabaseClient
      .from("posts")
      .insert([postData])
      .select()
      .single();
    error = err;

    if (!err && newPost) {
      await supabaseClient.from("comments").insert([
        {
          post_id: newPost.id,
          user_name: "Khushaank Gupta",
          content:
            "Thank you for visiting this post and reading it! 🙏 Hope you enjoyed it. Follow for more insights and updates on finance, AI, and technology!",
        },
      ]);
    }
  }

  if (error) {
    alert(error.message);
  } else {
    showToast(
      id ? "Article updated successfully" : "Article published successfully",
    );
    closeModal();
    fetchPosts();
  }

  btn.textContent = originalText;
  btn.disabled = false;
});

async function editPost(id) {
  const { data } = await supabaseClient
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();
  if (data) {
    document.getElementById("post-id").value = data.id;
    document.getElementById("p-title").value = data.title;
    document.getElementById("p-excerpt").value = data.excerpt;
    document.getElementById("p-image").value = data.image_url || "";

    quill.root.innerHTML = data.content || "";

    if (data.image_url) {
      imagePreview.src = data.image_url;
      imagePreview.style.display = "block";
    } else {
      imagePreview.style.display = "none";
    }

    if (data.file_url) {
      updateAttachmentPreview(data.file_url);
    }

    document.getElementById("p-file").value = data.file_url || "";
    openModal(true);
  }
}

function updateAttachmentPreview(url) {
  const container = document.getElementById("attachment-preview");
  if (!url) {
    container.style.display = "none";
    return;
  }

  const fileName = url.split("/").pop();
  const ext = fileName.split(".").pop().toLowerCase();

  container.innerHTML = `
    <div style="padding: 0.75rem; background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; display: flex; align-items: center; gap: 0.75rem;">
      <div style="width: 40px; height: 40px; background: var(--accent); color: white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800;">
        ${ext.toUpperCase()}
      </div>
      <div style="flex: 1; overflow: hidden;">
        <div style="font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fileName}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted);">Attachment Ready</div>
      </div>
      <button type="button" class="icon-btn" onclick="removeAttachment()" style="color: var(--danger);">
        <i data-lucide="x" size="14"></i>
      </button>
    </div>
  `;
  container.style.display = "block";
  lucide.createIcons();
}

window.removeAttachment = function () {
  document.getElementById("p-file").value = "";
  document.getElementById("attachment-preview").style.display = "none";
  document.getElementById("attachment-preview").innerHTML = "";
};

async function deletePost(id) {
  if (confirm("Delete this article? This cannot be undone.")) {
    const { error } = await supabaseClient.from("posts").delete().eq("id", id);
    if (error) {
      alert(error.message);
    } else {
      showToast("Article deleted.");
      fetchPosts();
    }
  }
}

const defaultSettings = {
  blogTitle: "Khushaank's Blog",
  authorName: "Khushaank",
  tagline: "Thoughts on tech and design...",
  socialLinkedIn: "",
  socialGithub: "",
  socialX: "",
  seoDesc: "Khushaank Gupta - AI Engineer & Developer Portfolio",
  seoKeywords:
    "Khushaank Gupta, AI Engineer, Machine Learning, Web Developer, Portfolio",
  compactView: false,
  maintMode: false,
  autosave: "60",
};

function loadSettings() {
  const saved =
    JSON.parse(localStorage.getItem("adminSettings")) || defaultSettings;

  const fields = {
    "set-blog-title": "blogTitle",
    "set-author-name": "authorName",
    "set-tagline": "tagline",
    "set-social-linkedin": "socialLinkedIn",
    "set-social-github": "socialGithub",
    "set-social-x": "socialX",
    "set-seo-desc": "seoDesc",
    "set-seo-keywords": "seoKeywords",
    "set-autosave": "autosave",
  };

  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = saved[key] || defaultSettings[key] || "";
  });

  const compactEl = document.getElementById("set-compact-view");
  if (compactEl)
    compactEl.checked = saved.compactView ?? defaultSettings.compactView;

  const maintEl = document.getElementById("set-maint-mode");
  if (maintEl) maintEl.checked = saved.maintMode ?? defaultSettings.maintMode;

  applySettings(saved);
}

window.saveSettings = function () {
  const settings = {
    blogTitle: document.getElementById("set-blog-title").value,
    authorName: document.getElementById("set-author-name").value,
    tagline: document.getElementById("set-tagline").value,
    socialLinkedIn: document.getElementById("set-social-linkedin").value,
    socialGithub: document.getElementById("set-social-github").value,
    socialX: document.getElementById("set-social-x").value,
    seoDesc: document.getElementById("set-seo-desc").value,
    seoKeywords: document.getElementById("set-seo-keywords").value,
    compactView: document.getElementById("set-compact-view").checked,
    maintMode: document.getElementById("set-maint-mode").checked,
    autosave: document.getElementById("set-autosave").value,
  };

  localStorage.setItem("adminSettings", JSON.stringify(settings));
  applySettings(settings);
  showToast("Settings saved successfully!");
};

function applySettings(settings) {
  const tableTable = document.getElementById("posts-table");
  if (tableTable) {
    tableTable.classList.toggle("compact-view", settings.compactView);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
});

async function fetchSubscribers() {
  const totalEl = document.getElementById("total-subscribers");
  const tbody = document.getElementById("subscribers-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

  const { data, error } = await supabaseClient
    .from("subscribers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
    return;
  }

  allSubscribers = data || [];
  if (totalEl) totalEl.textContent = allSubscribers.length;
  renderSubscribers(allSubscribers);
}

window.filterSubscribers = function () {
  const term = document
    .getElementById("search-subscribers")
    .value.toLowerCase();
  const filtered = allSubscribers.filter(
    (s) => s.email && s.email.toLowerCase().includes(term),
  );
  renderSubscribers(filtered);
};

function renderSubscribers(subscribers) {
  const tbody = document.getElementById("subscribers-body");
  if (!tbody) return;

  if (subscribers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No subscribers found.</td></tr>';
    return;
  }

  tbody.innerHTML = subscribers
    .map((sub) => {
      const date = new Date(sub.created_at).toLocaleDateString();
      return `
      <tr>
        <td>${sub.email}</td>
        <td>${date}</td>
        <td style="text-align: right;">
           <button class="icon-btn" title="Remove Subscriber" onclick="deleteSubscriber('${sub.id}')">
              <i data-lucide="user-minus" size="18" style="color: var(--danger);"></i>
           </button>
        </td>
      </tr>
    `;
    })
    .join("");
  lucide.createIcons();
}

window.deleteSubscriber = async function (id) {
  if (confirm("Are you sure you want to remove this subscriber?")) {
    const { error } = await supabaseClient
      .from("subscribers")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      showToast("Subscriber removed.");
      fetchSubscribers();
    }
  }
};

window.exportSubscribers = async function () {
  const { data: subscribers, error } = await supabaseClient
    .from("subscribers")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    alert("Error fetching data for export: " + error.message);
    return;
  }

  if (!subscribers || subscribers.length === 0) {
    alert("No subscribers to export.");
    return;
  }

  const headers = ["Email", "Joined Date"];
  const rows = subscribers.map((sub) => [
    sub.email,
    new Date(sub.created_at).toISOString(),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
    "\n",
  );

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `subscribers_export_${Date.now()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

async function fetchMessages() {
  const tbody = document.getElementById("messages-body");
  const emptyDiv = document.getElementById("messages-empty");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (emptyDiv) emptyDiv.style.display = "none";

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Error fetching messages: " + error.message, "error");
    return;
  }

  allMessages = data || [];
  renderMessageTable(allMessages);
}

window.filterMessages = function () {
  const term = document.getElementById("search-messages").value.toLowerCase();
  const filtered = allMessages.filter(
    (m) =>
      (m.name && m.name.toLowerCase().includes(term)) ||
      (m.email && m.email.toLowerCase().includes(term)) ||
      (m.subject && m.subject.toLowerCase().includes(term)) ||
      (m.message && m.message.toLowerCase().includes(term)),
  );
  renderMessageTable(filtered);
};

function renderMessageTable(messages) {
  const tbody = document.getElementById("messages-body");
  const empty = document.getElementById("messages-empty");
  if (!tbody) return;

  if (messages.length === 0) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  tbody.innerHTML = messages
    .map((msg) => {
      const date = new Date(msg.created_at).toLocaleString();
      const unreadClass = msg.is_read
        ? ""
        : "font-weight: bold; color: var(--accent);";
      return `
      <tr>
        <td>
          <div style="${unreadClass}">${msg.name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">${msg.email}</div>
        </td>
        <td>
          <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 2px;">${msg.subject}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${msg.message}</div>
        </td>
        <td style="font-size: 0.8rem;">${date}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="icon-btn" title="${msg.is_read ? "Mark Unread" : "Mark Read"}" onclick="toggleMessageRead('${msg.id}', ${msg.is_read})">
              <i data-lucide="${msg.is_read ? "mail-open" : "mail"}" size="18"></i>
            </button>
            <button class="icon-btn" title="Delete" onclick="deleteMessage('${msg.id}')" style="color: var(--danger);">
              <i data-lucide="trash-2" size="18"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
  lucide.createIcons();
}

window.deleteMessage = async function (id) {
  if (confirm("Delete this message?")) {
    const { error } = await supabaseClient
      .from("messages")
      .delete()
      .eq("id", id);
    if (error) showToast("Error: " + error.message, "error");
    else {
      showToast("Message deleted.");
      fetchMessages();
    }
  }
};

window.toggleMessageRead = async function (id, currentStatus) {
  const { error } = await supabaseClient
    .from("messages")
    .update({ is_read: !currentStatus })
    .eq("id", id);
  if (error) showToast("Error: " + error.message, "error");
  else fetchMessages();
};

async function fetchFiles() {
  const grid = document.getElementById("files-grid");
  const emptyDiv = document.getElementById("files-empty");
  if (!grid) return;

  grid.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading files...</div>';
  if (emptyDiv) emptyDiv.style.display = "none";

  try {
    // Fetch from root
    const { data: rootFiles, error: rootError } = await supabaseClient.storage
      .from("assets")
      .list("", {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    // Fetch from attachments folder
    const { data: attachmentsFiles, error: attachmentsError } =
      await supabaseClient.storage.from("assets").list("attachments", {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (rootError && attachmentsError) {
      showToast(
        "Error fetching files: " +
          (rootError.message || attachmentsError.message),
        "error",
      );
      grid.innerHTML = "";
      if (emptyDiv) emptyDiv.style.display = "block";
      return;
    }

    const allFiles = [
      ...(rootFiles || [])
        .filter((f) => f.id)
        .map((f) => ({ ...f, path: f.name })),
      ...(attachmentsFiles || [])
        .filter((f) => f.id)
        .map((f) => ({ ...f, path: `attachments/${f.name}` })),
    ];

    grid.innerHTML = "";

    if (allFiles.length === 0) {
      if (emptyDiv) emptyDiv.style.display = "block";
      grid.appendChild(emptyDiv);
      return;
    }

    allFiles.forEach((file) => {
      const card = document.createElement("div");
      card.className = "table-card fade-in";
      card.style.padding = "1rem";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.gap = "0.75rem";
      card.style.position = "relative";
      card.style.minHeight = "260px";

      const ext = file.name.split(".").pop().toLowerCase();
      const isImage = ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(
        ext,
      );
      const isPdf = ext === "pdf";
      const isDoc = ["doc", "docx"].includes(ext);
      const isSheet = ["xls", "xlsx", "csv"].includes(ext);
      const isArchive = ["zip", "rar", "7z", "tar"].includes(ext);

      const { data: urlData } = supabaseClient.storage
        .from("assets")
        .getPublicUrl(file.path);
      const publicUrl = urlData.publicUrl;

      let previewIcon = "file-text";
      let iconColor = "#cbd5e1";
      let bgColor = "#f8fafc";

      if (isPdf) {
        previewIcon = "file-text";
        iconColor = "#ef4444";
        bgColor = "#fef2f2";
      } else if (isDoc) {
        previewIcon = "file-text";
        iconColor = "#2563eb";
        bgColor = "#eff6ff";
      } else if (isSheet) {
        previewIcon = "file-spreadsheet";
        iconColor = "#10b981";
        bgColor = "#f0fdf4";
      } else if (isArchive) {
        previewIcon = "archive";
        iconColor = "#f59e0b";
        bgColor = "#fffbeb";
      }

      card.innerHTML = `
        <div style="height: 140px; background: ${bgColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border); transition: all 0.2s; position: relative;">
          ${
            isImage
              ? `<img src="${publicUrl}" style="width: 100%; height: 100%; object-fit: cover;">`
              : isPdf
                ? `<iframe src="${publicUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" style="width: 100%; height: 100%; border: none; pointer-events: none;" scrolling="no" tabindex="-1"></iframe>`
                : `
            <div style="text-align: center;">
              <i data-lucide="${previewIcon}" size="40" style="color: ${iconColor}"></i>
              <div style="font-size: 0.65rem; font-weight: 800; color: ${iconColor}; margin-top: 4px; text-transform: uppercase;">${ext}</div>
            </div>
          `
          }
          <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.4); color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; backdrop-filter: blur(4px);">
            ${ext.toUpperCase()}
          </div>
        </div>
        <div style="overflow: hidden;">
          <div style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);" title="${file.name}">${file.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Size: ${file.metadata ? (file.metadata.size / 1024).toFixed(1) : "0"} KB</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="icon-btn" style="flex: 1; height: 32px; font-size: 0.7rem; justify-content: center; background: var(--bg-body);" onclick="copyToClipboard('${publicUrl}')" title="Copy Direct URL">
            <i data-lucide="link" size="14"></i> URL
          </button>
          <a href="${publicUrl}" target="_blank" class="icon-btn" style="flex: 1; height: 32px; font-size: 0.7rem; justify-content: center; background: var(--bg-body); border: 1px solid var(--border);" title="Open File">
            <i data-lucide="external-link" size="14"></i> Open
          </a>
          <button class="icon-btn" style="width: 32px; height: 32px; color: var(--danger); background: #fef2f2;" onclick="deleteFile('${file.path}')" title="Delete Permanent">
            <i data-lucide="trash-2" size="14"></i>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
    lucide.createIcons();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

window.handleFileUpload = async function (input) {
  const file = input.files[0];
  if (!file) return;

  showToast("Uploading " + file.name + "...");
  const { data, error } = await supabaseClient.storage
    .from("assets")
    .upload(file.name, file, { upsert: true });

  if (error) {
    showToast("Upload failed: " + error.message, "error");
  } else {
    showToast("File uploaded successfully!");
    fetchFiles();
  }
  input.value = "";
};

window.deleteFile = async function (name) {
  if (confirm("Delete this file?")) {
    const { error } = await supabaseClient.storage
      .from("assets")
      .remove([name]);
    if (error) showToast("Error: " + error.message, "error");
    else {
      showToast("File deleted.");
      fetchFiles();
    }
  }
};

window.copyToClipboard = function (text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Link copied to clipboard!");
  });
};

window.handlePostFileUpload = async function (input) {
  const file = input.files[0];
  if (!file) return;

  showToast("Uploading attachment...");
  const fileName = `attachments/${Date.now()}_${file.name}`;
  const { data, error } = await supabaseClient.storage
    .from("assets")
    .upload(fileName, file);

  if (error) {
    showToast("Upload failed: " + error.message, "error");
  } else {
    const { data: urlData } = supabaseClient.storage
      .from("assets")
      .getPublicUrl(fileName);
    document.getElementById("p-file").value = urlData.publicUrl;
    updateAttachmentPreview(urlData.publicUrl);
    showToast("Attachment uploaded!");
  }
  input.value = "";
};

async function fetchComments() {
  const tbody = document.getElementById("comments-body");
  const emptyDiv = document.getElementById("comments-empty");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (emptyDiv) emptyDiv.style.display = "none";

  const { data, error } = await supabaseClient
    .from("comments")
    .select("*, posts(title)")
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Error fetching comments: " + error.message, "error");
    return;
  }

  allComments = data || [];
  renderCommentTable(allComments);
}

window.filterComments = function () {
  const term = document.getElementById("search-comments").value.toLowerCase();
  const filtered = allComments.filter(
    (c) =>
      (c.user_name && c.user_name.toLowerCase().includes(term)) ||
      (c.content && c.content.toLowerCase().includes(term)) ||
      (c.posts && c.posts.title && c.posts.title.toLowerCase().includes(term)),
  );
  renderCommentTable(filtered);
};

window.renderCommentTable = function (comments) {
  const tbody = document.getElementById("comments-body");
  const empty = document.getElementById("comments-empty");
  if (!tbody) return;

  if (comments.length === 0) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  tbody.innerHTML = comments
    .map((comment) => {
      const date = new Date(comment.created_at).toLocaleString();
      const postTitle = comment.posts?.title || "Unknown Post";
      const imageHtml = comment.image_url
        ? `<div style="margin-top: 0.5rem;"><a href="${comment.image_url}" target="_blank"><img src="${comment.image_url}" style="max-width: 150px; border-radius: 4px; border: 1px solid var(--border);" /></a></div>`
        : "";
      return `
      <tr>
        <td>
          <div style="font-weight: 600;">${comment.user_name}</div>
        </td>
        <td>
          <div style="font-size: 0.9rem; max-width: 400px; word-wrap: break-word;">${comment.content}</div>
          ${imageHtml}
        </td>
        <td>
          <div style="font-size: 0.85rem; color: var(--text-muted)">${postTitle}</div>
        </td>
        <td style="font-size: 0.8rem;">${date}</td>
        <td style="text-align: right;">
          <button class="icon-btn" title="Delete Comment" onclick="deleteComment('${comment.id}')" style="color: var(--danger);">
            <i data-lucide="trash-2" size="18"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");
  lucide.createIcons();
};

window.deleteComment = async function (id) {
  if (confirm("Are you sure you want to delete this comment?")) {
    const { error } = await supabaseClient
      .from("comments")
      .delete()
      .eq("id", id);
    if (error) showToast("Error: " + error.message, "error");
    else {
      showToast("Comment deleted.");
      fetchComments();
    }
  }
};

// --- Audience / Intelligence Logic ---
let allAudienceUsers = [];

window.refreshAudienceList = async function () {
  const dl = document.getElementById("user-datalist");
  if (!dl) return;

  try {
    const { data: subs } = await supabaseClient
      .from("subscribers")
      .select("email, created_at");
    const { data: msgs } = await supabaseClient
      .from("messages")
      .select("email, name, created_at");
    const { data: comms } = await supabaseClient
      .from("comments")
      .select("user_name, created_at");

    const userMap = new Map();

    (subs || []).forEach((s) => {
      if (s.email) {
        const email = s.email.toLowerCase();
        userMap.set(email, { email: s.email, name: "", type: "Subscriber" });
      }
    });

    (msgs || []).forEach((m) => {
      if (m.email) {
        const email = m.email.toLowerCase();
        const existing = userMap.get(email);
        userMap.set(email, {
          email: m.email,
          name: m.name || (existing ? existing.name : ""),
          type: existing ? existing.type + ", Lead" : "Lead",
        });
      }
    });

    (comms || []).forEach((c) => {
      const emailMatch = c.user_name && c.user_name.includes("@");
      if (emailMatch) {
        const email = c.user_name.toLowerCase();
        const existing = userMap.get(email);
        userMap.set(email, {
          email: c.user_name,
          name: existing ? existing.name : "",
          type: existing ? existing.type + ", Commenter" : "Commenter",
        });
      }
    });

    dl.innerHTML = "";
    allAudienceUsers = Array.from(userMap.values()).sort((a, b) =>
      a.email.localeCompare(b.email),
    );

    allAudienceUsers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.email;
      const desc = u.name ? `${u.name} · ${u.type}` : u.type;
      opt.textContent = desc;
      dl.appendChild(opt);
    });

    console.log(`Audience synchronized: ${allAudienceUsers.length} profiles.`);
  } catch (err) {
    console.warn("Audience fetch error:", err);
    showToast("Error loading user records", "error");
  }
};

window.loadUserActivity = async function (email) {
  if (!email) {
    document.getElementById("user-profile-data").style.display = "none";
    document.getElementById("audience-empty").style.display = "block";
    return;
  }

  const profileData = document.getElementById("user-profile-data");
  const emptyState = document.getElementById("audience-empty");
  if (profileData) profileData.style.display = "block";
  if (emptyState) emptyState.style.display = "none";

  // Reset UI
  document.getElementById("user-stat-views").textContent = "...";
  document.getElementById("user-stat-comments").textContent = "...";
  document.getElementById("user-stat-messages").textContent = "...";
  document.getElementById("user-stat-subscriber").textContent = "...";

  const activityBody = document.getElementById("user-activity-body");
  const interactionContainer = document.getElementById(
    "user-interactions-container",
  );
  if (activityBody)
    activityBody.innerHTML = '<tr><td colspan="2">Analyzing...</td></tr>';
  if (interactionContainer)
    interactionContainer.innerHTML = "<p>Processing logs...</p>";

  try {
    const [subRes, msgRes, commRes, viewsRes] = await Promise.all([
      supabaseClient.from("subscribers").select("*").eq("email", email),
      supabaseClient
        .from("messages")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("comments")
        .select("*, posts(title)")
        .eq("user_name", email)
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("page_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const isSub = subRes.data && subRes.data.length > 0;
    const messages = msgRes.data || [];
    const comments = commRes.data || [];

    let userViews = [];
    const knownTrackingIds = new Set();

    messages.forEach((m) => {
      if (m.tracking_id) knownTrackingIds.add(m.tracking_id);
    });
    if (isSub && subRes.data[0].tracking_id)
      knownTrackingIds.add(subRes.data[0].tracking_id);

    if (knownTrackingIds.size > 0) {
      userViews = (viewsRes.data || []).filter((v) =>
        knownTrackingIds.has(v.tracking_id),
      );
    }

    document.getElementById("user-stat-subscriber").textContent = isSub
      ? "Yes"
      : "No";
    document.getElementById("user-stat-messages").textContent = messages.length;
    document.getElementById("user-stat-comments").textContent = comments.length;
    document.getElementById("user-stat-views").textContent = userViews.length;

    if (activityBody) {
      if (userViews.length === 0) {
        activityBody.innerHTML =
          '<tr><td colspan="2" style="text-align:center; padding: 2rem; color: var(--text-muted);">No journey logs linked to this email yet. New interactions will be tracked automatically.</td></tr>';
      } else {
        activityBody.innerHTML = userViews
          .map(
            (v) => `
          <tr>
            <td style="font-weight: 500">${v.page_path}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted)">${new Date(v.created_at).toLocaleString()}</td>
          </tr>
        `,
          )
          .join("");
      }
    }

    if (interactionContainer) {
      let html = "";
      if (isSub) {
        html += `
          <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.85rem; color: #15803d; display: flex; align-items: center; gap: 0.5rem">
              <i data-lucide="check-circle" size="14"></i> Newsletter Subscribed
            </div>
            <div style="font-size: 0.75rem; color: #15803d; opacity: 0.8">${new Date(subRes.data[0].created_at).toLocaleString()}</div>
          </div>
        `;
      }

      messages.forEach((m) => {
        html += `
          <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.85rem; color: #1d4ed8;">Message: ${m.subject}</div>
            <p style="font-size: 0.8rem; margin: 0.35rem 0; color: #1e3a8a;">${m.message}</p>
            <div style="font-size: 0.75rem; color: #1d4ed8; opacity: 0.7">${new Date(m.created_at).toLocaleString()}</div>
          </div>
        `;
      });

      comments.forEach((c) => {
        html += `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem;">
            <div style="font-weight: 600; font-size: 0.85rem; color: #b45309;">Comment: ${c.posts?.title || "Article"}</div>
            <p style="font-size: 0.8rem; margin: 0.35rem 0; color: #92400e;">${c.content}</p>
            <div style="font-size: 0.75rem; color: #b45309; opacity: 0.7">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        `;
      });

      interactionContainer.innerHTML =
        html ||
        '<p style="color: var(--text-muted); font-size: 0.85rem;">No direct interactions recorded.</p>';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  } catch (err) {
    console.warn("Load user activity error:", err);
    showToast("Error analyzing profile", "error");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  document.addEventListener("click", (e) => {
    const desktopToggle = e.target.closest("#desktop-sidebar-toggle");
    const mobileToggle = e.target.closest("#mobile-sidebar-toggle");
    const overlayTarget = e.target.closest("#sidebar-overlay");

    if (desktopToggle && sidebar) {
      if (window.innerWidth > 768) {
        sidebar.classList.toggle("minimized");
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
          mainContent.style.marginLeft = sidebar.classList.contains("minimized")
            ? "76px"
            : "260px";
        }
      } else {
        if (sidebar.classList.contains("active")) {
          sidebar.classList.remove("active");
          if (overlay) overlay.classList.remove("active");
        } else {
          sidebar.classList.add("active");
          if (overlay) overlay.classList.add("active");
        }
      }
    }

    if (mobileToggle && sidebar) {
      sidebar.classList.add("active");
      if (overlay) overlay.classList.add("active");
    }

    if (overlayTarget && sidebar) {
      sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  });

  // Handle window resizing
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      if (sidebar) sidebar.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  });

  // Clicking nav item on mobile closes the sidebar
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        if (sidebar) sidebar.classList.remove("active");
        if (overlay) overlay.classList.remove("active");
      }
    });
  });

  // Hide preloader
  window.addEventListener("load", () => {
    const preloader = document.querySelector(".preloader");
    if (preloader) {
      preloader.style.opacity = "0";
      setTimeout(() => {
        preloader.remove(); // Remove from DOM for security/performance
      }, 600);
    }
  });

  /* Security: Session Watchdog */
  setInterval(async () => {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (!session) {
        window.location.href = "login.html";
      }
    } catch (e) {
      console.warn("Session check failed", e);
    }
  }, 30000);

  /* Security: Idle Logout (15 mins) */
  let idleTimer;
  const resetIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      supabaseClient.auth.signOut().then(() => {
        window.location.href = "login.html";
      });
    }, 900000);
  };
  ["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach(
    (evt) => {
      document.addEventListener(evt, resetIdleTimer, true);
    },
  );
  resetIdleTimer();

  // Settings Logic Initializer
  const maintToggle = document.getElementById("set-maint-mode");
  if (maintToggle) {
    maintToggle.checked = localStorage.getItem("maintenanceMode") === "true";
  }
});

window.saveSettings = function () {
  const maintMode = document.getElementById("set-maint-mode").checked;
  localStorage.setItem("maintenanceMode", maintMode);
  showToast("Settings saved successfully");
};
