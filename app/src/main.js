/* VICE COVER — editor wiring. Loads photos (uploads, drag-drop, samples),
   binds every control to the cover state, keeps an undo/redo history of the
   settings, and exports the finished PNG. The drawing itself lives in
   src/cover.js (ViceCoverRender). */

(function () {
  "use strict";

  var R = window.ViceCoverRender;
  var $ = function (id) { return document.getElementById(id); };

  var SAMPLE_PHOTOS = [
    { src: "samples/boulevard.jpg", name: "Boulevard" },
    { src: "samples/pier.jpg", name: "Pier" }
  ];

  var state = {
    layout: "vice-grid",
    gap: 10,
    title: "VICE CITY",
    subtitle: "WELCOME TO THE SUNSHINE STATE",
    titleSize: 120,
    titleSpot: "bottom",
    titleInk: "sunset",
    titleOutline: true,
    grade: "vice-sunset",
    gradeStrength: 80,
    grain: true,
    vignette: true,
    skyline: true,
    size: "1080x1080",
    photos: [],
    panels: [],
    selectedPanel: 0,
    showSelection: true
  };

  var history = [];
  var historyIndex = -1;
  var photosReadyResolve;
  var photosReady = new Promise(function (resolve) { photosReadyResolve = resolve; });

  function snapshotState() {
    return JSON.parse(JSON.stringify({
      layout: state.layout,
      gap: state.gap,
      title: state.title,
      subtitle: state.subtitle,
      titleSize: state.titleSize,
      titleSpot: state.titleSpot,
      titleInk: state.titleInk,
      titleOutline: state.titleOutline,
      grade: state.grade,
      gradeStrength: state.gradeStrength,
      grain: state.grain,
      vignette: state.vignette,
      skyline: state.skyline,
      size: state.size,
      panels: state.panels,
      selectedPanel: state.selectedPanel
    }));
  }

  function restoreSnapshot(snap) {
    Object.keys(snap).forEach(function (k) { state[k] = snap[k]; });
    syncControls();
    renderPreview();
  }

  function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshotState());
    if (history.length > 60) history.shift();
    historyIndex = history.length - 1;
    updateUndoButtons();
  }

  function undoCover() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreSnapshot(history[historyIndex]);
    updateUndoButtons();
  }

  function redoCover() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreSnapshot(history[historyIndex]);
    updateUndoButtons();
  }

  function updateUndoButtons() {
    $("undo-btn").disabled = historyIndex <= 0;
    $("redo-btn").disabled = historyIndex >= history.length - 1;
  }

  function ensurePanels() {
    var n = R.panelCount(state.layout);
    while (state.panels.length < n) {
      state.panels.push({ photo: -1, zoom: 1, ox: 0, oy: 0 });
    }
    state.panels.length = n;
    if (state.selectedPanel >= n) state.selectedPanel = 0;
    // First photo fills empty panels so the cover is never blank: cycle
    // through the loaded photos so neighbouring panels differ.
    for (var i = 0; i < n; i++) {
      if (state.panels[i].photo < 0 && state.photos.length > 0) {
        state.panels[i].photo = i % state.photos.length;
      }
    }
  }

  function renderPreview() {
    ensurePanels();
    R.renderCover($("preview-canvas"), state);
    renderPanelStrip();
    renderPhotoTray();
  }

  function renderPanelStrip() {
    var strip = $("panel-strip");
    strip.innerHTML = "";
    var rects = R.layoutPanels(state.layout, 1080, 1080, state.gap);
    void rects;
    for (var i = 0; i < state.panels.length; i++) {
      (function (i) {
        var p = state.panels[i];
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "panel-chip" + (i === state.selectedPanel ? " is-selected" : "");
        var photoName = p.photo >= 0 && state.photos[p.photo] ? state.photos[p.photo].name : "empty";
        chip.innerHTML = "";
        var strong = document.createElement("strong");
        strong.textContent = "Panel " + (i + 1);
        var span = document.createElement("span");
        span.textContent = photoName + " · " + Math.round((p.zoom || 1) * 100) + "%";
        chip.appendChild(strong);
        chip.appendChild(span);
        chip.addEventListener("click", function () {
          state.selectedPanel = i;
          syncZoomControl();
          renderPreview();
        });
        strip.appendChild(chip);
      })(i);
    }
  }

  function renderPhotoTray() {
    var tray = $("photo-tray");
    tray.innerHTML = "";
    state.photos.forEach(function (photo, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "photo-thumb" + (state.panels[state.selectedPanel] && state.panels[state.selectedPanel].photo === idx ? " is-selected" : "");
      btn.title = photo.name + " — click to put in the selected panel";
      var img = document.createElement("img");
      img.src = photo.img.src;
      img.alt = photo.name;
      var x = document.createElement("span");
      x.className = "photo-remove";
      x.textContent = "×";
      x.title = "Remove photo";
      x.addEventListener("click", function (ev) {
        ev.stopPropagation();
        removePhoto(idx);
      });
      btn.appendChild(img);
      btn.appendChild(x);
      btn.addEventListener("click", function () {
        ensurePanels();
        state.panels[state.selectedPanel].photo = idx;
        pushHistory();
        renderPreview();
      });
      tray.appendChild(btn);
    });
  }

  function removePhoto(idx) {
    state.photos.splice(idx, 1);
    state.panels.forEach(function (p) {
      if (p.photo === idx) p.photo = state.photos.length ? 0 : -1;
      else if (p.photo > idx) p.photo--;
    });
    pushHistory();
    renderPreview();
  }

  function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () { resolve({ img: img, name: file.name.replace(/\.[^.]+$/, "") || "Photo" }); };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function addPhotoFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return f.type.indexOf("image/") === 0; });
    if (!list.length) return Promise.resolve();
    return Promise.all(list.map(loadImageFile)).then(function (loaded) {
      loaded.forEach(function (photo) { state.photos.push(photo); });
      ensurePanels();
      pushHistory();
      renderPreview();
    }).catch(function () {
      // A bad file is skipped; the good ones still land.
      renderPreview();
    });
  }

  function loadSamplePhotos() {
    var jobs = SAMPLE_PHOTOS.map(function (s) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ img: img, name: s.name }); };
        img.onerror = function () { resolve(null); };
        img.src = s.src;
      });
    });
    return Promise.all(jobs).then(function (loaded) {
      loaded.forEach(function (photo) { if (photo) state.photos.push(photo); });
      ensurePanels();
      renderPreview();
      photosReadyResolve();
    });
  }

  function syncZoomControl() {
    var p = state.panels[state.selectedPanel];
    var z = p ? Math.round((p.zoom || 1) * 100) : 100;
    $("zoom-range").value = z;
    $("zoom-value").textContent = z + "%";
  }

  function syncControls() {
    $("title-input").value = state.title;
    $("subtitle-input").value = state.subtitle;
    $("title-size-range").value = state.titleSize;
    $("title-spot-select").value = state.titleSpot;
    $("title-ink-select").value = state.titleInk;
    $("title-outline-check").checked = state.titleOutline;
    $("gap-range").value = state.gap;
    $("gap-value").textContent = state.gap + " px";
    $("grade-strength-range").value = state.gradeStrength;
    $("grade-strength-value").textContent = state.gradeStrength + "%";
    $("grain-check").checked = state.grain;
    $("vignette-check").checked = state.vignette;
    $("skyline-check").checked = state.skyline;
    document.querySelectorAll(".layout-btn").forEach(function (b) {
      var on = b.dataset.layout === state.layout;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    document.querySelectorAll(".grade-btn").forEach(function (b) {
      var on = b.dataset.grade === state.grade;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    document.querySelectorAll(".size-btn").forEach(function (b) {
      var on = b.dataset.size === state.size;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    syncZoomControl();
  }

  function bindControls() {
    $("photo-input").addEventListener("change", function (ev) {
      addPhotoFiles(ev.target.files);
      ev.target.value = "";
    });
    document.addEventListener("dragover", function (ev) { ev.preventDefault(); });
    document.addEventListener("drop", function (ev) {
      ev.preventDefault();
      if (ev.dataTransfer && ev.dataTransfer.files) addPhotoFiles(ev.dataTransfer.files);
    });

    $("fill-all-btn").addEventListener("click", function () {
      var p = state.panels[state.selectedPanel];
      if (!p || p.photo < 0) return;
      state.panels.forEach(function (panel) { panel.photo = p.photo; });
      pushHistory();
      renderPreview();
    });
    $("cycle-photo-btn").addEventListener("click", function () {
      if (!state.photos.length) return;
      var p = state.panels[state.selectedPanel];
      p.photo = ((p.photo < 0 ? -1 : p.photo) + 1) % state.photos.length;
      pushHistory();
      renderPreview();
    });
    $("reset-panel-btn").addEventListener("click", function () {
      var p = state.panels[state.selectedPanel];
      p.zoom = 1; p.ox = 0; p.oy = 0;
      syncZoomControl();
      pushHistory();
      renderPreview();
    });

    document.querySelectorAll(".layout-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.layout = b.dataset.layout;
        ensurePanels();
        pushHistory();
        syncControls();
        renderPreview();
      });
    });
    document.querySelectorAll(".grade-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.grade = b.dataset.grade;
        pushHistory();
        syncControls();
        renderPreview();
      });
    });
    document.querySelectorAll(".size-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.size = b.dataset.size;
        pushHistory();
        syncControls();
        renderPreview();
      });
    });

    $("gap-range").addEventListener("input", function () {
      state.gap = parseInt($("gap-range").value, 10);
      $("gap-value").textContent = state.gap + " px";
      renderPreview();
    });
    $("gap-range").addEventListener("change", pushHistory);
    $("title-size-range").addEventListener("input", function () {
      state.titleSize = parseInt($("title-size-range").value, 10);
      renderPreview();
    });
    $("title-size-range").addEventListener("change", pushHistory);
    $("grade-strength-range").addEventListener("input", function () {
      state.gradeStrength = parseInt($("grade-strength-range").value, 10);
      $("grade-strength-value").textContent = state.gradeStrength + "%";
      renderPreview();
    });
    $("grade-strength-range").addEventListener("change", pushHistory);
    $("zoom-range").addEventListener("input", function () {
      var p = state.panels[state.selectedPanel];
      if (!p) return;
      p.zoom = parseInt($("zoom-range").value, 10) / 100;
      $("zoom-value").textContent = $("zoom-range").value + "%";
      renderPreview();
    });
    $("zoom-range").addEventListener("change", pushHistory);

    $("title-input").addEventListener("input", function () {
      state.title = $("title-input").value;
      renderPreview();
    });
    $("title-input").addEventListener("change", pushHistory);
    $("subtitle-input").addEventListener("input", function () {
      state.subtitle = $("subtitle-input").value;
      renderPreview();
    });
    $("subtitle-input").addEventListener("change", pushHistory);
    $("title-spot-select").addEventListener("change", function () {
      state.titleSpot = $("title-spot-select").value;
      pushHistory();
      renderPreview();
    });
    $("title-ink-select").addEventListener("change", function () {
      state.titleInk = $("title-ink-select").value;
      pushHistory();
      renderPreview();
    });
    $("title-outline-check").addEventListener("change", function () {
      state.titleOutline = $("title-outline-check").checked;
      pushHistory();
      renderPreview();
    });
    $("grain-check").addEventListener("change", function () {
      state.grain = $("grain-check").checked;
      pushHistory();
      renderPreview();
    });
    $("vignette-check").addEventListener("change", function () {
      state.vignette = $("vignette-check").checked;
      pushHistory();
      renderPreview();
    });
    $("skyline-check").addEventListener("change", function () {
      state.skyline = $("skyline-check").checked;
      pushHistory();
      renderPreview();
    });

    $("undo-btn").addEventListener("click", undoCover);
    $("redo-btn").addEventListener("click", redoCover);
    document.addEventListener("keydown", function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !ev.shiftKey) {
        ev.preventDefault();
        undoCover();
      } else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === "y" || (ev.key.toLowerCase() === "z" && ev.shiftKey))) {
        ev.preventDefault();
        redoCover();
      }
    });

    $("export-btn").addEventListener("click", exportCurrentCover);
    bindCanvasGestures();
  }

  function bindCanvasGestures() {
    var canvas = $("preview-canvas");
    var drag = null;
    function canvasPoint(ev) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * (canvas.width / r.width),
        y: (ev.clientY - r.top) * (canvas.height / r.height)
      };
    }
    function panelAt(pt) {
      var rects = R.layoutPanels(state.layout, canvas.width, canvas.height, state.gap);
      for (var i = 0; i < rects.length; i++) {
        var rc = rects[i];
        if (pt.x >= rc.x && pt.x <= rc.x + rc.w && pt.y >= rc.y && pt.y <= rc.y + rc.h) return i;
      }
      return -1;
    }
    canvas.addEventListener("pointerdown", function (ev) {
      var pt = canvasPoint(ev);
      var idx = panelAt(pt);
      if (idx < 0) return;
      state.selectedPanel = idx;
      syncZoomControl();
      renderPreview();
      drag = { panel: state.panels[idx], startX: pt.x, startY: pt.y, ox: state.panels[idx].ox, oy: state.panels[idx].oy, moved: false };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var pt = canvasPoint(ev);
      var rects = R.layoutPanels(state.layout, canvas.width, canvas.height, state.gap);
      var rc = rects[state.selectedPanel];
      var dx = (pt.x - drag.startX) / rc.w;
      var dy = (pt.y - drag.startY) / rc.h;
      if (Math.abs(dx) + Math.abs(dy) > 0.005) drag.moved = true;
      drag.panel.ox = drag.ox + dx;
      drag.panel.oy = drag.oy + dy;
      renderPreview();
    });
    canvas.addEventListener("pointerup", function () {
      if (drag && drag.moved) pushHistory();
      drag = null;
    });
    canvas.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var p = state.panels[state.selectedPanel];
      if (!p) return;
      var next = (p.zoom || 1) * (ev.deltaY < 0 ? 1.08 : 0.93);
      p.zoom = Math.max(1, Math.min(2.6, next));
      syncZoomControl();
      renderPreview();
    }, { passive: false });
  }

  function exportCurrentCover() {
    var dims = state.size.split("x");
    var w = parseInt(dims[0], 10);
    var h = parseInt(dims[1], 10);
    return R.exportCoverPNG(state, w, h).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "vice-cover-" + state.size + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      return blob;
    });
  }

  // Automation hook used by the maker's own screenshot runs: renders the
  // cover at an exact size and returns a JPEG data URL of the app's drawing.
  function shotCover(width, height, mime, quality) {
    return R.coverDataURL(state, width, height, mime || "image/jpeg", quality == null ? 0.88 : quality);
  }

  window.ViceCover = {
    state: state,
    photosReady: photosReady,
    renderPreview: renderPreview,
    exportPNG: exportCurrentCover,
    shotCover: shotCover,
    undo: undoCover,
    redo: redoCover
  };

  bindControls();
  syncControls();
  pushHistory();
  loadSamplePhotos();
})();
