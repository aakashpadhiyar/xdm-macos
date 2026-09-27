(() => {
  const stage = document.querySelector("#pet-stage");
  const hitArea = document.querySelector("#pet-hit-area");
  const sprite = document.querySelector("#pet-sprite");
  const status = document.querySelector("#stage-status-text");
  const card = document.querySelector("#video-card");
  const dock = document.querySelector("#pet-dock");
  if (!stage || !hitArea || !sprite || !status || !card || !dock) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durations = {
    idle: [280, 110, 110, 140, 140, 320],
    wave: [140, 140, 140, 280],
    jump: [140, 140, 140, 140, 280],
    right: [120, 120, 120, 120, 120, 120, 120, 220],
    left: [120, 120, 120, 120, 120, 120, 120, 220]
  };
  const rows = { idle: 0, right: 1, left: 2, wave: 3, jump: 4 };
  let activity = "idle";
  let activityStarted = performance.now();
  let lookDirection = null;
  let interactionTimer = null;
  let statusTimer = null;
  let pointerDown = null;
  let dragged = false;
  let position = { x: 0, y: 0 };
  let frameRequest = 0;

  function showFrame(row, column) {
    sprite.style.backgroundPosition = `${column / 7 * 100}% ${row / 10 * 100}%`;
  }

  function frameForActivity(now) {
    const sequence = durations[activity] || durations.idle;
    let time = (now - activityStarted) % sequence.reduce((sum, value) => sum + value, 0);
    for (let index = 0; index < sequence.length; index += 1) {
      time -= sequence[index];
      if (time < 0) return index;
    }
    return 0;
  }

  function render(now) {
    if (lookDirection !== null && activity === "idle") {
      showFrame(lookDirection < 8 ? 9 : 10, lookDirection % 8);
    } else {
      showFrame(rows[activity] ?? 0, reducedMotion ? 0 : frameForActivity(now));
    }
    frameRequest = requestAnimationFrame(render);
  }

  function setActivity(next, duration = null, label = null) {
    activity = next;
    activityStarted = performance.now();
    lookDirection = null;
    if (interactionTimer) window.clearTimeout(interactionTimer);
    if (statusTimer) window.clearTimeout(statusTimer);
    if (duration !== null) {
      interactionTimer = window.setTimeout(() => {
        activity = "idle";
        activityStarted = performance.now();
        status.textContent = "Standing by";
      }, duration);
    }
    if (label) status.textContent = label;
  }

  function pointToLook(event) {
    if (activity !== "idle" || pointerDown || reducedMotion) return;
    const bounds = hitArea.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    if (Math.hypot(dx, dy) < 8) {
      lookDirection = null;
      return;
    }
    lookDirection = (Math.round(Math.atan2(dx, -dy) / (Math.PI * 2) * 16) + 16) % 16;
  }

  function positionPet(x, y) {
    const stageBounds = stage.getBoundingClientRect();
    const halfWidth = hitArea.offsetWidth / 2;
    const halfHeight = hitArea.offsetHeight / 2;
    position.x = Math.min(stageBounds.width - halfWidth - 10, Math.max(halfWidth + 10, x));
    position.y = Math.min(stageBounds.height - halfHeight - 10, Math.max(halfHeight + 10, y));
    hitArea.style.left = `${position.x}px`;
    hitArea.style.top = `${position.y}px`;
    hitArea.style.transform = "translate(-50%, -50%)";
    positionDock();
  }

  function positionDock() {
    const halfWidth = (dock.offsetWidth || 245) / 2;
    const dockHeight = dock.offsetHeight || 48;
    const petHeight = hitArea.offsetHeight;
    const margin = 12;
    const x = Math.min(stage.clientWidth - halfWidth - margin, Math.max(halfWidth + margin, position.x));
    let y = position.y + petHeight / 2 + 8;
    if (y + dockHeight > stage.clientHeight - margin) y = position.y - petHeight / 2 - dockHeight - 8;
    dock.style.left = `${x}px`;
    dock.style.top = `${Math.max(margin, y)}px`;
  }

  function toggleDock() {
    const opening = dock.hidden;
    dock.hidden = !opening;
    if (opening) positionDock();
    setActivity("jump", 840, opening ? "Quick actions open" : "Standing by");
  }

  hitArea.addEventListener("pointerdown", event => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerDown = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
    dragged = false;
    hitArea.setPointerCapture(event.pointerId);
  });

  hitArea.addEventListener("pointermove", event => {
    if (!pointerDown || pointerDown.id !== event.pointerId) {
      pointToLook(event);
      return;
    }
    const dx = event.clientX - pointerDown.x;
    const dy = event.clientY - pointerDown.y;
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    if (!dragged) {
      dragged = true;
      dock.hidden = true;
    }
    const nextActivity = dx >= 0 ? "right" : "left";
    if (activity !== nextActivity) {
      activity = nextActivity;
      activityStarted = performance.now();
    }
    status.textContent = "Miss Minutes is on the move";
    positionPet(pointerDown.startX + dx, pointerDown.startY + dy);
  });

  function endPointer(event) {
    if (!pointerDown || pointerDown.id !== event.pointerId) return;
    pointerDown = null;
    if (dragged) {
      dragged = false;
      setActivity("idle", null, "Standing by");
      return;
    }
    toggleDock();
  }

  hitArea.addEventListener("pointerup", endPointer);
  hitArea.addEventListener("pointercancel", () => {
    pointerDown = null;
    dragged = false;
    setActivity("idle", null, "Standing by");
  });
  hitArea.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDock();
    }
  });
  stage.addEventListener("pointermove", pointToLook);
  stage.addEventListener("pointerleave", () => { if (activity === "idle") lookDirection = null; });

  document.querySelector("#preview-detection").addEventListener("click", () => {
    card.hidden = false;
    dock.hidden = true;
    setActivity("wave", 700, "Video detected — Miss Minutes says hello");
  });
  document.querySelector("#dismiss-detection").addEventListener("click", () => {
    card.hidden = true;
    status.textContent = "Standing by";
  });
  dock.addEventListener("click", event => {
    const button = event.target.closest("button[data-demo-action]");
    if (!button) return;
    status.textContent = button.dataset.demoAction === "videos" ? "Detected videos action preview" : "Paste a link action preview";
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { if (!pointerDown) status.textContent = "Standing by"; }, 1800);
  });

  positionPet(stage.clientWidth / 2, stage.clientHeight * .55);
  window.addEventListener("resize", () => positionPet(stage.clientWidth / 2, stage.clientHeight * .55));
  frameRequest = requestAnimationFrame(render);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frameRequest), { once: true });
})();
