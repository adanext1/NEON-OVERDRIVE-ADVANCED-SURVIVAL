// === GESTOR CENTRAL DE HABILIDADES Y PASIVOS DE NEON OVERDRIVE ===

let activeMines = [];
let activeFlares = [];
let activeDomes = [];
let activeStasisFields = [];
let activeEscortDrones = [];
let activeOrbitalBeams = [];
let activeAntimatterOrbs = [];
let activeAIAllies = [];
let activeQuantumShields = [];

// --- EJECUTOR DE HABILIDADES ACTIVAS (40 HABILIDADES) ---
function executeActiveSkill(id, pObj, slotKey) {
    if (!pObj) pObj = players[0];
    let mod = getActiveSkillModifier(id);
    let baseCD = 300;
    
    // Calcular cooldown base del slot y aplicar modificador de nivel
    let skillCD = Math.max(60, Math.floor(baseCD * mod.cdMultiplier));
    
    if (id === 'turbo_impulso') {
        // Dash corto con 2 cargas
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
            if (gp) { moveX = gp.axes[0] || 0; moveY = gp.axes[1] || 0; }
        }
        if (moveX === 0 && moveY === 0) {
            moveX = Math.cos(pObj.angle); moveY = Math.sin(pObj.angle);
        }
        let len = Math.hypot(moveX, moveY);
        pObj.dashVx = (moveX / len) * 15; pObj.dashVy = (moveY / len) * 15;
        let pcd = Math.max(30, 80 - (getPassiveLevel('passive_cooldown') * 5));
        pObj.dashTimer = 9; pObj.dashCooldown = Math.max(15, Math.floor(pcd * mod.cdMultiplier));
        playDashSound();
        if (mod.level === 6) {
            pObj.invisibleTimer = 30; // 0.5s invisible
            pObj.invulnTimer = Math.max(pObj.invulnTimer || 0, 30);
            showNetworkMessage('👤 ¡DASH INVISIBLE!', 800);
        }
    }
    
    else if (id === 'pulso_choque') {
        // Onda de empuje
        pObj.pulseCooldown = Math.max(60, Math.floor(300 * mod.cdMultiplier));
        createExplosion(pObj.x, pObj.y, '#ff007f', 40, 2);
        screenShake = 12;
        playPulseSound();
        let dmg = Math.floor(35 * mod.effectMultiplier * pObj.damageModifier);
        enemies.forEach(e => {
            let dx = e.x - pObj.x; let dy = e.y - pObj.y; let dist = Math.hypot(dx, dy);
            if (dist < 260) {
                let force = ((260 - dist) / 1.2) * mod.effectMultiplier;
                let angle = Math.atan2(dy, dx);
                e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force;
                e.hp -= dmg; e.flashTicks = 5; spawnDamageText(e.x, e.y, dmg, 'normal');
                if (mod.level === 6) {
                    e.stunTimer = 90; // Stun 1.5s
                    createExplosion(e.x, e.y, '#00ffff', 4, 0.4);
                }
            }
        });
    }
    
    else if (id === 'blaster_repeticion') {
        // Disparo estándar rápido en secuencia
        pObj.pulseCooldown = Math.max(40, Math.floor(180 * mod.cdMultiplier));
        let count = 0;
        let interval = setInterval(() => {
            if (pObj.isDead || !gameStarted || isPaused) { clearInterval(interval); return; }
            let angle = pObj.angle;
            let dmg = Math.floor(25 * mod.effectMultiplier * pObj.damageModifier);
            bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(angle) * 14, vy: Math.sin(angle) * 14, radius: 5, color: '#00ffcc', damage: dmg, type: 'single' });
            if (mod.level === 6) {
                // Diagonales
                bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(angle - 0.25) * 14, vy: Math.sin(angle - 0.25) * 14, radius: 4, color: '#00ffff', damage: dmg * 0.7, type: 'single' });
                bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(angle + 0.25) * 14, vy: Math.sin(angle + 0.25) * 14, radius: 4, color: '#00ffff', damage: dmg * 0.7, type: 'single' });
            }
            playLaserFireSound(1.3);
            count++;
            if (count >= 5) clearInterval(interval);
        }, 80);
    }
    
    else if (id === 'mina_proximidad') {
        // Deja una mina
        pObj.pulseCooldown = Math.max(50, Math.floor(200 * mod.cdMultiplier));
        activeMines.push({
            x: pObj.x, y: pObj.y,
            radius: 20,
            damage: Math.floor(140 * mod.effectMultiplier),
            isUltra: (mod.level === 6),
            color: '#ff3300',
            pulseTimer: 0
        });
        playMinigunFireSound(); // Sonido metálico de anclaje
        showNetworkMessage('💣 MINA DESPLEGADA', 1000);
    }
    
    else if (id === 'reparacion_emergencia') {
        // Cura 15% de vida
        pObj.qCooldown = Math.max(120, Math.floor(600 * mod.cdMultiplier));
        let healing = Math.floor(pObj.maxHp * 0.15 * mod.effectMultiplier);
        pObj.hp = Math.min(pObj.maxHp, pObj.hp + healing);
        spawnDamageText(pObj.x, pObj.y, `+${healing} HP`, 'heal');
        createExplosion(pObj.x, pObj.y, '#00ff88', 15, 1.2);
        playOverloadSound();
        if (mod.level === 6) {
            pObj.controlsInverted = false;
            pObj.empTimer = 0;
            showNetworkMessage('🩹 SISTEMAS DEPURADOS & CURADOS', 1500);
        }
    }
    
    else if (id === 'escudo_frontal') {
        // Escudo en arco
        pObj.pulseCooldown = Math.max(90, Math.floor(360 * mod.cdMultiplier));
        pObj.frontalShieldHp = Math.floor(3 * mod.effectMultiplier);
        pObj.frontalShieldMax = pObj.frontalShieldHp;
        pObj.frontalShieldUltra = (mod.level === 6);
        playPulseSound();
        showNetworkMessage('🛡️ ESCUDO FRONTAL ACTIVADO', 1200);
    }
    
    else if (id === 'bengala_distraccion') {
        // Bengala de distracción
        pObj.pulseCooldown = Math.max(90, Math.floor(360 * mod.cdMultiplier));
        let tx = mouse.x; let ty = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            tx = pObj.x + Math.cos(pObj.angle) * 250;
            ty = pObj.y + Math.sin(pObj.angle) * 250;
        }
        activeFlares.push({
            x: tx, y: ty,
            radius: 120,
            duration: 360, // 6s
            isUltra: (mod.level === 6)
        });
        playDashSound();
        showNetworkMessage('✨ BENGALA DESPLEGADA', 1000);
    }
    
    else if (id === 'dron_escolta') {
        // Invoca dron de soporte
        pObj.qCooldown = Math.max(180, Math.floor(720 * mod.cdMultiplier));
        activeEscortDrones.push({
            pId: pObj.id,
            angle: Math.random() * Math.PI * 2,
            radiusOrbit: 60,
            shootCooldown: 0,
            isUltra: (mod.level === 6)
        });
        playTurretToggleSound();
        showNetworkMessage('🛸 DRON DE ESCOLTA ACOPLADO', 1500);
    }
    
    // --- TIER: RARO ---
    else if (id === 'mega_laser_carga') {
        pObj.pulseCooldown = Math.max(90, Math.floor(360 * mod.cdMultiplier));
        pObj.isChargingLaser = true;
        pObj.laserCharge = 0;
        pObj.laserDmgMod = mod.effectMultiplier;
        pObj.laserTrailUltra = (mod.level === 6);
        showNetworkMessage('⚡ CARGANDO MEGA-LÁSER DE CORTE', 1000);
    }
    
    else if (id === 'mortero_plasma') {
        pObj.pulseCooldown = Math.max(70, Math.floor(280 * mod.cdMultiplier));
        let targetX = mouse.x; let targetY = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            targetX = pObj.x + Math.cos(pObj.angle) * 300;
            targetY = pObj.y + Math.sin(pObj.angle) * 300;
        }
        bullets.push({
            type: 'mortar_shell',
            x: pObj.x, y: pObj.y, startX: pObj.x, startY: pObj.y,
            targetX: targetX, targetY: targetY, vx: 0, vy: 0,
            duration: 45, radius: 8, color: '#ffff00',
            damage: Math.floor(220 * mod.effectMultiplier * pObj.damageModifier),
            isUltra: (mod.level === 6)
        });
        playPlasmaSound();
        showNetworkMessage('🚀 MORTERO DE PLASMA DISPARADO', 1000);
    }
    
    else if (id === 'cupula_defensiva') {
        pObj.qCooldown = Math.max(120, Math.floor(540 * mod.cdMultiplier));
        activeDomes.push({
            x: pObj.x, y: pObj.y,
            radius: 150,
            duration: 480, // 8s
            reduction: 0.30,
            isUltra: (mod.level === 6)
        });
        playOverloadSound();
        showNetworkMessage('🛡️ CÚPULA DEFENSA ANCLADA', 1500);
    }
    
    else if (id === 'rayo_enlace') {
        pObj.pulseCooldown = Math.max(80, Math.floor(300 * mod.cdMultiplier));
        // Encontrar objetivo más cercano
        let target = null;
        if (isCoop) {
            target = players.find(p => p.id !== pObj.id && !p.isDead);
        }
        if (!target && enemies.length > 0) {
            let minDist = Infinity;
            enemies.forEach(e => {
                let d = Math.hypot(e.x - pObj.x, e.y - pObj.y);
                if (d < minDist) { minDist = d; target = e; }
            });
        }
        if (target) {
            pObj.linkBeamTarget = target;
            pObj.linkBeamDuration = 240; // 4s
            pObj.linkBeamUltra = (mod.level === 6);
            playLaserChargeSound(500);
            showNetworkMessage('🔗 RAYO DE ENLACE FIJADO', 1000);
        } else {
            // Reembolsar CD parcial si no hay objetivo
            pObj.pulseCooldown = 60;
            showNetworkMessage('⚠️ ENLACE SIN OBJETIVOS CERCANOS', 1000);
        }
    }
    
    else if (id === 'gancho_energia') {
        pObj.pulseCooldown = Math.max(50, Math.floor(180 * mod.cdMultiplier));
        if (enemies.length > 0) {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => {
                let d = Math.hypot(e.x - pObj.x, e.y - pObj.y);
                if (d < minDist && !e.isBoss) { minDist = d; closest = e; }
            });
            if (closest) {
                // Jalar enemigo
                closest.x = pObj.x + Math.cos(pObj.angle) * 40;
                closest.y = pObj.y + Math.sin(pObj.angle) * 40;
                createExplosion(closest.x, closest.y, '#00ffcc', 12, 1.2);
                let damage = Math.floor(60 * mod.effectMultiplier * pObj.damageModifier);
                if (mod.level === 6) {
                    damage *= 2; // Crit garantizado
                    spawnDamageText(closest.x, closest.y, 'CRÍTICO!', 'crit');
                }
                closest.hp -= damage; closest.flashTicks = 4;
                spawnDamageText(closest.x, closest.y, damage, 'normal');
                playPulseSound();
                showNetworkMessage('🪝 GANCHO CONECTADO', 800);
            }
        }
    }
    
    else if (id === 'granada_criogenia') {
        pObj.pulseCooldown = Math.max(60, Math.floor(240 * mod.cdMultiplier));
        let targetX = mouse.x; let targetY = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            targetX = pObj.x + Math.cos(pObj.angle) * 200;
            targetY = pObj.y + Math.sin(pObj.angle) * 200;
        }
        createExplosion(targetX, targetY, '#00ffff', 30, 2);
        enemies.forEach(e => {
            let d = Math.hypot(e.x - targetX, e.y - targetY);
            if (d < 160) {
                e.stunTimer = 120; // Congelado 2s
                e.isFrozen = true;
                e.frozenDmgAmp = (mod.level === 6); // +30% daño si ultra
                createExplosion(e.x, e.y, '#00ffff', 4, 0.5);
            }
        });
        playPulseSound();
        showNetworkMessage('❄️ DETONACIÓN CRIOGÉNICA', 1200);
    }
    
    else if (id === 'sobrecarga_armas') {
        if (pObj.qCooldown > 0) return;
        let baseCD = 900;
        pObj.qCooldown = Math.max(180, Math.floor(baseCD * mod.cdMultiplier * (pObj.qCdMod || 1.0)));
        pObj.dashCooldown = 0; pObj.pulseCooldown = 0; pObj.laserCooldown = 0;
        pObj.qTurboTimer = 240; 
        playOverloadSound();
        createExplosion(pObj.x, pObj.y, '#00ffaa', 30, 2);
        showNetworkMessage(`⚡ SOBRECARGA ACTIVADA`, 2000);
    }
    
    else if (id === 'salto_falla') {
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
            if (gp) { moveX = gp.axes[0] || 0; moveY = gp.axes[1] || 0; }
        }
        if (moveX === 0 && moveY === 0) {
            moveX = Math.cos(pObj.angle); moveY = Math.sin(pObj.angle);
        }
        let len = Math.hypot(moveX, moveY);
        let dx = (moveX / len) * 220; let dy = (moveY / len) * 220;
        let oldX = pObj.x; let oldY = pObj.y;
        let newX = Math.max(pObj.radius, Math.min(canvas.width - pObj.radius, pObj.x + dx));
        let newY = Math.max(pObj.radius, Math.min(canvas.height - pObj.radius, pObj.y + dy));
        
        createExplosion(oldX, oldY, '#7700ff', 20, 1);
        enemies.forEach(e => {
            let ds = Math.hypot(e.x - oldX, e.y - oldY);
            let de = Math.hypot(e.x - newX, e.y - newY);
            if (ds < 100 || de < 100) {
                let dmg = Math.floor(50 * mod.effectMultiplier * pObj.damageModifier);
                e.hp -= dmg; e.flashTicks = 4;
                spawnDamageText(e.x, e.y, dmg, 'normal');
            }
        });
        if (mod.level === 6) {
            setTimeout(() => {
                createExplosion(oldX, oldY, '#ff00ff', 50, 2.5);
                enemies.forEach(e => {
                    if (Math.hypot(e.x - oldX, e.y - oldY) < 150) {
                        let dmg = Math.floor(100 * pObj.damageModifier);
                        e.hp -= dmg; e.flashTicks = 5;
                        spawnDamageText(e.x, e.y, dmg, 'normal');
                    }
                });
                playExplosionSound();
            }, 300);
            showNetworkMessage('🌌 ¡CLON DE EXTRACCIÓN EXPLOSIVA!', 1000);
        }
        pObj.x = newX; pObj.y = newY;
        pObj.teleportCooldown = blinkCD;
        playPulseSound();
        showNetworkMessage(`🌌 TELETRANSPORTE`, 1000);
    }
    
    // --- TIER: ÉPICO ---
    else if (id === 'agujero_negro') {
        pObj.qCooldown = Math.max(120, Math.floor(600 * mod.cdMultiplier));
        let targetX = mouse.x; let targetY = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            targetX = pObj.x + Math.cos(pObj.angle) * 200;
            targetY = pObj.y + Math.sin(pObj.angle) * 200;
        }
        activeStasisFields.push({
            x: targetX,
            y: targetY,
            radius: 180,
            duration: 300, // 5s
            isBlackhole: true,
            isUltra: (mod.level === 6)
        });
        playPulseSound();
        showNetworkMessage('🌀 SINGULARIDAD CREADA', 1500);
    }
    
    else if (id === 'lluvia_misiles') {
        pObj.pulseCooldown = Math.max(100, Math.floor(480 * mod.cdMultiplier));
        let launched = 0;
        let scanEnemies = [...enemies].sort((a,b) => Math.hypot(a.x-pObj.x, a.y-pObj.y) - Math.hypot(b.x-pObj.x, b.y-pObj.y));
        for (let i = 0; i < 5; i++) {
            if (scanEnemies[i]) {
                setTimeout(() => {
                    bullets.push({
                        x: pObj.x, y: pObj.y,
                        vx: (Math.random() - 0.5) * 8, vy: -5,
                        radius: 6, color: '#ff5500',
                        damage: Math.floor(80 * mod.effectMultiplier * pObj.damageModifier),
                        type: 'homing_rocket',
                        target: scanEnemies[i],
                        isAoE: (mod.level === 6),
                        duration: 180
                    });
                    playLaserFireSound(0.8);
                }, i * 100);
                launched++;
            }
        }
        if (launched > 0) showNetworkMessage(`🚀 MISILES FIJADOS: ${launched}`, 1200);
    }
    
    else if (id === 'escudo_espejo') {
        pObj.pulseCooldown = Math.max(90, Math.floor(360 * mod.cdMultiplier));
        pObj.mirrorShieldTimer = 240; // 4s
        pObj.mirrorShieldUltra = (mod.level === 6);
        playPulseSound();
        showNetworkMessage('🪞 ESCUDO DE ESPEJO ACTIVO', 1200);
    }
    
    else if (id === 'torreta_desplegable') {
        pObj.isTurret = !pObj.isTurret;
        playTurretToggleSound();
        if (pObj.isTurret) pObj.minigunSpool = 0;
    }
    
    else if (id === 'inyeccion_nanobots') {
        pObj.qCooldown = Math.max(120, Math.floor(600 * mod.cdMultiplier));
        players.forEach(p => {
            if (!p.isDead) {
                p.hp = Math.min(p.maxHp, p.hp + 25);
                spawnDamageText(p.x, p.y, '+25 HP', 'heal');
                createExplosion(p.x, p.y, '#00ffaa', 10, 1.0);
                if (mod.level === 6) p.invulnTimer = 60; // 1s inmune
            }
        });
        playOverloadSound();
        showNetworkMessage('🩹 INYECCIÓN DE NANOBOTS EJECUTADA', 1500);
    }
    
    else if (id === 'pulso_magnetico') {
        pObj.pulseCooldown = Math.max(110, Math.floor(450 * mod.cdMultiplier));
        createExplosion(pObj.x, pObj.y, '#0088ff', 50, 2.5);
        enemies.forEach(e => {
            e.stunTimer = 180; // 3s EMP
            e.empActive = true;
            if (mod.level === 6) {
                e.armor = 0; // Armadura a cero
                createExplosion(e.x, e.y, '#ff0055', 5, 0.8);
            }
        });
        playPulseSound();
        showNetworkMessage('🔌 ONDA EMP DE RED DESPLEGADA', 1500);
    }
    
    else if (id === 'campo_estasis') {
        pObj.qCooldown = Math.max(120, Math.floor(600 * mod.cdMultiplier));
        activeStasisFields.push({
            x: pObj.x, y: pObj.y,
            radius: 200,
            duration: 360, // 6s
            isBlackhole: false,
            isUltra: (mod.level === 6)
        });
        playPulseSound();
        showNetworkMessage('⏳ MATRIZ DE ESTASIS CREADA', 1500);
    }
    
    else if (id === 'teletransporte_grupo') {
        pObj.qCooldown = Math.max(120, Math.floor(540 * mod.cdMultiplier));
        let tx = mouse.x; let ty = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            tx = pObj.x + Math.cos(pObj.angle) * 300;
            ty = pObj.y + Math.sin(pObj.angle) * 300;
        }
        players.forEach(p => {
            if (!p.isDead) {
                createExplosion(p.x, p.y, '#7700ff', 15, 1.0);
                p.x = tx + (Math.random() - 0.5) * 30;
                p.y = ty + (Math.random() - 0.5) * 30;
                createExplosion(p.x, p.y, '#00ffff', 15, 1.0);
                if (mod.level === 6) p.shield = Math.min(p.maxShield, p.shield + 50);
            }
        });
        playPulseSound();
        showNetworkMessage('🌌 TELETRANSPORTE GRUPAL', 1500);
    }
    
    // --- TIER: LEGENDARIO ---
    else if (id === 'rayo_orbital') {
        pObj.qCooldown = Math.max(150, Math.floor(900 * mod.cdMultiplier));
        activeOrbitalBeams.push({
            pId: pObj.id,
            x: mouse.x, y: mouse.y,
            radius: 80,
            duration: 300, // 5s
            damage: Math.floor(7 * mod.effectMultiplier * pObj.damageModifier),
            isUltra: (mod.level === 6)
        });
        playLaserChargeSound(800);
        showNetworkMessage('🛰️ SATÉLITE ENLACE ORBITAL ACTIVADO', 1800);
    }
    
    else if (id === 'protocolo_ultima_muralla') {
        pObj.qCooldown = Math.max(180, Math.floor(1080 * mod.cdMultiplier));
        pObj.invulnTimer = 360; // 6s invulnerable
        pObj.ultimaMurallaTimer = 360;
        pObj.ultimaMurallaUltra = (mod.level === 6);
        playOverloadSound();
        showNetworkMessage('🛡️ PROTOCOLO: ÚLTIMA MURALLA', 2000);
    }
    
    else if (id === 'frenesi_cinetico') {
        pObj.qCooldown = Math.max(120, Math.floor(600 * mod.cdMultiplier));
        pObj.frenesiCineticoTimer = 300; // 5s
        pObj.frenesiCineticoUltra = (mod.level === 6);
        playOverloadSound();
        showNetworkMessage('⚔️ FRENESÍ CINÉTICO ACTIVADO', 1500);
    }
    
    else if (id === 'dron_resurreccion') {
        pObj.qCooldown = Math.max(300, Math.floor(1800 * mod.cdMultiplier));
        pObj.resurreccionDronEquipado = true;
        pObj.resurreccionDronUltra = (mod.level === 6);
        playTurretToggleSound();
        showNetworkMessage('🛸 DRON RESURRECCIÓN DESPLEGADO', 2000);
    }
    
    else if (id === 'tormenta_electrica') {
        pObj.qCooldown = Math.max(110, Math.floor(600 * mod.cdMultiplier));
        let strikes = 15;
        let interval = setInterval(() => {
            if (!gameStarted || isPaused || strikes <= 0) { clearInterval(interval); return; }
            let target = enemies[Math.floor(Math.random() * enemies.length)];
            let sx = target ? target.x : Math.random() * canvas.width;
            let sy = target ? target.y : Math.random() * canvas.height;
            createExplosion(sx, sy, '#00ffff', 12, 1.5);
            playLaserFireSound(1.5);
            if (target) {
                let damage = Math.floor(90 * mod.effectMultiplier * pObj.damageModifier);
                target.hp -= damage; target.flashTicks = 4;
                spawnDamageText(target.x, target.y, damage, 'crit');
                
                // Chain Lightning (Ultra)
                if (mod.level === 6) {
                    enemies.forEach(other => {
                        if (other !== target && Math.hypot(other.x - target.x, other.y - target.y) < 140) {
                            other.hp -= Math.floor(damage * 0.5);
                            other.flashTicks = 3;
                            createExplosion(other.x, other.y, '#00aaff', 4, 0.8);
                        }
                    });
                }
            }
            strikes--;
        }, 150);
        showNetworkMessage('⚡ TORMENTA ELÉCTRICA CONVOCADA', 1500);
    }
    
    else if (id === 'canon_antimateria') {
        pObj.qCooldown = Math.max(150, Math.floor(800 * mod.cdMultiplier));
        activeAntimatterOrbs.push({
            x: pObj.x, y: pObj.y,
            vx: Math.cos(pObj.angle) * 3.5, vy: Math.sin(pObj.angle) * 3.5,
            radius: 40,
            damage: Math.floor(350 * mod.effectMultiplier * pObj.damageModifier),
            isUltra: (mod.level === 6),
            duration: 240
        });
        playPlasmaSound();
        showNetworkMessage('⚫ ORBE DE ANTIMATERIA DISPARADO', 1500);
    }
    
    else if (id === 'invisibilidad_total') {
        pObj.qCooldown = Math.max(150, Math.floor(900 * mod.cdMultiplier));
        pObj.invisibleTimer = 300; // 5s
        pObj.invulnTimer = Math.max(pObj.invulnTimer || 0, 300);
        pObj.invisibilidadFocoUltra = (mod.level === 6);
        playDashSound();
        showNetworkMessage('👤 INVISIBILIDAD TOTAL', 1500);
    }
    
    else if (id === 'enlace_vida') {
        pObj.qCooldown = Math.max(150, Math.floor(800 * mod.cdMultiplier));
        if (isCoop) {
            players.forEach(p => {
                p.enlaceVidaActive = true;
                p.enlaceVidaDuration = 480; // 8s
                p.enlaceVidaUltra = (mod.level === 6);
            });
            playOverloadSound();
            showNetworkMessage('🔗 ENLACE DE VIDA ESTABLECIDO', 1800);
        } else {
            pObj.qCooldown = 60;
            showNetworkMessage('⚠️ ENLACE REQUIERE COOPERATIVO', 1000);
        }
    }
    
    // --- TIER: MÍTICO ---
    else if (id === 'colapso_codigo') {
        pObj.qCooldown = Math.max(200, Math.floor(1200 * mod.cdMultiplier));
        createExplosion(canvas.width / 2, canvas.height / 2, '#ff0055', 100, 4);
        enemies.forEach(e => {
            if (!e.isBoss) {
                e.hp = 0;
            } else if (mod.level === 6) {
                // Boss pierde 10% hp fijo
                let lost = Math.floor(e.maxHp * 0.10);
                e.hp -= lost; e.flashTicks = 6;
                spawnDamageText(e.x, e.y, lost, 'crit');
            }
        });
        playExplosionSound();
        showNetworkMessage('🔥 CATASTROFE: COLAPSO DE CÓDIGO', 2000);
    }
    
    else if (id === 'avatar_guerra') {
        pObj.qCooldown = Math.max(300, Math.floor(1800 * mod.cdMultiplier));
        pObj.avatarGuerraTimer = 600; // 10s
        pObj.avatarGuerraUltra = (mod.level === 6);
        playOverloadSound();
        showNetworkMessage('🚨 TRANSFORMA: AVATAR DE LA GUERRA', 2500);
    }
    
    else if (id === 'cronos') {
        pObj.qCooldown = Math.max(200, Math.floor(1200 * mod.cdMultiplier));
        gameSpeed = 0.35; // Dilación
        pObj.cronosTimer = 360; // 6s
        pObj.cronosUltra = (mod.level === 6);
        playPulseSound();
        showNetworkMessage('⏳ PROTOCOLO CRONOS: TIEMPO DILATADO', 2000);
    }
    
    else if (id === 'supernova') {
        pObj.qCooldown = Math.max(250, Math.floor(1500 * mod.cdMultiplier));
        createExplosion(pObj.x, pObj.y, '#ffffff', 120, 5);
        screenShake = 35;
        playExplosionSound();
        
        let selfDmg = Math.floor(pObj.maxHp * 0.25);
        takeDamage(pObj, selfDmg);
        
        enemies.forEach(e => {
            let dmg = Math.floor(800 * mod.effectMultiplier);
            e.hp -= dmg; e.flashTicks = 6;
            spawnDamageText(e.x, e.y, dmg, 'crit');
        });
        
        if (mod.level === 6 && pObj.hp > 0) {
            // Doblar estadisticas por el resto de la oleada
            pObj.damageModifier *= 2.0;
            pObj.supernovaBuffed = true;
            showNetworkMessage('☀️ ESTADO SUPERNOVA: DAÑO DUPLICADO', 2500);
        } else {
            showNetworkMessage('☀️ EXPLOSIÓN SUPERNOVA DETONADA', 2000);
        }
    }
    
    else if (id === 'llamada_flota') {
        pObj.qCooldown = Math.max(300, Math.floor(1800 * mod.cdMultiplier));
        for (let i = 0; i < 5; i++) {
            activeAIAllies.push({
                x: pObj.x + (Math.random() - 0.5) * 100,
                y: pObj.y + 60,
                angle: pObj.angle,
                radius: 12,
                color: '#00ffcc',
                shootCooldown: Math.random() * 20,
                isUltra: (mod.level === 6)
            });
        }
        playTurretToggleSound();
        showNetworkMessage('🛸 FLOTA DE COMBATE ALIADA INVOCADA', 2000);
    }
    
    else if (id === 'rayo_creacion') {
        pObj.qCooldown = Math.max(140, Math.floor(800 * mod.cdMultiplier));
        let angle = pObj.angle;
        // Lanzar un rayo continuo
        for (let step = 0; step < 800; step += 10) {
            let rx = pObj.x + Math.cos(angle) * step;
            let ry = pObj.y + Math.sin(angle) * step;
            if (Math.random() < 0.2) createExplosion(rx, ry, '#ffffff', 2, 0.4);
            
            // Daño enemigos
            enemies.forEach(e => {
                if (Math.hypot(e.x - rx, e.y - ry) < e.radius + 30) {
                    let dmg = Math.floor(5 * mod.effectMultiplier * pObj.damageModifier);
                    e.hp -= dmg; e.flashTicks = 2;
                }
            });
            // Curar aliados
            players.forEach(p => {
                if (p !== pObj && !p.isDead && Math.hypot(p.x - rx, p.y - ry) < p.radius + 30) {
                    p.hp = Math.min(p.maxHp, p.hp + 2);
                    if (mod.level === 6 && p.hp >= p.maxHp) {
                        p.shield = Math.min(p.maxShield, p.shield + 2);
                    }
                }
            });
        }
        playLaserFireSound(1.6);
        showNetworkMessage('✨ RAYO DE LA CREACIÓN DISPARADO', 1500);
    }
    
    else if (id === 'juicio_final') {
        pObj.qCooldown = Math.max(250, Math.floor(1500 * mod.cdMultiplier));
        let targetX = mouse.x; let targetY = mouse.y;
        if (pObj.inputSource === 'gamepad') {
            targetX = pObj.x + Math.cos(pObj.angle) * 300;
            targetY = pObj.y + Math.sin(pObj.angle) * 300;
        }
        let currentKills = wave * 8; // fallback de bajas
        let isInfinite = (mod.level === 6 && currentKills > 100);
        let dmg = isInfinite ? 999999 : Math.floor(150 * currentKills * mod.effectMultiplier);
        bullets.push({
            type: 'mortar_shell',
            x: pObj.x, y: pObj.y, startX: pObj.x, startY: pObj.y,
            targetX: targetX, targetY: targetY, vx: 0, vy: 0,
            duration: 45, radius: 15, color: '#ffff00',
            damage: dmg
        });
        playPlasmaSound();
        showNetworkMessage(isInfinite ? '🌌 JUICIO FINAL INFALIBLE' : `⚡ JUICIO FINAL (DAÑO: ${dmg})`, 1800);
    }
    
    else if (id === 'singularidad_maestra') {
        pObj.qCooldown = Math.max(200, Math.floor(1200 * mod.cdMultiplier));
        activeStasisFields.push({
            x: pObj.x, y: pObj.y,
            radius: 350,
            duration: 420, // 7s
            isBlackhole: true,
            isMaster: true,
            isUltra: (mod.level === 6)
        });
        playPulseSound();
        showNetworkMessage('🌌 LA SINGULARIDAD MAESTRA DESPLEGADA', 2000);
    }
}

