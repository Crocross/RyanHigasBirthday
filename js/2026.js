// ── Module Setup & Shared Lifecycle States ───────────────────────
let showContainer, hideContainer, showMessage;

// ── Game Constants ────────────────────────────────────────────────
const AW = 560;
const AH = 600;
const TOTAL = 5;
const G = 0.48;
const SX = AW / 2;
const SY = AH - 52 - 40;
const MAX_DRAG = 130;
const VB_W = 290;
const VB_H = 185;
const VB_RIM_XF = 145 / 290;
const VB_RIM_YF = 136 / 185;
const RIM_RESTITUTION = 0.45;
const BOARD_RESTITUTION = 0.38;
const MAX_BOUNCES = 3;
const DIST_LABELS = [
    { label: 'CLOSE', ft: '~10 ft' },
    { label: 'MID', ft: '~18 ft' },
    { label: 'LONG', ft: '~26 ft' }
];
const PASS_SCORE = 3;

// ── Live Variables ────────────────────────────────────────────────
let score = 0;
let ballsLeft = TOTAL;
let canShoot = true;
let inFlight = false;
let gameOver = false;
let dragging = false;
let dSX = 0, dSY = 0, dCX = 0, dCY = 0;
let hoop = null;
let msgT;
let activeRafId = null;  
let rstBtn = null;       
let skipBtn = null;

// ── UI Elements Cache ─────────────────────────────────────────────
let arena, CV, ctx, curBall, flyBall, powerWrap, powerFill;
let ballQueue, flashEl, msgEl, gameoverEl, hoopWrap;

function cacheElements() {
    arena = document.getElementById('arena');
    CV = document.getElementById('arrow-canvas');
    ctx = CV ? CV.getContext('2d') : null;
    curBall = document.getElementById('current-ball');
    flyBall = document.getElementById('fly-ball');
    powerWrap = document.getElementById('power-wrap');
    powerFill = document.getElementById('power-bar-fill');
    ballQueue = document.getElementById('ball-queue');
    flashEl = document.getElementById('flash');
    msgEl = document.getElementById('msg');
    gameoverEl = document.getElementById('gameover');
    hoopWrap = document.getElementById('hoop-wrap');
    
    if (CV) {
        CV.width = AW;
        CV.height = AH;
    }
}

// ── Hoop Logic ────────────────────────────────────────────────────
function randomHoopConfig() {
    const tiers = [
        { hoopY: 290, svgW: 270, dist: 0 },
        { hoopY: 210, svgW: 190, dist: 1 },
        { hoopY: 145, svgW: 130, dist: 2 }
    ];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    const margin = 75 + (1 - tier.svgW / 270) * 55;
    const hoopX = margin + Math.random() * (AW - margin * 2);
    return { ...tier, hoopX };
}

function placeHoop(cfg) {
    if (!hoopWrap) return;
    hoop = cfg;
    const svgH = cfg.svgW * (VB_H / VB_W);
    const rimPxX = cfg.svgW * VB_RIM_XF;
    const rimPxY = svgH * VB_RIM_YF;
    
    hoopWrap.style.width = cfg.svgW + 'px';
    hoopWrap.style.left = (cfg.hoopX - rimPxX) + 'px';
    hoopWrap.style.top = (cfg.hoopY - rimPxY) + 'px';
    
    hoop.rimHalfPx = (60 / VB_W) * cfg.svgW * 0.75;
    const scl = cfg.svgW / VB_W;
    const wrapLeft = cfg.hoopX - rimPxX;
    const wrapTop = cfg.hoopY - rimPxY;
    
    hoop.board = {
        left: wrapLeft + 55 * scl,
        right: wrapLeft + 235 * scl,
        top: wrapTop + 8 * scl,
        bottom: wrapTop + 126 * scl
    };
    hoop.leftRimX = cfg.hoopX - hoop.rimHalfPx;
    hoop.rightRimX = cfg.hoopX + hoop.rimHalfPx;
    hoop.rimY = cfg.hoopY;
    hoop.rimThick = 7 * scl;
    
    const floorH = 140 + ((cfg.hoopY - 145) / (290 - 145)) * 90;
    const floor = document.getElementById('court-floor');
    if (floor) {
        floor.style.height = floorH + 'px';
        const hFrac = ((AH - floorH) / AH * 100).toFixed(1);
        floor.style.clipPath = `polygon(0% ${hFrac}%, 100% ${hFrac}%, 100% 100%, 0% 100%)`;
    }
    
    const distEl = document.getElementById('v-dist');
    if (distEl) distEl.textContent = DIST_LABELS[cfg.dist].ft;
}

