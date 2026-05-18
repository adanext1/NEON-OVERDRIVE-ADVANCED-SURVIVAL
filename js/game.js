function createExplosion(x, y, color, count = 10, spd = 1) {
    for (let i = 0; i < count; i++) {
        let a = Math.random() * Math.PI * 2; let s = (Math.random() * 4 + 2) * spd;
        particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, radius: Math.random() * 3 + 1, color: color, alpha: 1, decay: Math.random() * 0.02 + 0.015 });
    }
}

function spawnDamageText(x, y, amount, type = 'normal') {
    let textColor = '#ffffff'; let isCritSize = false;
    let decay = 0.015; let vx = (Math.random() - 0.5) * 2; let vy = -2 - Math.random() * 2;
    if (type === 'crit') { textColor = '#ffff00'; isCritSize = true; decay = 0.008; vx *= 1.5; vy *= 1.5; }
    else if (type === 'hazard') { textColor = '#ff0055'; }
    else if (type === 'shield') { textColor = '#00aaff'; }
    damageTexts.push({ x: x, y: y - 10, text: Math.floor(amount), isCrit: isCritSize, color: textColor, alpha: 1, vx: vx, vy: vy, decay: decay });
}

function takeDamage(pObj, amount) {
    if (amount <= 0) return;
    pObj.flashTicks = 6; pObj.damageFlashAlpha = 0.5;
    
    // Animación en el HUD
    let hudId = pObj.id === 1 ? 'hud-box' : 'hud-box-p2';
    let hudElem = document.getElementById(hudId);
    if (hudElem) {
        hudElem.classList.remove('hud-damage');
        void hudElem.offsetWidth; // Trigger reflow
        hudElem.classList.add('hud-damage');
    }

    if (pObj.shield > 0) {
        let absorbed = Math.min(pObj.shield, amount); pObj.shield -= absorbed; amount -= absorbed;
        spawnDamageText(pObj.x, pObj.y, absorbed, 'shield'); createExplosion(pObj.x, pObj.y, '#00aaff', 8, 1.2);
    }
    if (amount > 0) {
        pObj.hp -= amount; spawnDamageText(pObj.x, pObj.y, amount, 'hazard'); createExplosion(pObj.x, pObj.y, '#ff0055', 12, 1.5);
        if (pObj.hp <= 0) {
            let allDead = players.every(p => p.hp <= 0);
            if (allDead && !isGameOver) {
                isGameOver = true;
                document.getElementById('game-over-stats').innerText = `Oleada alcanzada: ${wave}`;
                document.getElementById('game-over-modal').style.display = 'block';
                updateMenuSelection('game-over-modal');
                isPaused = true;
            }
        }
    }
    updateUI();
}

function startGameSimulation() {
    gameStarted = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud-box').style.display = 'block';
    
    players.forEach(p => {
        p.maxHp = 100 + (userSave.artifacts.shipHp * 15);
        p.hp = p.maxHp;
        p.damageModifier = 1.0 + (userSave.artifacts.shipDmg * 0.05);
        p.maxShield = 40 + (userSave.artifacts.shieldGen * 10);
        if (userSave.artifacts.shieldGen > 0) { p.shield = p.maxShield; }
    });

    startWave();
    
    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('start-game', {});
    }
}

function resetGame() {
    isGameOver = false;
    isPaused = false;
    wave = 1;
    enemies = [];
    bullets = [];
    drops = [];
    hazards = [];
    airDrops = [];
    dynamicEvents = [];
    helperDrones = [];
    xpMultiplier = 1;
    
    players.forEach(p => {
        p.credits = 0;
        p.level = 1;
        p.xp = 0;
        p.nextXp = 100;
        p.weapons = ['blaster'];
        p.currentWeaponIndex = 0;
    });
    
    document.getElementById('game-over-modal').style.display = 'none';
    startGameSimulation();
}