// --- ACTUALIZACIONES POR FRAME DE MECÁNICAS DE HABILIDADES ---
function updateSkillsAndPassives(pObj) {
    if (!pObj) pObj = players[0];
    
    // 1. Minas Proximidad
    for (let i = activeMines.length - 1; i >= 0; i--) {
        let m = activeMines[i];
        m.pulseTimer = (m.pulseTimer + 1) % 60;
        let detonated = false;
        enemies.forEach(e => {
            if (Math.hypot(e.x - m.x, e.y - m.y) < m.radius + e.radius) {
                detonated = true;
            }
        });
        if (detonated) {
            createExplosion(m.x, m.y, '#ff3300', 30, 2.0);
            playExplosionSound();
            enemies.forEach(e => {
                let d = Math.hypot(e.x - m.x, e.y - m.y);
                if (d < 120) {
                    let finalDmg = Math.floor(m.damage * (1 - d / 120) * pObj.damageModifier);
                    e.hp -= finalDmg; e.flashTicks = 4;
                    spawnDamageText(e.x, e.y, finalDmg, 'normal');
                }
            });
            
            // Ultra: Dividir en 3 minibombas
            if (m.isUltra) {
                for (let k = 0; k < 3; k++) {
                    let a = Math.random() * Math.PI * 2;
                    activeMines.push({
                        x: m.x + Math.cos(a) * 40,
                        y: m.y + Math.sin(a) * 40,
                        radius: 10,
                        damage: Math.floor(m.damage * 0.4),
                        isUltra: false,
                        color: '#ffff00',
                        pulseTimer: Math.random() * 20
                    });
                }
            }
            activeMines.splice(i, 1);
        }
    }
    
    // 2. Bengalas
    for (let i = activeFlares.length - 1; i >= 0; i--) {
        let f = activeFlares[i];
        f.duration--;
        if (Math.random() < 0.3) {
            particles.push({
                x: f.x + (Math.random() - 0.5) * 20,
                y: f.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 1.5, vy: -1,
                radius: Math.random() * 3 + 2, color: '#00ffff', alpha: 1, decay: 0.03
            });
        }
        if (f.duration <= 0) {
            if (f.isUltra) {
                createExplosion(f.x, f.y, '#00ffff', 40, 2.0);
                enemies.forEach(e => {
                    if (Math.hypot(e.x - f.x, e.y - f.y) < 180) {
                        e.stunTimer = 90; // Cegados 1.5s
                    }
                });
                playExplosionSound();
            }
            activeFlares.splice(i, 1);
        }
    }
    
    // 3. Cúpulas Defensivas y Campos de Estasis
    for (let i = activeDomes.length - 1; i >= 0; i--) {
        let d = activeDomes[i];
        d.duration--;
        if (d.duration <= 0) activeDomes.splice(i, 1);
    }
    
    for (let i = activeStasisFields.length - 1; i >= 0; i--) {
        let sf = activeStasisFields[i];
        sf.duration--;
        
        // Atraer enemigos si es Agujero Negro
        if (sf.isBlackhole) {
            enemies.forEach(e => {
                let dx = sf.x - e.x; let dy = sf.y - e.y; let dist = Math.hypot(dx, dy);
                if (dist < sf.radius) {
                    let force = (sf.radius - dist) / 10;
                    if (sf.isMaster) force *= 1.8;
                    let angle = Math.atan2(dy, dx);
                    e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force;
                }
            });
        }
        
        // Detener balas enemigas
        bullets.forEach(b => {
            if (b.type === 'enemy') {
                let d = Math.hypot(b.x - sf.x, b.y - sf.y);
                if (d < sf.radius) {
                    b.vx *= 0.1; b.vy *= 0.1; // ralentizar drásticamente
                    b.isStasisStopped = true;
                }
            }
        });
        
        if (sf.duration <= 0) {
            if (sf.isBlackhole && sf.isUltra) {
                // Al colapsar, lanzar enemigos
                enemies.forEach(e => {
                    let dx = e.x - sf.x; let dy = e.y - sf.y; let dist = Math.hypot(dx, dy);
                    if (dist < sf.radius * 0.8) {
                        let force = 30; let angle = Math.atan2(dy, dx);
                        e.x += Math.cos(angle) * force; e.y += Math.sin(angle) * force;
                        let dmg = 150 * pObj.damageModifier;
                        e.hp -= dmg; e.flashTicks = 4;
                        spawnDamageText(e.x, e.y, dmg, 'normal');
                    }
                });
                playExplosionSound();
            }
            if (!sf.isBlackhole && sf.isUltra) {
                // Balas paradas caen como Créditos
                bullets.forEach(b => {
                    if (b.type === 'enemy' && b.isStasisStopped) {
                        drops.push({ x: b.x, y: b.y, credits: 8, xp: 0, radius: 4, matType: null });
                        b.duration = 0; // eliminar bala
                    }
                });
            }
            activeStasisFields.splice(i, 1);
        }
    }
    
    // 4. Drones de Soporte / Escolta
    activeEscortDrones.forEach(d => {
        d.angle += 0.04;
        let owner = players.find(p => p.id === d.pId);
        if (owner && !owner.isDead) {
            d.x = owner.x + Math.cos(d.angle) * d.radiusOrbit;
            d.y = owner.y + Math.sin(d.angle) * d.radiusOrbit;
            
            // Interceptar proyectiles si es Ultra
            if (d.isUltra) {
                bullets.forEach((b, bi) => {
                    if (b.type === 'enemy' && Math.hypot(b.x - d.x, b.y - d.y) < 25) {
                        bullets.splice(bi, 1); // Absorber
                        createExplosion(d.x, d.y, '#00ffaa', 3, 0.5);
                    }
                });
            }
            
            // Disparar
            d.shootCooldown--;
            if (d.shootCooldown <= 0 && enemies.length > 0) {
                d.shootCooldown = 40;
                let target = enemies[Math.floor(Math.random() * enemies.length)];
                let a = Math.atan2(target.y - d.y, target.x - d.x);
                bullets.push({
                    x: d.x, y: d.y,
                    vx: Math.cos(a) * 11, vy: Math.sin(a) * 11,
                    radius: 4, color: '#00ff55', damage: 15 * owner.damageModifier,
                    type: 'single'
                });
                playLaserFireSound(1.4);
            }
        }
    });
    
    // 5. Enlace
    if (pObj.linkBeamDuration > 0 && pObj.linkBeamTarget) {
        pObj.linkBeamDuration--;
        let t = pObj.linkBeamTarget;
        if (t.hp !== undefined && t.hp > 0) {
            t.hp -= 0.6 * pObj.damageModifier; // Drenar vida
            t.flashTicks = 2;
            if (Math.random() < 0.15) spawnDamageText(t.x, t.y, 2, 'normal');
        } else if (t.hp === undefined && !t.isDead) {
            // Es un aliado
            t.shield = Math.min(t.maxShield, t.shield + 0.6);
            if (Math.random() < 0.15) createExplosion(t.x, t.y, '#00ffff', 2, 0.4);
        }
        if (pObj.linkBeamDuration <= 0) pObj.linkBeamTarget = null;
    }
    
    // 6. Rayos Orbitales
    for (let i = activeOrbitalBeams.length - 1; i >= 0; i--) {
        let b = activeOrbitalBeams[i];
        b.duration--;
        b.x += (mouse.x - b.x) * 0.08;
        b.y += (mouse.y - b.y) * 0.08;
        
        enemies.forEach(e => {
            if (Math.hypot(e.x - b.x, e.y - b.y) < b.radius) {
                e.hp -= b.damage; e.flashTicks = 2;
                if (Math.random() < 0.15) spawnDamageText(e.x, e.y, b.damage, 'crit');
            }
        });
        
        if (b.duration <= 0) activeOrbitalBeams.splice(i, 1);
    }
    
    // 7. Orbes Antimateria
    for (let i = activeAntimatterOrbs.length - 1; i >= 0; i--) {
        let o = activeAntimatterOrbs[i];
        o.duration--;
        o.x += o.vx; o.y += o.vy;
        
        // Destruir balas enemigas y dañar enemigos
        bullets.forEach((b, bi) => {
            if (b.type === 'enemy' && Math.hypot(b.x - o.x, b.y - o.y) < o.radius + 10) {
                bullets.splice(bi, 1);
            }
        });
        
        enemies.forEach(e => {
            if (Math.hypot(e.x - o.x, e.y - o.y) < o.radius + e.radius) {
                e.hp -= o.damage * 0.08; e.flashTicks = 2;
                if (Math.random() < 0.1) spawnDamageText(e.x, e.y, Math.floor(o.damage * 0.08), 'normal');
            }
        });
        
        if (o.duration <= 0) {
            if (o.isUltra) {
                createExplosion(o.x, o.y, '#aa00ff', 60, 3.0);
                enemies.forEach(e => {
                    if (Math.hypot(e.x - o.x, e.y - o.y) < 180) {
                        e.hp -= 200; e.flashTicks = 5;
                        spawnDamageText(e.x, e.y, 200, 'crit');
                    }
                });
                playExplosionSound();
            }
            activeAntimatterOrbs.splice(i, 1);
        }
    }
    
    // 8. Aliados AI
    for (let i = activeAIAllies.length - 1; i >= 0; i--) {
        let ship = activeAIAllies[i];
        ship.shootCooldown--;
        
        // Moverse cerca del jugador
        ship.x += (pObj.x - ship.x + Math.sin(Date.now() * 0.005 + i) * 60) * 0.05;
        ship.y += (pObj.y - ship.y + Math.cos(Date.now() * 0.005 + i) * 60 + 50) * 0.05;
        
        if (ship.shootCooldown <= 0 && enemies.length > 0) {
            ship.shootCooldown = 30;
            let target = enemies[0];
            let angle = Math.atan2(target.y - ship.y, target.x - ship.x);
            bullets.push({
                x: ship.x, y: ship.y,
                vx: Math.cos(angle) * 12, vy: Math.sin(angle) * 12,
                radius: 4, color: '#00ffff', damage: 20 * pObj.damageModifier,
                type: 'single'
            });
            playLaserFireSound(1.5);
        }
        
        // Limpiar al final de la oleada
        if (!waveActive) activeAIAllies.splice(i, 1);
    }
    
    // 9. Dron Resurrección Pasivo
    if (pObj.resurreccionDronEquipado && pObj.isDead) {
        pObj.isDead = false;
        pObj.hp = pObj.resurreccionDronUltra ? pObj.maxHp : Math.floor(pObj.maxHp * 0.5);
        if (pObj.resurreccionDronUltra) pObj.shield = pObj.maxShield;
        pObj.resurreccionDronEquipado = false; // Se consume
        createExplosion(pObj.x, pObj.y, '#00ff88', 55, 2.5);
        playOverloadSound();
        showNetworkMessage('🛸 ¡DRON RESURRECCIÓN CONSUMIDO!', 2000);
    }
    
    // 10. Cronos dilación reloj
    if (pObj.cronosTimer > 0) {
        pObj.cronosTimer--;
        if (pObj.cronosTimer <= 0) {
            gameSpeed = 1.7; // Restaurar
            showNetworkMessage('⏳ TIEMPO RESTAURADO', 1000);
        }
    }
    
    // 11. Escudo Espejo
    if (pObj.mirrorShieldTimer > 0) {
        pObj.mirrorShieldTimer--;
        bullets.forEach((b, bi) => {
            if (b.type === 'enemy' && Math.hypot(b.x - pObj.x, b.y - pObj.y) < pObj.radius + 35) {
                // Reflejar bala hacia enemigo aleatorio
                b.type = 'single'; // Aliada
                b.vx = -b.vx * 1.5; b.vy = -b.vy * 1.5;
                b.color = '#ff00ff';
                if (pObj.mirrorShieldUltra) {
                    b.damage *= 2;
                    b.isStunning = true;
                }
                createExplosion(b.x, b.y, '#ff00ff', 4, 0.6);
            }
        });
    }
    
    // 12. Escudo Frontal Arc collision checks
    if (pObj.frontalShieldHp > 0) {
        bullets.forEach((b, bi) => {
            if (b.type === 'enemy') {
                let dx = b.x - pObj.x; let dy = b.y - pObj.y;
                let angleToBullet = Math.atan2(dy, dx);
                let diff = Math.abs(angleToBullet - pObj.angle);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                
                if (diff < Math.PI / 4 && Math.hypot(dx, dy) < pObj.radius + 35) {
                    bullets.splice(bi, 1);
                    pObj.frontalShieldHp--;
                    createExplosion(b.x, b.y, '#00ffff', 6, 0.7);
                    
                    if (pObj.frontalShieldHp <= 0) {
                        if (pObj.frontalShieldUltra) {
                            // Detonar escudo
                            createExplosion(pObj.x, pObj.y, '#00ffff', 35, 1.8);
                            enemies.forEach(e => {
                                if (Math.hypot(e.x - pObj.x, e.y - pObj.y) < 140) {
                                    e.hp -= 120 * pObj.damageModifier; e.flashTicks = 4;
                                    spawnDamageText(e.x, e.y, 120, 'normal');
                                }
                            });
                            playExplosionSound();
                        }
                        showNetworkMessage('🛡️ ESCUDO FRONTAL AGOTADO', 1000);
                    }
                }
            }
        });
    }
    
    // --- TICK GENERAL DE PASIVOS (30 MODULOS) ---
    applyPassiveTicks(pObj);
}