function newHoop() {
    placeHoop(randomHoopConfig());
}

// ── HUD Updates ───────────────────────────────────────────────────
function updateHUD() {
    const scoreEl = document.getElementById('v-score');
    const ballsEl = document.getElementById('v-balls');
    if (scoreEl) scoreEl.textContent = score;
    if (ballsEl) ballsEl.textContent = ballsLeft;
    
    if (ballQueue) {
        ballQueue.innerHTML = '';
        for (let i = 0; i < ballsLeft; i++) {
            const d = document.createElement('div');
            d.className = 'queue-ball' + (i === ballsLeft - 1 ? ' active' : '');
            d.textContent = '🏀';
            ballQueue.appendChild(d);
        }
    }
}

function showMsg(t, d = 1100) {
    if (!msgEl) return;
    clearTimeout(msgT);
    msgEl.textContent = t;
    msgEl.style.opacity = '1';
    if (d > 0) msgT = setTimeout(() => msgEl.style.opacity = '0', d);
}

function hideMsg() {
    if (msgEl) msgEl.style.opacity = '0';
}

function doFlash(c) {
    if (!flashEl) return;
    flashEl.style.background = c;
    flashEl.style.transition = '';
    flashEl.style.opacity = '0.2';
    setTimeout(() => {
        flashEl.style.transition = 'opacity .45s';
        flashEl.style.opacity = '0';
    }, 80);
}

// ── FX Particles ──────────────────────────────────────────────────
function spawnParticles(x, y, col, n) {
    if (!arena) return;
    for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const sz = 4 + Math.random() * 7;
        p.style.cssText = `width:${sz}px;height:${sz}px;background:${col};left:${x}px;top:${y}px;`;
        arena.appendChild(p);
        
        const a = Math.random() * Math.PI * 2;
        const sp = 50 + Math.random() * 110;
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp - 75;
        let t0 = null;
        
        requestAnimationFrame(function s(ts) {
            if (!t0) t0 = ts;
            const t = (ts - t0) / 1000;
            const op = Math.max(0, 1 - t * 2.2);
            p.style.left = (x + vx * t) + 'px';
            p.style.top = (y + vy * t + 110 * t * t) + 'px';
            p.style.opacity = op;
            if (op > 0) requestAnimationFrame(s);
            else p.remove();
        });
    }
}

function spawnPop(x, y, text, col) {
    if (!arena) return;
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.style.cssText = `left:${x}px;top:${y}px;color:${col};transform:translateX(-50%)`;
    el.textContent = text;
    arena.appendChild(el);
    let t0 = null;
    
    requestAnimationFrame(function s(ts) {
        if (!t0) t0 = ts;
        const t = (ts - t0) / 1000;
        el.style.top = (y - t * 58) + 'px';
        el.style.opacity = Math.max(0, 1 - t * 2.3);
        if (t < 0.9) requestAnimationFrame(s);
        else el.remove();
    });
}

function swayNet() {
    const n = document.getElementById('net');
    if (!n) return;
    n.style.transition = 'transform 0.08s';
    n.style.transform = 'translateX(7px)';
    setTimeout(() => n.style.transform = 'translateX(-5px)', 100);
    setTimeout(() => n.style.transform = 'translateX(3px)', 210);
    setTimeout(() => n.style.transform = 'translateX(0)', 320);
}

function rimFlash() {
    if (!arena || !hoop) return;
    const f = document.createElement('div');
    f.style.cssText = `position:absolute;left:${hoop.hoopX - 30}px;top:${hoop.rimY - 10}px;width:60px;height:20px;background:rgba(255,180,60,0.55);border-radius:4px;pointer-events:none;z-index:35;`;
    arena.appendChild(f);
    let t0 = null;
    
    requestAnimationFrame(function s(ts) {
        if (!t0) t0 = ts;
        const t = (ts - t0) / 1000;
        f.style.opacity = Math.max(0, 1 - t * 5);
        if (t < 0.25) requestAnimationFrame(s);
        else f.remove();
    });
}

