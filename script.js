
"use strict";

/* ==========================================
   PORTFOLIO SCROLL ANIMATION
========================================== */

const TOTAL_FRAMES = 240;
const MAX_CONCURRENT = 4;
const MAX_CACHE = 48;

const canvas = document.getElementById("hero-canvas");
const hero = document.querySelector(".hero-scroll");

const ctx = canvas
  ? canvas.getContext("2d", { alpha: false })
  : null;

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const cache = new Map();
const queue = [];
const queued = new Set();

let activeLoads = 0;
let targetFrame = 0;
let displayedFrame = -1;

let canvasWidth = 0;
let canvasHeight = 0;

let drawScheduled = false;
let scrollScheduled = false;

/* ==========================================
   FRAME PATHS
========================================== */

function framePath(index) {
  const number = String(index + 1).padStart(3, "0");
  return `frames/ezgif-frame-${number}.png`;
}

/* ==========================================
   REQUEST FRAME
========================================== */

function requestFrame(index) {
  if (index < 0 || index >= TOTAL_FRAMES) return;
  if (cache.has(index) || queued.has(index)) return;

  queued.add(index);
  queue.push(index);

  processQueue();
}

/* ==========================================
   LOAD FRAMES
========================================== */

function processQueue() {
  while (activeLoads < MAX_CONCURRENT && queue.length) {
    const index = queue.shift();
    queued.delete(index);

    if (cache.has(index)) continue;

    activeLoads++;

    const image = new Image();
    image.decoding = "async";

    cache.set(index, {
      image,
      status: "loading"
    });

    image.onload = () => {
      cache.set(index, {
        image,
        status: "ready"
      });

      activeLoads--;

      trimCache();
      requestDraw();
      processQueue();
    };

    image.onerror = () => {
      cache.set(index, {
        image: null,
        status: "error"
      });

      activeLoads--;
      processQueue();
    };

    image.src = framePath(index);
  }
}

/* ==========================================
   CACHE MANAGEMENT
========================================== */

function trimCache() {
  if (cache.size <= MAX_CACHE) return;

  const removable = [...cache.entries()]
    .filter(([index, item]) =>
      item.status === "ready" &&
      index !== 0 &&
      index !== displayedFrame
    )
    .sort((a, b) =>
      Math.abs(b[0] - targetFrame) -
      Math.abs(a[0] - targetFrame)
    );

  for (const [index] of removable) {
    if (cache.size <= MAX_CACHE) break;
    cache.delete(index);
  }
}

/* ==========================================
   LOAD FRAMES NEAR TARGET
========================================== */

function loadNearby(index) {
  // Clear queued requests far from the new target.
  for (let i = queue.length - 1; i >= 0; i--) {
    if (Math.abs(queue[i] - index) > 12) {
      queued.delete(queue[i]);
      queue.splice(i, 1);
    }
  }

  const nearby = [index];

  for (let distance = 1; distance <= 6; distance++) {
    nearby.push(index + distance);
    nearby.push(index - distance);
  }

  for (const frame of nearby) {
    requestFrame(frame);
  }
}

/* ==========================================
   GET CLOSEST AVAILABLE FRAME
========================================== */

function findReadyFrame(index) {
  if (cache.get(index)?.status === "ready") {
    return index;
  }

  let closest = -1;
  let distance = Infinity;

  for (const [number, item] of cache) {
    if (item.status !== "ready") continue;

    const difference = Math.abs(number - index);

    if (difference < distance) {
      distance = difference;
      closest = number;
    }
  }

  return closest;
}

/* ==========================================
   DRAW FRAME
========================================== */

