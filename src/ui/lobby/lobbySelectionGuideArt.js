import { SELECTION_GUIDE_STEPS } from "./lobbySelectionAffordance.js";

export const SELECTION_GUIDE_CANVAS = Object.freeze({ width: 1200, height: 180 });

function tracedStroke(ctx, draw, {
  dark = "rgba(40, 20, 10, 0.36)",
  light = "rgba(220, 194, 145, 0.34)",
  width = 3,
  lightDx = 0.8,
  lightDy = -0.8,
} = {}) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width + 1.3;
  ctx.strokeStyle = dark;
  draw();
  ctx.stroke();
  ctx.translate(lightDx, lightDy);
  ctx.lineWidth = width;
  ctx.strokeStyle = light;
  draw();
  ctx.stroke();
  ctx.restore();
}

function tracedFill(ctx, draw, {
  dark = "rgba(40, 20, 10, 0.22)",
  light = "rgba(223, 198, 151, 0.18)",
  lightDx = 0.7,
  lightDy = -0.7,
} = {}) {
  ctx.save();
  ctx.fillStyle = dark;
  draw();
  ctx.fill();
  ctx.translate(lightDx, lightDy);
  ctx.fillStyle = light;
  draw();
  ctx.fill();
  ctx.restore();
}

function roughLine(ctx, x1, y1, x2, y2, bend = 0) {
  return () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + bend, x2, y2);
  };
}

function roughArrow(ctx, x1, x2, y) {
  tracedStroke(ctx, roughLine(ctx, x1, y, x2, y - 1, 3), { width: 3.3 });
  tracedStroke(ctx, roughLine(ctx, x2 - 20, y - 12, x2, y - 1, 1.2), { width: 3 });
  tracedStroke(ctx, roughLine(ctx, x2 - 20, y + 10, x2, y - 1, -1.2), { width: 3 });
}

function drawPortrait(ctx, cx, cy) {
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy - 40);
    ctx.lineTo(cx + 36, cy - 40);
    ctx.lineTo(cx + 31, cy + 40);
    ctx.lineTo(cx - 31, cy + 40);
    ctx.closePath();
  }, { width: 3.5 });
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy - 12, 12, 0, Math.PI * 2);
  }, { width: 3 });
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 22);
    ctx.quadraticCurveTo(cx, cy + 4, cx + 20, cy + 22);
  }, { width: 3 });
}

function drawScroll(ctx, cx, cy) {
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 42, cy - 32);
    ctx.quadraticCurveTo(cx - 49, cy - 38, cx - 46, cy - 18);
    ctx.lineTo(cx - 46, cy + 22);
    ctx.quadraticCurveTo(cx - 47, cy + 40, cx - 34, cy + 36);
    ctx.lineTo(cx + 34, cy + 36);
    ctx.quadraticCurveTo(cx + 47, cy + 40, cx + 46, cy + 22);
    ctx.lineTo(cx + 46, cy - 18);
    ctx.quadraticCurveTo(cx + 49, cy - 38, cx + 42, cy - 32);
  }, { width: 3.4 });
  tracedStroke(ctx, roughLine(ctx, cx - 28, cy - 10, cx + 24, cy - 10, 1), { width: 2.2 });
  tracedStroke(ctx, roughLine(ctx, cx - 28, cy + 4, cx + 18, cy + 4, -1), { width: 2.1 });
  tracedStroke(ctx, roughLine(ctx, cx - 28, cy + 18, cx + 26, cy + 18, 1), { width: 2.1 });
}

function drawQuillAndSeal(ctx, cx, cy) {
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 30);
    ctx.quadraticCurveTo(cx - 4, cy + 6, cx + 20, cy - 30);
  }, { width: 3.4 });
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx + 20, cy - 30);
    ctx.quadraticCurveTo(cx + 38, cy - 22, cx + 26, cy - 6);
    ctx.quadraticCurveTo(cx + 12, cy - 14, cx + 20, cy - 30);
  }, { width: 3.2 });
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 46, cy + 28);
    ctx.bezierCurveTo(cx - 28, cy + 6, cx - 10, cy + 40, cx + 5, cy + 20);
    ctx.bezierCurveTo(cx + 14, cy + 8, cx + 26, cy + 30, cx + 38, cy + 18);
  }, { width: 3.1 });
  tracedFill(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx + 50, cy + 28, 12.5, 0, Math.PI * 2);
  });
  tracedStroke(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx + 50, cy + 28, 12.5, 0, Math.PI * 2);
  }, { width: 2.3 });
}

function drawStepLabel(ctx, x, label) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 23px Cinzel, Georgia, serif";
  ctx.fillStyle = "rgba(48, 25, 11, 0.44)";
  ctx.fillText(label, x, 149);
  ctx.fillStyle = "rgba(218, 192, 145, 0.44)";
  ctx.fillText(label, x + 0.8, 148.2);
  ctx.restore();
}

export function paintCharacterSelectionGuide(ctx, { width = SELECTION_GUIDE_CANVAS.width, height = SELECTION_GUIDE_CANVAS.height } = {}) {
  ctx.clearRect(0, 0, width, height);

  const centers = [210, 600, 990];
  const iconY = 74;

  drawPortrait(ctx, centers[0], iconY);
  drawScroll(ctx, centers[1], iconY);
  drawQuillAndSeal(ctx, centers[2], iconY);
  roughArrow(ctx, 312, 486, iconY + 2);
  roughArrow(ctx, 706, 880, iconY + 2);

  centers.forEach((x, index) => drawStepLabel(ctx, x, SELECTION_GUIDE_STEPS[index]?.label ?? ""));
}
