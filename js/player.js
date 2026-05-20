// === LÓGICA DEL JUGADOR ===

function takeDamage(pObj, amount) {
    if (amount <= 0) return;
    if (pObj.isDead) return; // Ya muerto, no recibir más daño
    if ((pObj.invulnTimer || 0) > 0) return; // Invulnerable por i-frames
    
    if (pObj.isTurret) amount *= (1 - (pObj.turretDamageReduction || 0.3)); // 30% base
    
    // Activar i-frames (35 frames ≈ 0.58 segundos a 60fps)
    pObj.invulnTimer = 35;
    pObj.flashTicks = 6; pObj.damageFlashAlpha = 0.5;
    
    // Animación en el HUD
    let hudId = pObj.id === 1 ? 'hud-box' : 'hud-box-p2';
    let hudElem = document.getElementById(hudId);
    if (hudElem) {
        hudElem.classList.remove('hud-damage');
        void hudElem.offsetWidth;
        hudElem.classList.add('hud-damage');
    }

    if (pObj.shield > 0) {
        let absorbed = Math.min(pObj.shield, amount); pObj.shield -= absorbed; amount -= absorbed;
        spawnDamageText(pObj.x, pObj.y, absorbed, 'shield'); createExplosion(pObj.x, pObj.y, '#00aaff', 8, 1.2);
    }
    if (amount > 0) {
        pObj.hp -= amount;
        if (pObj.hp <= 0) {
            if (pObj.hasSecondChance) {
                pObj.hp = Math.floor(pObj.maxHp * 0.5);
                pObj.hasSecondChance = false;
                createExplosion(pObj.x, pObj.y, '#ffff00', 40, 2.5);
                screenShake = 10;
                showNetworkMessage('🛡️ ¡SEGUNDA OPORTUNIDAD ACTIVADA!', 3000);
            } else {
                pObj.hp = 0;
                createExplosion(pObj.x, pObj.y, pObj.color, 40, 2.5);
                screenShake = 15;
                spawnDamageText(pObj.x, pObj.y, amount, 'player_hit');
                spawnDamageText(pObj.x, pObj.y - 28, 'KO', 'hazard');
                
                // En solitario, Game Over directo e inmediato
                if (!isCoop && !isOnline) {
                    isGameOver = true;
                    document.getElementById('game-over-stats').innerText = `Oleada alcanzada: ${wave}`;
                    document.getElementById('game-over-modal').style.display = 'block';
                    updateMenuSelection('game-over-modal');
                    isPaused = true;
                    return; // Detener ejecución para evitar que quede en bucle
                } else {
                    pObj.isDead = true;
                    pObj.reviveTimer = 0;
                    showNetworkMessage(`💀 ${pObj.id === 1 ? 'JUGADOR 1' : 'JUGADOR 2'} CAÍDO — acércate y mantén [R] para revivir!`, 5000);
                }
            }
        } else {
            spawnDamageText(pObj.x, pObj.y, amount, 'player_hit'); createExplosion(pObj.x, pObj.y, '#ff0055', 12, 1.5);
        }
    }
    updateUI();
}

function revivePlayer(pObj) {
    pObj.isDead = false;
    pObj.hp = Math.floor(pObj.maxHp * 0.3); // Revive con 30% de vida
    pObj.shield = 0;
    createExplosion(pObj.x, pObj.y, '#00ff88', 30, 1.5);
    showNetworkMessage(`✅ ${pObj.id === 1 ? 'JUGADOR 1' : 'JUGADOR 2'} REVIVIDO!`, 3000);
    screenShake = 8;
    updateUI();
}

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

function triggerDash() { if (players[0].empTimer > 0 || players[0].dashCooldown > 0 || players[0].dashTimer > 0) return; triggerDashKeyboard(); }

function triggerPulse() {
    if (players[0].empTimer > 0 || players[0].pulseCooldown > 0) return;
    players[0].pulseCooldown = 300; createExplosion(players[0].x, players[0].y, '#ff007f', 40, 2); screenShake = 15;

    enemies.forEach(e => {
        let dx = e.x - players[0].x; let dy = e.y - players[0].y; let dist = Math.hypot(dx, dy);
        if (dist < 260) {
            let force = (260 - dist) / 1.2; let angle = Math.atan2(dy, dx);
            if (dist > 0) { e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force; }
            e.hp -= 35; e.flashTicks = 5; spawnDamageText(e.x, e.y, 35, 'normal');
            if (e.isEMPStalker && !e.isRevealed) {
                e.isRevealed = true;
                showNetworkMessage('👁️ ¡INHABILITADOR REVELADO!', 1500);
            }
        }
    });
}

