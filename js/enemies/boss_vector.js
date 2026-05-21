// === COMPORTAMIENTO: VECTOR SUPREMO (BOSS LVL 10) ===

function updateBossVector(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.bossStateTimer = (e.bossStateTimer || 0) + 1;
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;

    // === FASE 0: CORTINA DE ESTRUCTURAS (100% → 70% HP · Cian) ===
    if (e.bossPhase === 0) {
        e.color = '#00ffcc';
        e.x += moveX * e.speed + sx; 
        e.y += moveY * e.speed + sy;
        e.angle = Math.atan2(dy, dx);

        // Ataque A: Anillo concéntrico de 16 proyectiles cuadrados cada 90 frames
        e.ringTimer = (e.ringTimer || 0) + 1;
        if (e.ringTimer >= 90) {
            e.ringTimer = 0;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, 
                    radius: 5, color: '#00ffcc', damage: 18, type: 'enemy', isSquare: true 
                });
            }
        }

        // Ataque B: Cruz de micro-hazards bajo el jugador cada 120 frames
        e.crossTimer = (e.crossTimer || 0) + 1;
        if (e.crossTimer >= 120) {
            e.crossTimer = 0;
            [[70,0],[-70,0],[0,70],[0,-70]].forEach(([ox, oy]) => {
                hazards.push({ 
                    x: nearestPlayer.x + ox, y: nearestPlayer.y + oy, 
                    radius: 32, timer: 60, maxTimer: 60, duration: 90, 
                    active: false, shockwaveRadius: 0, isCrossHazard: true 
                });
            });
            showNetworkMessage('⚠️ ¡MICRO-HAZARDS DETECTADOS!', 1200);
        }

        // Transición al 70% HP
        if (e.hp < e.maxHp * 0.7) {
            e.bossPhase = 1;
            e.bossLaserAngle = e.angle;
            e.speed = 0;
            e.bossStateTimer = 0;
            e.matrixAngle = e.angle;
            createExplosion(e.x, e.y, '#ff007f', 40, 2.5);
            screenShake = 15;
            showNetworkMessage('🔴 VECTOR SUPREMO — FASE 2: HAZ DE LUZ BIFURCADO · ¡INMUNIDAD FRONTAL ACTIVA!', 5000);
        }
    }

    // === FASE 1: HAZ DE LUZ BIFURCADO (70% → 30% HP · Magenta) ===
    else if (e.bossPhase === 1) {
        e.color = '#ff007f';
        // Anclado al centro
        e.x = canvas.width / 2; 
        e.y = canvas.height / 2;
        e.bossLaserAngle = (e.bossLaserAngle || e.angle) + 0.012; // Rotación horaria lenta
        e.angle = e.bossLaserAngle;
        // Actualizar ángulo de la Matriz (apunta al jugador para calcular inmunidad frontal en colisiones de bala)
        e.matrixAngle = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);

        // Daño del láser: balas a lo largo de los dos haces
        if (e.bossStateTimer % 3 === 0) {
            bullets.push({ 
                x: e.x, y: e.y, 
                vx: Math.cos(e.bossLaserAngle) * 14, vy: Math.sin(e.bossLaserAngle) * 14, 
                radius: 9, color: '#ff007f', damage: 22, type: 'enemy', isLaserBeam: true 
            });
            bullets.push({ 
                x: e.x, y: e.y, 
                vx: Math.cos(e.bossLaserAngle + Math.PI) * 14, vy: Math.sin(e.bossLaserAngle + Math.PI) * 14, 
                radius: 9, color: '#ff007f', damage: 22, type: 'enemy', isLaserBeam: true 
            });
        }

        // Transición al 30% HP
        if (e.hp < e.maxHp * 0.3) {
            e.bossPhase = 2;
            e.fragmentsSpawned = false;
        }
    }

    // === FASE 2: PROTOCOLO DE FRAGMENTACIÓN (30% → 0%) ===
    else if (e.bossPhase === 2) {
        if (!e.fragmentsSpawned) {
            e.fragmentsSpawned = true;
            let hpPerFrag = Math.max(200, Math.floor(e.hp / 4));
            [[-90,-90],[90,-90],[-90,90],[90,90]].forEach(([ox, oy], idx) => {
                enemies.push({
                    id: Date.now() + Math.random() + idx,
                    x: e.x + ox, y: e.y + oy,
                    radius: 22, speed: 3.2, hp: hpPerFrag, maxHp: hpPerFrag,
                    color: '#ff0000', credits: 40, xp: 60, angle: 0,
                    flashTicks: 0, vx: 0, vy: 0, isShielded: false,
                    isKamikaze: false, isEliteGold: false, bossPhase: 0,
                    bossInvulnTimer: 0, hazardHitTimer: 0, armor: 5,
                    isVectorFragment: true, kamiState: 'CHASING',
                    stateTimer: 50 + idx * 15, dashVx: 0, dashVy: 0, dropType: 'crystal'
                });
                createExplosion(e.x + ox, e.y + oy, '#ff0000', 15, 1.5);
            });
            createExplosion(e.x, e.y, '#ff0000', 70, 3.5);
            screenShake = 25;
            showNetworkMessage('🚨 FRAGMENTACIÓN ACTIVADA — ¡4 FRAGMENTOS LIBERADOS! Elimínalos a todos.', 5000);
            e.hp = 0; // Eliminar jefe original
        }
    }
}