function drawFrame() {
  drawScheduled = false;

  if (!ctx || !canvasWidth || !canvasHeight) return;

  const index = findReadyFrame(targetFrame);
  if (index < 0 || index === displayedFrame) return;

  const image = cache.get(index)?.image;
  if (!image || !image.naturalWidth) return;

  const imageWidth = image.naturalWidth;
  const imageHeight = image.naturalHeight;

  const isMobile = window.innerWidth <= 600;

  let width;
  let height;
  let x;
  let y;

  if (isMobile) {
    /*
      Mobile portrait area:
      Fill the upper image section and
      center the portrait without stretching.

      The HTML text is positioned below
      this canvas through CSS.
    */

    const scale = Math.max(
      canvasWidth / imageWidth,
      canvasHeight / imageHeight
    );

    width = imageWidth * scale;
    height = imageHeight * scale;

    x = (canvasWidth - width) / 2;
    y = (canvasHeight - height) / 2;

  } else {
    /*
      Desktop:
      Fill the entire cinematic hero.
    */

    const scale = Math.max(
      canvasWidth / imageWidth,
      canvasHeight / imageHeight
    );

    width = imageWidth * scale;
    height = imageHeight * scale;

    x = (canvasWidth - width) / 2;
    y = (canvasHeight - height) / 2;
  }

  ctx.fillStyle = "#9d221d";

  ctx.fillRect(
    0, 0,
    canvasWidth,
    canvasHeight
  );

  ctx.drawImage(
    image,
    x, y,
    width, height
  );

  displayedFrame = index;
}

/* ==========================================
   SCHEDULE DRAW
========================================== */

function requestDraw() {
  if (!ctx || drawScheduled) return;

  drawScheduled = true;
  requestAnimationFrame(drawFrame);
}

/* ==========================================
   RESIZE CANVAS
========================================== */

function resizeCanvas() {
  if (!canvas || !ctx) return;

  canvasWidth = canvas.clientWidth;
  canvasHeight = canvas.clientHeight;

  if (!canvasWidth || !canvasHeight) return;

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  displayedFrame = -1;
  requestDraw();
}

/* ==========================================
   SCROLL POSITION
========================================== */

function getScrollProgress() {
  if (!hero) return 0;

  const rect = hero.getBoundingClientRect();

  const isMobile = window.innerWidth <= 600;

  if (isMobile) {
    /*
      Mobile hero has natural document height.
      Animate as the user scrolls through it.
    */

    const travel = Math.max(
      1,
      hero.offsetHeight - window.innerHeight
    );

    return Math.min(
      1,
      Math.max(0, -rect.top / travel)
    );
  }

  /*
    Desktop hero is sticky.
  */

  const travel = Math.max(
    1,
    hero.offsetHeight - window.innerHeight
  );

  return Math.min(
    1,
    Math.max(0, -rect.top / travel)
  );
}

/* ==========================================
   UPDATE ANIMATION
========================================== */

function updateAnimation() {
  if (!hero || reducedMotion) return;

  const progress = getScrollProgress();

  const next = Math.round(
    progress * (TOTAL_FRAMES - 1)
  );

  if (next !== targetFrame) {
    targetFrame = next;
    loadNearby(next);
  }

  requestDraw();
}

/* ==========================================
   INITIALIZE HERO
========================================== */

if (canvas && hero && ctx) {
  resizeCanvas();

  requestFrame(0);

  if (!reducedMotion) {
    loadNearby(0);
    updateAnimation();

    window.addEventListener(
      "scroll",
      () => {
        if (scrollScheduled) return;

        scrollScheduled = true;

        requestAnimationFrame(() => {
          scrollScheduled = false;
          updateAnimation();
        });
      },
      { passive: true }
    );
  }

  let resizeScheduled = false;

  window.addEventListener(
    "resize",
    () => {
      if (resizeScheduled) return;

      resizeScheduled = true;

      requestAnimationFrame(() => {
        resizeScheduled = false;
        resizeCanvas();
        updateAnimation();
      });
    },
    { passive: true }
  );
}

/* ==========================================
   SCROLL REVEAL
========================================== */

const revealElements = document.querySelectorAll(
  ".reveal"
);

if (
  reducedMotion ||
  !("IntersectionObserver" in window)
) {
  revealElements.forEach(element => {
    element.classList.add("visible");
  });
} else {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -20px 0px"
    }
  );

  revealElements.forEach(element => {
    observer.observe(element);
  });
}

/* ==========================================
   MOBILE NAVIGATION
========================================== */

const menu = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

if (menu && nav) {
  menu.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");

    menu.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    menu.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
  });

  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");

      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open navigation");
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      nav.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open navigation");
    }
  });
}

/* ==========================================
   COPYRIGHT YEAR
========================================== */

const year = document.getElementById("year");

if (year) {
  year.textContent = new Date().getFullYear();
}
