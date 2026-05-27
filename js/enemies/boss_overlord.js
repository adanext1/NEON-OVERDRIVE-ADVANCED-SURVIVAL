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
        if (!e.olPillarsInitialized) {
            e.olPillarsInitialized = true;
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

        // Seguridad: El Overlord Apex es inmune mientras los pilares estén vivos o en espera
        if (!e.olPillarsSpawned || pillarsAlive > 0) {
            e.olLastHp = e.olLastHp || e.hp;
            if (e.hp < e.olLastHp) {
                if (e.olPillarDamageAllowed) {
                    e.olLastHp = e.hp;
                    e.olPillarDamageAllowed = false;
                } else {
                    e.hp = e.olLastHp;
                }
            }
        }
        e.olLastHp = e.hp;

        // Bombardeo del área central y ataques dirigidos mientras la jaula esté activa
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

            // Ráfaga cinética directa hacia el jugador cada 75 frames (Dificulta estar boca a boca)
            if (e.olTimer % 75 === 0 && typeof bullets !== 'undefined') {
                let ang = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
                for (let d = -1; d <= 1; d++) {
                    bullets.push({
                        x: e.x, y: e.y,
                        vx: Math.cos(ang + d * 0.15) * 6.5, vy: Math.sin(ang + d * 0.15) * 6.5,
                        radius: 6, color: '#d4af37', damage: 15, type: 'enemy'
                    });
                }
            }

            // Bombardeo defensivo si el jugador se acerca demasiado
            if (dist < 210) {
                e.olProxCooldown = (e.olProxCooldown || 0) - 1;
                if (e.olProxCooldown <= 0 && typeof bullets !== 'undefined') {
                    e.olProxCooldown = 90;
                    if (typeof showNetworkMessage !== 'undefined') {
                        showNetworkMessage('⚠️ ¡BOMBARDEO DEFENSIVO! Aleja tu nave del Overlord.', 2000);
                    }
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                        bullets.push({
                            x: e.x, y: e.y,
                            vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5,
                            radius: 7, color: '#ffaa00', damage: 18, type: 'enemy'
                        });
                    }
                    if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 10);
                }
            } else {
                if (e.olProxCooldown > 0) e.olProxCooldown--;
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

        // Transición al 75% HP (Solo si los pilares fueron destruidos y baja del 75% HP)
        if (e.hp <= e.maxHp * 0.75 && pillarsAlive === 0 && e.olPillarsSpawned) {
            e.bossPhase = 1;
            e.olTimer = 0;
            e.olTransitionFlash = 1.0; // Flash de transición
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
            e.olTransitionFlash = 1.0; // Flash de transición
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

        // MECÁNICA: Láser de Fijación (Target-locking laser)
        e.lockTimer = (e.lockTimer || 0) + 1;
        if (e.lockTimer < 120) {
            // Seguir la posición del jugador más cercano
            e.lockX = nearestPlayer.x;
            e.lockY = nearestPlayer.y;
        }
        // A los 150 frames (2.5s), dispara un proyectil pesado
        if (e.lockTimer >= 150) {
            e.lockTimer = 0;
            let fireAng = Math.atan2(e.lockY - e.y, e.lockX - e.x);
            if (typeof bullets !== 'undefined') {
                bullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(fireAng) * 9.5, vy: Math.sin(fireAng) * 9.5,
                    radius: 12, color: '#ff0033', damage: 35, type: 'enemy',
                    isPurpleBlasterBullet: true
                });
            }
            if (typeof screenShake !== 'undefined') screenShake = Math.max(screenShake, 16);
            if (typeof playExplosionSound === 'function') playExplosionSound();
        }

        // MECÁNICA: Pozos de gravedad dinámicos
        if (e.gravityPulsar) {
            e.gravityPulsar.duration--;
            let gp = e.gravityPulsar;
            if (typeof players !== 'undefined') {
                players.forEach(p => {
                    if (p.isDead || p.dashTimer > 0) return;
                    let pdx = gp.x - p.x;
                    let pdy = gp.y - p.y;
                    let pdist = Math.hypot(pdx, pdy);
                    if (pdist < gp.radius) {
                        p.vortexPullCount = (p.vortexPullCount || 0) + 1;
                        let pullForce = (gp.radius - pdist) * 0.012; // Fuerte atracción
                        p.x += (pdx / (pdist || 1)) * pullForce;
                        p.y += (pdy / (pdist || 1)) * pullForce;
                    }
                });
            }
            if (gp.duration <= 0) {
                e.gravityPulsar = null;
            }
        } else {
            e.gravityPulsarTimer = (e.gravityPulsarTimer || 0) + 1;
            if (e.gravityPulsarTimer >= 180 && typeof canvas !== 'undefined') {
                e.gravityPulsarTimer = 0;
                let cw = canvas.width, ch = canvas.height;
                // Spawnear entre el muro y el boss
                let px = e.olWallX + (e.x - e.olWallX) * 0.5 + (Math.random() - 0.5) * 120;
                let py = nearestPlayer.y + (Math.random() - 0.5) * 150;
                px = Math.max(50, Math.min(cw - 50, px));
                py = Math.max(50, Math.min(ch - 50, py));
                e.gravityPulsar = {
                    x: px, y: py,
                    radius: 260,
                    duration: 120
                };
                if (typeof showNetworkMessage !== 'undefined') {
                    showNetworkMessage('⚠️ ¡ANOMALÍA GRAVITATORIA DETECTADA!', 2000);
                }
            }
        }

        // Tensión: Temblores y pánico al estar cerca del muro láser
        if (typeof players !== 'undefined') {
            players.forEach(p => {
                if (p.isDead) return;
                let wallDist = p.x - e.olWallX;
                if (wallDist < 220 && wallDist > 0) {
                    if (typeof screenShake !== 'undefined') {
                        screenShake = Math.max(screenShake, (220 - wallDist) * 0.08);
                    }
                }
            });
        }

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
        // Compartir vida: la barra de vida de los pilares representa el 25% de la vida del jefe
        let hpPct = Math.max(0, (e.hp - e.maxHp * 0.75) / (e.maxHp * 0.25));
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

