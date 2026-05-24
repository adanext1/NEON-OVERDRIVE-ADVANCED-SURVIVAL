// === COMPORTAMIENTO: OVERLORD APEX — THE KINETIC ARCHITECT (BOSS LVL 15) ===
// Jefe de 3 fases. Gris Corporativo Premium y Oro Líquido (#d4af37).
// Fase 0: La Jaula de Vectores — 4 pilares que reducen el espacio jugable.
// Fase 1: Inversión Magnética — controles invertidos + retroceso de armas.
// Fase 2: Protocolo Muro de Ejecución — muro láser avanzando + inmunidad a balas normales.

function updateBossOverlord(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.olTimer = (e.olTimer || 0) + 1;
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;

    // =====================================================================
    // FASE 0: LA JAULA DE VECTORES (100% → 75% HP)
    // =====================================================================
    if (e.bossPhase === 0) {
        e.color = '#d4af37';

        // Posicionarse en la parte superior del mapa
        let targetY = (typeof canvas !== 'undefined') ? canvas.height * 0.18 : 100;
        let targetX = (typeof canvas !== 'undefined') ? canvas.width / 2 : 400;
        let toTargetX = targetX - e.x;
        let toTargetY = targetY - e.y;
        let toTargetDist = Math.hypot(toTargetX, toTargetY);
        if (toTargetDist > 8) {
            e.x += (toTargetX / toTargetDist) * e.speed * 1.5;
            e.y += (toTargetY / toTargetDist) * e.speed * 1.5;
        }
        e.angle += 0.02;

        // Inicializar pilares si no existen
        if (!e.olPillarsSpawned) {
            e.olPillarsSpawned = false;
            e.olPillarHealth = [0, 0, 0, 0];
            e.olPillarAlive = [false, false, false, false];
            e.olPillarSpawnTimer = 120; // Esperar 2s antes de clavar pilares
        }

        e.olPillarSpawnTimer = (e.olPillarSpawnTimer || 120) - 1;

        if (e.olPillarSpawnTimer <= 0 && !e.olPillarsSpawned) {
            e.olPillarsSpawned = true;
            // Clavar 4 pilares en las esquinas
            let margin = 80;
            let cw = (typeof canvas !== 'undefined') ? canvas.width : 800;
            let ch = (typeof canvas !== 'undefined') ? canvas.height : 600;
            e.olPillarPositions = [
                { x: margin, y: margin },
                { x: cw - margin, y: margin },
                { x: margin, y: ch - margin },
                { x: cw - margin, y: ch - margin }
            ];
            e.olPillarHealth = [400, 400, 400, 400];
            e.olPillarAlive = [true, true, true, true];
            e.olCageClosing = false;
            e.olCageCloseTimer = 600; // 10s para destruir los pilares

            if (typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('🔴 OVERLORD APEX — FASE 1: ¡JAULA DE VECTORES ACTIVADA! Destruye los 4 pilares.', 5000);
            }
            if (typeof screenShake !== 'undefined') screenShake = 20;
            if (typeof createExplosion !== 'undefined') {
                e.olPillarPositions.forEach(pos => createExplosion(pos.x, pos.y, '#d4af37', 25, 2.0));
            }
        }

        // Contar pilares vivos
        let pillarsAlive = e.olPillarAlive ? e.olPillarAlive.filter(a => a).length : 0;

        // Bombardeo del área central mientras la jaula esté activa
        if (e.olPillarsSpawned && pillarsAlive > 0) {
            e.olCageCloseTimer = (e.olCageCloseTimer || 600) - 1;

            // Proyectiles de plasma pesados al centro cada 40 frames
            if (e.olTimer % 40 === 0 && typeof bullets !== 'undefined' && typeof canvas !== 'undefined') {
                let cw = canvas.width, ch = canvas.height;
                // Disparar hacia el centro del mapa con dispersión
                let centerX = cw / 2 + (Math.random() - 0.5) * 200;
                let centerY = ch / 2 + (Math.random() - 0.5) * 200;
                let ang = Math.atan2(centerY - e.y, centerX - e.x);
                bullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(ang) * 5.5, vy: Math.sin(ang) * 5.5,
                    radius: 10, color: '#d4af37', damage: 20, type: 'enemy'
                });
            }

            // Advertencia de cierre de jaula
            if (e.olCageCloseTimer === 180 && typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('⚠️ ¡LA JAULA SE CIERRA EN 3 SEGUNDOS! Destruye los pilares.', 3000);
            }

            // Si se acaba el tiempo, la jaula aplasta al jugador (daño masivo)
            if (e.olCageCloseTimer <= 0) {
                e.olCageCloseTimer = 600; // Reiniciar
                if (typeof takeDamage !== 'undefined' && typeof players !== 'undefined') {
                    players.forEach(p => {
                        if (!p.isDead) {
                            takeDamage(p, 40);
                            if (typeof showNetworkMessage !== 'undefined') {
                                showNetworkMessage('💥 ¡LA JAULA SE CERRÓ! Daño masivo recibido.', 2000);
                            }
                        }
                    });
                }
                if (typeof screenShake !== 'undefined') screenShake = 25;
            }
        }

        // Transición al 75% HP
        if (e.hp < e.maxHp * 0.75) {
            e.bossPhase = 1;
            e.olTimer = 0;
            e.olPillarsSpawned = false;
            e.olPillarAlive = [false, false, false, false];
            e.speed = 1.2;

            // Activar inversión de controles
            if (typeof players !== 'undefined') {
                players.forEach(p => {
                    p.controlsInverted = true;
                    p.recoilEnabled = true;
                });
            }

            if (typeof createExplosion !== 'undefined') createExplosion(e.x, e.y, '#d4af37', 60, 3.0);
            if (typeof screenShake !== 'undefined') screenShake = 25;
            if (typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('🔴 OVERLORD APEX — FASE 2: ¡INVERSIÓN MAGNÉTICA! Controles invertidos. El retroceso es real.', 6000);
            }
            // Teñir pantalla de ámbar (via clase CSS temporal)
            document.body.classList.add('magnetic-inversion');
        }
    }

    // =====================================================================
    // FASE 1: INVERSIÓN MAGNÉTICA (75% → 35% HP)
    // =====================================================================
    else if (e.bossPhase === 1) {
        e.color = '#d4af37';

        // Moverse al centro del mapa
        let targetX = (typeof canvas !== 'undefined') ? canvas.width / 2 : 400;
        let targetY = (typeof canvas !== 'undefined') ? canvas.height / 2 : 300;
        let toTargetX = targetX - e.x;
        let toTargetY = targetY - e.y;
        let toTargetDist = Math.hypot(toTargetX, toTargetY);
        if (toTargetDist > 10) {
            e.x += (toTargetX / toTargetDist) * e.speed;
            e.y += (toTargetY / toTargetDist) * e.speed;
        }
        e.angle += 0.025;

        // Asegurar que los controles siguen invertidos
        if (typeof players !== 'undefined') {
            players.forEach(p => {
                p.controlsInverted = true;
                p.recoilEnabled = true;
            });
        }

        // Ataques: espiral de proyectiles de gravedad inversa cada 60 frames
        if (e.olTimer % 60 === 0 && typeof bullets !== 'undefined') {
            e.olSpiralAngle = (e.olSpiralAngle || 0) + 0.5;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
                bullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(e.olSpiralAngle + a) * 4.5,
                    vy: Math.sin(e.olSpiralAngle + a) * 4.5,
                    radius: 8, color: '#d4af37', damage: 18, type: 'enemy'
                });
            }
        }

        // Ráfaga dirigida al jugador cada 90 frames
        if (e.olTimer % 90 === 0 && typeof bullets !== 'undefined') {
            let ang = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
            for (let j = -1; j <= 1; j++) {
                bullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(ang + j * 0.25) * 7,
                    vy: Math.sin(ang + j * 0.25) * 7,
                    radius: 7, color: '#ffaa00', damage: 22, type: 'enemy'
                });
            }
        }

        // Transición al 35% HP
        if (e.hp < e.maxHp * 0.35) {
            e.bossPhase = 2;
            e.olTimer = 0;
            e.olWallX = -20; // El muro empieza fuera del canvas por la izquierda
            e.olWallSpeed = 0.8; // Velocidad inicial del muro
            e.olPhase2Immune = true; // Inmune a balas normales

            // Desactivar inversión de controles
            if (typeof players !== 'undefined') {
                players.forEach(p => {
                    p.controlsInverted = false;
                    p.recoilEnabled = false;
                });
            }
            document.body.classList.remove('magnetic-inversion');

            if (typeof createExplosion !== 'undefined') createExplosion(e.x, e.y, '#ff0000', 80, 3.5);
            if (typeof screenShake !== 'undefined') screenShake = 30;
            if (typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('🚨 OVERLORD APEX — FASE FINAL: ¡MURO DE EJECUCIÓN! Solo el Mega-Láser Crítico puede dañarlo.', 7000);
            }
            // Vibración máxima del gamepad
            _triggerGamepadRumble();
        }
    }

    // =====================================================================
    // FASE 2: PROTOCOLO MURO DE EJECUCIÓN (35% → 0% HP)
    // =====================================================================
    else if (e.bossPhase === 2) {
        e.color = '#ff2200'; // Rojo de emergencia en fase final
        e.olPhase2Immune = true;

        // El jefe se mueve hacia el lado derecho del canvas
        let targetX = (typeof canvas !== 'undefined') ? canvas.width * 0.72 : 576;
        let targetY = (typeof canvas !== 'undefined') ? canvas.height / 2 : 300;
        let toTargetX = targetX - e.x;
        let toTargetY = targetY - e.y;
        let toTargetDist = Math.hypot(toTargetX, toTargetY);
        if (toTargetDist > 15) {
            e.x += (toTargetX / toTargetDist) * e.speed * 1.5;
            e.y += (toTargetY / toTargetDist) * e.speed * 1.5;
        }
        e.angle += 0.04;

        // Avanzar el muro láser
        e.olWallX = (e.olWallX || -20) + (e.olWallSpeed || 0.8);
        // Acelerar el muro con el tiempo
        e.olWallSpeed = Math.min(3.5, (e.olWallSpeed || 0.8) + 0.002);

        // Daño del muro al jugador
        if (typeof players !== 'undefined' && typeof canvas !== 'undefined') {
            players.forEach(p => {
                if (p.isDead) return;
                if (p.x < e.olWallX + 15 && p.dashTimer === 0) {
                    if (typeof takeDamage !== 'undefined') {
                        takeDamage(p, 3); // Daño continuo del muro
                    }
                    if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 5);
                }
                // Si el muro llega al borde derecho, reiniciar desde la izquierda
                if (e.olWallX > canvas.width + 20) {
                    e.olWallX = -20;
                    e.olWallSpeed = Math.min(3.5, (e.olWallSpeed || 0.8) + 0.3); // Cada ciclo más rápido
                    if (typeof showNetworkMessage !== 'undefined') {
                        showNetworkMessage('⚠️ ¡NUEVO CICLO DEL MURO! Velocidad aumentada.', 2000);
                    }
                }
            });
        }

        // Ataques adicionales: proyectiles desde el jefe cada 50 frames
        if (e.olTimer % 50 === 0 && typeof bullets !== 'undefined') {
            let ang = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
            bullets.push({
                x: e.x, y: e.y,
                vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6,
                radius: 9, color: '#ff2200', damage: 25, type: 'enemy'
            });
        }

        // Vibración continua del gamepad en fase 2
        if (e.olTimer % 60 === 0) {
            _triggerGamepadRumble();
        }
    }
}

