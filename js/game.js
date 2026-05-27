

// === FUNCIÓN takeDamage MOVIDA A player.js ===

// Mover el check de todos muertos fuera del takeDamage para coop
function checkCoopGameOver() {
    if (isCoop || isOnline) {
        let allDead = players.every(p => p.isDead || p.hp <= 0);
        if (allDead && !isGameOver) {
            isGameOver = true;
            // Guardar créditos obtenidos en la partida
            userSave.credits = (userSave.credits || 0) + players[0].credits;
            saveGame();
            document.getElementById('game-over-stats').innerText = `Oleada alcanzada: ${wave}`;
            document.getElementById('game-over-modal').style.display = 'block';
            updateMenuSelection('game-over-modal');
            isPaused = true;
        }
    }
}

// --- ACTUALIZACIONES DINÁMICAS HUD ---
function updateHUDLabels() {
    let build = userSave.nexusBuild;
    if (!build) return;
    
    // Habilidad Shift (Dash-CD Bar)
    let shiftSkill = build.skills.Shift;
    let shiftLabel = shiftSkill ? COMPONENT_CATALOG[shiftSkill].name.toUpperCase() : 'VACÍO';
    let shiftParent = document.getElementById('dash-cd').parentElement.previousElementSibling;
    if (shiftParent) shiftParent.innerText = `${shiftLabel} [SHIFT]:`;

    // Habilidad E (Pulse-CD Bar)
    let eSkill = build.skills.E;
    let eLabel = eSkill ? COMPONENT_CATALOG[eSkill].name.toUpperCase() : 'VACÍO';
    let eParent = document.getElementById('pulse-cd').parentElement.previousElementSibling;
    if (eParent) eParent.innerText = `${eLabel} [E]:`;

    // Habilidad Q (Q-CD Bar)
    let qSkill = build.skills.Q;
    let qLabel = qSkill ? COMPONENT_CATALOG[qSkill].name.toUpperCase() : 'VACÍO';
    let qParent = document.getElementById('q-cd').parentElement.previousElementSibling;
    if (qParent) qParent.innerText = `${qLabel} [Q]:`;

    // Arma Especial (Laser-CD Bar)
    let specWep = build.specialWeapon;
    let specLabel = specWep ? COMPONENT_CATALOG[specWep].name.toUpperCase() : 'VACÍO';
    let specParent = document.getElementById('laser-cd').parentElement.previousElementSibling;
    if (specParent) specParent.innerText = `${specLabel} [CLIC D]:`;
}

function updateHUDCooldownBars(p) {
    let build = userSave.nexusBuild;
    if (!build) return;
    
    function getCooldownPercent(skillId, pObj) {
        if (!skillId) return 0;
        let mod = getActiveSkillModifier(skillId);
        if (skillId === 'dash' || skillId === 'turbo_impulso') {
            let maxCD = Math.max(15, Math.floor(90 * mod.cdMultiplier));
            return 1 - (pObj.dashCooldown / maxCD);
        } else if (skillId === 'pulse' || skillId === 'pulso_choque') {
            let maxCD = Math.max(60, Math.floor(300 * mod.cdMultiplier));
            return 1 - (pObj.pulseCooldown / maxCD);
        } else if (skillId === 'overload' || skillId === 'sobrecarga_armas') {
            let maxCD = Math.max(180, Math.floor(900 * mod.cdMultiplier));
            return 1 - (pObj.qCooldown / maxCD);
        } else if (skillId === 'teleport' || skillId === 'salto_falla') {
            let maxCD = Math.max(90, Math.floor(480 * mod.cdMultiplier));
            return 1 - ((pObj.teleportCooldown || 0) / maxCD);
        }
        return 1;
    }
    
    let shiftPercent = getCooldownPercent(build.skills.Shift, p);
    document.getElementById('dash-cd').style.width = `${Math.max(0, Math.min(1, shiftPercent)) * 100}%`;
    
    let ePercent = getCooldownPercent(build.skills.E, p);
    document.getElementById('pulse-cd').style.width = `${Math.max(0, Math.min(1, ePercent)) * 100}%`;
    
    let qPercent = getCooldownPercent(build.skills.Q, p);
    document.getElementById('q-cd').style.width = `${Math.max(0, Math.min(1, qPercent)) * 100}%`;
    
    let specWep = build.specialWeapon;
    let maxLaserCD = specWep === 'mortar' ? 240 : (p.maxLaserCooldown || 480);
    document.getElementById('laser-cd').style.width = `${(1 - p.laserCooldown / maxLaserCD) * 100}%`;
}

function startGameSimulation() {
    gameStarted = true;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('hud-box').style.display = 'block';
    
    // Cargar build del Nexus
    updateHUDLabels();
    
    players.forEach(p => {
        let pSave = getPlayerSave(p);
        // Inicializar stats según pasivas equipadas de su propio Nexus
        p.maxHp = 100 + getPassiveLevel('passive_hp', p) * 15;
        p.hp = p.maxHp;
        p.damageModifier = 1.0 + getPassiveLevel('passive_dmg', p) * 0.05;
        p._baseDmgMod = p.damageModifier; // Base para restaurar tras buffs
        p.maxShield = getPassiveLevel('passive_shield', p) > 0 ? (40 + getPassiveLevel('passive_shield', p) * 10) : 0;
        p.shield = p.maxShield;
        
        // Equipamiento del Nexus — usando el save del jugador
        p.weapons = [pSave.nexusBuild.primaryWeapon || 'basic'];
        p.currentWeaponIndex = 0;
        
        // Variables v0.8.0 / v0.9.0
        p.laserCharge = 0;
        p.laserCooldown = 0;
        p.teleportCooldown = 0;
        p.reinicioForzadoCooldown = 0;
        p.postCombustionTimer = 0;
        p.lastShotTime = Date.now();
        p.isTurret = false;
        p.minigunHeat = 0;
        p.minigunOverheat = false;
        p.qCooldown = 0;
        p.qTurboTimer = 0;
        p.minigunSpool = 0;
        p.minigunCooldown = 0;
        p.rearDischargeTimer = 0;
        p.isDead = false;
    });

    if (!isOnline || isHost) {
        startWave();
    }

    
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
    
    // Guardar créditos de TODOS los jugadores al reiniciar
    players.forEach((p, i) => {
        let save = getPlayerSave(p);
        save.credits = (save.credits || 0) + p.credits;
    });
    saveGame();
    
    players.forEach(p => {
        let pSave = getPlayerSave(p);
        p.credits = 0;
        p.level = 1;
        p.xp = 0;
        p.nextXp = 100;
        p.hp = p.maxHp || 100;
        p.shield = 0;
        p.weapons = [pSave.nexusBuild.primaryWeapon || 'basic'];
        p.currentWeaponIndex = 0;
        p.overdriveTimer = 0;
        p.dashTimer = 0;
        p.dashCooldown = 0;
        p.pulseCooldown = 0;
        p.teleportCooldown = 0;
        p.reinicioForzadoCooldown = 0;
        p.postCombustionTimer = 0;
        p.weaponUpgrades = { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } };
        p.upgradeCounts = { hp: 0, dmg: 0, laser: 0, minigun: 0, q_cooldown: 0 };
        p.laserDmgMod = 1.0;
        p.minigunHeatMod = 1.0;
        p.qCdMod = 1.0;
    });
    // En online, quitar al jugador remoto para que se re-cree cuando se reconecte
    if (typeof isOnline !== 'undefined' && isOnline) {
        players.splice(1);
    }
    
    if (typeof resetShopUI !== 'undefined') {
        resetShopUI();
    }
    
    document.getElementById('game-over-modal').style.display = 'none';
    startGameSimulation();
}

function returnToMainMenu() {
    gameStarted = false;
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
    
    // Guardar créditos de TODOS los jugadores al volver al menú
    players.forEach((p) => {
        let save = getPlayerSave(p);
        save.credits = (save.credits || 0) + p.credits;
    });
    saveGame();
    
    players.forEach(p => {
        let pSave = getPlayerSave(p);
        p.credits = 0;
        p.level = 1;
        p.xp = 0;
        p.nextXp = 100;
        p.hp = p.maxHp || 100;
        p.shield = 0;
        p.weapons = [pSave.nexusBuild.primaryWeapon || 'basic'];
        p.currentWeaponIndex = 0;
        p.overdriveTimer = 0;
        p.dashTimer = 0;
        p.dashCooldown = 0;
        p.pulseCooldown = 0;
        p.teleportCooldown = 0;
        p.reinicioForzadoCooldown = 0;
        p.postCombustionTimer = 0;
        p.weaponUpgrades = { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } };
        p.upgradeCounts = { hp: 0, dmg: 0, laser: 0, minigun: 0, q_cooldown: 0 };
        p.laserDmgMod = 1.0;
        p.minigunHeatMod = 1.0;
        p.qCdMod = 1.0;
    });
    
    if (typeof isOnline !== 'undefined' && isOnline) {
        players.splice(1);
    }
    
    if (typeof resetShopUI !== 'undefined') {
        resetShopUI();
    }
    
    if (typeof playMusic !== 'undefined') {
        playMusic('view_from_the_bridge.mp3');
    }
    
    document.getElementById('game-over-modal').style.display = 'none';
    document.getElementById('hud-box').style.display = 'none';
    // Ocultar HUDs de P2-P4
    for (let i = 2; i <= 4; i++) {
        let h = document.getElementById(`hud-box-p${i}`);
        if (h) h.style.display = 'none';
    }
    // Reiniciar estado de jugadores para el menú
    players = [createPlayer(1, 0)];
    activePlayers = 1;
    isCoop = false;
    playerSlotsActive = [true, false, false, false];
    document.getElementById('main-menu').style.display = 'block';
    
    if (typeof updateMenuSelection !== 'undefined') {
        updateMenuSelection('main-menu');
    }
}

// --- IMPLEMENTACIÓN DE HABILIDADES CONFIGURABLES ---
function triggerTeleport(pObj) {
    if (!pObj) pObj = players[0];
    let moveX = 0; let moveY = 0;
    if (pObj.inputSource === 'keyboard') {
        if (keys['w'] || keys['arrowup']) moveY = -1;
        if (keys['s'] || keys['arrowdown']) moveY = 1;
        if (keys['a'] || keys['arrowleft']) moveX = -1;
        if (keys['d'] || keys['arrowright']) moveX = 1;
    } else {
        const gamepads = navigator.getGamepads();
        let gp = gamepads[pObj.gamepadIndex];
        if (gp) {
            moveX = gp.axes[0] || 0;
            moveY = gp.axes[1] || 0;
        }
    }
    let angle = pObj.angle;
    if (moveX !== 0 || moveY !== 0) {
        angle = Math.atan2(moveY, moveX);
    }
    
    let dist = 180;
    let newX = pObj.x + Math.cos(angle) * dist;
    let newY = pObj.y + Math.sin(angle) * dist;
    
    newX = Math.max(pObj.radius, Math.min(canvas.width - pObj.radius, newX));
    newY = Math.max(pObj.radius, Math.min(canvas.height - pObj.radius, newY));
    
    createExplosion(pObj.x, pObj.y, '#aa00ff', 20, 1.2);
    createExplosion(newX, newY, '#00ffff', 25, 1.5);
    
    enemies.forEach(e => {
        let distStart = Math.hypot(e.x - pObj.x, e.y - pObj.y);
        let distEnd = Math.hypot(e.x - newX, e.y - newY);
        if (distStart < 100 || distEnd < 100) {
            let dmg = 50 * pObj.damageModifier;
            e.hp -= dmg;
            e.flashTicks = 4;
            spawnDamageText(e.x, e.y, Math.floor(dmg), 'normal');
        }
    });
    
    pObj.x = newX;
    pObj.y = newY;
    pObj.teleportCooldown = 480; 
    playPulseSound(); 
    showNetworkMessage(`🌌 ¡TELETRANSPORTE (P${pObj.id})!`, 1000);
}

