// === LÓGICA DEL JUGADOR ===

function takeDamage(pObj, amount, attacker = null) {
    if (amount <= 0) return;
    if (pObj.isDead) return; 
    if ((pObj.invulnTimer || 0) > 0 || (pObj.invisibleTimer || 0) > 0) return; 
    
    // --- CÚPULA DEFENSIVA: Reducción de daño si el jugador está dentro ---
    if (typeof activeDomes !== 'undefined') {
        activeDomes.forEach(dome => {
            if (Math.hypot(pObj.x - dome.x, pObj.y - dome.y) < dome.radius) {
                amount *= (1 - dome.reduction);
                if (dome.isUltra) { /* Bonus cadencia fuego - handled on shoot */ }
            }
        });
    }
    
    // --- PASIVA: MÓDULO DE RESISTENCIA (REDUCCIÓN DE ESTADOS) ---
    let statusResLvl = getPassiveLevel('passive_status_res');
    // Ultra Nv6: Inquebrantable (invulnerable 1.5s al recibir Stun, CD 30s)
    if (statusResLvl === 6 && pObj.stunTimer > 0) {
        if (!pObj.inquebrantableCooldown || pObj.inquebrantableCooldown <= 0) {
            pObj.invulnTimer = 90; // 1.5s invulnerabilidad
            pObj.inquebrantableCooldown = 1800; // 30s CD
            spawnDamageText(pObj.x, pObj.y, 'INQUEBRANTABLE', 'shield');
        }
    }
    if ((pObj.inquebrantableCooldown || 0) > 0) pObj.inquebrantableCooldown--;
    
    // --- PASIVA: ESCUDO ESPECTRAL (EVASIÓN) ---
    let evadeLvl = getPassiveLevel('passive_evade');
    if (evadeLvl > 0 && Math.random() < evadeLvl * 0.04) {
        spawnDamageText(pObj.x, pObj.y, 'EVADIDO', 'shield');
        createExplosion(pObj.x, pObj.y, '#aa00ff', 12, 1.0);
        // Ultra Nv6: Desfase (1s invisible/invulnerable)
        if (evadeLvl === 6) {
            pObj.invulnTimer = 60; 
            showNetworkMessage('👤 ¡DESFASE! (Invisible)', 1000);
        }
        return;
    }

    // --- PASIVA: PLACAS REFRACTARIAS (REDUCCIÓN DE DAÑO) ---
    let defLvl = getPassiveLevel('passive_energy_def');
    if (defLvl > 0) {
        amount *= (1 - defLvl * 0.06);
        // Ultra Nv6: Prisma (Refleja 15% del daño al atacante)
        if (defLvl === 6 && attacker && attacker.hp !== undefined) {
            let reflected = amount * 0.15;
            attacker.hp -= reflected;
            attacker.flashTicks = 4;
            spawnDamageText(attacker.x, attacker.y, Math.floor(reflected), 'normal');
        }
    }

    if (pObj.isTurret) amount *= (1 - (pObj.turretDamageReduction || 0.3)); 
    
    pObj.invulnTimer = 35;
    pObj.flashTicks = 6; pObj.damageFlashAlpha = 0.5;
    
    let hudId = pObj.id === 1 ? 'hud-box' : `hud-box-p${pObj.id}`;
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
    
    // --- PASIVA: CÉLULA DE ESCUDO ULTRA (REINICIO FORZADO) ---
    if (pObj.shield <= 0 && getPassiveLevel('passive_shield') === 6 && (!pObj.reinicioForzadoCooldown || pObj.reinicioForzadoCooldown <= 0)) {
        pObj.shield = pObj.maxShield * 0.5;
        pObj.reinicioForzadoCooldown = 3600; 
        createExplosion(pObj.x, pObj.y, '#00aaff', 30, 1.5);
        showNetworkMessage('🛡️ ¡REINICIO FORZADO! (50% Escudo)', 2000);
    }

    if (amount > 0) {
        if (pObj.hp - amount <= 0 && isCoop) {
            let otherPlayer = players.find(p => p !== pObj && !p.isDead);
            let guardianLvl = getPassiveLevel('passive_guardian');
            if (otherPlayer && guardianLvl > 0) {
                let mitigated = amount * (1 - guardianLvl * 0.1);
                takeDamage(otherPlayer, mitigated);
                showNetworkMessage('🛡️ ¡DAÑO REDIRIGIDO POR GUARDIÁN!', 1500);
                return;
            }
        }
        
        pObj.hp -= amount;
        
        // --- PASIVA: REFUERZO DE CHASIS ULTRA (BLINDAJE REACTIVO) ---
        let hpLevel = getPassiveLevel('passive_hp');
        if (hpLevel === 6) {
            createExplosion(pObj.x, pObj.y, '#ff0055', 25, 1.2);
            enemies.forEach(e => {
                let dist = Math.hypot(e.x - pObj.x, e.y - pObj.y);
                if (dist < 150) {
                    e.hp -= 20;
                    e.flashTicks = 4;
                    spawnDamageText(e.x, e.y, 20, 'normal');
                }
            });
        }

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
                
                // Mártir (passive_guardian Nv6)
                if (getPassiveLevel('passive_guardian', pObj) === 6) {
                    createExplosion(pObj.x, pObj.y, '#ffffff', 80, 3.0);
                    players.forEach(p => {
                        if (p !== pObj && !p.isDead) {
                            p.hp = p.maxHp;
                            spawnDamageText(p.x, p.y, '100% HP', 'heal');
                            createExplosion(p.x, p.y, '#00ff88', 20, 1.2);
                        }
                    });
                    playExplosionSound();
                    showNetworkMessage('🏆 ¡MÁRTIR! (Aliados sanados)', 2500);
                }
                
                screenShake = 15;
                spawnDamageText(pObj.x, pObj.y, amount, 'player_hit');
                spawnDamageText(pObj.x, pObj.y - 28, 'KO', 'hazard');
                
                if (!isCoop && !isOnline) {
                    isGameOver = true;
                    let pSave = getPlayerSave(pObj);
                    pSave.credits = (pSave.credits || 0) + pObj.credits;
                    saveGame();
                    document.getElementById('game-over-stats').innerText = `Oleada alcanzada: ${wave}`;
                    document.getElementById('game-over-modal').style.display = 'block';
                    updateMenuSelection('game-over-modal');
                    isPaused = true;
                    return; 
                } else {
                    pObj.isDead = true;
                    pObj.reviveTimer = 0;
                    showNetworkMessage(`💀 JUGADOR ${pObj.id} CAÍDO — acércate y mantén [A/R] para revivir!`, 5000);
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
    showNetworkMessage(`✅ JUGADOR ${pObj.id} REVIVIDO!`, 3000);
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
    // Recopilar hasta 4 gamepads conectados
    let connectedGamepads = [];
    for (let i = 0; i < 4; i++) {
        connectedGamepads.push(gamepads[i] && gamepads[i].connected ? gamepads[i] : null);
    }
    let gp1 = connectedGamepads[0];
    let gp2 = connectedGamepads[1];

    for (let i = 0; i < 4; i++) {
        if (!lastGamepadButtons[i]) lastGamepadButtons[i] = [];
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
            let currentSpeed = pObj.speed;
            if (pObj.vortexPullCount >= 2) currentSpeed /= 2;
            if (pObj.isChargingLaser) currentSpeed = 1.8;
            if (pObj.isTurret) currentSpeed = 0;
            
            // Ralentización por zonas Glitch
            if (typeof hazards !== 'undefined') {
                let inGlitch = hazards.some(h => h.isGlitchZone && Math.hypot(pObj.x - h.x, pObj.y - h.y) < h.radius);
                if (inGlitch) currentSpeed *= 0.45;
            }
            
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

        // Mapeo dinámico de habilidades (Shift, E, Space, Q) para Gamepad
        if ((gp.buttons[4]?.pressed && !lastGamepadButtons[gpIdx][4]) || (gp.buttons[2]?.pressed && !lastGamepadButtons[gpIdx][2])) {
            triggerAbility('Shift', pObj);
        }

        // Cambiar arma (LT)
        if (gp.buttons[6]?.pressed && !lastGamepadButtons[gpIdx][6]) { pObj.currentWeaponIndex = (pObj.currentWeaponIndex + 1) % pObj.weapons.length; updateUI(); }
        
        // Pulso (B / Botón 1) -> slot E
        if (gp.buttons[1]?.pressed && !lastGamepadButtons[gpIdx][1]) {
            // Botón B: primero intenta revivir a aliado cercano caído
            let revived = false;
            if (isCoop) {
                players.forEach(deadP => {
                    if (deadP.isDead && deadP !== pObj) {
                        let dist = Math.hypot(pObj.x - deadP.x, pObj.y - deadP.y);
                        if (dist < 60) {
                            pObj.isReviving = true;
                            revived = true;
                        }
                    }
                });
            }
            if (!revived) triggerAbility('E', pObj);
        }
        
        // Modo Torreta (Y / Botón 3) -> slot Space
        if (gp.buttons[3]?.pressed && !lastGamepadButtons[gpIdx][3]) {
            triggerAbility('Space', pObj);
        }
        
        // Célula Q (R3 / Botón 11) -> slot Q
        if (gp.buttons[11]?.pressed && !lastGamepadButtons[gpIdx][11]) {
            triggerAbility('Q', pObj);
        }
        
        // Arma Especial (RB / Botón 5) -> Clic Derecho
        if (gp.buttons[5]?.pressed) {
            if ((pObj.empTimer || 0) === 0 && (pObj.laserCooldown || 0) <= 0 && !pObj.isTurret) {
                let pSave = getPlayerSave(pObj);
                let specWep = pSave.nexusBuild.specialWeapon || 'laser';
                if (specWep === 'laser' && !pObj.isChargingLaser) {
                    pObj.isChargingLaser = true;
                    pObj.laserCharge = 0;
                } else if (specWep === 'mortar' && !lastGamepadButtons[gpIdx][5]) {
                    fireMortar(pObj);
                }
            }
        } else if (lastGamepadButtons[gpIdx][5] && !gp.buttons[5]?.pressed) {
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
        if (!gameStarted) {
            const controlsModal = document.getElementById('controls-modal');
            if (controlsModal?.style.display === 'block') activeModal = controlsModal;
            else if (inCollectionMenu) activeModal = document.getElementById('collection-modal');
            else activeModal = document.getElementById('main-menu');
        }
        else if (isShopActive) activeModal = document.getElementById('shop-modal');
        else if (inCollectionMenu) activeModal = document.getElementById('collection-modal');
        else if (isGameOver) activeModal = document.getElementById('game-over-modal');
        else if (document.getElementById('level-up-modal')?.style.display === 'block') activeModal = document.getElementById('level-up-modal');

        // Navegación especial del Nexus multi-panel
        if (inCollectionMenu && typeof handleNexusGamepadInput === 'function') {
            handleNexusGamepadInput(gpIdx, gp, lastGamepadButtons[gpIdx]);
            gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
            return;
        }

        // --- GESTIÓN DE UNIÓN EN MENÚ PRINCIPAL ---
        if (!gameStarted && activeModal && activeModal.id === 'main-menu') {
            // El jugador 2, 3 o 4 presiona A (botón 0) o Start (botón 9) para activarse
            if (gpIdx > 0) {
                if ((gp.buttons[0]?.pressed && !lastGamepadButtons[gpIdx][0]) || 
                    (gp.buttons[9]?.pressed && !lastGamepadButtons[gpIdx][9])) {
                    if (!playerSlotsActive[gpIdx]) {
                        togglePlayerSlot(gpIdx + 1);
                    }
                }
                // Presiona B (botón 1) para desactivarse (salir)
                if (gp.buttons[1]?.pressed && !lastGamepadButtons[gpIdx][1]) {
                    if (playerSlotsActive[gpIdx]) {
                        togglePlayerSlot(gpIdx + 1);
                    }
                }
                // Los mandos secundarios en el menú principal no mueven el cursor ni hacen clic
                gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
                return;
            }
        }

        // Determinar qué botones son accesibles por este mando en este modal
        let buttons = [];
        if (activeModal) {
            if (activeModal.id === 'shop-modal') {
                // En la tienda, cada jugador sólo navega su propia columna + el botón de cerrar
                let colEl = document.getElementById(`shop-p${gpIdx + 1}-col`);
                buttons = colEl ? Array.from(colEl.querySelectorAll('.shop-btn')).filter(btn => btn.offsetParent !== null) : [];
                let closeBtn = activeModal.querySelector('.shop-btn[onclick*="toggleShop(false)"]');
                if (closeBtn) buttons.push(closeBtn);
            } else if (activeModal.id === 'level-up-modal') {
                // En el menú de subida de nivel, sólo el jugador que está subiendo de nivel debe controlar
                if (window.currentLevelUpPlayer && gpIdx === (window.currentLevelUpPlayer.id - 1)) {
                    buttons = Array.from(activeModal.querySelectorAll('.level-up-card')).filter(btn => btn.offsetParent !== null);
                } else {
                    // Otros jugadores no pueden interactuar con el modal de subida de nivel de este jugador
                    gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
                    return;
                }
            } else {
                // Modales generales (pausa, controles, principal, fin de partida)
                buttons = Array.from(activeModal.querySelectorAll('.shop-btn, .level-up-card, .menu-btn')).filter(btn => btn.offsetParent !== null);
            }
        }

        if (buttons.length === 0) { gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false); return; }

        if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) { if (!menuNavCooldown) { selectedMenuItem[gpIdx]--; moved = true; } }
        else if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) { if (!menuNavCooldown) { selectedMenuItem[gpIdx]++; moved = true; } }
        else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) { if (!menuNavCooldown && buttons[0]?.classList.contains('level-up-card')) { selectedMenuItem[gpIdx]--; moved = true; } }
        else if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) { if (!menuNavCooldown && buttons[0]?.classList.contains('level-up-card')) { selectedMenuItem[gpIdx]++; moved = true; } }

        if (moved) {
            menuNavCooldown = 15;
            if (selectedMenuItem[gpIdx] < 0) selectedMenuItem[gpIdx] = buttons.length - 1;
            if (selectedMenuItem[gpIdx] >= buttons.length) selectedMenuItem[gpIdx] = 0;

            if (isShopActive) {
                // Quitar la clase de selección específica de este jugador de todos los botones de su columna + el botón de cerrar
                buttons.forEach(btn => btn.classList.remove(`selected-p${gpIdx + 1}`));
                // Añadirla al botón seleccionado por este jugador
                buttons[selectedMenuItem[gpIdx]]?.classList.add(`selected-p${gpIdx + 1}`);
            } else {
                const allBtns = activeModal.querySelectorAll('.shop-btn, .level-up-card, .menu-btn');
                allBtns.forEach(btn => btn.classList.remove('selected'));
                buttons[selectedMenuItem[gpIdx]]?.classList.add('selected');
            }
        }

        // A = confirmar
        if (gp.buttons[0]?.pressed && !lastGamepadButtons[gpIdx][0]) {
            buttons[selectedMenuItem[gpIdx]]?.click();
        }
        // En menú principal: presionar Start activa/desactiva el slot del jugador correspondiente (para P1)
        if (!gameStarted && gpIdx === 0 && gp.buttons[9]?.pressed && !lastGamepadButtons[gpIdx][9]) {
            togglePlayerSlot(gpIdx + 1);
        }
        gp.buttons.forEach((b, i) => lastGamepadButtons[gpIdx][i] = b ? b.pressed : false);
    }

    // Procesar pausa (cualquier mando activo puede pausar)
    for (let gi = 0; gi < 4; gi++) {
        let gpPause = connectedGamepads[gi];
        if (gpPause && gpPause.buttons[9]?.pressed && !lastGamepadButtons[gi][9]) {
            if (!isShopActive && !inCollectionMenu && !isGameOver && gameStarted) {
                togglePause();
            }
        }
    }

    // Procesar entrada de juego
    if (!inMenu) {
        // Reglas de asignación de input:
        // Si hay N gamepads conectados, cada jugador activo usa su gamepad (índice = id-1)
        // El teclado solo controla P1 si NO hay ningún gamepad conectado
        let anyGamepad = connectedGamepads.some(g => g !== null);
        
        players.forEach(p => {
            if (p.isDead) return;
            if (typeof isOnline !== 'undefined' && isOnline && p.id !== localPlayerId) return;
            
            if (anyGamepad) {
                // Con gamepads: todos los jugadores usan su mando
                p.inputSource = 'gamepad';
                p.gamepadIndex = p.id - 1; // P1=gp0, P2=gp1, etc.
            } else {
                // Sin gamepads: solo P1 con teclado
                p.inputSource = 'keyboard';
            }
            
            if (p.inputSource === 'gamepad') {
                let gp = connectedGamepads[p.gamepadIndex];
                if (gp) handlePlayerGamepad(gp, p, p.gamepadIndex);
            }
        });
    }

    if (inMenu) {
        for (let gi = 0; gi < 4; gi++) {
            if (connectedGamepads[gi]) handleMenuGamepad(connectedGamepads[gi], gi);
        }
    }
}