function processGamepadInput() {
    const gamepads = navigator.getGamepads();
    let gp1 = gamepads[0];
    let gp2 = gamepads[1];

    if (!lastGamepadButtons[0]) lastGamepadButtons[0] = [];
    if (!lastGamepadButtons[1]) lastGamepadButtons[1] = [];

    // Activar co-op si el Mando 1 presiona START (botón 9) y no estamos en co-op ni en online
    if (gp1 && gp1.buttons[9]?.pressed && !lastGamepadButtons[0][9] && !isCoop && !isOnline) {
        isCoop = true;
        let p2 = {
            id: 2,
            inputSource: 'gamepad',
            x: players[0].x + 50, y: players[0].y, radius: 15, speed: 4.2,
            hp: 100, maxHp: 100, shield: 0, maxShield: 40, xp: 0, nextXp: 100, level: 1, credits: 0, angle: 0,
            damageModifier: 1.0, weapons: ['basic'], currentWeaponIndex: 0,
            dashCooldown: 0, dashTimer: 0, dashVx: 0, dashVy: 0, pulseCooldown: 0,
            aimMode: 'AUTO', overdriveTimer: 0,
            flashTicks: 0, damageFlashAlpha: 0,
            weaponUpgrades: { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } }
        };
        // Aplicar mejoras permanentes J2
        p2.maxHp = 100 + (userSave.artifacts.shipHp * 15);
        p2.hp = p2.maxHp;
        p2.damageModifier = 1.0 + (userSave.artifacts.shipDmg * 0.05);
        p2.maxShield = 40 + (userSave.artifacts.shieldGen * 10);
        if (userSave.artifacts.shieldGen > 0) { p2.shield = p2.maxShield; }
        
        players.push(p2);
        updateUI();
    }

    let inMenu = !gameStarted || isShopActive || inCollectionMenu || isGameOver || (document.getElementById('level-up-modal')?.style.display === 'block');

    function handlePlayerGamepad(gp, pObj, gpIdx) {
        let stickX = gp.axes[0] || 0; let stickY = gp.axes[1] || 0; let deadzone = 0.18;
        let moveX = 0; let moveY = 0;
        if (Math.abs(stickX) > deadzone) moveX = stickX;
        if (Math.abs(stickY) > deadzone) moveY = stickY;

        if (gp.buttons[12]?.pressed) moveY = -1;
        if (gp.buttons[13]?.pressed) moveY = 1;
        if (gp.buttons[14]?.pressed) moveX = -1;
        if (gp.buttons[15]?.pressed) moveX = 1;

        if (moveX !== 0 || moveY !== 0) {
            let magnitude = Math.hypot(moveX, moveY);
            if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
            if (pObj.dashTimer <= 0) { pObj.x += moveX * pObj.speed; pObj.y += moveY * pObj.speed; }
        }

        if (pObj.aimMode === 'MANUAL') {
            let aimX = gp.axes[2] || 0; let aimY = gp.axes[3] || 0;
            if (Math.hypot(aimX, aimY) > 0.25) { pObj.angle = Math.atan2(aimY, aimX); }
        }

        if (gp.buttons[8]?.pressed && !lastGamepadButtons[gpIdx][8]) { pObj.aimMode = pObj.aimMode === 'AUTO' ? 'MANUAL' : 'AUTO'; updateUI(); }
        
        // Disparar
        if (gp.buttons[7]?.pressed || gp.buttons[0]?.pressed) { 
            pObj.isShooting = true; 
        } else { 
            pObj.isShooting = false; 
        }

        // Dash
        if ((gp.buttons[4]?.pressed && !lastGamepadButtons[gpIdx][4]) || (gp.buttons[2]?.pressed && !lastGamepadButtons[gpIdx][2])) {
            if (pObj.dashCooldown === 0 && pObj.dashTimer === 0 && (moveX !== 0 || moveY !== 0)) {
                let len = Math.hypot(moveX, moveY);
                pObj.dashVx = (moveX / len) * 14; pObj.dashVy = (moveY / len) * 14;
                let dashCD = Math.max(30, 90 - (userSave.artifacts.hyperdrive * 5));
                pObj.dashTimer = 10; pObj.dashCooldown = dashCD; screenShake = 5;
            }
        }

        // Cambiar arma
        if (gp.buttons[6]?.pressed && !lastGamepadButtons[gpIdx][6]) { pObj.currentWeaponIndex = (pObj.currentWeaponIndex + 1) % pObj.weapons.length; updateUI(); }
        
        gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
    }

    function handleMenuGamepad(gp, gpIdx) {
        let moved = false;
        let activeModal = null;
        if (!gameStarted) activeModal = document.getElementById('main-menu');
        else if (isShopActive) activeModal = document.getElementById('shop-modal');
        else if (inCollectionMenu) activeModal = document.getElementById('collection-modal');
        else if (isGameOver) activeModal = document.getElementById('game-over-modal');
        else if (document.getElementById('level-up-modal')?.style.display === 'block') activeModal = document.getElementById('level-up-modal');

        if (activeModal) {
            let buttons = [];
            if (isShopActive) {
                let colId = gpIdx === 0 ? '#shop-p1-col' : '#shop-p2-col';
                buttons = Array.from(activeModal.querySelectorAll(`${colId} .shop-btn`));
                let backBtn = activeModal.querySelector('button[onclick="toggleShop(false)"]');
                if (backBtn) buttons.push(backBtn);
            } else {
                buttons = Array.from(activeModal.querySelectorAll('.shop-btn, .level-up-card'));
            }

            if (buttons.length === 0) return;

            if ((gp.buttons[12]?.pressed && !lastGamepadButtons[gpIdx][12]) || (gp.buttons[14]?.pressed && !lastGamepadButtons[gpIdx][14])) {
                selectedMenuItem[gpIdx]--; moved = true;
            }
            if ((gp.buttons[13]?.pressed && !lastGamepadButtons[gpIdx][13]) || (gp.buttons[15]?.pressed && !lastGamepadButtons[gpIdx][15])) {
                selectedMenuItem[gpIdx]++; moved = true;
            }

            if (moved) {
                if (selectedMenuItem[gpIdx] < 0) selectedMenuItem[gpIdx] = buttons.length - 1;
                if (selectedMenuItem[gpIdx] >= buttons.length) selectedMenuItem[gpIdx] = 0;

                if (isShopActive) {
                    buttons.forEach((btn, idx) => {
                        if (idx === selectedMenuItem[gpIdx]) btn.classList.add('selected');
                        else btn.classList.remove('selected');
                    });
                } else {
                    const allBtns = activeModal.querySelectorAll('.shop-btn, .level-up-card');
                    allBtns.forEach(btn => btn.classList.remove('selected'));
                    buttons[selectedMenuItem[gpIdx]]?.classList.add('selected');
                }
            }

            if (gp.buttons[0]?.pressed && !lastGamepadButtons[gpIdx][0]) {
                buttons[selectedMenuItem[gpIdx]]?.click();
            }
        }
        gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
    }

    // Procesar pausa
    let gpPausa = gp1 || gp2;
    if (gpPausa && gpPausa.buttons[9]?.pressed && !lastGamepadButtons[gpPausa === gp1 ? 0 : 1][9]) {
        if (!isShopActive && !inCollectionMenu && !isGameOver && gameStarted) {
            isPaused = !isPaused;
            document.getElementById('pause-display').style.display = isPaused ? 'block' : 'none';
        }
    }

    // Procesar entrada de juego
    if (!inMenu) {
        // Asignación de mandos según preferencia del usuario
        if (gp1 && gp2) {
            players[0].inputSource = 'gamepad';
            players[0].gamepadIndex = 0;
            if (players[1]) {
                players[1].inputSource = 'gamepad';
                players[1].gamepadIndex = 1;
            }
        } else if (gp1 && !gp2) {
            if (isCoop) {
                players[0].inputSource = 'keyboard';
                if (players[1]) {
                    players[1].inputSource = 'gamepad';
                    players[1].gamepadIndex = 0;
                }
            } else {
                players[0].inputSource = 'gamepad';
                players[0].gamepadIndex = 0;
            }
        } else {
            players[0].inputSource = 'keyboard';
        }

        // Ejecutar control para cada jugador
        players.forEach(p => {
            if (p.inputSource === 'gamepad') {
                let gp = gamepads[p.gamepadIndex];
                if (gp) handlePlayerGamepad(gp, p, p.gamepadIndex);
            }
        });
    }

    if (inMenu) {
        if (gp1) handleMenuGamepad(gp1, 0);
        if (gp2) handleMenuGamepad(gp2, 1);
    }
}

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase(); keys[k] = true;
    if (!gameStarted) return;
    if (k === 'p') { if (!isShopActive && !inCollectionMenu) { isPaused = !isPaused; document.getElementById('pause-display').style.display = isPaused ? 'block' : 'none'; } }
    if (isPaused) return;
    if (k === 'm') { players[0].aimMode = players[0].aimMode === 'AUTO' ? 'MANUAL' : 'AUTO'; updateUI(); }
    if (e.key === 'Shift') triggerDash(); if (k === 'e') triggerPulse();
    if (e.key === ' ' || e.key === 'Spacebar') { if (!waveActive && enemies.length === 0 && !inCollectionMenu) toggleShop(!isShopActive); }
    if (k === 'c') { if (!waveActive && enemies.length === 0) { if (isShopActive) toggleShop(false); toggleCollection(!inCollectionMenu); } }
    if (e.key >= '1' && e.key <= '3') { let idx = parseInt(e.key) - 1; if (players[0].weapons[idx]) players[0].currentWeaponIndex = idx; updateUI(); }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => { if (e.button === 0 && gameStarted && !isPaused) mouse.isDown = true; });
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.isDown = false; });

function triggerDashKeyboard() {
    let moveX = 0; let moveY = 0;
    if (keys['w'] || keys['arrowup']) moveY = -1; if (keys['s'] || keys['arrowdown']) moveY = 1;
    if (keys['a'] || keys['arrowleft']) moveX = -1; if (keys['d'] || keys['arrowright']) moveX = 1;

    if (moveX === 0 && moveY === 0) return;
    let len = Math.hypot(moveX, moveY);
    players[0].dashVx = (moveX / len) * 14; players[0].dashVy = (moveY / len) * 14;
    let dashCD = Math.max(30, 90 - (userSave.artifacts.hyperdrive * 5));
    players[0].dashTimer = 10; players[0].dashCooldown = dashCD; screenShake = 5;
}

function triggerDash() { if (players[0].dashCooldown > 0 || players[0].dashTimer > 0) return; triggerDashKeyboard(); }

function triggerPulse() {
    if (players[0].pulseCooldown > 0) return;
    players[0].pulseCooldown = 300; createExplosion(players[0].x, players[0].y, '#ff007f', 40, 2); screenShake = 15;

    enemies.forEach(e => {
        let dx = e.x - players[0].x; let dy = e.y - players[0].y; let dist = Math.hypot(dx, dy);
        if (dist < 260) {
            let force = (260 - dist) / 1.2; let angle = Math.atan2(dy, dx);
            if (dist > 0) { e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force; }
            e.hp -= 35; e.flashTicks = 5; spawnDamageText(e.x, e.y, 35, 'normal');
        }
    });
}