// --- ACTUALIZACIÓN DE HABILIDADES PASIVAS POR FRAME ---
function applyPassiveTicks(pObj) {
    // 1. Reparación Automática (passive_regen)
    let regenLvl = getPassiveLevel('passive_regen');
    if (regenLvl > 0) {
        if (!pObj.regenTimer) pObj.regenTimer = 0;
        pObj.regenTimer++;
        let tickInterval = Math.max(30, 240 - regenLvl * 30); // mejora cooldown
        if (pObj.regenTimer >= tickInterval) {
            pObj.regenTimer = 0;
            pObj.hp = Math.min(pObj.maxHp, pObj.hp + 1);
            spawnDamageText(pObj.x, pObj.y, '+1 HP', 'heal');
            
            // Compartir con aliado (Ultra)
            if (regenLvl === 6 && isCoop) {
                players.forEach(other => {
                    if (other !== pObj && !other.isDead && Math.hypot(other.x - pObj.x, other.y - pObj.y) < 250) {
                        other.hp = Math.min(other.maxHp, other.hp + 1);
                    }
                });
            }
        }
    }
    
    // 2. Mente de Colmena (passive_hivemind)
    let hivemindLvl = getPassiveLevel('passive_hivemind');
    if (hivemindLvl > 0 && isCoop) {
        // En coop, otorga mejoras a aliados
        players.forEach(other => {
            if (other !== pObj) {
                other.damageModifier = Math.max(other.damageModifier, 1.0 + hivemindLvl * 0.05);
            }
        });
    }
}

