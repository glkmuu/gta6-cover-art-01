/* VICE COVER — cover render engine. Draws the whole poster on a canvas:
   multi-panel photo layout, Vice City colour grades, retro sun + palm
   silhouettes, heavy poster lettering, grain and vignette. No assets are
   fetched here: photos come from the user's machine, everything else is
   drawn with canvas paths. */

(function (global) {
  "use strict";

  var LAYOUTS = {
    "vice-grid": { panels: 3, label: "Vice Grid" },
    duo: { panels: 3, label: "Duo" },
    quad: { panels: 4, label: "Quad" },
    hero: { panels: 1, label: "Hero" }
  };

  var GRADES = {
    "vice-sunset": {
      label: "Vice Sunset",
      filter: "saturate(1.35) contrast(1.12) brightness(1.04)",
      top: "rgba(255,150,60,0.30)",
      bottom: "rgba(205,30,130,0.34)",
      blend: "overlay"
    },
    "neon-night": {
      label: "Neon Night",
      filter: "saturate(1.55) contrast(1.18) brightness(0.94) hue-rotate(-12deg)",
      top: "rgba(34,211,238,0.32)",
      bottom: "rgba(255,46,136,0.38)",
      blend: "overlay"
    },
    "palm-gold": {
      label: "Palm Gold",
      filter: "sepia(0.28) saturate(1.45) contrast(1.08) brightness(1.03)",
      top: "rgba(255,205,90,0.24)",
      bottom: "rgba(165,60,10,0.26)",
      blend: "soft-light"
    },
    "teal-dusk": {
      label: "Teal Dusk",
      filter: "saturate(1.15) contrast(1.10) hue-rotate(18deg) brightness(0.96)",
      top: "rgba(20,125,145,0.34)",
      bottom: "rgba(10,20,60,0.36)",
      blend: "overlay"
    },
    noir: {
      label: "Noir",
      filter: "grayscale(1) contrast(1.30) brightness(1.03)",
      top: "rgba(255,255,255,0.08)",
      bottom: "rgba(0,0,0,0.28)",
      blend: "overlay"
    }
  };

  var TITLE_INKS = {
    sunset: ["#ffffff", "#ffd166", "#ff5e8a", "#ff2e88"],
    gold: ["#fffbe8", "#ffe98a", "#ffc93c", "#ff7a18"],
    neon: ["#ecfeff", "#67e8f9", "#22d3ee", "#ff2e88"],
    plain: ["#ffffff", "#ffffff", "#f3e8ff", "#e9d5ff"]
  };

  function layoutPanels(layout, W, H, gap) {
    var g = gap || 0;
    var rects = [];
    if (layout === "vice-grid") {
      var w1 = (W - 2 * g) * 0.32;
      var w2 = (W - 2 * g) * 0.36;
      var w3 = W - 2 * g - w1 - w2;
      rects = [
        { x: 0, y: 0, w: w1, h: H },
        { x: w1 + g, y: 0, w: w2, h: H },
        { x: w1 + g + w2 + g, y: 0, w: w3, h: H }
      ];
    } else if (layout === "duo") {
      var left = (W - g) * 0.60;
      var right = W - g - left;
      var half = (H - g) / 2;
      rects = [
        { x: 0, y: 0, w: left, h: H },
        { x: left + g, y: 0, w: right, h: half },
        { x: left + g, y: half + g, w: right, h: half }
      ];
    } else if (layout === "quad") {
      var cw = (W - g) / 2;
      var ch = (H - g) / 2;
      rects = [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + g, y: 0, w: cw, h: ch },
        { x: 0, y: ch + g, w: cw, h: ch },
        { x: cw + g, y: ch + g, w: cw, h: ch }
      ];
    } else {
      rects = [{ x: 0, y: 0, w: W, h: H }];
    }
    return rects;
  }

  function panelCount(layout) {
    return (LAYOUTS[layout] || LAYOUTS["vice-grid"]).panels;
  }

  function drawPhotoCover(ctx, img, rect, panel) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var zoom = panel.zoom || 1;
    var scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
    var dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
    // Clamp the pan so the photo always covers the panel.
    var maxOx = Math.max(0, (dw - rect.w) / 2);
    var maxOy = Math.max(0, (dh - rect.h) / 2);
    dx = Math.min(rect.x + maxOx, Math.max(rect.x + rect.w - dw - maxOx, dx));
    dy = Math.min(rect.y + maxOy, Math.max(rect.y + rect.h - dh - maxOy, dy));
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function applyPhotoGrade(ctx, rect, grade, strength) {
    var g = GRADES[grade] || GRADES["vice-sunset"];
    var s = Math.max(0, Math.min(1, strength == null ? 0.8 : strength));
    if (s <= 0) return;
    var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, g.top);
    grad.addColorStop(1, g.bottom);
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.globalAlpha = s;
    ctx.globalCompositeOperation = g.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  function drawEmptyPanel(ctx, rect, index) {
    var grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, "#3b1155");
    grad.addColorStop(0.55, "#7c2d6e");
    grad.addColorStop(1, "#160a26");
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(2, rect.w * 0.006);
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(rect.x + 14, rect.y + 14, rect.w - 28, rect.h - 28);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 " + Math.round(Math.min(rect.w, rect.h) * 0.055) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PANEL " + (index + 1) + " — ADD A PHOTO", rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  function drawRetroSun(ctx, cx, cy, r) {
    var off = document.createElement("canvas");
    off.width = Math.ceil(r * 2 + 4);
    off.height = Math.ceil(r * 2 + 4);
    var o = off.getContext("2d");
    var grad = o.createRadialGradient(r, r, r * 0.1, r, r, r);
    grad.addColorStop(0, "#fff3b0");
    grad.addColorStop(0.45, "#ffd166");
    grad.addColorStop(0.8, "#ff7a18");
    grad.addColorStop(1, "#ff2e88");
    o.fillStyle = grad;
    o.beginPath();
    o.arc(r + 2, r + 2, r, 0, Math.PI * 2);
    o.fill();
    // Synthwave slits across the lower half, widening toward the bottom.
    o.globalCompositeOperation = "destination-out";
    var y = r + 2 + r * 0.08;
    var thickness = Math.max(2, r * 0.03);
    while (y < r * 2 + 2) {
      o.fillRect(0, y, off.width, thickness);
      y += thickness + r * 0.16;
      thickness *= 1.55;
    }
    ctx.drawImage(off, cx - r - 2, cy - r - 2);
  }

  function drawPalmTree(ctx, x, y, s, lean) {
    // x, y = base of the trunk; s = tree height in px; lean bends the crown.
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(14,5,28,0.95)";
    ctx.fillStyle = "rgba(14,5,28,0.95)";
    ctx.lineCap = "round";
    var crownX = lean * s * 0.22;
    var crownY = -s;
    // Trunk: a tapered curve from the base up to the crown.
    ctx.beginPath();
    ctx.moveTo(-s * 0.035, 0);
    ctx.quadraticCurveTo(-s * 0.02, -s * 0.55, crownX, crownY);
    ctx.lineTo(crownX + s * 0.035, crownY + s * 0.02);
    ctx.quadraticCurveTo(s * 0.02, -s * 0.5, s * 0.035, 0);
    ctx.closePath();
    ctx.fill();
    // Fronds: six drooping arcs fanning out from the crown.
    ctx.lineWidth = Math.max(2, s * 0.028);
    var angles = [-2.5, -1.9, -1.25, -0.6, 0.05, 0.7];
    for (var i = 0; i < angles.length; i++) {
      var a = angles[i];
      var len = s * (0.42 + (i % 2) * 0.07);
      var ex = crownX + Math.cos(a) * len;
      var ey = crownY + Math.sin(a) * len * 0.55 + len * 0.28;
      var mx = crownX + Math.cos(a) * len * 0.55;
      var my = crownY + Math.sin(a) * len * 0.45 - len * 0.12;
      ctx.beginPath();
      ctx.moveTo(crownX, crownY);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }
    // Coconuts.
    ctx.beginPath();
    ctx.arc(crownX - s * 0.02, crownY + s * 0.03, s * 0.03, 0, Math.PI * 2);
    ctx.arc(crownX + s * 0.035, crownY + s * 0.04, s * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSkyline(ctx, W, H, state, bandY, bandH) {
    // Palm silhouettes rising from the title band. The sun is drawn
    // separately, behind the band, in drawTitleBlock.
    var palmH = bandH * 1.5;
    drawPalmTree(ctx, W * 0.045, bandY + bandH * 0.98, palmH, -1);
    drawPalmTree(ctx, W * 0.13, bandY + bandH * 0.98, palmH * 0.78, 1);
    drawPalmTree(ctx, W * 0.955, bandY + bandH * 0.98, palmH * 0.88, 1);
    drawPalmTree(ctx, W * 0.885, bandY + bandH * 0.98, palmH * 0.66, -1);
  }

  function drawTitleBlock(ctx, W, H, state) {
    var scale = W / 1080;
    var title = (state.title || "").toUpperCase();
    var subtitle = (state.subtitle || "").toUpperCase();
    var bandH = Math.round(H * (state.titleSpot === "top" ? 0.24 : 0.26));
    var bandY = state.titleSpot === "top" ? 0 : H - bandH;
    // Retro sun rising behind the title band: drawn first so the band's
    // gradient dims its lower half. It sits on the last vertical panel seam
    // (the gap between the two right-hand columns), where no face sits, so
    // it stays a sunset and never covers a subject.
    if (state.skyline) {
      var sunR = Math.min(W, H) * 0.15;
      var sunX = W * 0.80;
      if (state.layout === "vice-grid") sunX = W * 0.68;
      else if (state.layout === "duo") sunX = W * 0.60;
      else if (state.layout === "quad") sunX = W * 0.50;
      var sunY = state.titleSpot === "top"
        ? bandY + bandH + sunR * 0.55
        : bandY + sunR * 0.30;
      drawRetroSun(ctx, sunX, sunY, sunR);
    }
    // Backdrop band: dark-to-transparent so lettering always reads.
    var band = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    if (state.titleSpot === "top") {
      band.addColorStop(0, "rgba(10,4,20,0.88)");
      band.addColorStop(1, "rgba(10,4,20,0)");
    } else {
      band.addColorStop(0, "rgba(10,4,20,0)");
      band.addColorStop(0.35, "rgba(10,4,20,0.72)");
      band.addColorStop(1, "rgba(10,4,20,0.92)");
    }
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY, W, bandH);

    if (state.skyline) {
      drawSkyline(ctx, W, H, state, bandY, bandH);
    }

    var cx = W / 2;
    var cy = bandY + bandH / 2;
    var titlePx = Math.round((state.titleSize || 120) * scale);
    var fontStack = '"Arial Black", "Helvetica Neue", Impact, "Segoe UI", sans-serif';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.021); // -1.2deg: poster energy without breaking the crop.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    try { ctx.letterSpacing = Math.round(titlePx * 0.03) + "px"; } catch (e) {}
    var ink = TITLE_INKS[state.titleInk] || TITLE_INKS.sunset;
    var inkGrad = ctx.createLinearGradient(0, -titlePx * 0.55, 0, titlePx * 0.55);
    inkGrad.addColorStop(0, ink[0]);
    inkGrad.addColorStop(0.45, ink[1]);
    inkGrad.addColorStop(0.75, ink[2]);
    inkGrad.addColorStop(1, ink[3]);
    ctx.font = "900 " + titlePx + "px " + fontStack;
    // Fit the title inside the cover width.
    var tw = ctx.measureText(title).width;
    var maxW = W * 0.92;
    if (tw > maxW) {
      var fit = maxW / tw;
      ctx.scale(fit, fit);
      titlePx = Math.round(titlePx * fit);
    }
    var titleY = subtitle ? -titlePx * 0.18 : 0;
    if (state.titleOutline) {
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#12081f";
      ctx.lineWidth = Math.max(4, titlePx * 0.11);
      ctx.strokeText(title, 0, titleY);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = Math.max(2, titlePx * 0.02);
      ctx.strokeText(title, 0, titleY);
    }
    // Hard drop shadow baked under the fill.
    ctx.fillStyle = "rgba(10,4,20,0.55)";
    ctx.fillText(title, titlePx * 0.03, titleY + titlePx * 0.045);
    ctx.fillStyle = inkGrad;
    ctx.fillText(title, 0, titleY);
    // Subtitle: wide-tracked caps under the title.
    if (subtitle) {
      var subPx = Math.round(titlePx * 0.24);
      ctx.font = "800 " + subPx + "px " + fontStack;
      try { ctx.letterSpacing = Math.round(subPx * 0.32) + "px"; } catch (e) {}
      var sw = ctx.measureText(subtitle).width;
      if (sw > maxW) {
        var sfit = maxW / sw;
        ctx.font = "800 " + Math.round(subPx * sfit) + "px " + fontStack;
        subPx = Math.round(subPx * sfit);
      }
      ctx.fillStyle = "#ffe9f4";
      ctx.fillText(subtitle, 0, titleY + titlePx * 0.52 + subPx * 0.4);
    }
    ctx.restore();
  }

  var grainTile = null;
  function drawFilmGrain(ctx, W, H) {
    if (!grainTile) {
      grainTile = document.createElement("canvas");
      grainTile.width = 160;
      grainTile.height = 160;
      var g = grainTile.getContext("2d");
      var img = g.createImageData(160, 160);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.floor(Math.random() * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = "overlay";
    var pattern = ctx.createPattern(grainTile, "repeat");
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawVignette(ctx, W, H) {
    var r = Math.hypot(W, H) / 2;
    var grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    grad.addColorStop(0, "rgba(10,4,20,0)");
    grad.addColorStop(1, "rgba(10,4,20,0.42)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCoverFrame(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = "#0d0518";
    ctx.lineWidth = Math.max(4, W * 0.008);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    ctx.strokeStyle = "rgba(255,201,60,0.65)";
    ctx.lineWidth = Math.max(1, W * 0.0015);
    ctx.strokeRect(W * 0.012, H * 0.012, W * 0.976, H * 0.976);
    ctx.restore();
  }

  function renderCover(canvas, state) {
    var size = state.size || "1080x1080";
    var dims = size.split("x");
    var W = parseInt(dims[0], 10) || 1080;
    var H = parseInt(dims[1], 10) || 1080;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    // Poster seam base: deep plum-to-sunset gradient shows through the gaps.
    var base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#2a0a4a");
    base.addColorStop(0.5, "#7c2d6e");
    base.addColorStop(1, "#12081f");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    var rects = layoutPanels(state.layout || "vice-grid", W, H, state.gap == null ? 10 : state.gap);
    var grade = GRADES[state.grade] ? state.grade : "vice-sunset";
    var strength = (state.gradeStrength == null ? 80 : state.gradeStrength) / 100;
    for (var i = 0; i < rects.length; i++) {
      var panel = (state.panels && state.panels[i]) || { photo: -1, zoom: 1, ox: 0, oy: 0 };
      var photo = panel.photo >= 0 && state.photos ? state.photos[panel.photo] : null;
      if (photo && photo.img) {
        ctx.save();
        ctx.filter = (GRADES[grade].filter);
        drawPhotoCover(ctx, photo.img, rects[i], panel);
        ctx.restore();
        applyPhotoGrade(ctx, rects[i], grade, strength);
      } else {
        drawEmptyPanel(ctx, rects[i], i);
      }
      // Selected panel gets a hot-pink seam so the editor state is visible.
      if (state.showSelection && i === state.selectedPanel) {
        ctx.save();
        ctx.strokeStyle = "#ff2e88";
        ctx.lineWidth = Math.max(3, W * 0.004);
        ctx.strokeRect(rects[i].x + 2, rects[i].y + 2, rects[i].w - 4, rects[i].h - 4);
        ctx.restore();
      }
    }

    drawTitleBlock(ctx, W, H, state);
    if (state.grain) drawFilmGrain(ctx, W, H);
    if (state.vignette) drawVignette(ctx, W, H);
    drawCoverFrame(ctx, W, H);
    return canvas;
  }

  function exportCoverPNG(state, width, height) {
    var canvas = document.createElement("canvas");
    var shot = Object.assign({}, state, {
      size: width + "x" + height,
      showSelection: false
    });
    renderCover(canvas, shot);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("Export failed: canvas produced no PNG"));
      }, "image/png");
    });
  }

  function coverDataURL(state, width, height, mime, quality) {
    var canvas = document.createElement("canvas");
    var shot = Object.assign({}, state, {
      size: width + "x" + height,
      showSelection: false
    });
    renderCover(canvas, shot);
    return canvas.toDataURL(mime || "image/jpeg", quality == null ? 0.88 : quality);
  }

  global.ViceCoverRender = {
    LAYOUTS: LAYOUTS,
    GRADES: GRADES,
    TITLE_INKS: TITLE_INKS,
    layoutPanels: layoutPanels,
    panelCount: panelCount,
    renderCover: renderCover,
    exportCoverPNG: exportCoverPNG,
    coverDataURL: coverDataURL
  };
})(window);
