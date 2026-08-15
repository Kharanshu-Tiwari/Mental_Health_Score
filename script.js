/* =========================================================
   MindGauge — script.js
   Handles: mobile nav, form validation, API call to the
   FastAPI backend, result rendering, error handling, reset.
========================================================= */

const API_URL = "https://mental-health-score-5bo6.onrender.com/predict";

/* ---------------------------------------------------------
   Mobile navigation toggle
--------------------------------------------------------- */
const header = document.querySelector(".site-header");
const navToggle = document.getElementById("navToggle");

navToggle.addEventListener("click", () => {
  const isOpen = header.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

/* ---------------------------------------------------------
   Scroll-reveal: fade + rise elements marked ".reveal" into
   view once, the first time they cross the viewport.
--------------------------------------------------------- */
const revealTargets = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && revealTargets.length) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  // Fallback: no IntersectionObserver support, just show everything.
  revealTargets.forEach((el) => el.classList.add("in-view"));
}

/* ---------------------------------------------------------
   Button ripple micro-interaction (primary + ghost buttons)
--------------------------------------------------------- */
document.querySelectorAll(".btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });
});

/* ---------------------------------------------------------
   Element references
--------------------------------------------------------- */
const form = document.getElementById("assessmentForm");
const submitBtn = document.getElementById("submitBtn");
const formNote = document.getElementById("formNote");

const resultCard = document.getElementById("resultCard");
const errorCard = document.getElementById("errorCard");
const errorTitle = document.getElementById("errorTitle");
const errorDetail = document.getElementById("errorDetail");

const gaugeValue = document.getElementById("gaugeValue");
const gaugeScore = document.getElementById("gaugeScore");
const gaugeWrap = document.querySelector(".gauge-wrap");
const resetBtn = document.getElementById("resetBtn");

// Circumference of the gauge circle: 2 * PI * r (r = 86)
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 86;
gaugeValue.style.strokeDasharray = String(GAUGE_CIRCUMFERENCE);
gaugeValue.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);

/* ---------------------------------------------------------
   Validation rules
   Each rule maps a form field name to a validator function
   that returns an error string, or "" when the value is valid.
--------------------------------------------------------- */
const VALIDATORS = {
  Age: (v) => {
    if (v === "" || v === null) return "Age is required.";
    const n = Number(v);
    if (!Number.isInteger(n)) return "Age must be a whole number.";
    if (n < 10 || n > 100) return "Age must be between 10 and 100.";
    return "";
  },
  Gender: (v) => (v ? "" : "Please select a gender."),
  Country: (v) => (v && v.trim() ? "" : "Please enter your country."),
  Academic_Level: (v) => (v ? "" : "Please select an academic level."),
  Most_Used_Platform: (v) => (v ? "" : "Please select a platform."),
  Purpose_Of_Use: (v) => (v ? "" : "Please select a purpose of use."),
  Avg_Daily_Usage_Hours: (v) => rangeValidator(v, 0, 24, "Average daily usage"),
  Daily_Unlocks: (v) => {
    if (v === "" || v === null) return "Daily unlocks is required.";
    const n = Number(v);
    if (Number.isNaN(n)) return "Daily unlocks must be a number.";
    if (n < 0) return "Daily unlocks cannot be negative.";
    return "";
  },
  Study_Hours: (v) => rangeValidator(v, 0, 24, "Study hours"),
  Physical_Activity_Hours: (v) => rangeValidator(v, 0, 24, "Physical activity"),
  Sleep_Hours_Per_Night: (v) => rangeValidator(v, 0, 24, "Sleep hours"),
  Stress_Level: (v) => (v ? "" : "Please select a stress level."),
};

function rangeValidator(value, min, max, label) {
  if (value === "" || value === null) return `${label} is required.`;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
  return "";
}

// Map field name -> input id, for wiring error messages to the DOM.
const FIELD_TO_ID = {
  Age: "age",
  Gender: "gender",
  Country: "country",
  Academic_Level: "academicLevel",
  Most_Used_Platform: "platform",
  Purpose_Of_Use: "purpose",
  Avg_Daily_Usage_Hours: "dailyUsage",
  Daily_Unlocks: "dailyUnlocks",
  Study_Hours: "studyHours",
  Physical_Activity_Hours: "activityHours",
  Sleep_Hours_Per_Night: "sleepHours",
  Stress_Level: "stressLevel",
};

function setFieldError(fieldName, message) {
  const id = FIELD_TO_ID[fieldName];
  const inputEl = document.getElementById(id);
  const errorEl = document.getElementById(`err-${id}`);
  const fieldWrap = inputEl.closest(".field");

  if (message) {
    fieldWrap.classList.add("has-error");
    errorEl.textContent = message;
  } else {
    fieldWrap.classList.remove("has-error");
    errorEl.textContent = "";
  }
}

/**
 * Validates the whole form.
 * Returns { valid, payload } where payload is the JSON body
 * ready to send to the API when valid is true.
 */