// Dibuja el Muro Láser de la Fase 2 y los efectos de tensión (llamado desde draw())
function drawOverlordWall(e, ctx) {
    if (!e || e.bossPhase !== 2) return;
    if (typeof canvas === 'undefined') return;

    let wallX = e.olWallX || 0;

    // --- RAYOS ELÉCTRICOS DE ALTA TENSIÓN ---
    function drawArc(x1, y1, x2, y2, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.0 + Math.random() * 2.0;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        let steps = 6;
        for (let i = 1; i <= steps; i++) {
            let t = i / steps;
            let tx = x1 + (x2 - x1) * t;
            let ty = y1 + (y2 - y1) * t;
            if (i < steps) {
                let offset = (Math.random() - 0.5) * 22;
                let dx = x2 - x1, dy = y2 - y1;
                let len = Math.hypot(dx, dy);
                let px = -dy / (len || 1), py = dx / (len || 1);
                tx += px * offset;
                ty += py * offset;
            }
            ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.restore();
    }

    if (Math.random() < 0.45) {
        // Rayo desde el muro hacia el boss
        drawArc(wallX, Math.random() * canvas.height, e.x, e.y, 'rgba(255, 34, 0, 0.8)');
    }
    if (Math.random() < 0.3) {
        // Rayo vertical a lo largo del muro
        drawArc(wallX, Math.random() * canvas.height, wallX, Math.random() * canvas.height, 'rgba(255, 255, 100, 0.8)');
    }

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

    // --- LÁSER DE FIJACIÓN (Target Lock Line) ---
    if (e.lockTimer !== undefined && typeof players !== 'undefined') {
        let nearestP = players[0];
        let pct = e.lockTimer / 150;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.lockX || nearestP.x, e.lockY || nearestP.y);
        if (e.lockTimer > 120) {
            let flash = (e.olTimer % 6 < 3);
            ctx.strokeStyle = flash ? '#ffffff' : '#ff0033';
            ctx.lineWidth = 3.5;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0033';
        } else {
            ctx.strokeStyle = `rgba(255, 34, 0, ${0.15 + pct * 0.55})`;
            ctx.lineWidth = 1 + pct * 1.5;
        }
        ctx.stroke();

        // Cruz de fijación en las coordenadas bloqueadas
        if (e.lockTimer > 120) {
            ctx.beginPath();
            let lx = e.lockX || nearestP.x;
            let ly = e.lockY || nearestP.y;
            ctx.arc(lx, ly, 18, 0, Math.PI * 2);
            ctx.moveTo(lx - 25, ly); ctx.lineTo(lx + 25, ly);
            ctx.moveTo(lx, ly - 25); ctx.lineTo(lx, ly + 25);
            ctx.stroke();
        }
        ctx.restore();
    }

    // --- ANOMALÍA GRAVITATORIA (Vórtex visual) ---
    if (e.gravityPulsar) {
        let gp = e.gravityPulsar;
        ctx.save();
        ctx.translate(gp.x, gp.y);
        let rot = (e.olTimer * 0.06) % (Math.PI * 2);
        ctx.rotate(rot);

        // Núcleo del pozo de gravedad
        let gradPulse = ctx.createRadialGradient(0, 0, 5, 0, 0, 45);
        gradPulse.addColorStop(0, '#000000');
        gradPulse.addColorStop(0.3, '#aa00ff');
        gradPulse.addColorStop(0.7, '#ff007f');
        gradPulse.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradPulse;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fill();

        // Anillo exterior distorsionado
        ctx.beginPath();
        ctx.arc(0, 0, 60 + Math.sin(e.olTimer * 0.1) * 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(170, 0, 255, ${0.4 + Math.sin(e.olTimer * 0.08) * 0.2})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Brazos de espiral
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.7)';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 15, Math.sin(a) * 15, 30, a, a + Math.PI / 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // --- VIÑETA ROJA DE ALARMA DE PROXIMIDAD ---
    if (typeof players !== 'undefined') {
        let nearestP = players[0];
        let wallDist = nearestP.x - e.olWallX;
        if (wallDist < 220 && wallDist > 0) {
            let intensity = (220 - wallDist) / 220;
            let alpha = intensity * 0.28 * (0.7 + Math.sin(e.olTimer * 0.15) * 0.3);
            
            ctx.save();
            let radialGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height / 3, canvas.width / 2, canvas.height / 2, canvas.width / 2);
            radialGrad.addColorStop(0, 'rgba(255, 0, 0, 0)');
            radialGrad.addColorStop(1, `rgba(255, 0, 0, ${alpha})`);
            ctx.fillStyle = radialGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Texto de advertencia parpadeante en pantalla
            if (e.olTimer % 36 < 18) {
                ctx.font = "bold 13px 'Courier New'";
                ctx.fillStyle = '#ff1100';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#ff0000';
                ctx.fillText('🚨 WARNING: EXECUTION WALL PROXIMITY CRITICAL 🚨', canvas.width / 2, canvas.height * 0.88);
            }
            ctx.restore();
        }
    }
}