function triggerAbility(slotKey, pObj) {
    if (!pObj) pObj = players[0];
    if (pObj.isDead || isPaused || !gameStarted) return;
    if ((pObj.empTimer || 0) > 0) return;
    
    let pSave = getPlayerSave(pObj);
    let abilityId = pSave.nexusBuild.skills[slotKey];
    if (!abilityId) return;
    
    let mod = getActiveSkillModifier(abilityId, pObj);
    
    if (abilityId === 'dash' || abilityId === 'turbo_impulso') {
        if (pObj.dashCooldown > 0 || pObj.dashTimer > 0) return;
        let moveX = 0; let moveY = 0;
        if (pObj.inputSource === 'keyboard') {
            if (keys['w'] || keys['arrowup']) moveY = -1;
            if (keys['s'] || keys['arrowdown']) moveY = 1;
            if (keys['a'] || keys['arrowleft']) moveX = -1;
            if (keys['d'] || keys['arrowright']) moveX = 1;
        } else {
            const gamepads = navigator.getGamepads();
            let gp = gamepads[pObj.gamepadIndex];
            if (gp) {
                moveX = gp.axes[0] || 0;
                moveY = gp.axes[1] || 0;
            }
        }
        if (moveX === 0 && moveY === 0) return;
        let len = Math.hypot(moveX, moveY);
        pObj.dashVx = (moveX / len) * 14; pObj.dashVy = (moveY / len) * 14;
        
        let baseCD = Math.max(30, 90 - (getPassiveLevel('passive_cooldown', pObj) * 5));
        let dashCD = Math.max(15, Math.floor(baseCD * mod.cdMultiplier));
        
        pObj.dashTimer = 10; pObj.dashCooldown = dashCD; screenShake = 5;
        playDashSound();
        
        if (mod.level === 6) {
            pObj.invisibleTimer = 30; // 0.5s at 60fps
            pObj.invulnTimer = Math.max(pObj.invulnTimer || 0, 30);
            showNetworkMessage('🏃 ¡DASH INVISIBLE!', 800);
        }
    } else if (abilityId === 'pulse' || abilityId === 'pulso_choque') {
        if (pObj.pulseCooldown > 0) return;
        let baseCD = 300;
        pObj.pulseCooldown = Math.max(60, Math.floor(baseCD * mod.cdMultiplier));
        createExplosion(pObj.x, pObj.y, '#ff007f', 40, 2);
        screenShake = 15;
        playPulseSound();
        
        let pulseDmg = Math.floor(35 * mod.effectMultiplier);
        let forceMult = mod.effectMultiplier;
        
        enemies.forEach(e => {
            let dx = e.x - pObj.x; let dy = e.y - pObj.y; let dist = Math.hypot(dx, dy);
            if (dist < 260) {
                let force = ((260 - dist) / 1.2) * forceMult; let angle = Math.atan2(dy, dx);
                if (dist > 0) { e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force; }
                e.hp -= pulseDmg; e.flashTicks = 5; spawnDamageText(e.x, e.y, pulseDmg, 'normal');
                if (mod.level === 6) {
                    e.stunTimer = 90; // 1.5s stun
                    createExplosion(e.x, e.y, '#00ffff', 4, 0.4);
                }
            }
        });
    } else if (abilityId === 'overload' || abilityId === 'sobrecarga_armas') {
        if (pObj.qCooldown > 0) return;
        let baseCD = 900;
        pObj.qCooldown = Math.max(180, Math.floor(baseCD * mod.cdMultiplier * (pObj.qCdMod || 1.0)));
        pObj.dashCooldown = 0;
        pObj.pulseCooldown = 0;
        pObj.laserCooldown = 0;
        pObj.qTurboTimer = 240; 
        
        playOverloadSound();
        createExplosion(pObj.x, pObj.y, '#00ffaa', 30, 2);
        showNetworkMessage(`⚡ ¡CÉLULA DE SOBRECARGA ACTIVADA (P${pObj.id})!`, 2000);
    } else if (abilityId === 'turret' || abilityId === 'torreta_desplegable') {
        pObj.isTurret = !pObj.isTurret;
        playTurretToggleSound();
        if (pObj.isTurret) pObj.minigunSpool = 0;
    } else if (abilityId === 'teleport' || abilityId === 'salto_falla') {
        if ((pObj.teleportCooldown || 0) > 0) return;
        let baseCD = 480;
        let blinkCD = Math.max(90, Math.floor(baseCD * mod.cdMultiplier));
        
        let moveX = 0; let moveY = 0;
        if (pObj.inputSource === 'keyboard') {
            if (keys['w'] || keys['arrowup']) moveY = -1;
            if (keys['s'] || keys['arrowdown']) moveY = 1;
            if (keys['a'] || keys['arrowleft']) moveX = -1;
            if (keys['d'] || keys['arrowright']) moveX = 1;
        } else {
            const gamepads = navigator.getGamepads();
            let gp = gamepads[pObj.gamepadIndex];
            if (gp) {
                moveX = gp.axes[0] || 0;
                moveY = gp.axes[1] || 0;
            }
        }
        if (moveX === 0 && moveY === 0) {
            moveX = Math.cos(pObj.angle);
            moveY = Math.sin(pObj.angle);
        }
        let len = Math.hypot(moveX, moveY);
        let dx = (moveX / len) * 220;
        let dy = (moveY / len) * 220;
        
        let oldX = pObj.x;
        let oldY = pObj.y;
        let newX = Math.max(pObj.radius, Math.min(canvas.width - pObj.radius, pObj.x + dx));
        let newY = Math.max(pObj.radius, Math.min(canvas.height - pObj.radius, pObj.y + dy));
        
        createExplosion(oldX, oldY, '#7700ff', 20, 1);
        enemies.forEach(e => {
            let distStart = Math.hypot(e.x - oldX, e.y - oldY);
            let distEnd = Math.hypot(e.x - newX, e.y - newY);
            if (distStart < 100 || distEnd < 100) {
                let dmg = 50 * mod.effectMultiplier * pObj.damageModifier;
                e.hp -= dmg;
                e.flashTicks = 4;
                spawnDamageText(e.x, e.y, Math.floor(dmg), 'normal');
            }
        });
        
        if (mod.level === 6) {
            // Decoy explosion decoy clone
            setTimeout(() => {
                createExplosion(oldX, oldY, '#ff00ff', 50, 2.5);
                enemies.forEach(e => {
                    let dist = Math.hypot(e.x - oldX, e.y - oldY);
                    if (dist < 150) {
                        let dmg = 100 * pObj.damageModifier;
                        e.hp -= dmg; e.flashTicks = 5;
                        spawnDamageText(e.x, e.y, dmg, 'normal');
                    }
                });
                playExplosionSound();
            }, 300);
            showNetworkMessage('🌌 ¡CLON DE EXTRACCIÓN EXPLOSIVA!', 1000);
        }
        
        pObj.x = newX;
        pObj.y = newY;
        pObj.teleportCooldown = blinkCD;
        playPulseSound(); 
        showNetworkMessage(`🌌 ¡TELETRANSPORTE (P${pObj.id})!`, 1000);
    } else {
        // Delegar todas las habilidades restantes al gestor central de habilidades
        if (typeof executeActiveSkill === 'function') {
            executeActiveSkill(abilityId, pObj, slotKey);
        } else {
            // Fallback mínimo si skills.js no cargó
            let baseCD = 300;
            let skillCD = Math.max(60, Math.floor(baseCD * mod.cdMultiplier));
            if (slotKey === 'Shift') pObj.dashCooldown = skillCD;
            else if (slotKey === 'E') pObj.pulseCooldown = skillCD;
            else if (slotKey === 'Q') pObj.qCooldown = skillCD;
            else if (slotKey === 'Space') pObj.pulseCooldown = skillCD;
            playLaserFireSound(1.5); screenShake = 5;
            showNetworkMessage(`⚡ ${COMPONENT_CATALOG[abilityId] ? COMPONENT_CATALOG[abilityId].name.toUpperCase() : abilityId}`, 1000);
        }
    }

    // Efecto Ultra Aspiradora de Datos
    let magnetLevel = getPassiveLevel('passive_magnet');
    if (magnetLevel === 6 && pObj.id === 1) {
        drops.forEach(d => {
            d.x = pObj.x;
            d.y = pObj.y;
        });
        showNetworkMessage('🧲 ¡ASPIRADORA DE DATOS ACTIVADA!', 1200);
    }
}

// === ENTRADA DE TECLADO Y MOUSE ===
window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase(); keys[k] = true;
    if (!gameStarted) return;
    if (k === 'p') { if (!isShopActive && !inCollectionMenu) { togglePause(); } }
    if (isPaused) return;
    if (k === 'm') { players[0].aimMode = players[0].aimMode === 'AUTO' ? 'MANUAL' : 'AUTO'; updateUI(); }
    
    // Mapeo dinámico de habilidades del Nexus
    if (e.key === 'Shift') { triggerAbility('Shift'); } 
    if (k === 'e') { triggerAbility('E'); }
    if (k === 'q') { triggerAbility('Q'); }
    
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (gameStarted && !isPaused) {
            if (waveActive) {
                triggerAbility('Space');
            } else if (enemies.length === 0 && !inCollectionMenu) {
                toggleShop(!isShopActive);
            }
        }
    }
    if (k === 'c') { if (!waveActive && enemies.length === 0) { if (isShopActive) toggleShop(false); toggleCollection(!inCollectionMenu); } }
    if (e.key >= '1' && e.key <= '3') { let idx = parseInt(e.key) - 1; if (players[0].weapons[idx]) players[0].currentWeaponIndex = idx; updateUI(); }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / (rect.width || 1));
    mouse.y = (e.clientY - rect.top) * (canvas.height / (rect.height || 1));
});
window.addEventListener('mousedown', e => {
    if (e.button === 0 && gameStarted && !isPaused) mouse.isDown = true;
    if (e.button === 2 && gameStarted && !isPaused) {
        let p = players[0];
        if ((p.empTimer || 0) === 0 && (p.laserCooldown || 0) <= 0 && !p.isTurret) {
            let specWep = userSave.nexusBuild.specialWeapon || 'laser';
            if (specWep === 'laser') {
                p.isChargingLaser = true;
                p.laserCharge = 0;
            } else if (specWep === 'mortar') {
                fireMortar(p);
            }
        }
    }
});
window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.isDown = false;
    if (e.button === 2) {
        let p = players[0];
        if (p.isChargingLaser) {
            p.isChargingLaser = false;
            fireMegaLaser(p);
        }
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
    if (!gameStarted || isPaused) return;
    let p = players[0];
    if (p.isTurret) return; // Bloquear cambio de arma en modo torreta
    if (e.deltaY < 0) {
        p.currentWeaponIndex = (p.currentWeaponIndex + 1) % p.weapons.length;
    } else {
        p.currentWeaponIndex = (p.currentWeaponIndex - 1 + p.weapons.length) % p.weapons.length;
    }
    updateUI();
});

// === FUNCIONES DE HABILIDADES MOVIDAS A player.js ===

// === SISTEMA DE AUDIO MOVIDO A audio.js ===

// === FUNCIÓN spawnEnemy MOVIDA A enemies.js ===
// === FUNCIÓN spawnEnemy MOVIDA A enemies.js ===










function startWave() {
    waveActive = true; enemiesToSpawn = 10 + (wave * 6); if (wave % 5 === 0) enemiesToSpawn = 15 + (wave * 2);
    
    // Reproducir música normal si no es oleada de jefe
    if (wave % 5 !== 0) {
        playMusic('clockwork_siege.mp3');
    }
    
    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('wave-sync', { wave: wave });
    }
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