function processGamepadInput() {
    const gamepads = navigator.getGamepads();
    let gp1 = gamepads[0];
    let gp2 = gamepads[1];

    if (!lastGamepadButtons[0]) lastGamepadButtons[0] = [];
    if (!lastGamepadButtons[1]) lastGamepadButtons[1] = [];

    // Activar co-op si el Mando 1 presiona START (botón 9) y no estamos en co-op ni en online
    /*
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
            weaponUpgrades: { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } },
            upgradeCounts: { hp: 0, dmg: 0, laser: 0, minigun: 0, q_cooldown: 0 }
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
    */

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
            let currentSpeed = pObj.speed;
            if (pObj.vortexPullCount >= 2) currentSpeed /= 2;
            if (pObj.isChargingLaser) currentSpeed = 1.8;
            if (pObj.isTurret) currentSpeed = 0;
            
            if (pObj.dashTimer <= 0) { pObj.x += moveX * currentSpeed; pObj.y += moveY * currentSpeed; }
        }

        if (pObj.aimMode === 'MANUAL') {
            let aimX = gp.axes[2] || 0; let aimY = gp.axes[3] || 0;
            if (Math.hypot(aimX, aimY) > 0.25) {
                let targetAngle = Math.atan2(aimY, aimX);
                let turnSpeed = 0.1;
                if (pObj.isTurret && pObj.minigunHeat > 150) {
                    turnSpeed = 0.02;
                }
                
                let diff = targetAngle - pObj.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                pObj.angle += diff * turnSpeed;
            }
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
            if ((pObj.empTimer || 0) === 0 && pObj.dashCooldown === 0 && pObj.dashTimer === 0 && (moveX !== 0 || moveY !== 0)) {
                let len = Math.hypot(moveX, moveY);
                pObj.dashVx = (moveX / len) * 14; pObj.dashVy = (moveY / len) * 14;
                let dashCD = Math.max(30, 90 - (userSave.artifacts.hyperdrive * 5));
                pObj.dashTimer = 10; pObj.dashCooldown = dashCD; screenShake = 5;
            }
        }

        // Cambiar arma (LT)
        if (gp.buttons[6]?.pressed && !lastGamepadButtons[gpIdx][6]) { pObj.currentWeaponIndex = (pObj.currentWeaponIndex + 1) % pObj.weapons.length; updateUI(); }
        
        // Pulso (B / Botón 1)
        if (gp.buttons[1]?.pressed && !lastGamepadButtons[gpIdx][1]) {
            if ((pObj.empTimer || 0) === 0 && (pObj.pulseCooldown || 0) === 0) {
                triggerPulse();
                playPulseSound();
            }
        }
        
        // Modo Torreta (Y / Botón 3)
        if (gp.buttons[3]?.pressed && !lastGamepadButtons[gpIdx][3]) {
            if (waveActive && (pObj.empTimer || 0) === 0) {
                pObj.isTurret = !pObj.isTurret;
                playTurretToggleSound();
                if (pObj.isTurret) pObj.minigunSpool = 0;
            }
        }
        
        // Célula Q (R3 / Botón 11)
        if (gp.buttons[11]?.pressed && !lastGamepadButtons[gpIdx][11]) {
            if ((pObj.qCooldown || 0) <= 0 && (pObj.empTimer || 0) === 0) {
                pObj.dashCooldown = 0;
                pObj.pulseCooldown = 0;
                pObj.laserCooldown = 0;
                pObj.qTurboTimer = 240; // 4s
                pObj.qCooldown = 900 * (pObj.qCdMod || 1.0); // 15s base
                
                playOverloadSound();
                createExplosion(pObj.x, pObj.y, '#00ffaa', 30, 2);
                showNetworkMessage('⚡ ¡CÉLULA DE SOBRECARGA ACTIVADA!', 2000);
            }
        }
        
        // Mega Láser (RB / Botón 5)
        if (gp.buttons[5]?.pressed) {
            if ((pObj.empTimer || 0) === 0 && (pObj.laserCooldown || 0) <= 0 && !pObj.isTurret) {
                if (!pObj.isChargingLaser) {
                    pObj.isChargingLaser = true;
                    pObj.laserCharge = 0;
                }
            }
        } else if (lastGamepadButtons[gpIdx][5] && !gp.buttons[5]?.pressed) {
            // Se soltó el botón
            if (pObj.isChargingLaser) {
                pObj.isChargingLaser = false;
                fireMegaLaser(pObj);
            }
        }
        
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

        const buttons = activeModal ? activeModal.querySelectorAll('.shop-btn, .level-up-card') : [];
        if (buttons.length === 0) return;

        if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) { if (!menuNavCooldown) { selectedMenuItem[gpIdx]--; moved = true; } }
        else if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) { if (!menuNavCooldown) { selectedMenuItem[gpIdx]++; moved = true; } }
        else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) { if (!menuNavCooldown && buttons[0]?.classList.contains('level-up-card')) { selectedMenuItem[gpIdx]--; moved = true; } }
        else if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) { if (!menuNavCooldown && buttons[0]?.classList.contains('level-up-card')) { selectedMenuItem[gpIdx]++; moved = true; } }

        if (moved) {
            menuNavCooldown = 15;
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
        gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
    }

    // Procesar pausa
    let gpPausa = gp1 || gp2;
    if (gpPausa && gpPausa.buttons[9]?.pressed && !lastGamepadButtons[gpPausa === gp1 ? 0 : 1][9]) {
        if (!isShopActive && !inCollectionMenu && !isGameOver && gameStarted) {
            togglePause();
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