// Aplica retroceso al jugador cuando dispara (Fase 1: Inversión Magnética)
function applyWeaponRecoil(pObj, bulletAngle, force = 3.5) {
    if (!pObj.recoilEnabled) return;
    // El retroceso empuja en dirección opuesta al disparo
    pObj.x -= Math.cos(bulletAngle) * force;
    pObj.y -= Math.sin(bulletAngle) * force;
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

// Daña los pilares (que comparten vida con el jefe Overlord Apex)
function damageOverlordPillar(boss, pillarIndex, damage) {
    if (!boss || boss.bossPhase !== 0) return;
    boss.olPillarDamageAllowed = true;
    boss.hp -= damage;
    
    // Generar pequeña explosión de impacto en el pilar
    if (typeof createExplosion !== 'undefined' && boss.olPillarPositions) {
        let pos = boss.olPillarPositions[pillarIndex];
        createExplosion(pos.x, pos.y, '#d4af37', 5, 0.7);
    }
    
    // Si la vida del jefe cae por debajo de 75%, se destruyen todos los pilares
    if (boss.hp <= boss.maxHp * 0.75) {
        boss.hp = boss.maxHp * 0.75;
        // Crear gran explosión en cada pilar
        if (typeof createExplosion !== 'undefined' && boss.olPillarPositions) {
            boss.olPillarPositions.forEach(pos => {
                createExplosion(pos.x, pos.y, '#d4af37', 30, 2.0);
            });
        }
        boss.olPillarAlive = [false, false, false, false];
        if (typeof showNetworkMessage !== 'undefined') {
            showNetworkMessage('✅ ¡JAULA DE VECTORES DESTRUIDA! El Overlord Apex está expuesto.', 3000);
        }
        if (typeof screenShake !== 'undefined') screenShake = 25;
    }
}