// Dibuja los pilares de la Jaula de Vectores en el canvas (llamado desde draw())
function drawOverlordPillars(e, ctx) {
    if (!e || e.bossPhase !== 0 || !e.olPillarsSpawned || !e.olPillarPositions) return;

    let pillarsAlive = e.olPillarAlive || [];
    let positions = e.olPillarPositions || [];

    // Dibujar líneas láser entre pilares vivos
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 30, 30, 0.7)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff0000';

    let alivePosArr = positions.filter((_, i) => pillarsAlive[i]);
    // Conectar pilares adyacentes con líneas láser
    let connections = [[0,1],[0,2],[1,3],[2,3]]; // TL-TR, TL-BL, TR-BR, BL-BR
    connections.forEach(([a, b]) => {
        if (pillarsAlive[a] && pillarsAlive[b]) {
            ctx.beginPath();
            ctx.moveTo(positions[a].x, positions[a].y);
            ctx.lineTo(positions[b].x, positions[b].y);
            ctx.stroke();
        }
    });

    // Dibujar pilares
    positions.forEach((pos, i) => {
        if (!pillarsAlive[i]) return;
        let hpPct = (e.olPillarHealth[i] || 0) / 400;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#d4af37';
        // Cuerpo del pilar: rombo dorado
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(12, 0); ctx.lineTo(0, 18); ctx.lineTo(-12, 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(212, 175, 55, ${0.4 + hpPct * 0.6})`;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        // Barra de HP del pilar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-20, 24, 40, 5);
        ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff0000';
        ctx.fillRect(-20, 24, 40 * hpPct, 5);
        ctx.restore();
    });

    ctx.restore();
}

// Dibuja el Muro Láser de la Fase 2 (llamado desde draw())
function drawOverlordWall(e, ctx) {
    if (!e || e.bossPhase !== 2) return;
    if (typeof canvas === 'undefined') return;

    let wallX = e.olWallX || 0;

    ctx.save();
    // Gradiente del muro
    let grad = ctx.createLinearGradient(wallX - 20, 0, wallX + 20, 0);
    grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    grad.addColorStop(0.4, 'rgba(255, 50, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(255, 255, 100, 1.0)');
    grad.addColorStop(0.6, 'rgba(255, 50, 0, 0.85)');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff3300';
    ctx.fillRect(wallX - 20, 0, 40, canvas.height);

    // Línea central brillante
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(wallX, 0);
    ctx.lineTo(wallX, canvas.height);
    ctx.stroke();

    ctx.restore();
}

// Aplica retroceso al jugador cuando dispara (Fase 1: Inversión Magnética)
function applyWeaponRecoil(pObj, bulletAngle) {
    if (!pObj.recoilEnabled) return;
    // El retroceso empuja en dirección opuesta al disparo
    let recoilForce = 3.5;
    pObj.x -= Math.cos(bulletAngle) * recoilForce;
    pObj.y -= Math.sin(bulletAngle) * recoilForce;
}

// Vibración del gamepad (Fase 2)
function _triggerGamepadRumble() {
    try {
        const gamepads = navigator.getGamepads();
        for (let gp of gamepads) {
            if (gp && gp.vibrationActuator) {
                gp.vibrationActuator.playEffect('dual-rumble', {
                    startDelay: 0,
                    duration: 400,
                    weakMagnitude: 0.8,
                    strongMagnitude: 1.0
                });
            }
        }
    } catch (err) {
        // Vibración no soportada, ignorar
    }
}

// Daña un pilar específico de la Jaula de Vectores
function damageOverlordPillar(boss, pillarIndex, damage) {
    if (!boss || !boss.olPillarAlive || !boss.olPillarAlive[pillarIndex]) return;
    boss.olPillarHealth[pillarIndex] -= damage;
    if (boss.olPillarHealth[pillarIndex] <= 0) {
        boss.olPillarHealth[pillarIndex] = 0;
        boss.olPillarAlive[pillarIndex] = false;
        if (typeof createExplosion !== 'undefined' && boss.olPillarPositions) {
            let pos = boss.olPillarPositions[pillarIndex];
            createExplosion(pos.x, pos.y, '#d4af37', 30, 2.0);
        }
        if (typeof screenShake !== 'undefined') screenShake = 12;

        let remaining = boss.olPillarAlive.filter(a => a).length;
        if (typeof showNetworkMessage !== 'undefined') {
            if (remaining > 0) {
                showNetworkMessage(`💥 ¡PILAR DESTRUIDO! Quedan ${remaining} pilares.`, 2000);
            } else {
                showNetworkMessage('✅ ¡JAULA DESTRUIDA! El Overlord Apex está expuesto.', 3000);
                if (typeof screenShake !== 'undefined') screenShake = 25;
            }
        }
    }
}