// ── Physics Calculations ──────────────────────────────────────────
function checkBounce(bx,by,bvx,bvy,bounceCount) {
    if (bounceCount >= MAX_BOUNCES || !hoop) return null;
    const b = hoop, ballR = 12;
    
    if (Math.abs(bx - b.leftRimX) < ballR + 4 && Math.abs(by - b.rimY) < ballR + 4 && bvy > 0) {
        const newVx = Math.abs(bvx) * RIM_RESTITUTION + 0.5;
        const newVy = -Math.abs(bvy) * RIM_RESTITUTION;
        const luckyIn = bvx > 1.5 && bx < b.hoopX;
        return { bounced: true, vx: luckyIn ? Math.abs(newVx) * 0.7 : newVx, vy: newVy, isRim: true, isBounceIn: luckyIn };
    }
    if (Math.abs(bx - b.rightRimX) < ballR + 4 && Math.abs(by - b.rimY) < ballR + 4 && bvy > 0) {
        const newVx = -Math.abs(bvx) * RIM_RESTITUTION - 0.5;
        const newVy = -Math.abs(bvy) * RIM_RESTITUTION;
        const luckyIn = bvx < -1.5 && bx > b.hoopX;
        return { bounced: true, vx: luckyIn ? -Math.abs(newVx) * 0.7 : newVx, vy: newVy, isRim: true, isBounceIn: luckyIn };
    }
    
    const bd = b.board;
    if (bvx > 0.5 && bx + ballR >= bd.left && bx - ballR < bd.left + 6 && by >= bd.top && by <= bd.bottom) {
        return { bounced: true, vx: -bvx * BOARD_RESTITUTION, vy: bvy * BOARD_RESTITUTION, isRim: false, isBounceIn: false };
    }
    if (bvx < -0.5 && bx - ballR <= bd.right && bx + ballR > bd.right - 6 && by >= bd.top && by <= bd.bottom) {
        return { bounced: true, vx: -bvx * BOARD_RESTITUTION, vy: bvy * BOARD_RESTITUTION, isRim: false, isBounceIn: false };
    }
    return null;
}

function dragToVel(ddx, ddy) {
    const dist = Math.hypot(ddx, ddy);
    const power = Math.min(dist / MAX_DRAG, 1);
    const speed = 6 + power * 22;
    const angle = Math.atan2(-ddy, -ddx);
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, power };
}

// ── Vector Trajectory Canvas Drawing ──────────────────────────────
function clearC() {
    if (ctx) ctx.clearRect(0, 0, AW, AH);
}

