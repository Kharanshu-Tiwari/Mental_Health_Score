/* =========================================================
   MindGauge — script.js
   Handles: mobile nav, form validation, API call to the
   FastAPI backend, result rendering, error handling, reset.
========================================================= */

const API_URL = "http://127.0.0.1:8000/predict";

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

    showResult(score);
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
function showResult(score) {
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