function spawnEnemy() {
    let x = Math.random() < 0.5 ? -40 : canvas.width + 40; let y = Math.random() * canvas.height;
    if (Math.random() < 0.5) { x = Math.random() * canvas.width; y = Math.random() < 0.5 ? -40 : canvas.height + 40; }
    let isBoss = (wave % 5 === 0) && enemiesToSpawn === 1; let typeChance = Math.random();
    let enemy = { 
        id: Date.now() + Math.random(), 
        x: x, y: y, angle: 0, flashTicks: 0, vx: 0, vy: 0, isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0 
    };

    if (isBoss) {
        enemy.radius = 45; enemy.speed = 1.0; enemy.hp = 500 + (wave * 200); enemy.maxHp = enemy.hp;
        enemy.color = '#ff0044'; enemy.credits = 150; enemy.xp = 200; enemy.isBoss = true; enemy.shootCooldown = 0; enemy.bossInvulnTimer = 90; enemy.dropType = 'crystal';
    } else if (Math.random() < 0.06 && wave >= 2) {
        enemy.radius = 15; enemy.speed = 4.5; enemy.hp = 140; enemy.maxHp = 140;
        enemy.color = '#ffcc00'; enemy.credits = 80; enemy.xp = 60; enemy.isEliteGold = true; enemy.dropType = Math.random() > 0.5 ? 'crystal' : 'plate'; enemy.changeDirTimer = 0;
    } else if (typeChance > 0.85 && wave >= 8) {
        enemy.radius = 25; enemy.speed = 1.8; enemy.hp = 150 + (wave * 15); enemy.maxHp = enemy.hp;
        enemy.color = '#00ff55'; enemy.credits = 20; enemy.xp = 40; enemy.isSplitter = true; enemy.dropType = 'plate';
    } else if (typeChance > 0.70 && typeChance <= 0.85 && wave >= 5) {
        enemy.radius = 16; enemy.speed = 1.5; enemy.hp = 80 + (wave * 12); enemy.maxHp = enemy.hp;
        enemy.color = '#ffaa00'; enemy.credits = 15; enemy.xp = 35; enemy.isRanged = true; enemy.shootCooldown = 60; enemy.dropType = 'crystal';
    } else if (typeChance > 0.50 && typeChance <= 0.70 && wave >= 4) {
        enemy.radius = 20; enemy.speed = 2.0; enemy.hp = 60 + (wave * 10); enemy.maxHp = enemy.hp;
        enemy.color = '#0088ff'; enemy.credits = 14; enemy.xp = 30; enemy.isShielded = true; enemy.dropType = 'plate';
    } else if (typeChance > 0.25 && typeChance <= 0.50 && wave >= 2) {
        enemy.radius = 14; enemy.speed = 2.8; enemy.hp = 35 + (wave * 8); enemy.maxHp = enemy.hp;
        enemy.color = '#ff5500'; enemy.credits = 12; enemy.xp = 22; enemy.isKamikaze = true; enemy.dropType = 'core'; enemy.kamiState = 'CHASING'; enemy.stateTimer = 0;
    } else if (typeChance < 0.12 && wave >= 2) {
        enemy.radius = 12; enemy.speed = 5.5; enemy.hp = 30 + (wave * 5); enemy.maxHp = enemy.hp;
        enemy.color = '#00ffff'; enemy.credits = 10; enemy.xp = 20; enemy.dropType = 'core';
    } else {
        enemy.radius = 17; enemy.speed = 2.4 + (wave * 0.15); enemy.hp = 50 + (wave * 10); enemy.maxHp = enemy.hp;
        enemy.color = '#9900ff'; enemy.credits = 7; enemy.xp = 12; enemy.dropType = Math.random() > 0.5 ? 'core' : 'plate';
    }
    enemies.push(enemy);
    
    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('spawn-enemy', enemy);
    }
}

function triggerHazard() {
    hazards.push({ x: Math.random() * (canvas.width - 200) + 100, y: Math.random() * (canvas.height - 200) + 100, radius: Math.random() * 60 + 50, timer: 120, maxTimer: 120, duration: 300, active: false, shockwaveRadius: 0 });
}

// =============================================
// FUNCIÓN DE SPAWN DE EVENTOS DINÁMICOS
// =============================================
function spawnDynamicEvent(type) {
    let cx = Math.random() * (canvas.width - 300) + 150;
    let cy = Math.random() * (canvas.height - 300) + 150;
    let ev = { type, active: true };

    if (type === 'extractor') {
        ev = { type, x: cx, y: cy, radius: 80, progress: 0, active: true };
    } else if (type === 'overload') {
        ev = { type, x: cx, y: cy, radius: 35, hp: 400, maxHp: 400, timer: 300, maxTimer: 300, active: true };
    } else if (type === 'portal') {
        let bx = Math.random() * (canvas.width - 300) + 150;
        let by = Math.random() * (canvas.height - 300) + 150;
        ev = { type, ax: cx, ay: cy, bx, by, portalRadius: 30, crossings: 0, cooldown: 0, active: true };
    } else if (type === 'lockdown') {
        let sw = 180, sh = 150;
        let sx = Math.random() * (canvas.width - sw - 40) + 20;
        let sy = Math.random() * (canvas.height - sh - 40) + 20;
        ev = { type, sw, sh, sx, sy, tx: sx, ty: sy, timer: 360, maxTimer: 360, moveTimer: 0, active: true };
    } else if (type === 'anomaly') {
        ev = { type, x: cx, y: cy, radius: 14, speed: 3.8, hp: 240, maxHp: 240, segmentsDropped: 0, dashTimer: 0, active: true };
    }

    dynamicEvents.push(ev);
    showNetworkMessage(`⚡ EVENTO: ${getEventName(type)}`, 3000);

    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('spawn-dynamic-event', ev);
    }
}

function getEventName(type) {
    return { extractor: 'EXTRACTOR DE PLASMA', overload: 'SOBRECARGA DEL NÚcleo', portal: 'PORTALES DE DATOS INESTABLES', lockdown: 'BLOQUEO DE RED', anomaly: 'CACERIA DE LA ANOMALIA' }[type] || type;
}

function startWave() {
    waveActive = true; enemiesToSpawn = 6 + (wave * 4); if (wave % 5 === 0) enemiesToSpawn = 8 + wave;
    if (userSave.artifacts.shieldGen > 0) { 
        players.forEach(p => p.shield = p.maxShield);
        updateUI(); 
    }
    if (Math.random() < 0.15) {
        setTimeout(() => { if (waveActive) airDrops.push({ x: Math.random() * (canvas.width - 100) + 50, y: Math.random() * (canvas.height - 100) + 50, radius: 10 }); }, 3500);
    }
    let ab = document.getElementById('wave-alert');
    ab.innerHTML = `OLEADA ${wave}<br><span style='font-size:18px; color:#fff;'>SISTEMAS INVASORES DETECTADOS</span>`;
    ab.style.opacity = 1; setTimeout(() => ab.style.opacity = 0, 2200);

    // Reiniciar XP multiplier al empezar oleada
    xpMultiplier = 1;
    // Spawn de evento dinámico aleatorio (solo Host o solo, a partir de oleada 2)
    if (wave >= 2 && (!isOnline || isHost)) {
        setTimeout(() => {
            if (!waveActive) return;
            let eventTypes = ['extractor', 'overload', 'portal', 'lockdown', 'anomaly'];
            // Filtrar anomalia para oleadas bajas
            if (wave < 3) eventTypes = eventTypes.filter(t => t !== 'anomaly');
            let chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            spawnDynamicEvent(chosen);
        }, 8000 + Math.random() * 4000);
    }
}

function fireWeapon(pObj) {
    if (!pObj) pObj = players[0];
    let now = Date.now(); 
    let wep = WEAPONS[pObj.weapons[pObj.currentWeaponIndex]];
    
    let mods = pObj.weaponUpgrades[pObj.weapons[pObj.currentWeaponIndex]] || { damage: 0, fireRate: 0 };
    let baseRate = wep.fireRate - mods.fireRate;
    if (baseRate < 60) baseRate = 60;
    let currentFireRate = pObj.overdriveTimer > 0 ? baseRate / 2 : baseRate;
    if (currentFireRate < 30) currentFireRate = 30;
    let bulletColor = pObj.overdriveTimer > 0 ? '#ffff00' : wep.color;

    if (!pObj.lastShot) pObj.lastShot = 0;
    if (now - pObj.lastShot < currentFireRate || pObj.dashTimer > 0) return;
    pObj.lastShot = now; 
    let targetAngle = pObj.angle;

    if (pObj.aimMode === 'AUTO' && enemies.length > 0) {
        let closest = enemies[0]; let minDist = Infinity;
        enemies.forEach(e => { let d = Math.hypot(e.x - pObj.x, e.y - pObj.y); if (d < minDist) { minDist = d; closest = e; } });
        targetAngle = Math.atan2(closest.y - pObj.y, closest.x - pObj.x);
    } else if (pObj === players[0] && navigator.getGamepads()[0] === null) {
        targetAngle = Math.atan2(mouse.y - pObj.y, mouse.x - pObj.x);
    }
    
    pObj.angle = targetAngle; 
    screenShake = wep.type === 'plasma' ? 10 : 3;

    let baseDmg = wep.damage + mods.damage;
    let finalDmg = baseDmg * pObj.damageModifier;

    if (wep.type === 'single' || wep.type === 'plasma') {
        let baseAoERadius = wep.radius || 0;
        let finalAoERadius = (baseAoERadius > 0 && userSave.artifacts.singularity > 0)
            ? baseAoERadius * (1 + userSave.artifacts.singularity * 0.1)
            : baseAoERadius;
        bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(targetAngle) * wep.speed, vy: Math.sin(targetAngle) * wep.speed, radius: wep.type === 'plasma' ? 9 : 5, color: bulletColor, damage: finalDmg, type: wep.type, radiusAoE: finalAoERadius });
    } else if (wep.type === 'spread') {
        let count = wep.count + (mods.count || 0);
        for (let i = 0; i < count; i++) {
            let sa = targetAngle + (Math.random() - 0.5) * wep.spread;
            bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(sa) * (wep.speed * (Math.random() * 0.25 + 0.88)), vy: Math.sin(sa) * (wep.speed * (Math.random() * 0.25 + 0.88)), radius: 4, color: bulletColor, damage: finalDmg, type: 'single' });
        }
    }

    // Emitir evento si estamos online y somos el jugador local
    if (typeof isOnline !== 'undefined' && isOnline && pObj.id === 1) {
        sendGameEvent('shoot', {
            x: pObj.x, y: pObj.y,
            angle: targetAngle,
            weaponType: wep.type,
            bulletColor: bulletColor,
            damage: finalDmg,
            speed: wep.speed
        });
    }
}

