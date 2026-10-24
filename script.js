
"use strict";

/* ==========================================
   CHRISTIAN TABANAS PORTFOLIO
   SMOOTH FRAME-BY-FRAME SCROLL ANIMATION
========================================== */

const TOTAL_FRAMES = 240;

const canvas = document.getElementById("hero-canvas");
const hero = document.querySelector(".hero-scroll");

const ctx = canvas
  ? canvas.getContext("2d", { alpha: false })
  : null;

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* FRAME CACHE */

const frameCache = new Map();
const frameQueue = [];
const queued = new Set();

const MAX_CONCURRENT = 4;
const MAX_CACHE = 40;

let activeLoads = 0;
let targetFrame = 0;
let displayedFrame = -1;

let canvasWidth = 0;
let canvasHeight = 0;

let drawing = false;
let scrollScheduled = false;

/* FRAME FILE PATH */

function framePath(index) {
  const number = String(index + 1).padStart(3, "0");

  return `frames/ezgif-frame-${number}.png`;
}

/* REQUEST FRAMES */

function requestFrame(index) {
  if (index < 0 || index >= TOTAL_FRAMES) return;

  const existing = frameCache.get(index);

  if (existing && existing.status !== "error") return;
  if (queued.has(index)) return;

  queued.add(index);
  frameQueue.push(index);

  processQueue();
}

/* LOAD IMAGES */

function processQueue() {
  while (
    activeLoads < MAX_CONCURRENT &&
    frameQueue.length > 0
  ) {
    const index = frameQueue.shift();

    queued.delete(index);

    const existing = frameCache.get(index);

    if (existing && existing.status !== "error") {
      continue;
    }

    activeLoads++;

    const image = new Image();

    frameCache.set(index, {
      image,
      status: "loading"
    });

    image.decoding = "async";

    image.onload = () => {
      frameCache.set(index, {
        image,
        status: "ready"
      });

      activeLoads--;

      requestDraw();
      processQueue();
      trimCache();
    };

    image.onerror = () => {
      frameCache.set(index, {
        image: null,
        status: "error"
      });

      activeLoads--;
      processQueue();
    };

    image.src = framePath(index);
  }
}

/* LIMIT CACHE MEMORY */

function trimCache() {
  if (frameCache.size <= MAX_CACHE) return;

  const removable = [...frameCache.entries()]
    .filter(([index, data]) => {
      return (
        data.status === "ready" &&
        index !== 0 &&
        index !== displayedFrame
      );
    })
    .sort((a, b) => {
      return (
        Math.abs(b[0] - targetFrame) -
        Math.abs(a[0] - targetFrame)
      );
    });

  for (const [index] of removable) {
    if (frameCache.size <= MAX_CACHE) break;

    frameCache.delete(index);
  }
}

/* LOAD FRAMES NEAR CURRENT POSITION */

function loadNearby(index) {
  const desired = [];

  for (let offset = 0; offset <= 5; offset++) {
    desired.push(index + offset);

    if (offset > 0) {
      desired.push(index - offset);
    }
  }

  /* Remove obsolete queued requests */

  for (let i = frameQueue.length - 1; i >= 0; i--) {
    if (Math.abs(frameQueue[i] - index) > 12) {
      queued.delete(frameQueue[i]);
      frameQueue.splice(i, 1);
    }
  }

  for (const frame of desired) {
    requestFrame(frame);
  }
}

/* FIND CLOSEST LOADED FRAME */

function findLoaded(index) {
  const exact = frameCache.get(index);

  if (exact?.status === "ready") {
    return index;
  }

  let closest = -1;
  let distance = Infinity;

  for (const [number, data] of frameCache) {
    if (data.status !== "ready") continue;

    const difference = Math.abs(number - index);

    if (difference < distance) {
      closest = number;
      distance = difference;
    }
  }

  return closest;
}

/* RESPONSIVE CANVAS DRAWING */

function drawFrame() {
  drawing = false;

  if (!ctx || !canvasWidth || !canvasHeight) return;

  const index = findLoaded(targetFrame);

  if (index < 0 || index === displayedFrame) return;

  const image = frameCache.get(index)?.image;

  if (!image || !image.naturalWidth) return;

  const isMobile = canvasWidth <= 600;

  let width;
  let height;
  let x;
  let y;

  if (isMobile) {
    /*
      On mobile, avoid extreme cropping
      by scaling the image relative to
      the screen width and upper viewport.
    */

    const scale = Math.max(
      canvasWidth / image.naturalWidth,
      (canvasHeight * 0.48) / image.naturalHeight
    );

    width = image.naturalWidth * scale;
    height = image.naturalHeight * scale;

    x = (canvasWidth - width) / 2;
    y = canvasHeight * 0.075;

  } else {
    /*
      Desktop: fill the entire canvas
      while maintaining image proportions.
    */

    const scale = Math.max(
      canvasWidth / image.naturalWidth,
      canvasHeight / image.naturalHeight
    );

    width = image.naturalWidth * scale;
    height = image.naturalHeight * scale;

    x = (canvasWidth - width) / 2;
    y = (canvasHeight - height) / 2;
  }

  ctx.fillStyle = "#b12b1b";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.drawImage(image, x, y, width, height);

  displayedFrame = index;
}

/* REQUEST NEXT DRAW */

function requestDraw() {
  if (!ctx || drawing) return;

  drawing = true;
  requestAnimationFrame(drawFrame);
}

/* CANVAS RESIZING */

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

/* SCROLL PROGRESS */

function scrollProgress() {
  if (!hero) return 0;

  const availableScroll = Math.max(
    1,
    hero.offsetHeight - window.innerHeight
  );

  const progress =
    -hero.getBoundingClientRect().top / availableScroll;

  return Math.min(1, Math.max(0, progress));
}

/* UPDATE ANIMATION */

function updateAnimation() {
  if (!hero || reducedMotion) return;

  const frame = Math.round(
    scrollProgress() * (TOTAL_FRAMES - 1)
  );

  if (frame !== targetFrame) {
    targetFrame = frame;
    loadNearby(targetFrame);
  }

  requestDraw();
}

/* INITIALIZE HERO */

if (canvas && hero && ctx) {
  requestFrame(0);
  resizeCanvas();

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

/* REVEAL ON SCROLL */

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

/* MOBILE NAVIGATION */

const menu = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = nav.classList.toggle("open");

    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation"
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

/* COPYRIGHT YEAR */

const year = document.getElementById("year");

if (year) {
  year.textContent = new Date().getFullYear();
}