function drawArrow() {
    clearC();
    if (!dragging || !ctx) return;
    const dx = dCX - dSX, dy = dCY - dSY;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return;
    
    const { vx, vy, power } = dragToVel(dx, dy);
    let px = SX, py = SY, pvx = vx, pvy = vy;
    
    ctx.setLineDash([4, 10]);
    ctx.strokeStyle = `rgba(200,200,200,${0.15 + power * 0.55})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let i = 0; i < 80; i++) {
        pvy += G; px += pvx; py += pvy;
        ctx.lineTo(px, py);
        if (py > AH + 20 || px < -30 || px > AW + 30) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    const angle = Math.atan2(-dy, -dx);
    const arrowLen = 26 + power * 52;
    const ax = SX + Math.cos(angle) * arrowLen;
    const ay = SY + Math.sin(angle) * arrowLen;
    const col = power < 0.35 ? '#ffcc44' : power < 0.72 ? '#c8c8c8' : '#ff7a7a';
    
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(SX, SY); ctx.lineTo(ax, ay); ctx.stroke();
    
    const h = 12; ctx.fillStyle = col; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.lineTo(ax - h * Math.cos(angle - .38), ay - h * Math.sin(angle - .38));
    ctx.lineTo(ax - h * Math.cos(angle + .38), ay - h * Math.sin(angle + .38));
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    
    if (powerWrap && powerFill) {
        powerWrap.style.display = 'flex';
        powerFill.style.height = (power * 100) + '%';
        powerFill.style.background = col;
    }
}

// ── Ball Physics Simulation Loop ──────────────────────────────────
function shoot(ddx, ddy) {
    const dist = Math.hypot(ddx, ddy);
    if (dist < 8 || !canShoot || inFlight || gameOver || ballsLeft <= 0) return;
    
    const { vx, vy } = dragToVel(ddx, ddy);
    ballsLeft--;
    updateHUD();
    canShoot = false;
    inFlight = true;
    clearC();
    
    if (powerWrap) powerWrap.style.display = 'none';
    if (curBall) curBall.style.opacity = '0';
    if (flyBall) {
        flyBall.style.display = 'block';
        flyBall.style.fontSize = '50px';
        flyBall.style.left = (SX - 25) + 'px';
        flyBall.style.top = (SY - 25) + 'px';
    }
    
    let bx = SX, by = SY, bvx = vx, bvy = vy;
    let trail = [], scored = false, scoreChecked = false, bounceCount = 0, hadBoardBounce = false;

    function frame() {
        bvy += G; bx += bvx; by += bvy;
        const hit = checkBounce(bx, by, bvx, bvy, bounceCount);
        if (hit) {
            bvx = hit.vx; bvy = hit.vy; bounceCount++; rimFlash();
            if (!hit.isRim) hadBoardBounce = true;
            if (hit.isRim && hoop) by = hoop.rimY - 14;
        }
        trail.push({ x: bx, y: by });
        if (trail.length > 10) trail.shift();
        
        const depthT = Math.max(0, Math.min(1, (SY - by) / (SY - (hoop ? hoop.rimY : 0))));
        const hoopS = hoop ? hoop.svgW / 270 : 1;
        const s = 1 - depthT * (1 - hoopS * 0.88);
        const bsz = 50 * Math.max(0.18, s);
        
        if (flyBall) {
            flyBall.style.fontSize = bsz + 'px';
            flyBall.style.left = (bx - bsz / 2) + 'px';
            flyBall.style.top = (by - bsz / 2) + 'px';
        }
        
        clearC();
        if (ctx) {
            trail.forEach((pt, i) => {
                const a = (i / trail.length) * 0.28, r = 6 * (i / trail.length) * s;
                ctx.globalAlpha = a; ctx.fillStyle = '#aaa';
                ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
        
        if (hoop && !scoreChecked && bvy > 0 && by >= hoop.rimY - 8 && by <= hoop.rimY + 26) {
            scoreChecked = true;
            if (bx >= hoop.leftRimX && bx <= hoop.rightRimX) {
                scored = true; score++; updateHUD();
                swayNet(); doFlash('#c0c0c0');
                spawnParticles(hoop.hoopX, hoop.rimY, '#fff', 14);
                spawnParticles(hoop.hoopX, hoop.rimY, '#c0c0c0', 10);
                spawnParticles(hoop.hoopX, hoop.rimY + 40, '#888', 8);
                spawnPop(hoop.hoopX, hoop.rimY - 30, '+1', '#c8c8c8');
                const msgs = ['GOOD', 'NICE', 'SWISH', 'MONEY', 'BUCKETS', 'PURE'];
                showMsg(hadBoardBounce ? 'GLASS!' : msgs[Math.floor(Math.random() * msgs.length)], 900);
            }
        }
        
        if (by > AH + 80 || bx < -80 || bx > AW + 80 || by < -160) {
            clearC();
            if (flyBall) flyBall.style.display = 'none';
            inFlight = false;
            if (!scored) showMsg('MISS', 800);
            
            if (ballsLeft <= 0) {
                setTimeout(endGame, 500);
            } else {
                setTimeout(() => {
                    newHoop();
                    if (curBall) {
                        curBall.classList.remove('ball-load-anim');
                        void curBall.offsetWidth;
                        curBall.classList.add('ball-load-anim');
                        curBall.style.opacity = '1';
                    }
                    canShoot = true;
                }, 430);
            }
            return;
        }
        activeRafId = requestAnimationFrame(frame);
    }
    activeRafId = requestAnimationFrame(frame);
}

// ── Game Over Endstates ───────────────────────────────────────────
function endGame() {
    gameOver = true; canShoot = false; hideMsg();
    const finalScoreEl = document.getElementById('final-score');
    if (finalScoreEl) finalScoreEl.textContent = `${score} / ${TOTAL}`;
    
    const passed = score >= PASS_SCORE;
    const titleEl = document.getElementById('go-title');
    const quipEl = document.getElementById('final-quip');
    const cta = document.getElementById('go-cta');

    if (passed) {
        if (titleEl) titleEl.textContent = 'NICE SHOOTING!';
        const quips = [
            [6, 7, "Solid reads. Tim Duncan approves."],
            [8, 9, "Elite shooting. You've got real range."],
            [10, 10, "PERFECT. Pure Spurs basketball. 🐐"]
        ];
        const q = quips.find(([lo, hi]) => score >= lo && score <= hi);
        if (quipEl) quipEl.textContent = q ? q[2] : '';
        if (cta) {
            cta.textContent = 'CONTINUE →';
            cta.className = 'go-cta pass';
			cta.removeAttribute('target');
            cta.href = 'javascript:void(0)';
			cta.onclick = (e) => {
                e.preventDefault();
                displayLevelUp();
            };
        }
    } else {
        if (titleEl) titleEl.textContent = 'FINAL BUZZER';
        const quips = [
            [0, 2, "Brick city. Wemby is not pleased."],
            [3, 5, "Not bad, but you need 6 to pass."]
        ];
        const q = quips.find(([lo, hi]) => score >= lo && score <= hi);
        if (quipEl) quipEl.textContent = q ? q[2] : 'Keep working those angles.';
        if (cta) {
            cta.textContent = '↺ PLEASE TRY AGAIN';
            cta.className = 'go-cta fail';
            cta.href = '#';
            cta.target = '_self';
            cta.onclick = (e) => {
                e.preventDefault();
                resetGame();
            };
        }
    }
    if (gameoverEl) gameoverEl.style.display = 'flex';
}

function resetGame() {
    score = 0; ballsLeft = TOTAL; gameOver = false; canShoot = true; inFlight = false; dragging = false;
    if (flyBall) flyBall.style.display = 'none';
    if (curBall) {
        curBall.classList.remove('ball-load-anim');
        void curBall.offsetWidth;
        curBall.classList.add('ball-load-anim');
        curBall.style.opacity = '1';
    }
    if (gameoverEl) gameoverEl.style.display = 'none';
    clearC();
    if (powerWrap) powerWrap.style.display = 'none';
    hideMsg();
    newHoop();
    updateHUD();
}

// ── Touch and Cursor Event Integrations ───────────────────────────
function aPos(e) {
    if (!arena) return { x: SX, y: SY };
    const r = arena.getBoundingClientRect();
    const sx = AW / r.width;
    const sy = AH / r.height;
    const s = e.touches ? e.touches[0] : e;
    return {
        x: (s.clientX - r.left) * sx,
        y: (s.clientY - r.top) * sy
    };
}

function onDown(e) {
    if (!canShoot || inFlight || gameOver) return;
    const p = aPos(e);
    if (Math.hypot(p.x - SX, p.y - SY) > 58) return;
    e.preventDefault();
    dragging = true; dSX = p.x; dSY = p.y; dCX = p.x; dCY = p.y;
}

function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const p = aPos(e);
    dCX = p.x; dCY = p.y;
    drawArrow();
}

function onUp(e) {
    if (!dragging) return;
    dragging = false;
    e.preventDefault();
    clearC();
    if (powerWrap) powerWrap.style.display = 'none';
    shoot(dCX - dSX, dCY - dSY);
}

function bindInputEvents() {
    if (!arena) return;
    arena.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    arena.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp, { passive: false });
    
    rstBtn = document.getElementById('reset-btn');
    if (rstBtn) rstBtn.addEventListener('click', handleResetClick);

	skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', handleSkipClick);
    }
}

function handleResetClick() {
    resetGame();
}

function handleSkipClick(e) {
    e.preventDefault();
    displayLevelUp();
}

function displayLevelUp() {
	const gameContainer = document.getElementById('gameContainer');
	const levelUpContainer = document.getElementById('levelUpContainer');
	hideContainer(gameContainer);
	showContainer(levelUpContainer, true);
}

// ── Framework Module Entry Lifecycles ─────────────────────────────
export function initialize(shared) {
    showContainer = shared.showContainer;
    hideContainer = shared.hideContainer;
    showMessage = shared.showMessage;

	const levelUpContainer = document.getElementById('levelUpContainer');
	hideContainer(levelUpContainer);

	const gameContainer = document.getElementById('gameContainer');
	const birthdayLock = document.getElementById('birthdayLock');

	if (!gameContainer || !birthdayLock) return;

	showContainer(gameContainer, false);
    hideContainer(birthdayLock);

    console.log("🏀 Hoop Shots Module initialized smoothly.");
    
    cacheElements();
    bindInputEvents();
    resetGame();
}

// ── Framework Module Exit Lifecycles ──────────────────────────────
export function destroy() {
    // 1. Kill any active animation rendering frames
    if (activeRafId) {
        cancelAnimationFrame(activeRafId);
    }
    
    // 2. Unbind arena tracking layouts
    if (arena) {
        arena.removeEventListener('mousedown', onDown);
        arena.removeEventListener('touchstart', onDown);
    }
    
    // 3. Unbind root document inputs (CRITICAL: prevents layout drag ghosting)
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    
    // 4. Unbind button UI configurations
    if (rstBtn) rstBtn.removeEventListener('click', handleResetClick);
    if (skipBtn) skipBtn.removeEventListener('click', handleSkipClick);
    
    // 5. Clear execution timers
    clearTimeout(msgT);
    
    console.log("🏀 Hoop Shots Module destroyed cleanly.");
}