function validateForm() {
  const formData = new FormData(form);
  let firstInvalidId = null;
  let valid = true;

  const payload = {};

  for (const [fieldName, validate] of Object.entries(VALIDATORS)) {
    const rawValue = formData.get(fieldName);
    const message = validate(rawValue);
    setFieldError(fieldName, message);

    if (message) {
      valid = false;
      if (!firstInvalidId) firstInvalidId = FIELD_TO_ID[fieldName];
    } else {
      payload[fieldName] = coerceValue(fieldName, rawValue);
    }
  }

  if (firstInvalidId) {
    document.getElementById(firstInvalidId).focus({ preventScroll: false });
  }

  return { valid, payload };
}

function coerceValue(fieldName, rawValue) {
  const numericFields = [
    "Age",
    "Avg_Daily_Usage_Hours",
    "Daily_Unlocks",
    "Study_Hours",
    "Physical_Activity_Hours",
    "Sleep_Hours_Per_Night",
  ];
  if (numericFields.includes(fieldName)) return Number(rawValue);
  return String(rawValue).trim();
}

/* ---------------------------------------------------------
   Clear validation state as the user fixes fields
--------------------------------------------------------- */
Object.values(FIELD_TO_ID).forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener("input", () => {
    el.closest(".field").classList.remove("has-error");
  });
  el.addEventListener("change", () => {
    el.closest(".field").classList.remove("has-error");
  });
});

/* ---------------------------------------------------------
   Form submission
--------------------------------------------------------- */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formNote.textContent = "";
  hideError();

  const { valid, payload } = validateForm();

  if (!valid) {
    formNote.textContent = "Please fix the highlighted fields before continuing.";
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 422) {
      const body = await safeJson(response);
      showError(
        "The server rejected some of your inputs.",
        summarizeValidationError(body)
      );
      return;
    }

    if (!response.ok) {
      showError(
        "The prediction server returned an error.",
        `Server responded with status ${response.status}. Please try again.`
      );
      return;
    }

    const result = await response.json();
    const score = Number(result.predicted_mental_health_score);

    if (Number.isNaN(score)) {
      showError(
        "Unexpected response from the prediction server.",
        "The server did not return a valid score."
      );
      return;
    }

    showResult(score, payload);
  } catch (err) {
    showError(
      "Unable to connect to the prediction server.",
      "Please make sure the FastAPI backend is running at http://127.0.0.1:8000."
    );
  } finally {
    setLoading(false);
  }
});

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function summarizeValidationError(body) {
  if (!body || !Array.isArray(body.detail) || body.detail.length === 0) {
    return "Please double-check your inputs and try again.";
  }
  const first = body.detail[0];
  const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "field";
  return `Check the "${field}" field: ${first.msg || "invalid value"}.`;
}

/* ---------------------------------------------------------
   Loading state
--------------------------------------------------------- */
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  form.classList.toggle("is-submitting", isLoading);
}

/* ---------------------------------------------------------
   Result rendering
--------------------------------------------------------- */
const scoreBandEl = document.getElementById("scoreBand");
const insightGrid = document.getElementById("insightGrid");
const tipSection = document.getElementById("tipSection");
const tipList = document.getElementById("tipList");

/**
 * Score bands. Each entry describes the score range, a short label,
 * a "tone" used for styling, and a plain-language interpretation.
 */
const SCORE_BANDS = [
  { min: 8, tone: "good", label: "Thriving", desc: "Your inputs line up with a strong, well-balanced routine. Whatever you're doing, it's working." },
  { min: 6, tone: "good", label: "Doing well", desc: "Things look mostly steady. A few small adjustments below could nudge this even higher." },
  { min: 4, tone: "watch", label: "Some strain", desc: "A mix of habits may be pulling your score down. The factors below point to where to start." },
  { min: 2, tone: "concern", label: "Needs attention", desc: "Several factors suggest your routine may be taking a real toll right now." },
  { min: 0, tone: "concern", label: "High concern", desc: "This score reflects a pattern that's worth taking seriously — see the note below." },
];

function getScoreBand(score) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

const CHECK_ICON = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.8l2.6 2.6 5.4-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const WARN_ICON = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.2 12 11.5H1L6.5 1.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 5v3M6.5 9.6v.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const BULB_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1a4 4 0 0 0-2.2 7.3c.4.3.6.7.6 1.2v.5h3.2v-.5c0-.5.2-.9.6-1.2A4 4 0 0 0 7 1z" stroke="currentColor" stroke-width="1.2"/><path d="M5.4 12h3.2M6 13h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';

/**
 * Evaluates each lifestyle factor against a rough healthy range and
 * returns { title, text, status, tip } for factors worth surfacing.
 * These thresholds are general wellness guidelines, not clinical cutoffs.
 */