function update() {
    if (menuNavCooldown > 0) menuNavCooldown--;
    processGamepadInput();

    // Detectar gamepads para el selector de jugadores en el menú
    if (!gameStarted && typeof updatePlayerSlotUI !== 'undefined') {
        updatePlayerSlotUI();
    }

    if (!gameStarted || isPaused) return;

    // Cooldowns
    players.forEach(p => {
        let cdRate = p.qTurboTimer > 0 ? 3 : 1;
        if (p.dashCooldown > 0) p.dashCooldown -= cdRate; 
        if (p.pulseCooldown > 0) p.pulseCooldown -= cdRate;
        if (p.overdriveTimer > 0) p.overdriveTimer--;
        if (p.flashTicks > 0) p.flashTicks--;
        if (p.damageFlashAlpha > 0) p.damageFlashAlpha -= 0.02;
        if (p.empTimer > 0) p.empTimer--;
        if ((p.invulnTimer || 0) > 0) p.invulnTimer--;
        
        // Cooldowns v0.8.0 / v0.9.0
        if (p.laserCooldown > 0) p.laserCooldown -= cdRate;
        if (p.teleportCooldown > 0) p.teleportCooldown -= cdRate;
        if (p.qCooldown > 0) p.qCooldown--;
        if (p.qTurboTimer > 0) p.qTurboTimer--;
        
        // Cooldowns pasivos y especiales
        if (p.reinicioForzadoCooldown > 0) p.reinicioForzadoCooldown--;
        if (p.postCombustionTimer > 0) p.postCombustionTimer--;
        if (p.invisibleTimer > 0) p.invisibleTimer--;
        
        // HP drain during Weapon Overload (sobrecarga_armas)
        if (p.qTurboTimer > 0) {
            p.hp = Math.max(1, p.hp - 0.15);
        }
        
        if (p.dashCooldown < 0) p.dashCooldown = 0;
        if (p.pulseCooldown < 0) p.pulseCooldown = 0;
        if (p.laserCooldown < 0) p.laserCooldown = 0;
        if (p.teleportCooldown < 0) p.teleportCooldown = 0;
        
        // Avatar de la Guerra: x2 daño y velocidad, x3 max HP temporalmente
        if ((p.avatarGuerraTimer || 0) > 0) {
            p.avatarGuerraTimer--;
            if (!p._avatarApplied) {
                p._avatarApplied = true;
                p.damageModifier *= 2; p.speed *= 1.5;
                if (p.avatarGuerraUltra) { p.invulnTimer = 999; }
            }
        } else if (p._avatarApplied) {
            p._avatarApplied = false;
            p.damageModifier /= 2; p.speed /= 1.5;
            if (p.invulnTimer > 0 && p.avatarGuerraUltra) p.invulnTimer = 0;
        }
        
        // Frenesí Cinético: dash hace x10 daño
        if ((p.frenesiCineticoTimer || 0) > 0) {
            p.frenesiCineticoTimer--;
            if (p.dashTimer > 0) {
                // Daño de embestida a enemigos
                enemies.forEach(e => {
                    let d = Math.hypot(e.x - p.x, e.y - p.y);
                    if (d < p.radius + e.radius + 10) {
                        let dmg = Math.floor(80 * p.damageModifier * (p.frenesiCineticoUltra ? 1.5 : 1));
                        e.hp -= dmg; e.flashTicks = 5;
                        spawnDamageText(e.x, e.y, dmg, 'crit');
                        // Ultra: resetear dash CD al matar
                        if (e.hp <= 0 && p.frenesiCineticoUltra) p.dashCooldown = 0;
                    }
                });
            }
        }
        
        // Transmisor de Energía: aplicar boost de daño activo
        if ((p.transmitterBuff || 0) > 0) {
            p.transmitterBuff--;
            let transmLvl = p.transmitterLvl || 1;
            p.damageModifier = (p._baseDmgMod || 1.0) * (1 + transmLvl * 0.05);
            if (p.transmitterBuff <= 0) {
                p.damageModifier = p._baseDmgMod || 1.0;
            }
        }
        
        // Carga del láser
        if (p.isChargingLaser) {
            p.laserCharge++;
            if (p.laserCharge % 5 === 0) {
                let pitch = 200 + (p.laserCharge / 180) * 800; // Sube de 200Hz a 1000Hz
                playLaserChargeSound(pitch);
            }
        }
        
        // Minigun calor
        let isShooting = p.inputSource === 'keyboard' ? mouse.isDown : p.isShooting;
        if (!isShooting && p.minigunHeat > 0) {
            p.minigunHeat -= 2;
            if (p.minigunHeat < 0) p.minigunHeat = 0;
            p.minigunSpool = 0; // Resetear spool-up si no dispara
        }
        if (p.minigunOverheat) {
            p.minigunCooldown--;
            if (p.minigunCooldown <= 0) {
                p.minigunOverheat = false;
                p.minigunHeat = 0;
            }
        }
        
        // Descarga trasera y Misiles Torreta Ultra (Lv6)
        if (p.isTurret) {
            p.rearDischargeTimer++;
            if (p.rearDischargeTimer >= 90) {
                p.rearDischargeTimer = 0;
                triggerRearDischarge(p);
            }
            let turretLvl = getActiveSkillLevel('torreta_desplegable');
            if (turretLvl === 6) {
                if (!p.turretRocketTimer) p.turretRocketTimer = 0;
                p.turretRocketTimer++;
                if (p.turretRocketTimer >= 180) { // 3s
                    p.turretRocketTimer = 0;
                    fireTurretRockets(p);
                }
            }
        } else {
            p.turretRocketTimer = 0;
        }
    });

    updateHUDCooldownBars(players[0]);
    
    let heatBar = document.getElementById('minigun-heat-bar');
    if (heatBar) {
        heatBar.style.width = `${(players[0].minigunHeat / 300) * 100}%`;
        heatBar.style.background = players[0].minigunOverheat ? '#ff0000' : '#ffaa00';
    }

    // Movimiento
    players.forEach(p => {
        if (p.isDead) return; // No mover jugadores muertos
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== localPlayerId) return; 
        if (p.inputSource === 'keyboard') {
            if (p.dashTimer > 0) {
                p.x += p.dashVx; p.y += p.dashVy; p.dashTimer--;
                createExplosion(p.x, p.y, p.color === '#00ffcc' ? '#00ffff' : '#ff00ff', 2, 0.2);
            } else {
                let mx = 0; let my = 0;
                if (keys['w'] || keys['arrowup']) my = -1; if (keys['s'] || keys['arrowdown']) my = 1;
                if (keys['a'] || keys['arrowleft']) mx = -1; if (keys['d'] || keys['arrowright']) mx = 1;
                // Inversión de controles (Fase 1 del Overlord Apex)
                if (p.controlsInverted) { mx = -mx; my = -my; }
                let currentSpeed = p.speed;
                if (p.vortexPullCount >= 2) currentSpeed /= 2;
                if (p.isChargingLaser) currentSpeed = 1.8;
                if (p.isTurret) currentSpeed = 0;
                
                // Ralentización por zonas Glitch
                let inGlitch = hazards.some(h => h.isGlitchZone && Math.hypot(p.x - h.x, p.y - h.y) < h.radius);
                if (inGlitch) currentSpeed *= 0.45;
                
                if (mx !== 0 || my !== 0) { let l = Math.hypot(mx, my); p.x += (mx / l) * currentSpeed; p.y += (my / l) * currentSpeed; }
            }
        } else if (p.inputSource === 'gamepad') {
            if (p.dashTimer > 0) {
                p.x += p.dashVx; p.y += p.dashVy; p.dashTimer--;
                createExplosion(p.x, p.y, p.id === 1 ? '#00ffff' : '#ff007f', 2, 0.2);
            }
        }

        p.x = Math.max(p.radius, Math.min(canvas.width - p.radius, p.x));
        p.y = Math.max(p.radius, Math.min(canvas.height - p.radius, p.y));

        let targetAngle = p.angle;
        if (p.aimMode === 'AUTO' && enemies.length > 0) {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => {
                if (e.isEMPStalker && !e.isRevealed) return;
                let d = Math.hypot(e.x - p.x, e.y - p.y);
                if (d < minDist) { minDist = d; closest = e; }
            });
            if (closest) {
                targetAngle = Math.atan2(closest.y - p.y, closest.x - p.x);
            } else if (p.inputSource === 'keyboard') {
                targetAngle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
            }
        } else if (p.inputSource === 'keyboard') {
            targetAngle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
        }
        
        let turnSpeed = 0.1;
        if (p.isTurret && p.minigunHeat > 150) {
            turnSpeed = 0.02; // Lento cuando está caliente
        }
        
        let diff = targetAngle - p.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        p.angle += diff * turnSpeed;
    });

    // Disparar
    players.forEach(p => {
        if (p.isDead) return; // No disparar si está muerto
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== localPlayerId) return; 
        if (p.inputSource === 'keyboard' && mouse.isDown) fireWeapon(p);
        else if (p.isShooting) fireWeapon(p);
    });

    // --- REVIVIR CON [R] ---
    players.forEach(deadP => {
        if (!deadP.isDead) return;
        if (!isCoop) return; // Solo en coop
        players.forEach(aliveP => {
            if (aliveP.isDead || aliveP === deadP) return;
            let dist = Math.hypot(aliveP.x - deadP.x, aliveP.y - deadP.y);
            if (dist < 60 && (keys['r'] || aliveP.isReviving)) {
                deadP.reviveTimer = (deadP.reviveTimer || 0) + 1;
                aliveP.isReviving = true;
                if (deadP.reviveTimer >= 180) { // 3 segundos (60fps)
                    revivePlayer(deadP);
                    aliveP.isReviving = false;
                }
            } else {
                deadP.reviveTimer = Math.max(0, (deadP.reviveTimer || 0) - 2);
                aliveP.isReviving = false;
            }
        });
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
                let color = h.isLaserTrail ? '#33ff33' : (Math.random() > 0.4 ? '#ff0055' : '#ff00aa');
                particles.push({ x: h.x + Math.cos(angle) * dist, y: h.y + Math.sin(angle) * dist, vx: (Math.random() - 0.5) * 0.8, vy: -1.2 - Math.random() * 1.5, radius: Math.random() * 4 + 2, color: color, alpha: 0.9, decay: 0.02 });
            }
            if (h.shockwaveRadius > 0 && h.shockwaveRadius < h.radius * 1.3) h.shockwaveRadius += 8;
            
            for (let p of players) {
                if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius && p.dashTimer === 0) { 
                    let dmg = h.isLaserTrail ? 2.5 : 0.6;
                    takeDamage(p, dmg); 
                    screenShake = h.isLaserTrail ? 4 : 2; 
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
        if ((!isOnline || isHost) && enemiesToSpawn === 0 && enemies.length === 0) {
            waveActive = false; wave++;
            // Auto-revivir jugadores caídos al final de oleada con 1 HP
            players.forEach(p => {
                if (p.isDead) {
                    p.isDead = false;
                    p.hp = 1;
                    p.reviveTimer = 0;
                    createExplosion(p.x, p.y, '#00ff88', 20, 1);
                    showNetworkMessage(`➕ J${p.id} revivido al terminar la oleada con 1 HP`, 3000);
                }
            });
            players.forEach(p => p.credits += 60);
            updateUI(); 
            toggleShop(true); 
            hazards = []; 
            airDrops = [];
            if (typeof isOnline !== 'undefined' && isOnline && isHost) {
                sendGameEvent('open-shop', {});
            }
        }
    } else if (enemies.length === 0 && !isShopActive && !inCollectionMenu) {
        // Limpiar drones al terminar oleada
        helperDrones = [];
        if (!isOnline || isHost) {
            startWave();
        }
    }

    // Balas vs Enemigos
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; if (b.type === 'enemy') continue;
        
        if (b.type === 'homing_rocket') {
            if (b.target && b.target.hp > 0 && enemies.includes(b.target)) {
                let dx = b.target.x - b.x;
                let dy = b.target.y - b.y;
                let angle = Math.atan2(dy, dx);
                let speed = 9;
                b.vx = Math.cos(angle) * speed;
                b.vy = Math.sin(angle) * speed;
            } else if (enemies.length > 0) {
                // Find a new target if old one is dead
                let closest = enemies[0];
                let minDist = Math.hypot(enemies[0].x - b.x, enemies[0].y - b.y);
                enemies.forEach(e => {
                    let d = Math.hypot(e.x - b.x, e.y - b.y);
                    if (d < minDist) { minDist = d; closest = e; }
                });
                b.target = closest;
            }
            b.x += b.vx; b.y += b.vy;
        } else if (b.type === 'mortar_shell') {
            let t = 1 - b.duration / 45;
            b.x = b.startX + (b.targetX - b.startX) * t;
            b.y = b.startY + (b.targetY - b.startY) * t - Math.sin(t * Math.PI) * 120;
        } else {
            b.x += b.vx; b.y += b.vy;
        }
        
        if (b.duration !== undefined) {
            b.duration--;
            if (b.duration <= 0) {
                if (b.type === 'mortar_shell') {
                    triggerMortarExplosion(b.targetX, b.targetY, b.damage);
                }
                bullets.splice(i, 1); 
                continue; 
            }
        }
        
        // Balística de Rebote (passive_bounce): SOLO rebotar si tiene cargas
        let outOfBounds = b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height;
        if (outOfBounds) {
            if ((b.bounceLvl || 0) > 0) {
                // Clampear posición e invertir velocidad
                if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
                else if (b.x > canvas.width) { b.x = canvas.width; b.vx = -Math.abs(b.vx); }
                if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
                else if (b.y > canvas.height) { b.y = canvas.height; b.vy = -Math.abs(b.vy); }
                
                // Ultra Fragmentación (Lv6): primer rebote genera 2 sub-proyectiles
                if (b.bounceLvl >= 6 && !b._hasSplit) {
                    b._hasSplit = true;
                    for (let sp = 0; sp < 2; sp++) {
                        let sAngle = Math.atan2(b.vy, b.vx) + (sp === 0 ? 0.4 : -0.4);
                        bullets.push({
                            x: b.x, y: b.y,
                            vx: Math.cos(sAngle) * Math.hypot(b.vx, b.vy) * 0.8,
                            vy: Math.sin(sAngle) * Math.hypot(b.vx, b.vy) * 0.8,
                            radius: (b.radius * 0.6) | 0,
                            color: '#ffaa00', damage: b.damage * 0.5, type: 'single',
                            bounceLvl: 0, burnLvl: b.burnLvl || 0
                        });
                    }
                    createExplosion(b.x, b.y, '#ffaa00', 5, 0.6);
                }
                b.bounceLvl--;
            } else {
                // Sin rebotes: eliminar bala normalmente
                bullets.splice(i, 1); continue;
            }
        }

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j]; 

            // Daño a pilares de la Jaula de Vectores (Fase 0 del Overlord)
            if (e.isOverlordApex && e.bossPhase === 0 && e.olPillarsSpawned && e.olPillarPositions) {
                let hitPillar = false;
                for (let pi = 0; pi < 4; pi++) {
                    if (!e.olPillarAlive[pi]) continue;
                    let pp = e.olPillarPositions[pi];
                    let pillarDist = Math.hypot(b.x - pp.x, b.y - pp.y);
                    if (pillarDist < 22 + b.radius) {
                        let pillarDmg = b.damage * 0.5;
                        damageOverlordPillar(e, pi, pillarDmg);
                        spawnDamageText(pp.x, pp.y, Math.floor(pillarDmg), 'normal');
                        bullets.splice(i, 1);
                        hitPillar = true;
                        break;
                    }
                }
                if (hitPillar) break;
            }
            
            if (!b.hitEnemies) b.hitEnemies = [];
            if (b.hitEnemies.includes(e.id)) continue; // No golpear al mismo enemigo dos veces
            
            let dist = Math.hypot(b.x - e.x, b.y - e.y);
            
            // Colisión con escudos de Binary Aegis
            if (e.isBinaryAegis) {
                let angleToBullet = Math.atan2(b.y - e.y, b.x - e.x);
                let diff1 = Math.atan2(Math.sin(angleToBullet - e.shieldAngle), Math.cos(angleToBullet - e.shieldAngle));
                let diff2 = Math.atan2(Math.sin(angleToBullet - (e.shieldAngle + Math.PI)), Math.cos(angleToBullet - (e.shieldAngle + Math.PI)));
                
                if ((Math.abs(diff1) < Math.PI / 3 || Math.abs(diff2) < Math.PI / 3) && dist < e.radius + 20 && dist > e.radius - 5) {
                    bullets.splice(i, 1);
                    createExplosion(b.x, b.y, '#00ffff', 5, 0.5);
                    break; // Bala destruida, pasar a la siguiente
                }
            }
            
            if (dist < b.radius + e.radius) {
                if (e.isBoss && e.bossInvulnTimer > 0) { createExplosion(b.x, b.y, '#ffffff', 5, 0.8); bullets.splice(i, 1); break; }

                // Inmunidad Fase 0 (Jaula de Vectores) del Overlord Apex
                if (e.isOverlordApex && e.bossPhase === 0) {
                    let pillarsAlive = e.olPillarAlive ? e.olPillarAlive.filter(a => a).length : 0;
                    if (!e.olPillarsSpawned || pillarsAlive > 0) {
                        createExplosion(b.x, b.y, '#d4af37', 6, 0.8);
                        bullets.splice(i, 1);
                        break;
                    }
                }

                if (b.isStunning) {
                    e.stunTimer = 30;
                }

                // Inmunidad Fase 2 del Overlord Apex: solo el Mega-Láser Crítico puede dañarlo
                if (e.isOverlordApex && e.olPhase2Immune) {
                    if (b.type !== 'laser_heavy') {
                        createExplosion(b.x, b.y, '#d4af37', 4, 0.6);
                        bullets.splice(i, 1); break;
                    }
                }



                // Enlace Cuántico del Singularity Sentinel: redirigir daño
                if (e.isSingularitySentinel === false && typeof checkSentinelLinkRedirect !== 'undefined') {
                    let redirected = checkSentinelLinkRedirect(e, b.damage);
                    if (redirected) {
                        createExplosion(b.x, b.y, '#ffff00', 5, 0.7);
                        bullets.splice(i, 1); break;
                    }
                }

                // Inmunidad frontal de Vector Supreme en Fase 1 (Matriz)
                if (e.isVectorSupreme && e.bossPhase === 1) {
                    let angleToB = Math.atan2(b.y - e.y, b.x - e.x);
                    let diff = angleToB - e.matrixAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    if (Math.abs(diff) < Math.PI / 9.0) { // ±20° frontal bloqueado (era ±28.5°)
                        createExplosion(b.x, b.y, '#00aaff', 5, 0.8);
                        e.shieldFlashTicks = 8;
                        bullets.splice(i, 1); break;
                    }
                }
                if (e.isShielded && b.type !== 'plasma') {
                    let angleToBullet = Math.atan2(b.y - e.y, b.x - e.x); let diff = Math.abs(angleToBullet - e.angle);
                    if (diff < 0.6 || diff > Math.PI * 2 - 0.6) { createExplosion(b.x, b.y, '#0088ff', 3, 0.4); bullets.splice(i, 1); break; }
                }

                if (b.type === 'plasma') {
                    createExplosion(b.x, b.y, '#ffff00', 25, 1.3);
                    for (let k = enemies.length - 1; k >= 0; k--) {
                        let targetEn = enemies[k]; let dAoE = Math.hypot(b.x - targetEn.x, b.y - targetEn.y);
                        if (dAoE <= b.radiusAoE && !(targetEn.isBoss && targetEn.bossInvulnTimer > 0)) {
                            let dmg = b.damage * (1 - dAoE / b.radiusAoE);
                            let damageTaken = Math.max(1, dmg - (targetEn.armor || 0));
                            targetEn.hp -= damageTaken; targetEn.flashTicks = 4; spawnDamageText(targetEn.x, targetEn.y, damageTaken, 'normal');
                        }
                    }
                } else {
                    // --- MODIFICADORES DE PASIVOS ---
                    // Crítico base (15%) + Analizador de Debilidades
                    let critLvl = b.critDmgLvl || 0;
                    let critChance = 0.15 + critLvl * 0.03;
                    let isCrit = Math.random() < critChance;
                    let critMult = isCrit ? (1.8 + critLvl * 0.1) : 1.0;
                    let finalDmg = b.damage * critMult;

                    // Punto de Quiebre (Lv6): ejecutar enemigos < 15% HP
                    if (critLvl === 6 && isCrit && e.hp < e.maxHp * 0.15 && !e.isBoss) {
                        finalDmg = e.hp + 9999;
                        spawnDamageText(e.x, e.y, 'EJECUCIÓN', 'crit');
                    }
                    
                    // Daño porcentual por vida máxima a jefes con láser
                    if (e.isBoss && (b.type === 'laser_medium' || b.type === 'laser_heavy')) {
                        let pct = b.type === 'laser_heavy' ? 0.05 : 0.02; // 5% o 2% por impacto
                        finalDmg += Math.floor(e.maxHp * pct);
                    }

                    // Venganza de Código: +2% daño por cada 1% HP perdido
                    if (players[0] && getPassiveLevel('passive_code_vengeance') > 0) {
                        let vengeanceLvl = getPassiveLevel('passive_code_vengeance');
                        let hpPct = (players[0].maxHp - players[0].hp) / players[0].maxHp;
                        finalDmg *= (1 + hpPct * 2.0 * (vengeanceLvl / 6));
                        // Ultra: crítico garantizado y atraviesa armadura
                        if (vengeanceLvl === 6 && players[0].hp <= 1) {
                            isCrit = true; finalDmg *= 2; e.armor = 0;
                        }
                    }

                    let damageTaken = Math.max(1, finalDmg - (e.armor || 0));
                    e.hp -= damageTaken; e.flashTicks = 4;
                    // Contraataque de espejo para los fragmentos de Vector
                    if (e.isVectorFragment && typeof triggerFragmentMirrorAttack === 'function') {
                        triggerFragmentMirrorAttack(e);
                    }
                    createExplosion(b.x, b.y, b.color, 3, 0.5);
                    spawnDamageText(e.x, e.y, Math.floor(damageTaken), isCrit ? 'crit' : 'normal');
                    playHitSound();

                    // --- QUEMADURA (Munición Incendiaria) ---
                    if ((b.burnLvl || 0) > 0) {
                        let burnChance = b.burnLvl * 0.08;
                        if (Math.random() < burnChance) {
                            e.burnTimer = 180;
                            e.burnDmg = b.burnLvl * 2;
                            e.isBurning = true;
                            createExplosion(e.x, e.y, '#ff4400', 4, 0.6);
                        }
                    }

                    // --- KNOCKBACK EXTRA (Condensador de Pulso) ---
                    if ((b.knockLvl || 0) > 0) {
                        let kforce = 4 + b.knockLvl * 1.5;
                        let ka = Math.atan2(e.y - b.y, e.x - b.x);
                        e.x += Math.cos(ka) * kforce;
                        e.y += Math.sin(ka) * kforce;
                        // Ultra (Lv6): daño extra si colisiona con el borde
                        if (b.knockLvl === 6) {
                            if (e.x < e.radius || e.x > canvas.width - e.radius || e.y < e.radius || e.y > canvas.height - e.radius) {
                                e.hp -= Math.floor(damageTaken * 0.5);
                                spawnDamageText(e.x, e.y, '¡IMPACTO!', 'crit');
                            }
                            e.x = Math.max(e.radius, Math.min(canvas.width - e.radius, e.x));
                            e.y = Math.max(e.radius, Math.min(canvas.height - e.radius, e.y));
                        }
                    }

                    // --- SINGULARIDAD (Núcleo de Singularidad) ---
                    if ((b.singularityLvl || 0) > 0) {
                        enemies.forEach(other => {
                            if (other !== e) {
                                let sdx = b.x - other.x; let sdy = b.y - other.y;
                                let sdist = Math.hypot(sdx, sdy);
                                if (sdist < 120 && sdist > 0) {
                                    let sf = 1.5 * b.singularityLvl;
                                    other.x += (sdx / sdist) * sf;
                                    other.y += (sdy / sdist) * sf;
                                }
                            }
                        });
                    }

                    // --- ROBO DE VIDA (Sifón de Vida) ---
                    let lifestealLvl = getPassiveLevel('passive_lifesteal');
                    if (lifestealLvl > 0 && players[0]) {
                        let stolen = damageTaken * 0.005 * lifestealLvl;
                        if (stolen >= 1) {
                            players[0].hp = Math.min(players[0].maxHp, players[0].hp + stolen);
                            // Ultra: curar al aliado con menos HP
                            if (lifestealLvl === 6 && isCoop && players.length > 1) {
                                let weakest = players.reduce((a, b) => (!b.isDead && b.hp < a.hp) ? b : a, players[0]);
                                if (weakest !== players[0]) weakest.hp = Math.min(weakest.maxHp, weakest.hp + stolen);
                            }
                        }
                    }
                }
                if (e.isBoss && e.hp <= e.maxHp * 0.5 && e.bossPhase === 0) { e.bossPhase = 1; e.bossInvulnTimer = 150; createExplosion(e.x, e.y, '#ffff00', 40, 2); }
                
                if (b.type === 'laser_medium' || b.type === 'laser_heavy') {
                    b.hitEnemies.push(e.id); // Registrar golpe
                } else {
                    bullets.splice(i, 1); 
                    break;
                }
            }
        }
    }

    // Actualizar IA de Enemigos
    players.forEach(p => p.vortexPullCount = 0);
    updateEnemies();
    // Actualizar barra de vida del jefe en HUD (si existe)
    let boss = enemies.find(e => e.isVectorSupreme || e.isCoreGuardian || e.isOverlordApex);
    let frags = enemies.filter(e => e.isVectorFragment);
    let hpFill = document.getElementById('boss-hp-fill');
    let hpCont = document.getElementById('boss-hp-container');
    
    if ((boss || frags.length > 0) && hpFill && hpCont) {
        if (hpCont.style.display !== 'block') {
            hpCont.style.display = 'block';
            let label = hpCont.querySelector('.boss-hp-label');
            if (label) {
                label.innerText = boss ? (boss.isCoreGuardian ? 'GUARDIÁN DEL NÚCLEO' : boss.isOverlordApex ? 'OVERLORD APEX' : 'VECTOR SUPREMO') : 'VECTOR SUPREMO — FRAGMENTOS';
            }
        }
        
        let pct = 0;
        if (boss) {
            pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
        } else {
            // Si solo quedan los fragmentos, sumamos su HP actual y lo comparamos con su HP máximo combinado
            let currentFragsHp = frags.reduce((sum, f) => sum + f.hp, 0);
            let totalMaxHp = frags.reduce((sum, f) => sum + f.maxHp, 0);
            // Queremos que empiece exactamente en 30% y baje suavemente a 0%
            pct = Math.max(0, 30 * (currentFragsHp / (totalMaxHp || 1)));
            
            let label = hpCont.querySelector('.boss-hp-label');
            if (label && label.innerText !== 'VECTOR SUPREMO — FRAGMENTOS') {
                label.innerText = 'VECTOR SUPREMO — FRAGMENTOS';
            }
        }
        hpFill.style.width = `${pct}%`;
    } else if (!boss && frags.length === 0 && hpCont) {
        if (hpCont.style.display !== 'none') hpCont.style.display = 'none';
    }
    // Balas enemigas vs Jugadores
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; if (b.type !== 'enemy') continue;
        b.x += b.vx; b.y += b.vy; if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { bullets.splice(i, 1); continue; }
        
        // Estela de partículas moradas para las balas del fragmento Blaster de Vector
        if (b.isPurpleBlasterBullet && Math.random() < 0.35) {
            particles.push({
                x: b.x, y: b.y,
                vx: -b.vx * 0.15 + (Math.random() - 0.5) * 0.5,
                vy: -b.vy * 0.15 + (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                color: '#cc00ff', alpha: 0.8, decay: 0.05
            });
        }
        
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

    if (!isOnline || isHost) {
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

            let magRange = nearestP.magnetRange || 150;
            if (dist < magRange && dist > 0) { d.x += ((nearestP.x - d.x) / dist) * 6.5; d.y += ((nearestP.y - d.y) / dist) * 6.5; }
            if (dist < nearestP.radius + d.radius) {
                // Sincronizar ganancia de créditos, XP y materiales para todos los jugadores activos
                players.forEach(p => {
                    p.credits += d.credits;
                    p.xp += Math.round(d.xp * xpMultiplier);
                    if (d.matType) {
                        let pSave = getPlayerSave(p);
                        if (pSave && pSave.materials) {
                            pSave.materials[d.matType]++;
                        }
                    }
                    if (p.xp >= p.nextXp) {
                        p.level++; p.xp -= p.nextXp; p.nextXp = Math.floor(p.nextXp * 1.45);
                        createExplosion(p.x, p.y, p.color || '#00ffcc', 35, 1.8);
                        showLevelUpMenu(p);
                    }
                });
                if (d.matType) saveGame();
                drops.splice(i, 1); updateUI();
                
                // Enviar sincronización de stats al Cliente
                if (typeof isOnline !== 'undefined' && isOnline && isHost) {
                    let allStats = {};
                    players.forEach(p => {
                        allStats[`p${p.id}`] = {
                            xp: p.xp,
                            level: p.level,
                            credits: p.credits,
                            nextXp: p.nextXp
                        };
                    });
                    sendGameEvent('sync-stats', allStats);
                }
            }
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
    updateDynamicEvents();

    // === ACTUALIZAR DRONES ALIADOS ===
    updateHelperDrones();
    
    // === ACTUALIZAR HABILIDADES ACTIVAS Y PASIVOS ===
    if (typeof updateSkillsAndPassives === 'function' && gameStarted && !isPaused) {
        players.forEach(p => { if (!p.isDead) updateSkillsAndPassives(p); });
        
        // Quemadura activa en enemigos
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            if (e.isBurning && (e.burnTimer || 0) > 0) {
                e.burnTimer--;
                if (e.burnTimer % 30 === 0) { // Tick cada 0.5s
                    e.hp -= (e.burnDmg || 2);
                    e.flashTicks = 3;
                    spawnDamageText(e.x, e.y, `🔥${e.burnDmg}`, 'normal');
                    // Ultra Ignición en Cadena: al morir por quemadura, explotar en fuego
                    if (e.hp <= 0 && getPassiveLevel('passive_burn') === 6) {
                        createExplosion(e.x, e.y, '#ff4400', 20, 1.5);
                        enemies.forEach(other => {
                            if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 100) {
                                other.isBurning = true; other.burnTimer = 90; other.burnDmg = (e.burnDmg || 2);
                            }
                        });
                    }
                }
                if (e.burnTimer <= 0) { e.isBurning = false; }
            }
            // Congelado: reducir velocidad
            if (e.isFrozen && (e.stunTimer || 0) > 0) {
                if (e.frozenDmgAmp) e.frozenDmgAmpActive = true;
            } else if (e.frozenDmgAmpActive && (e.stunTimer || 0) <= 0) {
                e.frozenDmgAmpActive = false;
            }
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

    // === DIBUJAR CUADRÍCULA (CON SOPORTE PARA GLITCH DE FRAGMENTOS) ===
    let hasVectorFragments = enemies.some(e => e.isVectorFragment);
    if (hasVectorFragments) {
        let isGlitching = Math.random() < 0.22;
        ctx.strokeStyle = isGlitching ? 'rgba(255, 0, 127, 0.05)' : 'rgba(0, 255, 204, 0.015)';
        ctx.lineWidth = isGlitching ? 1.5 : 1;
        let shift = isGlitching ? (Math.random() - 0.5) * 8 : 0;
        
        for (let x = 0; x < canvas.width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x + shift, 0);
            ctx.lineTo(x + shift, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y + shift);
            ctx.lineTo(canvas.width, y + shift);
            ctx.stroke();
        }
        
        // Tinte de fondo glitch muy sutil ocasional
        if (Math.random() < 0.02) {
            ctx.fillStyle = 'rgba(255, 0, 127, 0.03)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.025)'; ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (let y = 0; y < canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    // === RENDERIZAR EVENTOS DINÁMICOS ===
    drawDynamicEvents();

    // === RENDERIZAR DRONES ALIADOS ===
    drawHelperDrones();

    // === RENDERIZAR OVERLORD APEX: PILARES Y MURO LÁSER ===
    let overlordBoss = enemies.find(e => e.isOverlordApex);
    if (overlordBoss) {
        if (typeof drawOverlordPillars !== 'undefined') drawOverlordPillars(overlordBoss, ctx);
        if (typeof drawOverlordWall !== 'undefined') drawOverlordWall(overlordBoss, ctx);
    }

    // === TINTE ÁMBAR DE INVERSIÓN MAGNÉTICA ===
    if (players[0] && players[0].controlsInverted) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 140, 0, 0.07)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }


    hazards.forEach(h => {
        if (!h.active) {
            ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.15 + Math.sin(Date.now() * 0.01) * 0.08})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.stroke();
            let scanProgress = h.timer / h.maxTimer; ctx.beginPath(); ctx.arc(h.x, h.y, h.radius * scanProgress, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        } else {
            ctx.save();
            if (h.isGlitchZone) {
                // Dibujar zona Glitch: Rejilla distorsionada, color rosa/morado glitch
                let grad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.radius);
                grad.addColorStop(0, 'rgba(255, 0, 127, 0.25)');
                grad.addColorStop(0.7, 'rgba(127, 0, 255, 0.12)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
                
                // Anillos de glitch distorsionados
                ctx.strokeStyle = `rgba(255, 0, 127, ${0.35 + Math.sin(Date.now() * 0.03) * 0.15})`;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 12]);
                ctx.stroke();
                
                // Línea de borde del glitch
                ctx.beginPath();
                ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.2)';
                ctx.lineWidth = 1.0;
                ctx.setLineDash([]);
                ctx.stroke();
            } else {
                let gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.radius);
                gradient.addColorStop(0, 'rgba(255, 0, 85, 0.25)'); gradient.addColorStop(0.7, 'rgba(255, 0, 60, 0.12)'); gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
                ctx.beginPath(); ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
                ctx.strokeStyle = `rgba(255, 0, 85, ${0.4 + Math.random() * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
                if (h.shockwaveRadius > 0 && h.shockwaveRadius < h.radius * 1.3) {
                    ctx.beginPath(); ctx.arc(h.x, h.y, h.shockwaveRadius, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (h.shockwaveRadius / (h.radius * 1.3))})`; ctx.lineWidth = 3; ctx.stroke();
                }
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

    bullets.forEach(b => {
        ctx.save();
        
        if (b.type === 'laser_thin' || b.type === 'laser_medium' || b.type === 'laser_heavy') {
            ctx.beginPath();
            let length = b.type === 'laser_heavy' ? 120 : (b.type === 'laser_medium' ? 60 : 30);
            let angle = Math.atan2(b.vy, b.vx);
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - Math.cos(angle) * length, b.y - Math.sin(angle) * length);
            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.radius * 2;
            ctx.lineCap = 'round';
            ctx.shadowBlur = b.type === 'laser_heavy' ? 25 : 15;
            ctx.shadowColor = b.color;
            ctx.stroke();
        } else if (b.isSquare) {
            // Proyectil cuadrado (Fase 1 Vector Supreme)
            let angle = Math.atan2(b.vy, b.vx);
            ctx.translate(b.x, b.y);
            ctx.rotate(angle);
            ctx.shadowBlur = 10; ctx.shadowColor = b.color;
            ctx.fillStyle = b.color;
            ctx.fillRect(-b.radius, -b.radius, b.radius * 2, b.radius * 2);
        } else if (b.type === 'mortar_shell') {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffaa00';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff6600';
            ctx.fill();
            
            // Retícula de impacto en el suelo
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.arc(b.targetX, b.targetY, 20, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 100, 0, ${0.4 + Math.sin(Date.now() * 0.015) * 0.25})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(b.targetX - 8, b.targetY); ctx.lineTo(b.targetX + 8, b.targetY);
            ctx.moveTo(b.targetX, b.targetY - 8); ctx.lineTo(b.targetX, b.targetY + 8);
            ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
        }
        
        ctx.restore();
    });
    particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); ctx.restore(); });

    // === DIBUJAR VÍNCULO DE PLASMA DE FRAGMENTOS VECTOR (FASE 3) ===
    let fragsVector = enemies.filter(x => x.isVectorFragment && x.hp > 0);
    if (fragsVector.length > 1) {
        ctx.save();
        for (let k = 0; k < fragsVector.length; k++) {
            let f1 = fragsVector[k];
            let f2 = fragsVector[(k + 1) % fragsVector.length];
            
            // Si alguno está aturdido o preparándose, el vínculo de daño se desactiva
            if (f1.stunTimer > 0 || f2.stunTimer > 0 || f1.convState === 'PREPARE' || f2.convState === 'PREPARE') {
                // Dibujar líneas de telegrafía guía hacia el jugador en fase de carga
                if (f1.convState === 'PREPARE' && f1.isCharging) {
                    ctx.beginPath();
                    ctx.moveTo(f1.x, f1.y);
                    let targetP = players[0];
                    ctx.lineTo(targetP.x, targetP.y);
                    ctx.strokeStyle = 'rgba(255, 0, 51, 0.45)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 6]);
                    ctx.stroke();
                }
                continue;
            }
            
            // Haz de plasma exterior (gloria carmesí translúcida)
            ctx.beginPath();
            ctx.moveTo(f1.x, f1.y);
            ctx.lineTo(f2.x, f2.y);
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
            ctx.lineWidth = 6 + Math.sin(Date.now() * 0.05) * 2;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ff0033';
            ctx.stroke();
            
            // Haz de plasma interior (núcleo blanco filoso)
            ctx.beginPath();
            ctx.moveTo(f1.x, f1.y);
            ctx.lineTo(f2.x, f2.y);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.shadowBlur = 0;
            ctx.stroke();
        }
        ctx.restore();
    }

    enemies.forEach(e => {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle); ctx.beginPath();
        let skipDefaultFill = false;
        if (e.isCoreGuardian) {
            skipDefaultFill = true;
            // Dibujar el Núcleo del Guardián (Estética Premium)
            ctx.shadowBlur = 25;
            ctx.shadowColor = e.color;
            
            // 1. Núcleo central
            ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = e.flashTicks > 0 ? '#fff' : e.color;
            ctx.fill();
            
            // 2. Anillo de energía interno
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 3. Paneles orbitales de escudo
            let numPanels = 4;
            let rotSpeed = e.bossPhase === 0 ? 0.025 : (e.bossPhase === 1 ? 0.05 : 0.09);
            e.drawRotAngle = (e.drawRotAngle || 0) + rotSpeed;
            
            for (let k = 0; k < numPanels; k++) {
                let angle = e.drawRotAngle + (k * Math.PI * 2 / numPanels);
                ctx.beginPath();
                ctx.arc(0, 0, e.radius * 0.9, angle - 0.35, angle + 0.35);
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 5;
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * (e.radius * 0.4), Math.sin(angle) * (e.radius * 0.4));
                ctx.lineTo(Math.cos(angle) * (e.radius * 0.9), Math.sin(angle) * (e.radius * 0.9));
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        else if (e.isVectorSupreme) {
            skipDefaultFill = true;
            // Dibujar Vector Supremo (Geometría Compleja y Futurista)
            ctx.shadowBlur = 30;
            ctx.shadowColor = e.color;
            
            // Cuerpo principal (Rombo/Octágono Geométrico)
            ctx.moveTo(0, -e.radius);
            ctx.lineTo(e.radius * 0.3, -e.radius * 0.3);
            ctx.lineTo(e.radius, 0);
            ctx.lineTo(e.radius * 0.3, e.radius * 0.3);
            ctx.lineTo(0, e.radius);
            ctx.lineTo(-e.radius * 0.3, e.radius * 0.3);
            ctx.lineTo(-e.radius, 0);
            ctx.lineTo(-e.radius * 0.3, -e.radius * 0.3);
            ctx.lineTo(0, -e.radius);
            ctx.fillStyle = e.flashTicks > 0 ? '#fff' : e.color;
            ctx.fill();
            
            // Rombo interno oscuro para dar profundidad
            ctx.beginPath();
            ctx.moveTo(0, -e.radius * 0.55);
            ctx.lineTo(e.radius * 0.55, 0);
            ctx.lineTo(0, e.radius * 0.55);
            ctx.lineTo(-e.radius * 0.55, 0);
            ctx.closePath();
            ctx.fillStyle = '#060112';
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 2.5;
            ctx.fill();
            ctx.stroke();

            // Ojo de seguimiento digital (apunta al jugador) con ciclo de parpadeo
            let relAngle = (e.matrixAngle || 0) - e.angle;
            let pupilDist = e.bossPhase === 1 ? 10 : 4; // Mira más intensamente en fase estática
            let pupilX = Math.cos(relAngle) * pupilDist;
            let pupilY = Math.sin(relAngle) * pupilDist;
            
            // Parpadear por 250ms cada 4.5 segundos
            let blinkCycle = Date.now() % 4500;
            let isBlinking = blinkCycle > 4250;
            
            // Brillo de fondo del ojo
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
            ctx.fill();
            
            if (isBlinking) {
                // Dibujar ojo cerrado como una ranura horizontal cian brillante
                ctx.beginPath();
                ctx.moveTo(pupilX - 7, pupilY);
                ctx.lineTo(pupilX + 7, pupilY);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#00ffff';
                ctx.stroke();
            } else {
                // Pupila/Núcleo cibernético
                let pulse = 1.0 + Math.sin(Date.now() * 0.015) * 0.2;
                ctx.beginPath();
                ctx.arc(pupilX, pupilY, 6 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00ffff';
                ctx.fill();
                
                // Destello blanco central
                ctx.beginPath();
                ctx.arc(pupilX, pupilY, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            // Anillos holográficos orbitales
            e.drawRotAngle = (e.drawRotAngle || 0) + 0.03;
            
            // Hexágono holográfico en rotación inversa
            ctx.save();
            ctx.rotate(-e.drawRotAngle * 1.4);
            ctx.beginPath();
            for (let side = 0; side < 6; side++) {
                let angle = (side * Math.PI) / 3;
                let rx = Math.cos(angle) * (e.radius * 0.85);
                let ry = Math.sin(angle) * (e.radius * 0.85);
                if (side === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            // Arcos exteriores giratorios
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 1.25, e.drawRotAngle, e.drawRotAngle + Math.PI * 0.5);
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 1.25, e.drawRotAngle + Math.PI, e.drawRotAngle + Math.PI + Math.PI * 0.5);
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        else if (e.isOverlordApex) {
            skipDefaultFill = true;
            let frame = e.olTimer || 0;
            let phase = e.bossPhase + 1; // 1, 2, o 3
            
            // Paletas de color del rediseño visual
            const THEMES = {
                1: { core: "#ffffff", primary: "#6600ff", secondary: "#330088" }, // Morado calculador
                2: { core: "#ffffff", primary: "#ff0033", secondary: "#880011" }, // Rojo furia
                3: { core: "#ffffff", primary: "#ff0000", secondary: "#ffffff" }  // Contraste apocalíptico
            };
            const t = THEMES[phase] || THEMES[1];
            
            // Funciones de dibujo internas
            function drawPolyRing(radius, sides, angleOffset, color, dash) {
                ctx.save();
                ctx.rotate(angleOffset);
                ctx.strokeStyle = color;
                ctx.lineWidth = phase === 3 ? 4.5 : 2.5;
                ctx.shadowBlur = 18;
                ctx.shadowColor = color;
                if (dash) ctx.setLineDash([15, 10]);

                ctx.beginPath();
                for (let i = 0; i <= sides; i++) {
                    const theta = (i * 2 * Math.PI) / sides;
                    const glitch = phase === 3 ? (Math.random() - 0.5) * 16 : 0;
                    const px = Math.cos(theta) * (radius + glitch);
                    const py = Math.sin(theta) * (radius + glitch);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                ctx.restore();
            }

            function drawAggressiveLightning(startX, startY, endX, endY, color, width) {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = width + Math.random() * 2;
                ctx.shadowBlur = 15;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                let currX = startX, currY = startY;
                const segments = 8;
                for (let i = 1; i <= segments; i++) {
                    currX += (endX - startX) / segments + (Math.random() - 0.5) * 35;
                    currY += (endY - startY) / segments + (Math.random() - 0.5) * 35;
                    ctx.lineTo(currX, currY);
                }
                ctx.stroke();
                ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
                ctx.restore();
            }

            function drawDeathBeam(angle) {
                ctx.save();
                ctx.rotate(angle);
                const length = Math.max(canvas.width, canvas.height) * 1.5;

                // Aura exterior
                ctx.shadowBlur = 30;
                ctx.shadowColor = THEMES[3].primary;
                ctx.fillStyle = "rgba(255, 0, 0, 0.25)";
                ctx.fillRect(0, -15, length, 30);

                // Cuerpo rojo
                ctx.fillStyle = THEMES[3].primary;
                ctx.fillRect(0, -4, length, 8);

                // Aguja blanca letal
                ctx.fillStyle = "#ffffff";
                ctx.shadowBlur = 10;
                ctx.fillRect(0, -1, length, 2);

                // Rayos gruesos alrededor del haz
                if (Math.random() > 0.55) {
                    drawAggressiveLightning(0, 0, length * 0.8, (Math.random() - 0.5) * 80, THEMES[3].primary, 4);
                }
                ctx.restore();
            }

            // --- RENDERIZADO DEL CUERPO DEL BOSS ---
            
            // Partículas desde el núcleo (se añaden a la lista global)
            if (phase > 1 && frame % (phase === 2 ? 3 : 1) === 0 && typeof particles !== 'undefined') {
                const pColor = Math.random() > 0.5 ? t.primary : t.core;
                const pAngle = Math.random() * Math.PI * 2;
                const pSpeed = (Math.random() * 6 + 3) * phase;
                particles.push({
                    x: e.x,
                    y: e.y,
                    vx: Math.cos(pAngle) * pSpeed,
                    vy: Math.sin(pAngle) * pSpeed,
                    radius: Math.random() * 3 + 1.5,
                    color: pColor,
                    alpha: 1.0,
                    decay: 0.025
                });
            }

            // Efectos de Fase 3 (Rayos de Aniquilación Scissor Lasers)
            if (phase === 3) {
                const sweepAngle = Math.sin(frame * 0.02) * Math.PI;
                drawDeathBeam(sweepAngle + Math.PI / 2);
                drawDeathBeam(-sweepAngle + Math.PI / 2);

                if (frame % 2 === 0) {
                    drawAggressiveLightning(0, 0, (Math.random() - 0.5) * 600, (Math.random() - 0.5) * 600, t.primary, 6);
                }
            }

            // Efectos de Fase 2 (Inestabilidad)
            if (phase === 2) {
                if (frame % 6 === 0) {
                    drawAggressiveLightning(0, 0, (Math.random() - 0.5) * 220, (Math.random() - 0.5) * 220, t.primary, 3);
                }
            }

            // Anillos protectores (Geometría del Boss)
            const pulse = Math.sin(frame * 0.05) * 8;
            // Anillo exterior
            drawPolyRing(110 + pulse, 6, frame * (phase * 0.008), t.secondary, true);
            // Anillo medio (gira al revés)
            drawPolyRing(75 - pulse, 8, -frame * (phase * 0.015), t.primary, false);
            // Anillo interior (caótico en fase 3)
            drawPolyRing(38, phase === 3 ? 3 : 4, frame * (phase * 0.04), t.core, false);

            // NÚCLEO (El "Ojo")
            ctx.beginPath();
            const coreRadius = phase === 3 ? 24 + Math.random() * 8 : 18 + pulse * 0.4;
            ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
            ctx.fillStyle = t.core;
            ctx.shadowBlur = 40;
            ctx.shadowColor = t.primary;
            ctx.fill();

            // Pupila/Iris (Se rasga en fase 2 y 3)
            ctx.beginPath();
            ctx.fillStyle = "#000000";
            ctx.shadowBlur = 0;
            if (phase > 1) {
                const slitHeight = 30 + Math.random() * 8;
                ctx.ellipse(0, 0, 4, slitHeight, 0, 0, Math.PI * 2);
            } else {
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
            }
            ctx.fill();

            // Escudo dorado de Fase 0 si hay pilares vivos
            if (phase === 1) {
                let pillarsAlive = e.olPillarAlive ? e.olPillarAlive.filter(a => a).length : 0;
                if (!e.olPillarsSpawned || pillarsAlive > 0) {
                    ctx.save();
                    ctx.beginPath();
                    let shieldRot = (Date.now() * 0.002) % (Math.PI * 2);
                    for (let i = 0; i < 6; i++) {
                        let a = (i * Math.PI / 3) + shieldRot;
                        let sx = Math.cos(a) * (135);
                        let sy = Math.sin(a) * (135);
                        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = '#d4af37';
                    ctx.lineWidth = 3 + Math.sin(Date.now() * 0.01) * 1.5;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#d4af37';
                    ctx.stroke();
                    ctx.fillStyle = `rgba(212, 175, 55, ${0.06 + Math.sin(Date.now() * 0.005) * 0.04})`;
                    ctx.fill();
                    ctx.restore();
                }
            }

            // Flash de transición de fase full screen
            if (e.olTransitionFlash > 0) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Full screen
                ctx.fillStyle = `rgba(255, 255, 255, ${e.olTransitionFlash})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
                e.olTransitionFlash -= 0.04;
            }

            // Glitch de pantalla en fase 3
            if (phase === 3 && Math.random() > 0.95) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Full screen
                ctx.fillStyle = "rgba(255, 0, 50, 0.15)";
                ctx.fillRect(0, Math.random() * canvas.height, canvas.width, Math.random() * 80 + 20);
                ctx.restore();
            }
        }
        else if (e.isBoss) { for (let i = 0; i < 8; i++) { let a = (i * Math.PI / 4); let x = Math.cos(a) * e.radius; let y = Math.sin(a) * e.radius; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }

        else if (e.isKamikaze) { ctx.moveTo(e.radius * 1.4, 0); ctx.lineTo(0, -e.radius * 0.7); ctx.lineTo(-e.radius * 0.6, 0); ctx.lineTo(0, e.radius * 0.7); }
        else if (e.isEliteGold) { ctx.moveTo(e.radius * 1.5, 0); ctx.lineTo(0, -e.radius * 0.5); ctx.lineTo(-e.radius * 1.5, 0); ctx.lineTo(0, e.radius * 0.5); ctx.shadowBlur = 15; ctx.shadowColor = '#ffcc00'; }
        else if (e.isVortexNode) {
            ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
            ctx.moveTo(0, 0);
            for (let a = 0; a < Math.PI * 4; a += 0.2) {
                let r = (a / (Math.PI * 4)) * e.radius;
                ctx.lineTo(Math.cos(a + e.angle * 3) * r, Math.sin(a + e.angle * 3) * r);
            }
        }
        else if (e.isHelixWeaver) {
            ctx.moveTo(0, -e.radius);
            ctx.lineTo(e.radius * 0.8, e.radius * 0.5);
            ctx.lineTo(-e.radius * 0.8, e.radius * 0.5);
            ctx.lineTo(0, -e.radius);
            
            ctx.moveTo(0, e.radius);
            ctx.lineTo(e.radius * 0.8, -e.radius * 0.5);
            ctx.lineTo(-e.radius * 0.8, -e.radius * 0.5);
            ctx.lineTo(0, e.radius);
        }
        else if (e.isBinaryAegis) {
            ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        }
        else if (e.isEMPStalker) {
            ctx.moveTo(e.radius * 1.3, 0);
            ctx.lineTo(-e.radius * 0.7, -e.radius * 0.7);
            ctx.lineTo(-e.radius * 0.3, 0);
            ctx.lineTo(-e.radius * 0.7, e.radius * 0.7);
            ctx.globalAlpha = e.isRevealed ? 0.8 : 0.3;
        }
        else if (e.isVectorFragment) {
            skipDefaultFill = true;
            // Dibujar Mini-Vector Supremo (Geometría Compleja y Futurista)
            let drawColor = (e.stunTimer > 0) ? '#7f8c8d' : e.color;
            ctx.shadowBlur = 18;
            ctx.shadowColor = drawColor;
            
            // Cuerpo principal (Rombo/Octágono Geométrico)
            ctx.moveTo(0, -e.radius);
            ctx.lineTo(e.radius * 0.3, -e.radius * 0.3);
            ctx.lineTo(e.radius, 0);
            ctx.lineTo(e.radius * 0.3, e.radius * 0.3);
            ctx.lineTo(0, e.radius);
            ctx.lineTo(-e.radius * 0.3, e.radius * 0.3);
            ctx.lineTo(-e.radius, 0);
            ctx.lineTo(-e.radius * 0.3, -e.radius * 0.3);
            ctx.lineTo(0, -e.radius);
            ctx.fillStyle = e.flashTicks > 0 ? '#fff' : drawColor;
            ctx.fill();
            
            // Rombo interno oscuro
            ctx.beginPath();
            ctx.moveTo(0, -e.radius * 0.55);
            ctx.lineTo(e.radius * 0.55, 0);
            ctx.lineTo(0, e.radius * 0.55);
            ctx.lineTo(-e.radius * 0.55, 0);
            ctx.closePath();
            ctx.fillStyle = '#060112';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Pupila central blanca pequeña
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
        else if (e.isFluxNullifier) {
            skipDefaultFill = true;
            // Pirámide invertida de Titanio Blanco
            ctx.shadowBlur = 20; ctx.shadowColor = '#ffffff';
            // Cuerpo: triángulo invertido
            ctx.beginPath();
            ctx.moveTo(-e.radius, -e.radius * 0.7);
            ctx.lineTo(e.radius, -e.radius * 0.7);
            ctx.lineTo(0, e.radius * 0.9);
            ctx.closePath();
            ctx.fillStyle = e.flashTicks > 0 ? '#ff0000' : (e.fnBeamActive ? '#ffff88' : '#e8e8e8');
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Pulso cónico de supresión si está activo
            if (e.fnBeamActive) {
                ctx.save();
                ctx.globalAlpha = 0.25 + Math.sin(Date.now() * 0.015) * 0.1;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, e.radius * 4, -0.5, 0.5);
                ctx.closePath();
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.restore();
            }
        }
        else if (e.isGlitchWeaver) {
            skipDefaultFill = true;
            // Entramado de líneas que vibran entre Magenta y Negro
            ctx.shadowBlur = 15; ctx.shadowColor = '#ff007f';
            let glitchColor = Math.random() < 0.5 ? '#ff007f' : '#cc0066';
            ctx.strokeStyle = e.flashTicks > 0 ? '#ffffff' : glitchColor;
            ctx.lineWidth = 2;
            // Forma: cuadrícula distorsionada
            let r = e.radius;
            for (let gi = -1; gi <= 1; gi++) {
                ctx.beginPath();
                ctx.moveTo(-r + Math.random() * 4, gi * r * 0.5 + (Math.random() - 0.5) * 6);
                ctx.lineTo(r + Math.random() * 4, gi * r * 0.5 + (Math.random() - 0.5) * 6);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(gi * r * 0.5 + (Math.random() - 0.5) * 6, -r);
                ctx.lineTo(gi * r * 0.5 + (Math.random() - 0.5) * 6, r);
                ctx.stroke();
            }
            // Núcleo parpadeante
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = glitchColor;
            ctx.fill();
        }
        else if (e.isSingularitySentinel) {
            skipDefaultFill = true;
            // Anillo doble dorado con núcleo azul
            ctx.shadowBlur = 22; ctx.shadowColor = '#ffff00';
            e.ssOrbitAngle = (e.ssOrbitAngle || 0) + 0.02;
            // Anillo exterior
            ctx.beginPath();
            ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
            ctx.strokeStyle = e.flashTicks > 0 ? '#ffffff' : '#ffff00';
            ctx.lineWidth = 3;
            ctx.stroke();
            // Anillo interior rotativo
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 0.65, e.ssOrbitAngle, e.ssOrbitAngle + Math.PI * 1.5);
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 4;
            ctx.stroke();
            // Núcleo azul
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = e.ssLinkTarget !== null ? '#00aaff' : '#0055aa';
            ctx.shadowBlur = 15; ctx.shadowColor = '#00aaff';
            ctx.fill();
            // Línea de enlace cuántico al objetivo
            if (e.ssLinkTarget !== null && typeof enemies !== 'undefined') {
                let target = enemies.find(en => en.id === e.ssLinkTarget);
                if (target) {
                    ctx.restore();
                    ctx.save();
                    ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 + Math.sin(Date.now() * 0.01) * 0.3})`;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 4]);
                    ctx.shadowBlur = 10; ctx.shadowColor = '#ffff00';
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Aura de inmunidad sobre el objetivo
                    ctx.beginPath();
                    ctx.arc(target.x, target.y, target.radius + 10, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + Math.sin(Date.now() * 0.015) * 0.2})`;
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.restore();
                    ctx.save();
                    ctx.translate(e.x, e.y);
                    ctx.rotate(e.angle);
                }
            }
        }

        else { ctx.moveTo(e.radius * 1.2, 0); ctx.lineTo(-e.radius, -e.radius * 0.8); ctx.lineTo(-e.radius, e.radius * 0.8); }
        
        if (!skipDefaultFill) {
            ctx.closePath(); ctx.fillStyle = e.flashTicks > 0 ? '#fff' : e.color; ctx.fill();
        }

        if (e.isBoss && e.bossInvulnTimer > 0) { ctx.beginPath(); ctx.arc(0, 0, e.radius + 12, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
        else if (e.isShielded) { ctx.beginPath(); ctx.arc(0, 0, e.radius + 4, -0.6, 0.6); ctx.strokeStyle = '#0088ff'; ctx.lineWidth = 4; ctx.stroke(); }
        else if (e.isBinaryAegis) {
            ctx.beginPath(); ctx.arc(0, 0, e.radius + 15, e.shieldAngle, e.shieldAngle + 2.1);
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 4; ctx.stroke();
            
            ctx.beginPath(); ctx.arc(0, 0, e.radius + 15, e.shieldAngle + Math.PI, e.shieldAngle + Math.PI + 2.1);
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.restore();

        // Render especial: Láser giratorio del Vector Supreme en Fase 1
        if (e.isVectorSupreme && e.bossPhase === 1) {
            // --- 1. DIBUJAR LÁSER ELÉCTRICO DE ALTO VOLTAJE ---
            ctx.save();
            
            // Función auxiliar para dibujar rayos eléctricos pesados a lo largo de un ángulo (de rayosaer.html)
            function drawHeavyLightningLaser(startX, startY, angle, length) {
                const segments = 10;
                const segmentLength = length / segments;
                const points = [[startX, startY]];
                for (let k = 1; k <= segments; k++) {
                    let baseX = startX + Math.cos(angle) * (k * segmentLength);
                    let baseY = startY + Math.sin(angle) * (k * segmentLength);
                    // Desviación perpendicular aleatoria
                    let jitter = (Math.random() - 0.5) * 45;
                    let px = baseX - Math.sin(angle) * jitter;
                    let py = baseY + Math.cos(angle) * jitter;
                    points.push([px, py]);
                }
                
                // Capa exterior de energía carmesí gruesa
                ctx.beginPath();
                ctx.moveTo(points[0][0], points[0][1]);
                points.forEach(pt => ctx.lineTo(pt[0], pt[1]));
                ctx.strokeStyle = '#ff0033';
                ctx.lineWidth = 6 + Math.random() * 4;
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#ff0033';
                ctx.lineJoin = 'round';
                ctx.stroke();

                // Capa de núcleo blanco interno delgado
                ctx.beginPath();
                ctx.moveTo(points[0][0], points[0][1]);
                points.forEach(pt => ctx.lineTo(pt[0], pt[1]));
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 0;
                ctx.stroke();
            }

            let angles = [e.bossLaserAngle, e.bossLaserAngle + Math.PI];
            
            angles.forEach(angle => {
                let startDist = e.radius * 0.75;
                let startX = e.x + Math.cos(angle) * startDist;
                let startY = e.y + Math.sin(angle) * startDist;
                let endX = e.x + Math.cos(angle) * canvas.width;
                let endY = e.y + Math.sin(angle) * canvas.width;

                // Capas estéticas del cuerpo del láser (adaptadas de rayosaer.html)
                // Capa 1: Aura ancha semi-transparente
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = 'rgba(255, 0, 51, 0.08)';
                ctx.lineWidth = 55;
                ctx.stroke();
                
                // Capa 2: Brillo interior carmesí pulsante
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = '#ff0055';
                let beamWidth = 20 + Math.sin(Date.now() * 0.04) * 4;
                ctx.lineWidth = beamWidth;
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#ff0055';
                ctx.stroke();

                // Capa 3: Núcleo filoso blanco central
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3.5;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ffffff';
                ctx.stroke();
                ctx.restore();

                // Capa 4: Rayos eléctricos agresivos intermitentes (cada 2 frames aproximadamente)
                if (Math.random() < 0.4) {
                    drawHeavyLightningLaser(startX, startY, angle, canvas.width - startDist);
                }

                // Generar partículas de plasma a lo largo del láser
                if (Math.random() < 0.25) {
                    let dist = Math.random() * (canvas.width - startDist);
                    let pSpeed = 4 + Math.random() * 6;
                    particles.push({
                        x: startX + Math.cos(angle) * dist,
                        y: startY + Math.sin(angle) * dist,
                        vx: Math.cos(angle) * pSpeed + (Math.random() - 0.5) * 1.5,
                        vy: Math.sin(angle) * pSpeed + (Math.random() - 0.5) * 1.5,
                        radius: Math.random() * 3 + 1,
                        color: '#ff0033',
                        alpha: 0.95,
                        decay: 0.015 + Math.random() * 0.02
                    });
                }
            });
            ctx.restore();

            // --- 2. DIBUJAR ESCUDO FRONTAL HOLOGRÁFICO (TELEGRIFÍA DE INMUNIDAD) ---
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.matrixAngle); // Rotado hacia el jugador
            
            let isShieldHit = e.shieldFlashTicks && e.shieldFlashTicks > 0;
            if (isShieldHit) {
                e.shieldFlashTicks--;
            }
            
            let shieldArc = Math.PI / 9.0; // Coincide exactamente con el arco de colisión bloqueado (±20 grados)
            let shieldRadius = e.radius + 20;

            // Aura interior y brillo del escudo holográfico
            let shieldGrad = ctx.createRadialGradient(0, 0, shieldRadius - 10, 0, 0, shieldRadius + 20);
            shieldGrad.addColorStop(0, isShieldHit ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 170, 255, 0.25)');
            shieldGrad.addColorStop(1, 'rgba(0, 170, 255, 0)');
            
            ctx.beginPath();
            ctx.moveTo(Math.cos(-shieldArc) * (shieldRadius - 5), Math.sin(-shieldArc) * (shieldRadius - 5));
            ctx.arc(0, 0, shieldRadius - 5, -shieldArc, shieldArc);
            ctx.lineTo(Math.cos(shieldArc) * (shieldRadius + 15), Math.sin(shieldArc) * (shieldRadius + 15));
            ctx.arc(0, 0, shieldRadius + 15, shieldArc, -shieldArc, true);
            ctx.closePath();
            ctx.fillStyle = shieldGrad;
            ctx.fill();

            // Línea de energía holográfica principal (cian/blanca)
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, -shieldArc, shieldArc);
            ctx.strokeStyle = isShieldHit ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = isShieldHit ? 6 : 4;
            ctx.shadowBlur = isShieldHit ? 25 : 15;
            ctx.shadowColor = isShieldHit ? '#ffffff' : '#00ffff';
            ctx.stroke();

            // Línea de soporte externa más fina
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius + 6, -shieldArc + 0.08, shieldArc - 0.08);
            ctx.strokeStyle = isShieldHit ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 255, 255, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Nodos o bornes en los extremos del escudo
            ctx.fillStyle = isShieldHit ? '#ffffff' : '#00ffff';
            ctx.beginPath();
            ctx.arc(Math.cos(-shieldArc) * shieldRadius, Math.sin(-shieldArc) * shieldRadius, 3.5, 0, Math.PI * 2);
            ctx.arc(Math.cos(shieldArc) * shieldRadius, Math.sin(shieldArc) * shieldRadius, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        if (e.hp < e.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 5);
            ctx.fillStyle = '#ff0055'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.radius * 2) * (e.hp / e.maxHp), 5);
        }
        
        if (e.stunTimer > 0) {
            ctx.save();
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffff00';
            let time = Date.now() * 0.01;
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius - 18, 6, time, time + Math.PI * 1.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(e.x, e.y - e.radius - 18, 10, -time, -time + Math.PI * 1.5);
            ctx.stroke();
            ctx.restore();
        }
    });

    // Dibujar Jugadores
    players.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y);

        // Parpadeo visual durante i-frames (alternado cada ~80ms) o Invisibilidad
        if (p.invisibleTimer > 0) {
            ctx.globalAlpha = 0.25;
        } else if ((p.invulnTimer || 0) > 0) {
            ctx.globalAlpha = (Math.floor(Date.now() / 80) % 2 === 0) ? 0.3 : 0.9;
        }

        if (p.isDead) {
            // Jugador muerto: dibujar como fantasma + texto KO
            ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.1;
            ctx.strokeStyle = p.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-p.radius, -p.radius); ctx.lineTo(p.radius, p.radius); ctx.moveTo(p.radius, -p.radius); ctx.lineTo(-p.radius, p.radius); ctx.stroke();
            ctx.globalAlpha = 0.7;
            ctx.font = "bold 14px 'Courier New'"; ctx.fillStyle = '#ff4444'; ctx.textAlign = 'center';
            ctx.fillText('KO', 0, -p.radius - 8);
            // Anillo de progreso de revivir
            if (p.reviveTimer > 0) {
                ctx.globalAlpha = 1;
                ctx.beginPath(); ctx.arc(0, 0, p.radius + 12, -Math.PI / 2, -Math.PI / 2 + (p.reviveTimer / 180) * Math.PI * 2);
                ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 4; ctx.stroke();
                ctx.font = "bold 11px 'Courier New'"; ctx.fillStyle = '#00ff88';
                ctx.fillText('HOLD R', 0, p.radius + 26);
            }
            ctx.textAlign = 'left';
            ctx.restore();
            return;
        }

        if (p.isTurret) {
            // Dibujar base de torreta (anclaje) - Más complejo
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 15, 0, Math.PI * 2);
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.setLineDash([12, 6, 3, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Garras de anclaje
            ctx.fillStyle = '#00ffcc';
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.fillRect(p.radius + 10, -4, 8, 8);
            }
            
            // Aura de reducción de daño
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.2 + Math.sin(Date.now()/200)*0.1})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Rayos eléctricos aleatorios si la minigun está caliente
            if (p.minigunHeat > 100 && Math.random() < 0.4) {
                ctx.beginPath();
                let startAng = Math.random() * Math.PI * 2;
                ctx.moveTo(Math.cos(startAng) * p.radius, Math.sin(startAng) * p.radius);
                let targetAng = startAng + (Math.random() - 0.5) * 0.5;
                ctx.lineTo(Math.cos(targetAng) * (p.radius + 15), Math.sin(targetAng) * (p.radius + 15));
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            
            // Dibujar calor de la minigun
            if (p.minigunHeat > 0) {
                ctx.beginPath();
                ctx.arc(0, 0, p.radius + 5, -Math.PI/2, -Math.PI/2 + (p.minigunHeat / 300) * Math.PI * 2);
                ctx.strokeStyle = p.minigunOverheat ? '#ff0055' : '#ffff00';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Efecto de brillo por sobrecalentamiento
                if (p.minigunOverheat) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 0, 85, ${0.15 + Math.sin(Date.now()/50)*0.1})`;
                    ctx.lineWidth = 8;
                    ctx.stroke();
                }
            }
        }

        if (p.isChargingLaser) {
            let charge = p.laserCharge;
            let targetRad = 30;
            let currentRad = charge < 120 
                ? 80 - (charge / 120) * 50 
                : Math.max(15, 30 - ((charge - 120) / 60) * 15);
            
            let color = '#00ffcc';
            let label = 'CARGANDO...';
            if (charge >= 60 && charge < 120) {
                color = '#ffff00';
                label = '¡ÓPTIMO! (x2)';
            } else if (charge >= 120 && charge < 180) {
                color = '#ff007f';
                label = '🔥 ¡CRÍTICO! (x6) 🔥';
            } else if (charge >= 180) {
                color = '#ff0000';
                label = '⚠️ ¡SOBRECARGA! ⚠️';
            }
            
            // Vibración si está muy cerca de sobrecargar (2.7s a 3.0s)
            let isVibrating = charge >= 160 && charge < 180;
            let vx = isVibrating ? (Math.random() - 0.5) * 4 : 0;
            let vy = isVibrating ? (Math.random() - 0.5) * 4 : 0;
            
            // Dibujar círculo objetivo (línea discontinua)
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, targetRad, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
            
            // Dibujar anillo de contracción
            ctx.save();
            ctx.beginPath();
            ctx.arc(vx, vy, currentRad, 0, Math.PI * 2);
            ctx.strokeStyle = color;
            ctx.lineWidth = charge >= 120 ? 3 : 2;
            if (isVibrating) {
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#ff0000';
            }
            ctx.stroke();
            ctx.restore();
            
            // Dibujar textos
            ctx.save();
            ctx.font = "bold 11px 'Courier New'";
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            
            let shadowColor = color === '#00ffcc' ? '#008888' : (color === '#ffff00' ? '#888800' : '#880044');
            ctx.shadowBlur = 4;
            ctx.shadowColor = shadowColor;
            
            let chargeSecStr = (charge / 60).toFixed(1) + 's';
            ctx.fillText(label, 0, -p.radius - 28);
            ctx.font = "9px 'Courier New'";
            ctx.fillText(chargeSecStr, 0, -p.radius - 16);
            ctx.restore();
            ctx.textAlign = 'left';
        }

        ctx.rotate(p.angle); ctx.beginPath();
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

    // === DIBUJAR HABILIDADES ACTIVAS Y PASIVOS ===
    if (typeof drawSkillsAndPassives === 'function' && gameStarted) {
        drawSkillsAndPassives();
    }

    damageTexts.forEach(dt => {
        ctx.save(); ctx.globalAlpha = dt.alpha;
        if (dt.isCrit) {
            ctx.font = "bold 26px 'Courier New'"; ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff'; ctx.fillStyle = '#ffff00';
        } else if (dt.isPlayerHit) {
            ctx.font = "bold 24px 'Courier New'"; ctx.shadowBlur = 18; ctx.shadowColor = '#ff0000'; ctx.fillStyle = dt.color;
        } else {
            ctx.font = "bold 16px 'Courier New'"; ctx.fillStyle = dt.color;
        }
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

function fireTurretRockets(p) {
    if (enemies.length === 0) return;
    for (let i = 0; i < 2; i++) {
        let target = enemies[Math.floor(Math.random() * enemies.length)];
        let angle = p.angle + (i === 0 ? -0.4 : 0.4);
        bullets.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8,
            radius: 6,
            color: '#ff00ff',
            damage: 80 * p.damageModifier,
            type: 'homing_rocket',
            target: target,
            duration: 180
        });
    }
    playLaserFireSound(1.2);
}

updateUI();
updateMenuSelection('main-menu');
requestAnimationFrame(gameLoop);
