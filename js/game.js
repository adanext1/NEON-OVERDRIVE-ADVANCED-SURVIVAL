

// === FUNCIÓN takeDamage MOVIDA A player.js ===

// Mover el check de todos muertos fuera del takeDamage para coop
function checkCoopGameOver() {
    if (isCoop || isOnline) {
        let allDead = players.every(p => p.isDead || p.hp <= 0);
        if (allDead && !isGameOver) {
            isGameOver = true;
            document.getElementById('game-over-stats').innerText = `Oleada alcanzada: ${wave}`;
            document.getElementById('game-over-modal').style.display = 'block';
            updateMenuSelection('game-over-modal');
            isPaused = true;
        }
    }
}

// === FUNCIÓN revivePlayer MOVIDA A player.js ===

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
        
        // Variables v0.8.0
        p.laserCharge = 0;
        p.laserCooldown = 0;
        p.isTurret = false;
        p.minigunHeat = 0;
        p.minigunOverheat = false;
        p.qCooldown = 0;
        p.qTurboTimer = 0;
        p.minigunSpool = 0;
        p.minigunCooldown = 0;
        p.rearDischargeTimer = 0;
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
    
    players.forEach(p => {
        p.credits = 0;
        p.level = 1;
        p.xp = 0;
        p.nextXp = 100;
        p.hp = p.maxHp || 100;
        p.shield = 0;
        p.weapons = ['basic'];
        p.currentWeaponIndex = 0;
        p.overdriveTimer = 0;
        p.dashTimer = 0;
        p.dashCooldown = 0;
        p.pulseCooldown = 0;
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
    
    players.forEach(p => {
        p.credits = 0;
        p.level = 1;
        p.xp = 0;
        p.nextXp = 100;
        p.hp = p.maxHp || 100;
        p.shield = 0;
        p.weapons = ['basic'];
        p.currentWeaponIndex = 0;
        p.overdriveTimer = 0;
        p.dashTimer = 0;
        p.dashCooldown = 0;
        p.pulseCooldown = 0;
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
    document.getElementById('main-menu').style.display = 'block';
    
    if (typeof updateMenuSelection !== 'undefined') {
        updateMenuSelection('main-menu');
    }
}

// === FUNCIÓN processGamepadInput MOVIDA A player.js ===

window.addEventListener('keydown', e => {
    let k = e.key.toLowerCase(); keys[k] = true;
    if (!gameStarted) return;
    if (k === 'p') { if (!isShopActive && !inCollectionMenu) { togglePause(); } }
    if (isPaused) return;
    if (k === 'm') { players[0].aimMode = players[0].aimMode === 'AUTO' ? 'MANUAL' : 'AUTO'; updateUI(); }
    if (e.key === 'Shift') { triggerDash(); playDashSound(); } 
    if (k === 'e') { triggerPulse(); playPulseSound(); }
    if (k === 'q') {
        let p = players[0];
        if ((p.qCooldown || 0) <= 0 && (p.empTimer || 0) === 0) {
            p.dashCooldown = 0;
            p.pulseCooldown = 0;
            p.laserCooldown = 0;
            p.qTurboTimer = 240; // 4s
            p.qCooldown = 900 * (p.qCdMod || 1.0); // 15s base
            
            playOverloadSound();
            createExplosion(p.x, p.y, '#00ffaa', 30, 2);
            showNetworkMessage('⚡ ¡CÉLULA DE SOBRECARGA ACTIVADA!', 2000);
        }
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (gameStarted && !isPaused) {
            let p = players[0];
            if (waveActive) {
                if ((p.empTimer || 0) === 0) {
                    p.isTurret = !p.isTurret;
                    playTurretToggleSound();
                    if (p.isTurret) {
                        p.minigunSpool = 0;
                    }
                }
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
            p.isChargingLaser = true;
            p.laserCharge = 0;
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
        
        // Cooldowns v0.8.0
        if (p.laserCooldown > 0) p.laserCooldown -= cdRate;
        if (p.qCooldown > 0) p.qCooldown--;
        if (p.qTurboTimer > 0) p.qTurboTimer--;
        
        if (p.dashCooldown < 0) p.dashCooldown = 0;
        if (p.pulseCooldown < 0) p.pulseCooldown = 0;
        if (p.laserCooldown < 0) p.laserCooldown = 0;
        
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
        
        // Descarga trasera
        if (p.isTurret) {
            p.rearDischargeTimer++;
            if (p.rearDischargeTimer >= 90) {
                p.rearDischargeTimer = 0;
                triggerRearDischarge(p);
            }
        }
    });

    let maxDashCD = Math.max(30, 90 - (userSave.artifacts.hyperdrive * 5));
    document.getElementById('dash-cd').style.width = `${(1 - players[0].dashCooldown / maxDashCD) * 100}%`;
    document.getElementById('pulse-cd').style.width = `${(1 - players[0].pulseCooldown / 300) * 100}%`;
    document.getElementById('q-cd').style.width = `${(1 - players[0].qCooldown / 900) * 100}%`;
    
    let maxLaserCD = players[0].maxLaserCooldown || 480;
    document.getElementById('laser-cd').style.width = `${(1 - players[0].laserCooldown / maxLaserCD) * 100}%`;
    
    let heatBar = document.getElementById('minigun-heat-bar');
    if (heatBar) {
        heatBar.style.width = `${(players[0].minigunHeat / 300) * 100}%`;
        heatBar.style.background = players[0].minigunOverheat ? '#ff0000' : '#ffaa00';
    }

    // Movimiento
    players.forEach(p => {
        if (p.isDead) return; // No mover jugadores muertos
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== 1) return; 
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
        if (typeof isOnline !== 'undefined' && isOnline && p.id !== 1) return; 
        if (p.id === 1 && p.inputSource === 'keyboard' && mouse.isDown) fireWeapon(p);
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
                    showNetworkMessage(`➕ ${p.id === 1 ? 'J1' : 'J2'} revivido al terminar la oleada con 1 HP`, 3000);
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
        b.x += b.vx; b.y += b.vy;
        
        if (b.duration !== undefined) {
            b.duration--;
            if (b.duration <= 0) { bullets.splice(i, 1); continue; }
        }
        
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { bullets.splice(i, 1); continue; }

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j]; 
            
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

                // Inmunidad Fase 2 del Overlord Apex: solo el Mega-Láser Crítico puede dañarlo
                if (e.isOverlordApex && e.olPhase2Immune) {
                    if (b.type !== 'laser_heavy') {
                        createExplosion(b.x, b.y, '#d4af37', 4, 0.6);
                        bullets.splice(i, 1); break;
                    }
                }

                // Daño a pilares de la Jaula de Vectores (Fase 0 del Overlord)
                if (e.isOverlordApex && e.bossPhase === 0 && e.olPillarsSpawned && e.olPillarPositions) {
                    for (let pi = 0; pi < 4; pi++) {
                        if (!e.olPillarAlive[pi]) continue;
                        let pp = e.olPillarPositions[pi];
                        let pillarDist = Math.hypot(b.x - pp.x, b.y - pp.y);
                        if (pillarDist < 22) {
                            let pillarDmg = b.damage * 0.5;
                            damageOverlordPillar(e, pi, pillarDmg);
                            spawnDamageText(pp.x, pp.y, Math.floor(pillarDmg), 'normal');
                            bullets.splice(i, 1);
                            break;
                        }
                    }
                    if (i < 0 || (bullets[i] && bullets[i] !== b)) break;
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
                    if (Math.abs(diff) < Math.PI / 3) { // ±60° frontal bloqueado
                        createExplosion(b.x, b.y, '#00aaff', 5, 0.8);
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
                    let isCrit = Math.random() < 0.15; let finalDmg = isCrit ? b.damage * 1.8 : b.damage;
                    
                    // Daño porcentual por vida máxima a jefes con láser
                    if (e.isBoss && (b.type === 'laser_medium' || b.type === 'laser_heavy')) {
                        let pct = b.type === 'laser_heavy' ? 0.05 : 0.02; // 5% o 2% por impacto
                        finalDmg += Math.floor(e.maxHp * pct);
                    }
                    
                    let damageTaken = Math.max(1, finalDmg - (e.armor || 0));
                    e.hp -= damageTaken; e.flashTicks = 4; createExplosion(b.x, b.y, b.color, 3, 0.5); spawnDamageText(e.x, e.y, damageTaken, isCrit ? 'crit' : 'normal');
                    playHitSound();
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
    let hpFill = document.getElementById('boss-hp-fill');
    let hpCont = document.getElementById('boss-hp-container');
    if (boss && hpFill && hpCont) {
        if (hpCont.style.display !== 'block') {
            hpCont.style.display = 'block';
            let label = hpCont.querySelector('.boss-hp-label');
            if (label) {
                label.innerText = boss.isCoreGuardian ? 'GUARDIÁN DEL NÚCLEO' : boss.isOverlordApex ? 'OVERLORD APEX' : 'VECTOR SUPREMO';
            }
        }
        let pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
        hpFill.style.width = `${pct}%`;
    } else if (!boss && hpCont) {
        if (hpCont.style.display !== 'none') hpCont.style.display = 'none';
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
                nearestP.credits += d.credits; nearestP.xp += Math.round(d.xp * xpMultiplier);
                if (d.matType) { userSave.materials[d.matType]++; saveGame(); }
                if (nearestP.xp >= nearestP.nextXp) {
                    nearestP.level++; nearestP.xp -= nearestP.nextXp; nearestP.nextXp = Math.floor(nearestP.nextXp * 1.45);
                    createExplosion(nearestP.x, nearestP.y, nearestP.color || '#00ffcc', 35, 1.8);
                    showLevelUpMenu(nearestP);
                }
                drops.splice(i, 1); updateUI();
                
                // Enviar sincronización de stats al Cliente
                if (typeof isOnline !== 'undefined' && isOnline && isHost) {
                    sendGameEvent('sync-stats', {
                        p1: { xp: players[0].xp, level: players[0].level, credits: players[0].credits, nextXp: players[0].nextXp },
                        p2: { xp: (players[1] ? players[1].xp : 0), level: (players[1] ? players[1].level : 1), credits: (players[1] ? players[1].credits : 0), nextXp: (players[1] ? players[1].nextXp : 100) }
                    });
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
        } else {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.fill();
        }
        
        ctx.restore();
    });
    particles.forEach(p => { ctx.save(); ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); ctx.restore(); });

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
            
            e.drawRotAngle = (e.drawRotAngle || 0) + 0.03;
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 1.2, e.drawRotAngle, e.drawRotAngle + Math.PI * 0.5);
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 1.2, e.drawRotAngle + Math.PI, e.drawRotAngle + Math.PI + Math.PI * 0.5);
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 3;
            ctx.stroke();
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
            // Fragmento: X de doble triángulo, rojo brillante
            ctx.shadowBlur = 18; ctx.shadowColor = '#ff0000';
            ctx.moveTo(0, -e.radius); ctx.lineTo(e.radius * 0.7, e.radius * 0.7); ctx.lineTo(-e.radius * 0.7, e.radius * 0.7);
            ctx.moveTo(0, e.radius); ctx.lineTo(e.radius * 0.7, -e.radius * 0.7); ctx.lineTo(-e.radius * 0.7, -e.radius * 0.7);
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
        else if (e.isOverlordApex) {
            skipDefaultFill = true;
            ctx.shadowBlur = 35; ctx.shadowColor = e.color;
            e.drawRotAngle = (e.drawRotAngle || 0) + 0.018;

            // Cuerpo principal: hexágono de Gris Corporativo
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let a = (i * Math.PI / 3) + e.drawRotAngle * 0.3;
                let x = Math.cos(a) * e.radius;
                let y = Math.sin(a) * e.radius;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            let bodyColor = e.bossPhase === 2 ? '#ff2200' : '#888888';
            ctx.fillStyle = e.flashTicks > 0 ? '#ffffff' : bodyColor;
            ctx.fill();
            ctx.strokeStyle = e.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Anillos de Oro Líquido orbitales
            for (let ri = 0; ri < 3; ri++) {
                let ringRadius = e.radius * (0.7 + ri * 0.25);
                let ringAngle = e.drawRotAngle * (ri % 2 === 0 ? 1 : -1) + ri * 1.2;
                ctx.beginPath();
                ctx.arc(0, 0, ringRadius, ringAngle, ringAngle + Math.PI * 0.6);
                ctx.strokeStyle = e.color;
                ctx.lineWidth = ri === 1 ? 4 : 2;
                ctx.stroke();
            }

            // Núcleo central brillante
            ctx.beginPath();
            ctx.arc(0, 0, e.radius * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = e.bossPhase === 2 ? '#ff4400' : e.color;
            ctx.shadowBlur = 20; ctx.shadowColor = e.color;
            ctx.fill();

            // Indicador de fase
            if (e.bossPhase === 1) {
                // Aura ámbar de inversión magnética
                ctx.beginPath();
                ctx.arc(0, 0, e.radius * 1.3, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 170, 0, ${0.2 + Math.sin(Date.now() * 0.008) * 0.15})`;
                ctx.lineWidth = 6;
                ctx.stroke();
            } else if (e.bossPhase === 2) {
                // Pulso rojo de emergencia
                ctx.beginPath();
                ctx.arc(0, 0, e.radius * 1.4, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 34, 0, ${0.3 + Math.sin(Date.now() * 0.02) * 0.2})`;
                ctx.lineWidth = 8;
                ctx.stroke();
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
            ctx.save();
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 8;
            ctx.shadowBlur = 30; ctx.shadowColor = '#ff007f';
            ctx.globalAlpha = 0.6;
            // Haz A
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + Math.cos(e.bossLaserAngle) * canvas.width, e.y + Math.sin(e.bossLaserAngle) * canvas.width);
            ctx.stroke();
            // Haz B (opuesto)
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + Math.cos(e.bossLaserAngle + Math.PI) * canvas.width, e.y + Math.sin(e.bossLaserAngle + Math.PI) * canvas.width);
            ctx.stroke();
            ctx.restore();
        }

        if (e.hp < e.maxHp) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 5);
            ctx.fillStyle = '#ff0055'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.radius * 2) * (e.hp / e.maxHp), 5);
        }
    });

    // Dibujar Jugadores
    players.forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y);

        // Parpadeo visual durante i-frames (alternado cada ~80ms)
        if ((p.invulnTimer || 0) > 0) {
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
            ctx.beginPath();
            let radius = 20 + (p.laserCharge % 60) * 0.5; // El anillo crece
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = p.laserCharge >= 120 ? '#ff007f' : '#ffff00';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Texto de carga
            ctx.font = "bold 12px 'Courier New'";
            ctx.fillStyle = ctx.strokeStyle;
            ctx.textAlign = 'center';
            ctx.fillText(`CARGA: ${Math.min(3, Math.floor(p.laserCharge/60))}s`, 0, -p.radius - 15);
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

updateUI();
updateMenuSelection('main-menu');
requestAnimationFrame(gameLoop);