function buildInsights(data) {
  const insights = [];

  const sleep = data.Sleep_Hours_Per_Night;
  if (sleep < 6) {
    insights.push({ title: "Sleep", status: "concern", text: `${sleep}h a night is under the recommended range — sleep debt compounds fast.`, tip: "Aim for 7–9 hours a night; even an extra 30–45 minutes can help." });
  } else if (sleep > 9.5) {
    insights.push({ title: "Sleep", status: "watch", text: `${sleep}h is on the high side, which can sometimes signal low energy or avoidance.` });
  } else {
    insights.push({ title: "Sleep", status: "good", text: `${sleep}h a night is within a healthy range.` });
  }

  const usage = data.Avg_Daily_Usage_Hours;
  if (usage > 6) {
    insights.push({ title: "Screen time", status: "concern", text: `${usage}h of daily social media use is high and linked to lower mood scores.`, tip: "Try setting app timers, or a screen-free hour before bed." });
  } else if (usage > 3.5) {
    insights.push({ title: "Screen time", status: "watch", text: `${usage}h a day is moderate-to-high — worth keeping an eye on.` });
  } else {
    insights.push({ title: "Screen time", status: "good", text: `${usage}h a day is a light, manageable amount of usage.` });
  }

  const activity = data.Physical_Activity_Hours;
  if (activity < 0.5) {
    insights.push({ title: "Physical activity", status: "concern", text: `${activity}h a day is quite low — movement is one of the strongest levers for mood.`, tip: "Even a 15–20 minute walk most days can measurably help." });
  } else if (activity < 1) {
    insights.push({ title: "Physical activity", status: "watch", text: `${activity}h a day is okay, but a bit more could help.` });
  } else {
    insights.push({ title: "Physical activity", status: "good", text: `${activity}h a day is a solid amount of movement.` });
  }

  const stress = data.Stress_Level;
  if (stress === "Very High" || stress === "High") {
    insights.push({ title: "Stress level", status: "concern", text: `You reported "${stress}" stress, which weighs heavily on the score.`, tip: "Short breathing breaks or talking to someone you trust can take the edge off in the moment." });
  } else if (stress === "Medium") {
    insights.push({ title: "Stress level", status: "watch", text: `"${stress}" stress is manageable but worth monitoring.` });
  } else {
    insights.push({ title: "Stress level", status: "good", text: `"${stress}" stress is a good place to be.` });
  }

  const study = data.Study_Hours;
  if (study > 8) {
    insights.push({ title: "Study load", status: "watch", text: `${study}h a day is a heavy academic load — burnout risk climbs from here.`, tip: "Build in real breaks between study blocks, not just screen switches." });
  }

  return insights;
}

function showResult(score, payload) {
  hideError();

  const clamped = Math.max(0, Math.min(10, score));
  const fraction = clamped / 10;
  const offset = GAUGE_CIRCUMFERENCE * (1 - fraction);

  resultCard.hidden = false;
  gaugeWrap.classList.remove("is-complete");

  // Animate the gauge ring.
  requestAnimationFrame(() => {
    gaugeValue.style.strokeDashoffset = String(offset);
  });

  // Animate the numeric score counting up.
  animateCount(gaugeScore, 0, score, 900);

  // Trigger a soft glow pulse once the ring finishes drawing.
  window.setTimeout(() => gaugeWrap.classList.add("is-complete"), 950);

  // Band badge + interpretation.
  const band = getScoreBand(clamped);
  scoreBandEl.textContent = band.label;
  scoreBandEl.dataset.tone = band.tone === "good" ? "" : band.tone;
  document.getElementById("resultDesc").textContent = band.desc;

  // Factor insights.
  const insights = payload ? buildInsights(payload) : [];
  insightGrid.innerHTML = insights
    .map(
      (i) => `
      <div class="insight-card" data-status="${i.status}">
        <span class="insight-icon">${i.status === "good" ? CHECK_ICON : WARN_ICON}</span>
        <div>
          <p class="insight-title">${i.title}</p>
          <p class="insight-text">${i.text}</p>
        </div>
      </div>`
    )
    .join("");

  // Tips, drawn from any flagged factors.
  const tips = insights.filter((i) => i.tip).map((i) => i.tip);
  if (tips.length) {
    tipList.innerHTML = tips.map((t) => `<li>${BULB_ICON}<span>${t}</span></li>`).join("");
    tipSection.hidden = false;
  } else {
    tipSection.hidden = true;
  }

  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function animateCount(el, from, to, duration) {
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    // Ease-out for a smooth, professional finish.
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    el.textContent = current.toFixed(2);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = to.toFixed(2);
  }

  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------
   Error rendering
--------------------------------------------------------- */
function showError(title, detail) {
  resultCard.hidden = true;
  errorTitle.textContent = title;
  errorDetail.textContent = detail;
  errorCard.hidden = false;
  errorCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  errorCard.hidden = true;
}

/* ---------------------------------------------------------
   Reset
--------------------------------------------------------- */
resetBtn.addEventListener("click", () => {
  form.reset();
  Object.values(FIELD_TO_ID).forEach((id) => {
    document.getElementById(id).closest(".field").classList.remove("has-error");
    document.getElementById(`err-${id}`).textContent = "";
  });

  resultCard.hidden = true;
  gaugeValue.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);
  gaugeScore.textContent = "0.00";
  gaugeWrap.classList.remove("is-complete");
  hideError();
  formNote.textContent = "";

  document.getElementById("assessment").scrollIntoView({ behavior: "smooth", block: "start" });
});