function spawnRemoteBullet(data) {
    if (data.weaponType === 'single' || data.weaponType === 'plasma') {
        bullets.push({ 
            x: data.x, y: data.y, 
            vx: Math.cos(data.angle) * data.speed, 
            vy: Math.sin(data.angle) * data.speed, 
            radius: data.weaponType === 'plasma' ? 9 : 5, 
            color: data.bulletColor, 
            damage: data.damage, 
            type: data.weaponType, 
            radiusAoE: 0 
        });
    } else if (data.weaponType === 'spread') {
        // Simplificado: disparamos una sola bala en la dirección
        bullets.push({ 
            x: data.x, y: data.y, 
            vx: Math.cos(data.angle) * data.speed, 
            vy: Math.sin(data.angle) * data.speed, 
            radius: 4, 
            color: data.bulletColor, 
            damage: data.damage, 
            type: 'single' 
        });
    }
}

function updateRemoteEnemies(enemyData) {
    enemyData.forEach(remoteEnemy => {
        let localEnemy = enemies.find(e => e.id === remoteEnemy.id);
        if (localEnemy) {
            localEnemy.x = remoteEnemy.x;
            localEnemy.y = remoteEnemy.y;
            localEnemy.hp = remoteEnemy.hp;
        }
    });
}

function update() {
    processGamepadInput();

    if (!gameStarted || isPaused) return;

    // Cooldowns
    players.forEach(p => {
        if (p.dashCooldown > 0) p.dashCooldown--; 
        if (p.pulseCooldown > 0) p.pulseCooldown--;
        if (p.overdriveTimer > 0) p.overdriveTimer--;
        if (p.flashTicks > 0) p.flashTicks--;
        if (p.damageFlashAlpha > 0) p.damageFlashAlpha -= 0.02;
    });

    let maxDashCD = Math.max(30, 90 - (userSave.artifacts.hyperdrive * 5));
    document.getElementById('dash-cd').style.width = `${(1 - players[0].dashCooldown / maxDashCD) * 100}%`;
    document.getElementById('pulse-cd').style.width = `${(1 - players[0].pulseCooldown / 300) * 100}%`;

    // Movimiento
    players.forEach(p => {
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== 1) return; 
        if (p.inputSource === 'keyboard') {
            if (p.dashTimer > 0) {
                p.x += p.dashVx; p.y += p.dashVy; p.dashTimer--;
                createExplosion(p.x, p.y, p.id === 1 ? '#00ffff' : '#ff007f', 2, 0.2);
            } else {
                let mx = 0; let my = 0;
                if (keys['w'] || keys['arrowup']) my = -1; if (keys['s'] || keys['arrowdown']) my = 1;
                if (keys['a'] || keys['arrowleft']) mx = -1; if (keys['d'] || keys['arrowright']) mx = 1;
                if (mx !== 0 || my !== 0) { let l = Math.hypot(mx, my); p.x += (mx / l) * p.speed; p.y += (my / l) * p.speed; }
            }
        } else if (p.inputSource === 'gamepad') {
            if (p.dashTimer > 0) {
                p.x += p.dashVx; p.y += p.dashVy; p.dashTimer--;
                createExplosion(p.x, p.y, p.id === 1 ? '#00ffff' : '#ff007f', 2, 0.2);
            }
        }

        p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
        p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

        if (p.aimMode === 'MANUAL' && p.inputSource === 'keyboard') {
            p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
        }
    });

    // Disparar
    players.forEach(p => {
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== 1) return; 
        if (p.id === 1 && p.inputSource === 'keyboard' && mouse.isDown) fireWeapon(p);
        else if (p.isShooting) fireWeapon(p);
    });

    // Air Drops
    for (let i = airDrops.length - 1; i >= 0; i--) {
        let ad = airDrops[i];
        let hit = false;
        
        for (let p of players) {
            if (Math.hypot(p.x - ad.x, p.y - ad.y) < p.radius + ad.radius) {
                p.overdriveTimer = 420; 
                createExplosion(ad.x, ad.y, '#ffff00', 30, 1.2); 
                airDrops.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
    }

    hazardTimer++; if (waveActive && hazardTimer > 200) { triggerHazard(); hazardTimer = 0; }
    for (let i = hazards.length - 1; i >= 0; i--) {
        let h = hazards[i];
        if (!h.active) {
            h.timer--; if (h.timer <= 0) { h.active = true; h.shockwaveRadius = 10; screenShake = 12; createExplosion(h.x, h.y, '#ff0055', 20, 1.5); }
        } else {
            h.duration--;
            if (Math.random() < 0.4) {
                let angle = Math.random() * Math.PI * 2; let dist = Math.random() * h.radius;
                particles.push({ x: h.x + Math.cos(angle) * dist, y: h.y + Math.sin(angle) * dist, vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random() * 1.5, radius: Math.random() * 4 + 2, color: Math.random() > 0.4 ? '#ff0055' : '#ff00aa', alpha: 0.9, decay: 0.02 });
            }
            if (h.shockwaveRadius > 0 && h.shockwaveRadius < h.radius * 1.3) h.shockwaveRadius += 8;

            for (let p of players) {
                if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius && p.dashTimer === 0) { 
                    takeDamage(p, 0.6); 
                    screenShake = 2; 
                }
            }

            enemies.forEach(e => {
                let distToHazard = Math.hypot(e.x - h.x, e.y - h.y);
                if (distToHazard < h.radius) {
                    let dmgValue = e.isBoss ? 0.8 : (e.isEliteGold ? 0.4 : 0.55); e.hp -= dmgValue; e.flashTicks = 2;
                    if (!e.hazardHitTimer) e.hazardHitTimer = 0; e.hazardHitTimer++;
                    if (e.hazardHitTimer >= 12) { spawnDamageText(e.x, e.y, dmgValue * 12, 'hazard'); e.hazardHitTimer = 0; }
                }
            });
            if (h.duration <= 0) hazards.splice(i, 1);
        }
    }

    if (waveActive) {
        spawnTimer += 16.6;
        if (typeof isOnline !== 'undefined' && isOnline && !isHost) {
            // El cliente no genera enemigos por tiempo, solo los recibe del host
        } else {
            if (spawnTimer >= 900 && enemiesToSpawn > 0) { spawnEnemy(); enemiesToSpawn--; spawnTimer = 0; }
        }
        if (enemiesToSpawn === 0 && enemies.length === 0) {
            waveActive = false; wave++; 
            players.forEach(p => p.credits += 60);
            updateUI(); toggleShop(true); hazards = []; airDrops = [];
        }
    } else if (enemies.length === 0 && !isShopActive && !inCollectionMenu) { startWave(); }

    // Balas vs Enemigos
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; if (b.type === 'enemy') continue;
        b.x += b.vx; b.y += b.vy; if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { bullets.splice(i, 1); continue; }

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j]; let dist = Math.hypot(b.x - e.x, b.y - e.y);
            if (dist < b.radius + e.radius) {
                if (e.isBoss && e.bossInvulnTimer > 0) { createExplosion(b.x, b.y, '#ffffff', 5, 0.8); bullets.splice(i, 1); break; }
                if (e.isShielded && b.type !== 'plasma') {
                    let angleToBullet = Math.atan2(b.y - e.y, b.x - e.x); let diff = Math.abs(angleToBullet - e.angle);
                    if (diff < 0.6 || diff > Math.PI * 2 - 0.6) { createExplosion(b.x, b.y, '#0088ff', 3, 0.4); bullets.splice(i, 1); break; }
                }

                if (b.type === 'plasma') {
                    createExplosion(b.x, b.y, '#ffff00', 25, 1.3);
                    for (let k = enemies.length - 1; k >= 0; k--) {
                        let targetEn = enemies[k]; let dAoE = Math.hypot(b.x - targetEn.x, b.y - targetEn.y);
                        if (dAoE <= b.radiusAoE && !(targetEn.isBoss && targetEn.bossInvulnTimer > 0)) {
                            let dmg = b.damage * (1 - dAoE / b.radiusAoE); targetEn.hp -= dmg; targetEn.flashTicks = 4; spawnDamageText(targetEn.x, targetEn.y, dmg, 'normal');
                        }
                    }
                } else {
                    let isCrit = Math.random() < 0.15; let finalDmg = isCrit ? b.damage * 1.8 : b.damage;
                    e.hp -= finalDmg; e.flashTicks = 4; createExplosion(b.x, b.y, b.color, 3, 0.5); spawnDamageText(e.x, e.y, finalDmg, isCrit ? 'crit' : 'normal');
                }
                if (e.isBoss && e.hp <= e.maxHp * 0.5 && e.bossPhase === 0) { e.bossPhase = 1; e.bossInvulnTimer = 150; createExplosion(e.x, e.y, '#ffff00', 40, 2); }
                bullets.splice(i, 1); break;
            }
        }
    }

    // Actualizar IA de Enemigos
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i]; if (e.bossInvulnTimer > 0) e.bossInvulnTimer--;

        if (e.hp <= 0) {
            createExplosion(e.x, e.y, e.color, e.isBoss ? 70 : 12, e.isBoss ? 2 : 1);
            let dropMat = null; let roll = Math.random();
            if (e.isBoss || e.isEliteGold) dropMat = e.dropType; else if (roll < 0.25) dropMat = e.dropType;
            drops.push({ x: e.x, y: e.y, credits: e.credits, xp: e.xp, radius: 4, matType: dropMat });
            
            if (e.isSplitter) {
                for (let k = 0; k < 3; k++) {
                    let a = Math.random() * Math.PI * 2;
                    enemies.push({
                        x: e.x + Math.cos(a) * 15, y: e.y + Math.sin(a) * 15,
                        radius: 11, speed: 3.2, hp: 35, maxHp: 35,
                        color: '#00ff55', credits: 4, xp: 8,
                        angle: a, flashTicks: 0, vx: 0, vy: 0,
                        isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0,
                        dropType: 'core'
                    });
                }
            }
            
            enemies.splice(i, 1); updateUI(); continue;
        }

        let nearestPlayer = players[0];
        let minDist = Infinity;
        players.forEach(p => {
            let d = Math.hypot(p.x - e.x, p.y - e.y);
            if (d < minDist) {
                minDist = d;
                nearestPlayer = p;
            }
        });
        let dx = nearestPlayer.x - e.x;
        let dy = nearestPlayer.y - e.y;
        let dist = minDist;

        let sx = 0; let sy = 0;
        enemies.forEach(o => { if (o === e) return; let d = Math.hypot(o.x - e.x, o.y - e.y); if (d < (e.radius + o.radius) * 1.4) { sx -= (o.x - e.x) * 0.12; sy -= (o.y - e.y) * 0.12; } });

        if (e.isEliteGold) {
            e.changeDirTimer--;
            if (e.changeDirTimer <= 0) {
                let escapeAngle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 1.5;
                e.vx = Math.cos(escapeAngle) * e.speed; e.vy = Math.sin(escapeAngle) * e.speed; e.changeDirTimer = 50 + Math.random() * 40;
            }
            e.x += e.vx; e.y += e.vy; e.angle = Math.atan2(e.vy, e.vx);
            if (e.x < 20 && e.vx < 0) e.vx *= -1;
            if (e.x > canvas.width - 20 && e.vx > 0) e.vx *= -1;
            if (e.y < 20 && e.vy < 0) e.vy *= -1;
            if (e.y > canvas.height - 20 && e.vy > 0) e.vy *= -1;
        }
        else if (e.isKamikaze) {
            if (e.kamiState === 'CHASING') {
                e.angle = Math.atan2(dy, dx);
                let moveX = dist > 0 ? (dx / dist) : 0;
                let moveY = dist > 0 ? (dy / dist) : 0;
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
                if (dist < 280) { e.kamiState = 'CHARGING'; e.stateTimer = 45; }
            } else if (e.kamiState === 'CHARGING') {
                e.stateTimer--; if (e.stateTimer % 6 === 0) e.flashTicks = 3;
                if (e.stateTimer <= 0) {
                    e.kamiState = 'DASHING'; e.stateTimer = 40;
                    let ang = Math.atan2(dy, dx); e.angle = ang; e.vx = Math.cos(ang) * 9.5; e.vy = Math.sin(ang) * 9.5;
                }
            } else if (e.kamiState === 'DASHING') {
                e.x += e.vx; e.y += e.vy; e.stateTimer--; createExplosion(e.x, e.y, '#ff5500', 1, 0.1);
                if (e.stateTimer <= 0 || e.x < 0 || e.x > canvas.width || e.y < 0 || e.y > canvas.height) {
                    e.kamiState = 'CHASING'; e.speed *= 0.9; setTimeout(() => e.speed = 2.8, 1000);
                }
            }
        } else if (e.isRanged) {
            let targetAngle = Math.atan2(dy, dx); e.angle = targetAngle;
            
            if (dist > 320) {
                let moveX = dist > 0 ? (dx / dist) : 0;
                let moveY = dist > 0 ? (dy / dist) : 0;
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
            } else if (dist < 220) {
                let moveX = dist > 0 ? (dx / dist) : 0;
                let moveY = dist > 0 ? (dy / dist) : 0;
                e.x -= moveX * e.speed + sx; e.y -= moveY * e.speed + sy;
            }
            
            e.shootCooldown--;
            if (e.shootCooldown <= 0) {
                e.shootCooldown = 90;
                bullets.push({ x: e.x, y: e.y, vx: Math.cos(targetAngle) * 3.5, vy: Math.sin(targetAngle) * 3.5, radius: 5, color: '#ffaa00', damage: 15, type: 'enemy' });
            }
        } else {
            let targetAngle = Math.atan2(dy, dx);
            if (e.isShielded) {
                let angleDiff = targetAngle - e.angle;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                e.angle += angleDiff * 0.05;
            } else { e.angle = targetAngle; }
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
        }

        if (e.flashTicks > 0) e.flashTicks--;

        if (e.isBoss) {
            e.shootCooldown++; let cdLimit = e.bossInvulnTimer > 0 ? 20 : 40;
            if (e.shootCooldown >= cdLimit) {
                e.shootCooldown = 0; let count = e.bossInvulnTimer > 0 ? 12 : 8; let base = Math.random() * Math.PI;
                for (let p = 0; p < count; p++) {
                    let a = base + (p * (Math.PI * 2 / count));
                    bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, radius: 6, color: '#ff0044', damage: 12, type: 'enemy' });
                }
            }
        }

        if (dist < nearestPlayer.radius + e.radius && nearestPlayer.dashTimer === 0) {
            let dmgMult = (e.isKamikaze && e.kamiState === 'DASHING') ? 1.8 : 1.0;
            let finalDmg = (e.isBoss ? 0.9 : (e.isEliteGold ? 0.1 : 0.35)) * dmgMult;
            takeDamage(nearestPlayer, finalDmg); 
            screenShake = e.kamiState === 'DASHING' ? 8 : 4;
        }
    }

    // Balas enemigas vs Jugadores
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; if (b.type !== 'enemy') continue;
        b.x += b.vx; b.y += b.vy; if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { bullets.splice(i, 1); continue; }
        
        let hit = false;
        for (let p of players) {
            if (Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius && p.dashTimer === 0) {
                takeDamage(p, b.damage); 
                screenShake = 7; 
                createExplosion(p.x, p.y, '#ff0055', 6, 1); 
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
    }

    // Drops por cercanía
    for (let i = drops.length - 1; i >= 0; i--) {
        let d = drops[i]; 
        let nearestP = players[0];
        let dist = Math.hypot(players[0].x - d.x, players[0].y - d.y);
        
        players.forEach(p => {
            let d2 = Math.hypot(p.x - d.x, p.y - d.y);
            if (d2 < dist) {
                nearestP = p;
                dist = d2;
            }
        });

        if (dist < 150 && dist > 0) { d.x += ((nearestP.x - d.x) / dist) * 6.5; d.y += ((nearestP.y - d.y) / dist) * 6.5; }
        if (dist < nearestP.radius + d.radius) {
            nearestP.credits += d.credits; nearestP.xp += Math.round(d.xp * xpMultiplier);
            if (d.matType) { userSave.materials[d.matType]++; saveGame(); }
            if (nearestP.xp >= nearestP.nextXp) {
                nearestP.level++; nearestP.xp -= nearestP.nextXp; nearestP.nextXp = Math.floor(nearestP.nextXp * 1.45);
                createExplosion(nearestP.x, nearestP.y, nearestP.color || '#00ffcc', 35, 1.8);
                showLevelUpMenu(nearestP);
            }
            drops.splice(i, 1); updateUI();
        }
    }

    for (let i = damageTexts.length - 1; i >= 0; i--) { 
        let dt = damageTexts[i]; 
        dt.x += dt.vx; dt.y += dt.vy; dt.vy += 0.05; dt.alpha -= dt.decay; 
        if (dt.alpha <= 0) damageTexts.splice(i, 1); 
    }
    for (let i = particles.length - 1; i >= 0; i--) { let p = particles[i]; p.x += p.vx; p.y += p.vy; p.alpha -= p.decay; if (p.alpha <= 0) particles.splice(i, 1); }
    if (screenShake > 0) screenShake *= 0.9;
    
    if (typeof isOnline !== 'undefined' && isOnline) {
        sendPlayerUpdate();
        if (isHost) {
            let enemyData = enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp }));
            sendGameEvent('enemy-update', enemyData);
        }
    }

    // === ACTUALIZAR EVENTOS DINÁMICOS ===
    for (let ei = dynamicEvents.length - 1; ei >= 0; ei--) {
        let ev = dynamicEvents[ei];
        if (!ev.active) { dynamicEvents.splice(ei, 1); continue; }

        // ---- EXTRACTOR DE PLASMA ----
        if (ev.type === 'extractor') {
            let playersInside = players.filter(p => Math.hypot(p.x - ev.x, p.y - ev.y) < ev.radius);
            let rate = playersInside.length === 2 ? 0.03 : (playersInside.length === 1 ? 0.02 : 0);
            ev.progress = Math.min(100, ev.progress + rate);
            if (ev.progress >= 100) {
                createExplosion(ev.x, ev.y, '#00ffcc', 50, 2);
                screenShake = 10;
                let mat = Math.random() > 0.5 ? 'crystal' : 'plate';
                userSave.materials[mat]++;
                userSave.materials[mat]++; // garantizado 2 materiales
                saveGame();
                showNetworkMessage('✅ EXTRACTOR COMPLETADO — Material raro obtenido!', 3000);
                ev.active = false;
            }
        }

        // ---- SOBRECARGA DEL NÚCLEO ----
        else if (ev.type === 'overload') {
            if (!isOnline || isHost) ev.timer--;
            // Colisión con balas aliadas
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                let b = bullets[bi];
                if (b.type === 'enemy') continue;
                if (Math.hypot(b.x - ev.x, b.y - ev.y) < ev.radius + b.radius) {
                    ev.hp -= b.damage; spawnDamageText(ev.x, ev.y, b.damage);
                    createExplosion(b.x, b.y, '#ffaa00', 3, 0.5);
                    bullets.splice(bi, 1);
                }
            }
            if (ev.hp <= 0) {
                // Éxito
                createExplosion(ev.x, ev.y, '#ffff00', 60, 2.5); screenShake = 12;
                let reward = 100 + Math.floor(Math.random() * 51);
                players.forEach(p => p.credits += Math.floor(reward / players.length));
                showNetworkMessage(`✅ NÚCLEO ESTABILIZADO — +$${reward} créditos!`, 3000);
                updateUI(); ev.active = false;
            } else if (ev.timer <= 0) {
                // Fracaso — onda expansiva
                createExplosion(ev.x, ev.y, '#ff0000', 80, 3); screenShake = 20;
                players.forEach(p => {
                    let dmg = (p.shield > 0 ? p.shield : p.hp) * 0.5;
                    takeDamage(p, dmg);
                });
                showNetworkMessage('❌ NÚCLEO DETONADO — 50% de vida perdida!', 3000);
                ev.active = false;
            }
        }

        // ---- PORTAL DE DATOS ----
        else if (ev.type === 'portal') {
            if (ev.cooldown > 0) ev.cooldown--;
            players.forEach(p => {
                if (ev.cooldown > 0) return;
                let dA = Math.hypot(p.x - ev.ax, p.y - ev.ay);
                let dB = Math.hypot(p.x - ev.bx, p.y - ev.by);
                if (dA < ev.portalRadius) {
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    p.x = ev.bx; p.y = ev.by;
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    ev.crossings++; ev.cooldown = 45;
                } else if (dB < ev.portalRadius) {
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    p.x = ev.ax; p.y = ev.ay;
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    ev.crossings++; ev.cooldown = 45;
                }
            });
            if (ev.crossings >= 3) {
                // Spawn dron aliado
                let owner = players[0];
                helperDrones.push({ x: owner.x, y: owner.y, ownerId: owner.id, shootCooldown: 0, angle: 0 });
                showNetworkMessage('✅ DRON DE DATOS ACTIVO — te ayuda hasta el final de la oleada!', 4000);
                ev.active = false;
            }
        }

        // ---- BLOQUEO DE RED ----
        else if (ev.type === 'lockdown') {
            if (!isOnline || isHost) {
                ev.timer--;
                ev.moveTimer++;
                if (ev.moveTimer >= 90) {
                    ev.tx = Math.random() * (canvas.width - ev.sw - 40) + 20;
                    ev.ty = Math.random() * (canvas.height - ev.sh - 40) + 20;
                    ev.moveTimer = 0;
                }
                ev.sx += (ev.tx - ev.sx) * 0.015;
                ev.sy += (ev.ty - ev.sy) * 0.015;
            }
            // Daño fuera de zona
            players.forEach(p => {
                let inside = p.x > ev.sx && p.x < ev.sx + ev.sw && p.y > ev.sy && p.y < ev.sy + ev.sh;
                if (!inside) takeDamage(p, 0.08);
            });
            if (ev.timer <= 0) {
                // Éxito — eliminar enemigos menores, activar multiplicador
                enemies = enemies.filter(e => e.isBoss || e.type === 'anomaly');
                xpMultiplier = 2;
                showNetworkMessage('✅ RED REINICIADA — Enemigos eliminados! XP x2 esta oleada!', 4000);
                ev.active = false;
            }
        }

        // ---- CACERÍA DE LA ANOMALÍA ----
        else if (ev.type === 'anomaly') {
            if (ev.dashTimer > 0) ev.dashTimer--;
            // IA de evasión: huye del jugador más cercano
            let nearest = players[0]; let minD = Infinity;
            players.forEach(p => { let d = Math.hypot(p.x - ev.x, p.y - ev.y); if (d < minD) { minD = d; nearest = p; } });
            let dx = ev.x - nearest.x; let dy = ev.y - nearest.y; let dist = Math.hypot(dx, dy) || 1;
            if (ev.dashTimer > 0) {
                ev.x += ev.dashVx; ev.y += ev.dashVy;
            } else {
                ev.x += (dx / dist) * ev.speed;
                ev.y += (dy / dist) * ev.speed;
            }
            // Partículas doradas
            if (Math.random() < 0.4) particles.push({ x: ev.x, y: ev.y, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, radius: Math.random()*3+1, color: '#ffcc00', alpha: 1, decay: 0.03 });
            // Mantenerse en pantalla
            ev.x = Math.max(ev.radius, Math.min(canvas.width - ev.radius, ev.x));
            ev.y = Math.max(ev.radius, Math.min(canvas.height - ev.radius, ev.y));

            // Colisión con balas aliadas
            let segment = Math.floor(ev.segmentsDropped);
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                let b = bullets[bi];
                if (b.type === 'enemy') continue;
                if (Math.hypot(b.x - ev.x, b.y - ev.y) < ev.radius + b.radius) {
                    ev.hp -= b.damage; spawnDamageText(ev.x, ev.y, b.damage, 'crit');
                    createExplosion(b.x, b.y, '#ffcc00', 4, 0.8);
                    bullets.splice(bi, 1);
                    // Chequear pérdida de segmento
                    let newSeg = Math.floor(ev.segmentsDropped + (1 - ev.hp / ev.maxHp) * 3);
                    if (newSeg > ev.segmentsDropped && newSeg <= 2) {
                        // Soltar créditos y micro-dash
                        let reward = 80 + Math.floor(Math.random() * 40);
                        players.forEach(p => p.credits += Math.floor(reward / players.length));
                        updateUI();
                        showNetworkMessage(`⚡ ANOMALÍA DAÑADA — +$${reward} créditos!`, 2000);
                        let escapeAngle = Math.atan2(ev.y - nearest.y, ev.x - nearest.x);
                        ev.dashVx = Math.cos(escapeAngle) * 12; ev.dashVy = Math.sin(escapeAngle) * 12; ev.dashTimer = 25;
                        ev.segmentsDropped = newSeg;
                    }
                    break;
                }
            }

            if (ev.hp <= 0) {
                // Muerte total — recompensa garantizada
                createExplosion(ev.x, ev.y, '#ffffff', 70, 2.5); screenShake = 15;
                userSave.materials.crystal++; userSave.materials.core++; saveGame();
                drops.push({ x: ev.x, y: ev.y, credits: 200, xp: 150, radius: 6, matType: 'crystal' });
                showNetworkMessage('✅ ANOMALÍA DESTRUIDA — Cristal y Núcleo garantizados!', 4000);
                ev.active = false;
            }
            // Si sale de pantalla, desaparece
            if (ev.x < -50 || ev.x > canvas.width + 50 || ev.y < -50 || ev.y > canvas.height + 50) ev.active = false;
        }
    }

    // === ACTUALIZAR DRONES ALIADOS ===
    for (let di = helperDrones.length - 1; di >= 0; di--) {
        let drone = helperDrones[di];
        let owner = players.find(p => p.id === drone.ownerId) || players[0];
        // Seguir al jugador
        drone.x += (owner.x + 30 - drone.x) * 0.08;
        drone.y += (owner.y - 20 - drone.y) * 0.08;
        drone.angle += 0.05;
        drone.shootCooldown--;
        if (drone.shootCooldown <= 0 && enemies.length > 0) {
            let target = enemies[0]; let minD = Infinity;
            enemies.forEach(e => { let d = Math.hypot(e.x - drone.x, e.y - drone.y); if (d < minD) { minD = d; target = e; } });
            let a = Math.atan2(target.y - drone.y, target.x - drone.x);
            bullets.push({ x: drone.x, y: drone.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, radius: 4, damage: 15, color: '#00ffcc', type: 'drone' });
            drone.shootCooldown = 45;
        }
    }
    // Limpiar drones al fin de oleada (se limpian en toggleShop -> resetGame)
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    if (screenShake > 0.4 && !isPaused && gameStarted) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);

    if (!gameStarted) {
        // Fondo oscuro
        ctx.fillStyle = '#030308'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Cuadrícula en movimiento
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)'; ctx.lineWidth = 1;
        let offset = (Date.now() / 50) % 60;
        for (let x = offset; x < canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = offset; y < canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
        
        // Estrellas/Partículas de fondo
        if (particles.length < 100) {
            particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, radius: Math.random() * 2, color: Math.random() > 0.5 ? '#00ffcc' : '#ff007f', alpha: Math.random(), decay: 0 });
        }
        
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha; ctx.fill();
        });
        ctx.globalAlpha = 1.0;
        
        // Líneas de escaneo CRT
        ctx.fillStyle = 'rgba(0, 255, 204, 0.015)';
        for (let i = 0; i < canvas.height; i += 4) { ctx.fillRect(0, i, canvas.width, 1); }
        
        ctx.restore(); return;
    }

    ctx.strokeStyle = 'rgba(0, 255, 204, 0.025)'; ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // === RENDERIZAR EVENTOS DINÁMICOS ===
    let t = Date.now();
    dynamicEvents.forEach(ev => {
        if (!ev.active) return;
        ctx.save();

        if (ev.type === 'extractor') {
            // Relleno interior pulsante
            let pulse = 0.06 + Math.sin(t * 0.005) * 0.04;
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 204, ${pulse})`; ctx.fill();
            // Anillo exterior
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.5 + Math.sin(t * 0.008) * 0.3})`; ctx.lineWidth = 3; ctx.stroke();
            // Anillo de progreso
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, -Math.PI / 2, -Math.PI / 2 + (ev.progress / 100) * Math.PI * 2);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
            // Pilar central
            ctx.fillStyle = '#00ffcc'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ffcc';
            ctx.fillRect(ev.x - 3, ev.y - 20, 6, 40);
            // Texto porcentaje
            ctx.font = "bold 18px 'Courier New'"; ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 0;
            ctx.textAlign = 'center'; ctx.fillText(`${Math.floor(ev.progress)}%`, ev.x, ev.y - 28);
            ctx.textAlign = 'left';
        }

        else if (ev.type === 'overload') {
            // Rombo amarillo parpadeante
            ctx.translate(ev.x, ev.y);
            let flicker = 0.7 + Math.sin(t * 0.02) * 0.3;
            ctx.rotate(t * 0.002);
            ctx.beginPath(); ctx.moveTo(0, -ev.radius * 2); ctx.lineTo(ev.radius * 1.4, 0); ctx.lineTo(0, ev.radius * 2); ctx.lineTo(-ev.radius * 1.4, 0);
            ctx.closePath(); ctx.fillStyle = `rgba(255, 180, 0, ${0.2 * flicker})`; ctx.fill();
            ctx.strokeStyle = `rgba(255, 200, 0, ${flicker})`; ctx.lineWidth = 3; ctx.stroke();
            ctx.rotate(-(t * 0.002));
            // Barra de vida
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-ev.radius * 1.5, -ev.radius * 2.5, ev.radius * 3, 8);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(-ev.radius * 1.5, -ev.radius * 2.5, ev.radius * 3 * (ev.hp / ev.maxHp), 8);
            // Temporizador
            ctx.beginPath(); ctx.arc(0, 0, ev.radius + 18, -Math.PI / 2, -Math.PI / 2 + (ev.timer / ev.maxTimer) * Math.PI * 2);
            ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 5; ctx.stroke();
            ctx.font = "bold 14px 'Courier New'"; ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center';
            ctx.fillText('NÚCLEO', 0, ev.radius * 2.7); ctx.textAlign = 'left';
        }

        else if (ev.type === 'portal') {
            // Portal A
            let pulseA = 0.6 + Math.sin(t * 0.007) * 0.4;
            ctx.beginPath(); ctx.arc(ev.ax, ev.ay, ev.portalRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(170, 0, 255, ${0.15 * pulseA})`; ctx.fill();
            ctx.strokeStyle = `rgba(200, 0, 255, ${pulseA})`; ctx.lineWidth = 4; ctx.shadowBlur = 20; ctx.shadowColor = '#aa00ff'; ctx.stroke();
            ctx.shadowBlur = 0; ctx.font = "bold 12px 'Courier New'"; ctx.fillStyle = '#cc88ff'; ctx.textAlign = 'center';
            ctx.fillText('A', ev.ax, ev.ay + 5); ctx.fillText(`${ev.crossings}/3`, ev.ax, ev.ay - ev.portalRadius - 8);
            // Portal B
            let pulseB = 0.6 + Math.sin(t * 0.007 + Math.PI) * 0.4;
            ctx.beginPath(); ctx.arc(ev.bx, ev.by, ev.portalRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(170, 0, 255, ${0.15 * pulseB})`; ctx.fill();
            ctx.strokeStyle = `rgba(200, 0, 255, ${pulseB})`; ctx.lineWidth = 4; ctx.shadowBlur = 20; ctx.shadowColor = '#aa00ff'; ctx.stroke();
            ctx.shadowBlur = 0; ctx.fillStyle = '#cc88ff';
            ctx.fillText('B', ev.bx, ev.by + 5);
            ctx.textAlign = 'left';
        }

        else if (ev.type === 'lockdown') {
            // Cubrir toda la pantalla de rojo
            ctx.fillStyle = 'rgba(180, 0, 0, 0.18)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Zona segura verde
            ctx.fillStyle = 'rgba(0, 255, 80, 0.12)'; ctx.fillRect(ev.sx, ev.sy, ev.sw, ev.sh);
            ctx.strokeStyle = `rgba(0, 255, 80, ${0.7 + Math.sin(t * 0.01) * 0.3})`; ctx.lineWidth = 3; ctx.setLineDash([8, 4]);
            ctx.strokeRect(ev.sx, ev.sy, ev.sw, ev.sh); ctx.setLineDash([]);
            // Contador regresivo
            let secs = Math.ceil(ev.timer / 60);
            ctx.font = "bold 22px 'Courier New'"; ctx.fillStyle = '#00ff55'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ff55';
            ctx.textAlign = 'center'; ctx.fillText(`BLOQUEO: ${secs}s`, ev.sx + ev.sw / 2, ev.sy - 10);
            ctx.textAlign = 'left'; ctx.shadowBlur = 0;
        }

        else if (ev.type === 'anomaly') {
            // Triángulo invertido blanco
            ctx.translate(ev.x, ev.y);
            ctx.shadowBlur = 25; ctx.shadowColor = '#ffffff';
            ctx.beginPath(); ctx.moveTo(0, ev.radius * 1.5); ctx.lineTo(-ev.radius * 1.3, -ev.radius * 0.9); ctx.lineTo(ev.radius * 1.3, -ev.radius * 0.9);
            ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.shadowBlur = 0;
            // Barra segmentada (3 segmentos)
            let bw = ev.radius * 5;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, -ev.radius * 2.5, bw, 7);
            let seg3 = Math.max(0, ev.hp / ev.maxHp);
            let segColor = seg3 > 0.66 ? '#ffffff' : (seg3 > 0.33 ? '#ffcc00' : '#ff4400');
            ctx.fillStyle = segColor; ctx.fillRect(-bw / 2, -ev.radius * 2.5, bw * seg3, 7);
            // Líneas divisorias segmentos
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            for (let s = 1; s < 3; s++) { ctx.beginPath(); ctx.moveTo(-bw / 2 + (bw / 3) * s, -ev.radius * 2.5); ctx.lineTo(-bw / 2 + (bw / 3) * s, -ev.radius * 2.5 + 7); ctx.stroke(); }
        }

        ctx.restore();
    });

    // === RENDERIZAR DRONES ALIADOS ===
    helperDrones.forEach(drone => {
        ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(drone.angle);
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffcc'; ctx.shadowBlur = 15; ctx.shadowColor = '#00ffcc'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
    });


    hazards.forEach(h => {
        if (!h.active) {
            ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.15 + Math.sin(Date.now() * 0.01) * 0.08})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.stroke();
            let scanProgress = h.timer / h.maxTimer; ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * scanProgress, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        } else {
            ctx.save(); let gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.radius);
            gradient.addColorStop(0, 'rgba(255, 0, 85, 0.25)'); gradient.addColorStop(0.7, 'rgba(255, 0, 60, 0.12)'); gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
            ctx.strokeStyle = `rgba(255, 0, 85, ${0.4 + Math.random() * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
            if (h.shockwaveRadius > 0 && h.shockwaveRadius < h.radius * 1.3) {
                ctx.beginPath(); ctx.arc(h.x, h.y, h.shockwaveRadius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (h.shockwaveRadius / (h.radius * 1.3))})`; ctx.lineWidth = 3; ctx.stroke();
            }
            ctx.restore();
        }
    });

    airDrops.forEach(ad => {
        ctx.save(); ctx.beginPath(); ctx.arc(ad.x, ad.y, ad.radius + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00'; ctx.shadowBlur = 15; ctx.shadowColor = '#ffff00'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    });

    drops.forEach(d => {
        ctx.save(); ctx.beginPath();
        if (d.matType === 'core') { ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2); ctx.fillStyle = '#00ffff'; }
        else if (d.matType === 'plate') { ctx.rect(d.x - d.radius, d.y - d.radius, d.radius * 2, d.radius * 2); ctx.fillStyle = '#0088ff'; }
        else if (d.matType === 'crystal') { ctx.moveTo(d.x, d.y - d.radius); ctx.lineTo(d.x + d.radius, d.y); ctx.lineTo(d.x, d.y + d.radius); ctx.lineTo(d.x, d.y + d.radius); ctx.lineTo(d.x - d.radius, d.y); ctx.closePath(); ctx.fillStyle = '#ff00ff'; }
        else { ctx.arc(d.x, d.y, d.radius * 0.8, 0, Math.PI * 2); ctx.fillStyle = '#ffff00'; }
        ctx.fill();
        if (d.matType) { ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.fill(); }
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    });

    bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill(); });
    particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); ctx.restore(); });

    enemies.forEach(e => {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle); ctx.beginPath();
        if (e.isBoss) { for (let i = 0; i < 8; i++) { let a = (i * Math.PI / 4); let x = Math.cos(a) * e.radius; let y = Math.sin(a) * e.radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
        else if (e.isKamikaze) { ctx.moveTo(e.radius * 1.4, 0); ctx.lineTo(0, -e.radius * 0.7); ctx.lineTo(-e.radius * 0.6, 0); ctx.lineTo(0, e.radius * 0.7); }
        else if (e.isEliteGold) { ctx.moveTo(e.radius * 1.5, 0); ctx.lineTo(0, -e.radius * 0.5); ctx.lineTo(-e.radius * 1.5, 0); ctx.lineTo(0, e.radius * 0.5); ctx.shadowBlur = 15; ctx.shadowColor = '#ffcc00'; }
        else { ctx.moveTo(e.radius * 1.2, 0); ctx.lineTo(-e.radius, -e.radius * 0.8); ctx.lineTo(-e.radius, e.radius * 0.8); }
        ctx.closePath(); ctx.fillStyle = e.flashTicks > 0 ? '#fff' : e.color; ctx.fill();

        if (e.isBoss && e.bossInvulnTimer > 0) { ctx.beginPath(); ctx.arc(0, 0, e.radius + 12, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
        else if (e.isShielded) { ctx.beginPath(); ctx.arc(0, 0, e.radius + 4, -0.6, 0.6); ctx.strokeStyle = '#0088ff'; ctx.lineWidth = 4; ctx.stroke(); }
        ctx.restore();

        if (e.hp < e.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 5);
            ctx.fillStyle = '#ff0055'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.radius * 2) * (e.hp / e.maxHp), 5);
        }
    });

    // Dibujar Jugadores
    players.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.beginPath();
        for (let i = 0; i < 6; i++) { let a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * p.radius, Math.sin(a) * p.radius); }
        ctx.closePath();

        if (p.flashTicks > 0) { ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ff0055'; ctx.fill(); }
        else { ctx.strokeStyle = p.dashTimer > 0 ? (p.color === '#00ffcc' ? '#00ffff' : '#ff00ff') : (p.color || '#00ffcc'); }
        ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = p.color === '#00ffcc' ? '#ff007f' : '#00ffff'; ctx.fillRect(0, -3, p.radius * 1.4, 6);

        if (p.shield > 0) {
            ctx.beginPath(); ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 170, 255, ${0.4 + Math.sin(Date.now() * 0.01) * 0.2})`; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();
    });

    damageTexts.forEach(dt => {
        ctx.save(); ctx.globalAlpha = dt.alpha;
        if (dt.isCrit) { ctx.font = "bold 26px 'Courier New'"; ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff'; ctx.fillStyle = '#ffff00'; }
        else { ctx.font = "bold 16px 'Courier New'"; ctx.fillStyle = dt.color; }
        ctx.fillText(dt.text, dt.x, dt.y); ctx.restore();
    });
    ctx.restore();

    if (players[0].damageFlashAlpha > 0) {
        ctx.save();
        let hitGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.3, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
        hitGrad.addColorStop(0, 'rgba(0,0,0,0)'); hitGrad.addColorStop(1, `rgba(255, 0, 60, ${players[0].damageFlashAlpha})`);
        ctx.fillStyle = hitGrad; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
}

let lastTime = performance.now();
let gameSpeed = 1.7;
const fixedDeltaTime = 1000 / (60 * gameSpeed);
let accumulator = 0;

function gameLoop(currentTime) {
    let frameTime = currentTime - lastTime; lastTime = currentTime;
    if (frameTime > 250) frameTime = 250;
    accumulator += frameTime;

    while (accumulator >= fixedDeltaTime) { update(); accumulator -= fixedDeltaTime; }

    draw(); requestAnimationFrame(gameLoop);
}

updateUI();
updateMenuSelection('main-menu');
requestAnimationFrame(gameLoop);
