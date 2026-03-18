const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ─── Rank Card ────────────────────────────────────────────────────────────────
async function generateRankCard({ username, avatarURL, level, xp, xpNeeded, rank, messageCount, accentColor = '#7c3aed' }) {
  const W = 800, H = 200;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0a1a';
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();

  // Subtle grid overlay
  ctx.strokeStyle = 'rgba(124,58,237,0.06)';
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Accent glow top-left
  const glow = ctx.createRadialGradient(60, 60, 0, 60, 60, 120);
  glow.addColorStop(0, `${accentColor}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Avatar circle clip
  const avatarX = 60, avatarY = H / 2, avatarR = 68;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    const avatar = await loadImage(avatarURL + '?size=128');
    ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
  } catch {
    ctx.fillStyle = accentColor;
    ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
  }
  ctx.restore();

  // Avatar border ring
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarR + 4, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Username
  ctx.font      = 'bold 26px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(username.length > 18 ? username.slice(0, 18) + '…' : username, 158, 78);

  // Rank badge
  ctx.font      = 'bold 14px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText(`RANK`, 158, 105);
  ctx.font      = 'bold 28px Sans';
  ctx.fillStyle = accentColor;
  ctx.fillText(`#${rank}`, 200, 105);

  // Level badge top right
  ctx.font      = 'bold 14px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('LEVEL', W - 140, 65);
  ctx.font      = 'bold 42px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${level}`, W - 100, 105);

  // XP bar background
  const barX = 158, barY = 122, barW = W - 200, barH = 18, barR = 9;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.fill();

  // XP bar fill
  const pct = Math.min(xp / xpNeeded, 1);
  if (pct > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(1, '#4f8ef7');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barR * 2, barW * pct), barH, barR);
    ctx.fill();

    // Glow on bar
    ctx.shadowColor = accentColor;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barR * 2, barW * pct), barH, barR);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // XP text
  ctx.font      = 'bold 13px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, barX, barY + barH + 18);

  // Messages count
  ctx.font      = 'bold 13px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const msgText = `${messageCount.toLocaleString()} messages`;
  const msgW    = ctx.measureText(msgText).width;
  ctx.fillText(msgText, barX + barW - msgW, barY + barH + 18);

  return canvas.toBuffer('image/png');
}

// ─── Messages Card ────────────────────────────────────────────────────────────
async function generateMessagesCard({ username, avatarURL, messageCount, rank, accentColor = '#4f8ef7' }) {
  const W = 700, H = 160;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  ctx.fillStyle = '#0f0a1a';
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 20);
  ctx.fill();

  // Glow
  const glow = ctx.createRadialGradient(60, 60, 0, 60, 60, 100);
  glow.addColorStop(0, `${accentColor}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Avatar
  const aX = 55, aY = H / 2, aR = 55;
  ctx.save();
  ctx.beginPath();
  ctx.arc(aX, aY, aR, 0, Math.PI * 2);
  ctx.clip();
  try {
    const avatar = await loadImage(avatarURL + '?size=128');
    ctx.drawImage(avatar, aX - aR, aY - aR, aR * 2, aR * 2);
  } catch {
    ctx.fillStyle = accentColor;
    ctx.fillRect(aX - aR, aY - aR, aR * 2, aR * 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(aX, aY, aR + 3, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth   = 3;
  ctx.stroke();

  // Username
  ctx.font      = 'bold 24px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(username.length > 20 ? username.slice(0, 20) + '…' : username, 132, 65);

  // Messages count big
  ctx.font      = 'bold 38px Sans';
  const grad    = ctx.createLinearGradient(132, 0, 132 + 200, 0);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, '#c084fc');
  ctx.fillStyle = grad;
  ctx.fillText(messageCount.toLocaleString(), 132, 112);

  ctx.font      = 'bold 16px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('MESSAGES', 132, 135);

  // Rank
  ctx.font      = 'bold 14px Sans';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('SERVER RANK', W - 160, 75);
  ctx.font      = 'bold 36px Sans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`#${rank}`, W - 130, 115);

  return canvas.toBuffer('image/png');
}

module.exports = { generateRankCard, generateMessagesCard };