// --- RENDERIZADO VISUAL DE COMPONENTES DE HABILIDAD ---
function drawSkillsAndPassives() {
    // 1. Dibujar Minas
    activeMines.forEach(m => {
        let glowRadius = m.radius + Math.sin(m.pulseTimer * 0.15) * 4;
        ctx.save();
        ctx.beginPath(); ctx.arc(m.x, m.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 51, 0, ${0.15 + Math.sin(m.pulseTimer * 0.15) * 0.1})`;
        ctx.fill();
        ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = m.color; ctx.shadowBlur = 10; ctx.shadowColor = m.color;
        ctx.fill();
        ctx.restore();
    });
    
    // 2. Dibujar Bengalas
    activeFlares.forEach(f => {
        ctx.save();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        let grad = ctx.createRadialGradient(f.x, f.y, 5, f.x, f.y, f.radius);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0.35)'); grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad; ctx.fill();
        
        ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff'; ctx.fill();
        ctx.restore();
    });
    
    // 3. Dibujar Cúpulas y Campos
    activeDomes.forEach(d => {
        ctx.save();
        ctx.beginPath(); ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 170, 255, ${0.35 + Math.sin(Date.now() * 0.005) * 0.1})`;
        ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = 'rgba(0, 170, 255, 0.03)'; ctx.fill();
        ctx.restore();
    });
    
    activeStasisFields.forEach(sf => {
        ctx.save();
        ctx.beginPath(); ctx.arc(sf.x, sf.y, sf.radius, 0, Math.PI * 2);
        if (sf.isBlackhole) {
            ctx.strokeStyle = sf.isMaster ? 'rgba(255, 0, 127, 0.5)' : 'rgba(119, 0, 255, 0.4)';
            ctx.lineWidth = 5; ctx.stroke();
            let grad = ctx.createRadialGradient(sf.x, sf.y, 5, sf.x, sf.y, sf.radius);
            grad.addColorStop(0, '#000000'); grad.addColorStop(0.3, '#0b001a'); grad.addColorStop(1, 'rgba(11, 0, 26, 0)');
            ctx.fillStyle = grad; ctx.fill();
        } else {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = 'rgba(0, 255, 255, 0.02)'; ctx.fill();
        }
        ctx.restore();
    });
    
    // 4. Dibujar Escort Drones
    activeEscortDrones.forEach(d => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle * 2);
        ctx.beginPath();
        ctx.moveTo(-7, -7); ctx.lineTo(10, 0); ctx.lineTo(-7, 7); ctx.closePath();
        ctx.fillStyle = '#00ffaa'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ffaa'; ctx.fill();
        
        if (d.isUltra) {
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 255, 170, 0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.restore();
    });
    
    // 5. Dibujar Link Beam
    players.forEach(p => {
        if (p.linkBeamTarget) {
            ctx.save();
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.linkBeamTarget.x, p.linkBeamTarget.y);
            ctx.strokeStyle = p.linkBeamUltra ? '#ffff00' : '#00ffff';
            ctx.lineWidth = 3 + Math.random() * 2; ctx.shadowBlur = 12; ctx.shadowColor = ctx.strokeStyle;
            ctx.stroke();
            ctx.restore();
        }
    });
    
    // 6. Dibujar Rayos Orbitales
    activeOrbitalBeams.forEach(b => {
        ctx.save();
        let grad = ctx.createLinearGradient(b.x - b.radius, b.y, b.x + b.radius, b.y);
        grad.addColorStop(0, 'rgba(255, 0, 127, 0)'); grad.addColorStop(0.5, 'rgba(255, 0, 127, 0.65)'); grad.addColorStop(1, 'rgba(255, 0, 127, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x - b.radius, 0, b.radius * 2, canvas.height);
        
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff007f'; ctx.lineWidth = 4; ctx.stroke();
        ctx.restore();
    });
    
    // 7. Dibujar Orbe Antimateria
    activeAntimatterOrbs.forEach(o => {
        ctx.save();
        ctx.beginPath(); ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000000'; ctx.shadowBlur = 25; ctx.shadowColor = '#7700ff'; ctx.fill();
        ctx.strokeStyle = '#7700ff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
    });
    
    // 8. Dibujar Aliados AI
    activeAIAllies.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.beginPath();
        ctx.moveTo(-10, -8); ctx.lineTo(12, 0); ctx.lineTo(-10, 8); ctx.closePath();
        ctx.fillStyle = s.color; ctx.shadowBlur = 8; ctx.shadowColor = s.color; ctx.fill();
        ctx.restore();
    });
}

// --- HOOK: EVENTO DE DAÑO APLICADO A JUGADOR (PASIVOS) ---
function applyPassiveOnDamage(pObj, amount, attacker) {
    // Reducción e interacciones pasivas
    let knockLvl = getPassiveLevel('passive_knockback');
    
    // Condensador de Pulso (passive_knockback Lv6 Wall Damage): handled inside knockback impact code.
    
    return amount;
}
