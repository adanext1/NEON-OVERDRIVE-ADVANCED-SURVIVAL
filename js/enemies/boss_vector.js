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
        
        // --- GESTIÓN DE ROTACIÓN DINÁMICA Y ER RÁTICA ---
        e.rotSpeed = e.rotSpeed !== undefined ? e.rotSpeed : 0.012;
        e.targetRotSpeed = e.targetRotSpeed !== undefined ? e.targetRotSpeed : 0.012;
        e.rotTimer = e.rotTimer !== undefined ? e.rotTimer : 180;
        e.rotDirection = e.rotDirection !== undefined ? e.rotDirection : 1;
        e.rotState = e.rotState || 'NORMAL';
        e.feintTimer = e.feintTimer || 0;

        e.rotTimer--;
        if (e.rotTimer <= 0) {
            let roll = Math.random();
            if (roll < 0.4) {
                // Inversión de dirección
                e.rotDirection = -e.rotDirection;
                e.targetRotSpeed = e.rotDirection * (0.008 + Math.random() * 0.012);
                e.rotTimer = 180 + Math.random() * 120;
                screenShake = Math.max(screenShake, 8);
                showNetworkMessage('🔄 ¡VECTOR SUPREMO: INVERSIÓN DE ROTACIÓN!', 1500);
            } else if (roll < 0.7) {
                // Amago / Finta
                e.rotState = 'FEINT';
                e.feintTimer = 0;
                e.rotTimer = 95; // Duración de la finta
                showNetworkMessage('⚠️ ¡ADVERTENCIA: ANOMALÍA DE ROTACIÓN DETECTADA!', 1500);
            } else {
                // Cambio de velocidad
                e.targetRotSpeed = e.rotDirection * (0.006 + Math.random() * 0.024);
                e.rotTimer = 120 + Math.random() * 120;
            }
        }

        // Procesar estado de Finta (Amago)
        if (e.rotState === 'FEINT') {
            e.feintTimer++;
            if (e.feintTimer < 30) {
                // Desacelerar a cero
                e.targetRotSpeed = 0;
            } else if (e.feintTimer < 55) {
                // Rotar falsamente al revés
                e.targetRotSpeed = -e.rotDirection * 0.020;
                screenShake = Math.max(screenShake, 2);
            } else if (e.feintTimer < 80) {
                // Snapback violento a la dirección original
                e.targetRotSpeed = e.rotDirection * 0.038;
                screenShake = Math.max(screenShake, 5);
            } else {
                // Fin de finta, reanudar normal
                e.rotState = 'NORMAL';
                e.feintTimer = 0;
                e.targetRotSpeed = e.rotDirection * 0.012;
                e.rotTimer = 120 + Math.random() * 120;
            }
        }

        // Interpolación suave y actualización del ángulo
        e.rotSpeed += (e.targetRotSpeed - e.rotSpeed) * 0.04;
        e.bossLaserAngle = (e.bossLaserAngle || e.angle) + e.rotSpeed;
        e.angle = e.bossLaserAngle;

        // Actualizar ángulo de la Matriz (apunta al jugador para calcular inmunidad frontal en colisiones de bala)
        e.matrixAngle = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);

        // Sacudida de pantalla constante sutil debido al poder del láser
        screenShake = Math.max(screenShake, 1.5);

        // Daño continuo al tocar el haz del láser visual
        players.forEach(p => {
            if (p.isDead || p.dashTimer > 0) return;
            let lCos = Math.cos(e.bossLaserAngle);
            let lSin = Math.sin(e.bossLaserAngle);
            let perpDist = Math.abs((p.x - e.x) * lSin - (p.y - e.y) * lCos);
            if (perpDist < p.radius + 10) {
                takeDamage(p, 1.2, e); // Daño de contacto continuo por frame
                screenShake = Math.max(screenShake, 2.5);
            }
        });

        // Disparo de proyectiles desincronizados en patrón de onda cruzada (braid)
        e.shootTimer = (e.shootTimer || 0) + 1;
        if (e.shootTimer % 4 === 0) {
            let waveOffset = Math.sin(e.bossStateTimer * 0.15) * 0.45; // oscila ±25 grados
            let startDist = e.radius * 0.8;
            
            // Haz A: proyectil con desfase
            let angleA = e.bossLaserAngle + waveOffset;
            bullets.push({ 
                x: e.x + Math.cos(angleA) * startDist, 
                y: e.y + Math.sin(angleA) * startDist, 
                vx: Math.cos(angleA) * 8.5, vy: Math.sin(angleA) * 8.5, 
                radius: 7, color: '#ff0033', damage: 16, type: 'enemy', isLaserBeam: true 
            });
            
            // Haz B: proyectil opuesto con desfase invertido (patrón cruzado)
            let angleB = e.bossLaserAngle + Math.PI - waveOffset;
            bullets.push({ 
                x: e.x + Math.cos(angleB) * startDist, 
                y: e.y + Math.sin(angleB) * startDist, 
                vx: Math.cos(angleB) * 8.5, vy: Math.sin(angleB) * 8.5, 
                radius: 7, color: '#ff0033', damage: 16, type: 'enemy', isLaserBeam: true 
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
            // Calcular vida base en función del HP MÁXIMO del jefe (en lugar de la vida actual baja)
            let hpPerFrag = Math.max(500, Math.floor(e.maxHp / 4)); // ~2125 HP base en Wave 10
            
            // Subtipos de fragmentos con un 50% de incremento en tamaño y estadísticas de aguante reforzadas
            let fragmentData = [
                { type: 'SHIELD',  radius: 39, speed: 1.6, hp: Math.floor(hpPerFrag * 2.5), armor: 24, color: '#ff3300' }, // Tanque (5312 HP)
                { type: 'TRACKER', radius: 27, speed: 3.8, hp: Math.floor(hpPerFrag * 1.3), armor: 8,  color: '#ff0055' }, // Rápido (2762 HP)
                { type: 'BLASTER', radius: 33, speed: 2.4, hp: Math.floor(hpPerFrag * 1.6), armor: 14, color: '#cc00ff' }, // Disparador (3400 HP)
                { type: 'VORTEX',  radius: 33, speed: 2.8, hp: Math.floor(hpPerFrag * 1.8), armor: 16, color: '#ff9900' }  // Vórtice/Succión (3825 HP)
            ];

            [[-90,-90],[90,-90],[-90,90],[90,90]].forEach(([ox, oy], idx) => {
                let data = fragmentData[idx];
                enemies.push({
                    id: Date.now() + Math.random() + idx,
                    x: e.x + ox, y: e.y + oy,
                    radius: data.radius, speed: data.speed, hp: data.hp, maxHp: data.hp,
                    color: data.color, credits: 40, xp: 60, angle: 0,
                    flashTicks: 0, vx: 0, vy: 0, isShielded: false,
                    isKamikaze: false, isEliteGold: false, bossPhase: 0,
                    bossInvulnTimer: 0, hazardHitTimer: 0, armor: data.armor,
                    isVectorFragment: true, fragmentIndex: idx, fragmentType: data.type,
                    convState: 'NORMAL', mirrorCooldown: 0, stunTimer: 0, dropType: 'crystal'
                });
                createExplosion(e.x + ox, e.y + oy, data.color, 25, 2.0);
            });
            createExplosion(e.x, e.y, '#ff0000', 70, 3.5);
            screenShake = 25;
            showNetworkMessage('🚨 FRAGMENTACIÓN CUÁNTICA — ¡4 NODOS REFORZADOS LIBERADOS!', 5000);
            e.hp = 0; // Eliminar jefe original
        }
    }
}

// === IA DE FRAGMENTO CUÁNTICO (FASE 3 VECTOR) ===
function updateVectorFragment(e, dx, dy, dist, sx, sy, nearestPlayer) {
    if (e.stunTimer > 0) {
        e.stunTimer--;
        e.color = '#7f8c8d'; // Gris metálico de desactivado al estar aturdido
        return;
    }
    
    if (e.mirrorCooldown > 0) e.mirrorCooldown--;

    // Inicializar subtipo según su índice de fragmento (fallback consistente)
    if (e.fragmentType === undefined) {
        let hpPerFrag = 2125;
        if (e.fragmentIndex === 0) {
            e.fragmentType = 'SHIELD';
            e.maxHp = Math.floor(hpPerFrag * 2.5); e.hp = e.maxHp; e.speed = 1.6; e.armor = 24; e.color = '#ff3300'; e.radius = 39;
        } else if (e.fragmentIndex === 1) {
            e.fragmentType = 'TRACKER';
            e.maxHp = Math.floor(hpPerFrag * 1.3); e.hp = e.maxHp; e.speed = 3.8; e.armor = 8; e.color = '#ff0055'; e.radius = 27;
        } else if (e.fragmentIndex === 2) {
            e.fragmentType = 'BLASTER';
            e.maxHp = Math.floor(hpPerFrag * 1.6); e.hp = e.maxHp; e.speed = 2.4; e.armor = 14; e.color = '#cc00ff'; e.radius = 33;
        } else {
            e.fragmentType = 'VORTEX';
            e.maxHp = Math.floor(hpPerFrag * 1.8); e.hp = e.maxHp; e.speed = 2.8; e.armor = 16; e.color = '#ff9900'; e.radius = 33;
        }
    }

    // --- GESTIÓN DE CICLO DINÁMICO Y PLANIFICACIÓN DE FINTAS ---
    if (e.currentCycleId === undefined) {
        e.currentCycleId = -1;
    }
    
    let cycleId = Math.floor(Date.now() / 15000);
    if (e.currentCycleId !== cycleId) {
        e.currentCycleId = cycleId;
        // Reiniciar variables por ciclo
        e.chargeDurationOffset = (Math.random() - 0.6) * 1000; // offset entre -600ms y +400ms
        e.willFeint = Math.random() < 0.45; // 45% probabilidad de fintear
        e.feintState = 'NONE'; // 'NONE' -> 'FEINTING' -> 'HOLD'
        e.feintTimer = 0;
        e.feintDirX = 0;
        e.feintDirY = 0;
        e.dashTargetX = 0;
        e.dashTargetY = 0;
        e.dashInitialized = false;
        e.isCharging = false;
    }

    let cycleTime = Date.now() % 15000;
    let adjustedDashTime = 13200 + e.chargeDurationOffset;
    
    // --- FASE D: EL APLAUSO (DASH CONVERGENTE AL CENTRO) ---
    if (cycleTime >= adjustedDashTime && cycleTime < adjustedDashTime + 1200) {
        if (!e.dashInitialized) {
            e.dashInitialized = true;
            e.convState = 'DASH';
            e.flashTicks = 0;
            // Fijar objetivo de embestida a donde estaba el jugador
            e.dashTargetX = nearestPlayer.x;
            e.dashTargetY = nearestPlayer.y;
            let len = Math.hypot(e.dashTargetX - e.x, e.dashTargetY - e.y);
            e.vx = (e.dashTargetX - e.x) / (len || 1) * 24.5;
            e.vy = (e.dashTargetY - e.y) / (len || 1) * 24.5;
            
            createExplosion(e.x, e.y, e.color, 25, 2.2);
            screenShake = Math.max(screenShake, 6);
        }
        
        let wasDashing = (e.vx !== 0 || e.vy !== 0);
        e.x += e.vx;
        e.y += e.vy;
        e.angle = Math.atan2(e.vy, e.vx);
        screenShake = Math.max(screenShake, 3);
        
        // Limitar movimiento para que no salgan volando fuera de la pantalla
        let margin = e.radius + 15;
        let hitWall = false;
        if (e.x < margin) { e.x = margin; e.vx = 0; hitWall = true; }
        if (e.x > canvas.width - margin) { e.x = canvas.width - margin; e.vx = 0; hitWall = true; }
        if (e.y < margin) { e.y = margin; e.vy = 0; hitWall = true; }
        if (e.y > canvas.height - margin) { e.y = canvas.height - margin; e.vy = 0; hitWall = true; }
        
        if (hitWall && wasDashing) {
            e.vx = 0;
            e.vy = 0;
            createExplosion(e.x, e.y, e.color, 8, 1.2);
            screenShake = Math.max(screenShake, 3);
        }
        
        // Dejar un rastro de partículas a alta velocidad
        if (Math.random() < 0.8) {
            particles.push({
                x: e.x, y: e.y,
                vx: -e.vx * 0.15 + (Math.random() - 0.5) * 1.5,
                vy: -e.vy * 0.15 + (Math.random() - 0.5) * 1.5,
                radius: Math.random() * 4 + 2,
                color: e.color, alpha: 1.0, decay: 0.035
            });
        }
        
        // Comprobar colisión entre fragmentos para auto-aturdirse
        let otherFrags = enemies.filter(x => x !== e && x.isVectorFragment && x.stunTimer <= 0);
        otherFrags.forEach(other => {
            if (Math.hypot(other.x - e.x, other.y - e.y) < 65) {
                e.stunTimer = 160; // ~2.6 segundos aturdido
                other.stunTimer = 160;
                e.vx = 0; e.vy = 0;
                other.vx = 0; other.vy = 0;
                createExplosion((e.x + other.x)/2, (e.y + other.y)/2, '#ffffff', 30, 2);
                screenShake = Math.max(screenShake, 12);
                showNetworkMessage('💥 ¡COLISIÓN FRAGMENTARIA! Nodos aturdidos.', 1500);
            }
        });
    }
    // --- FASE B/C: PREPARACIÓN Y TELEGRAFÍA EN ESQUINAS ---
    else if (cycleTime >= 9500 && cycleTime < adjustedDashTime) {
        e.convState = 'PREPARE';
        let cornerX = 100;
        let cornerY = 100;
        if (e.fragmentIndex === 1) { cornerX = canvas.width - 100; }
        else if (e.fragmentIndex === 2) { cornerX = canvas.width - 100; cornerY = canvas.height - 100; }
        else if (e.fragmentIndex === 3) { cornerY = canvas.height - 100; }
        
        // Determinar si ya es hora de la carga (1.7s antes del dash)
        let isChargingTime = (cycleTime >= adjustedDashTime - 1700);
        e.isCharging = isChargingTime;

        if (isChargingTime) {
            e.flashTicks = 2; // Parpadeo rápido cian/rojo
            
            // Si va a fintear y no está en proceso, iniciar la finta
            if (e.willFeint) {
                let feintTriggerTime = adjustedDashTime - 1200;
                if (cycleTime >= feintTriggerTime && e.feintState === 'NONE') {
                    e.feintState = 'FEINTING';
                    let dxP = nearestPlayer.x - e.x;
                    let dyP = nearestPlayer.y - e.y;
                    let len = Math.hypot(dxP, dyP);
                    e.feintDirX = dxP / (len || 1);
                    e.feintDirY = dyP / (len || 1);
                    e.feintTimer = 10; // Duración del lunge de finta (10 frames)
                    e.vx = e.feintDirX * 12.0;
                    e.vy = e.feintDirY * 12.0;
                    createExplosion(e.x, e.y, e.color, 12, 1.2);
                }
            }
        } else {
            e.feintState = 'NONE';
        }

        // Si está finteando, se mueve con la velocidad del lunge
        if (e.feintState === 'FEINTING') {
            e.x += e.vx;
            e.y += e.vy;
            e.feintTimer--;
            
            // Rastro de finta
            if (Math.random() < 0.6) {
                particles.push({
                    x: e.x, y: e.y,
                    vx: -e.vx * 0.2 + (Math.random() - 0.5),
                    vy: -e.vy * 0.2 + (Math.random() - 0.5),
                    radius: Math.random() * 2 + 1.5,
                    color: e.color, alpha: 1.0, decay: 0.04
                });
            }
            
            if (e.feintTimer <= 0) {
                e.feintState = 'HOLD';
                e.vx = 0;
                e.vy = 0;
                // Pequeña explosión de freno
                createExplosion(e.x, e.y, '#ffffff', 5, 0.8);
            }
        }
        // Si está en HOLD, se sacude e intensifica la carga
        else if (e.feintState === 'HOLD') {
            e.x += (Math.random() - 0.5) * 1.5;
            e.y += (Math.random() - 0.5) * 1.5;
            e.angle = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
        }
        // Si es normal o aún no empieza a cargar, viaja a su esquina
        else {
            let dxCorner = cornerX - e.x;
            let dyCorner = cornerY - e.y;
            let distCorner = Math.hypot(dxCorner, dyCorner);
            
            if (distCorner > 10) {
                e.x += (dxCorner / distCorner) * 9.5;
                e.y += (dyCorner / distCorner) * 9.5;
                e.angle = Math.atan2(dyCorner, dxCorner);
            } else {
                e.x = cornerX;
                e.y = cornerY;
                e.angle = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
            }
        }
    }
    // --- FASE A: COMPORTAMIENTO NORMAL ---
    else {
        e.convState = 'NORMAL';
        e.dashInitialized = false;
        e.feintState = 'NONE';
        e.isCharging = false;
        
        e.angle = Math.atan2(dy, dx);
        let moveX = dist > 0 ? (dx / dist) : 0;
        let moveY = dist > 0 ? (dy / dist) : 0;
        
        // Comportamiento según el subtipo de fragmento
        if (e.fragmentType === 'SHIELD') {
            // Posicionamiento interceptor enfrente de sus hermanos
            let brothers = enemies.filter(x => x.isVectorFragment && x.hp > 0 && x !== e);
            if (brothers.length > 0) {
                let avgX = 0, avgY = 0;
                brothers.forEach(b => { avgX += b.x; avgY += b.y; });
                avgX /= brothers.length;
                avgY /= brothers.length;
                
                // Vector del centro de los hermanos al jugador
                let dxP = nearestPlayer.x - avgX;
                let dyP = nearestPlayer.y - avgY;
                let distP = Math.hypot(dxP, dyP);
                
                // Mantenerse en frente de ellos, un 45% del camino hacia el jugador (máx 150px de offset)
                let targetOffset = Math.min(distP * 0.45, 150);
                let targetX = avgX + (dxP / (distP || 1)) * targetOffset;
                let targetY = avgY + (dyP / (distP || 1)) * targetOffset;
                
                let steerX = targetX - e.x;
                let steerY = targetY - e.y;
                let steerDist = Math.hypot(steerX, steerY);
                
                if (steerDist > 5) {
                    e.x += (steerX / steerDist) * e.speed + sx * 0.15;
                    e.y += (steerY / steerDist) * e.speed + sy * 0.15;
                } else {
                    e.x += sx * 0.15;
                    e.y += sy * 0.15;
                }
            } else {
                e.x += moveX * e.speed + sx * 0.15;
                e.y += moveY * e.speed + sy * 0.15;
            }
            
            // Efecto visual pasivo: aro de escudo
            if (Math.random() < 0.08) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                    particles.push({
                        x: e.x + Math.cos(a) * e.radius,
                        y: e.y + Math.sin(a) * e.radius,
                        vx: Math.cos(a) * 0.5,
                        vy: Math.sin(a) * 0.5,
                        radius: Math.random() * 1.5 + 1,
                        color: '#ff3300',
                        alpha: 0.6,
                        decay: 0.04
                    });
                }
            }
        } 
        else if (e.fragmentType === 'TRACKER') {
            e.x += moveX * e.speed + sx * 0.3;
            e.y += moveY * e.speed + sy * 0.3;
            
            // Rastro rosa rápido
            if (Math.random() < 0.45) {
                particles.push({
                    x: e.x - Math.cos(e.angle) * e.radius * 0.6 + (Math.random() - 0.5) * 3,
                    y: e.y - Math.sin(e.angle) * e.radius * 0.6 + (Math.random() - 0.5) * 3,
                    vx: -Math.cos(e.angle) * 1.5,
                    vy: -Math.sin(e.angle) * 1.5,
                    radius: Math.random() * 2 + 1,
                    color: '#ff0055',
                    alpha: 0.8,
                    decay: 0.03
                });
            }
        }
        else if (e.fragmentType === 'BLASTER') {
            if (dist > 300) {
                e.x += moveX * e.speed + sx * 0.2;
                e.y += moveY * e.speed + sy * 0.2;
            } else if (dist < 200) {
                e.x -= moveX * e.speed - sx * 0.2;
                e.y -= moveY * e.speed - sy * 0.2;
            } else {
                e.x += sx * 0.2;
                e.y += sy * 0.2;
            }
            
            // Disparar proyectil morado cada 80 frames
            e.shootTimer = (e.shootTimer || 0) + 1;
            if (e.shootTimer >= 80) {
                e.shootTimer = 0;
                let angleToP = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
                bullets.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(angleToP) * 5, vy: Math.sin(angleToP) * 5,
                    radius: 5, color: '#cc00ff', damage: 14, type: 'enemy',
                    isPurpleBlasterBullet: true
                });
                
                // Muzzle flash morado
                for (let i = 0; i < 10; i++) {
                    let a = angleToP + (Math.random() - 0.5) * 0.6;
                    let s = Math.random() * 4 + 2;
                    particles.push({
                        x: e.x + Math.cos(angleToP) * e.radius,
                        y: e.y + Math.sin(angleToP) * e.radius,
                        vx: Math.cos(a) * s,
                        vy: Math.sin(a) * s,
                        radius: Math.random() * 2.5 + 1.5,
                        color: '#cc00ff',
                        alpha: 1.0,
                        decay: 0.03
                    });
                }
            }
        }
        else if (e.fragmentType === 'VORTEX') {
            e.x += moveX * e.speed + sx * 0.25;
            e.y += moveY * e.speed + sy * 0.25;
            
            // Succión gravitacional leve sobre el jugador cercano si está en rango
            if (dist < 250 && nearestPlayer.dashTimer === 0) {
                let pull = 0.55;
                nearestPlayer.x -= moveX * pull;
                nearestPlayer.y -= moveY * pull;
            }
            
            // Espirales de succión dorada
            if (Math.random() < 0.35) {
                let angle = Math.random() * Math.PI * 2;
                let distG = 80 + Math.random() * 120;
                let px = e.x + Math.cos(angle) * distG;
                let py = e.y + Math.sin(angle) * distG;
                let vx = -Math.cos(angle + 0.3) * (2 + Math.random() * 2);
                let vy = -Math.sin(angle + 0.3) * (2 + Math.random() * 2);
                particles.push({
                    x: px, y: py,
                    vx: vx, vy: vy,
                    radius: Math.random() * 2 + 1,
                    color: '#ff9900',
                    alpha: 0.8,
                    decay: 0.03
                });
            }
        }
    }

    // --- CHEQUEAR COLISIÓN DEL JUGADOR CON EL VÍNCULO DE PLASMA ---
    let frags = enemies.filter(x => x.isVectorFragment && x.hp > 0 && x.stunTimer <= 0);
    if (frags.length > 1 && e.stunTimer <= 0 && e.convState !== 'PREPARE') {
        let myIdx = frags.indexOf(e);
        let nextFrag = frags[(myIdx + 1) % frags.length];
        
        let p = nearestPlayer;
        if (p && !p.isDead && p.dashTimer === 0) {
            let x0 = p.x; let y0 = p.y;
            let x1 = e.x; let y1 = e.y;
            let x2 = nextFrag.x; let y2 = nextFrag.y;
            
            let l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
            if (l2 > 0) {
                let t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / l2;
                t = Math.max(0, Math.min(1, t));
                let closestX = x1 + t * (x2 - x1);
                let closestY = y1 + t * (y2 - y1);
                let distToSegment = Math.hypot(x0 - closestX, y0 - closestY);
                
                if (distToSegment < p.radius + 3) {
                    takeDamage(p, 0.9, e);
                    screenShake = Math.max(screenShake, 5);
                    if (Math.random() < 0.05) {
                        showNetworkMessage('⚡ ¡VÍNCULO DE PLASMA SOBRECARGADO!', 1000);
                    }
                }
            }
        }
    }
}

// Contraataque de espejo al recibir daño
function triggerFragmentMirrorAttack(e) {
    if (e.stunTimer > 0 || e.convState === 'PREPARE') return;
    
    e.mirrorCooldown = e.mirrorCooldown || 0;
    if (e.mirrorCooldown <= 0) {
        e.mirrorCooldown = 15;
        
        let nearestP = players[0];
        let angleToP = Math.atan2(nearestP.y - e.y, nearestP.x - e.x);
        
        bullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(angleToP) * 7.5, vy: Math.sin(angleToP) * 7.5,
            radius: 5, color: '#ff0033', damage: 12, type: 'enemy'
        });
        
        createExplosion(e.x, e.y, '#ff0033', 4, 0.8);
        
        // Si es el fragmento ESCUDO, liberar chispas defensivas adicionales al ser golpeado
        if (e.fragmentType === 'SHIELD') {
            for (let i = 0; i < 8; i++) {
                let a = Math.random() * Math.PI * 2;
                let s = Math.random() * 2 + 1;
                particles.push({
                    x: e.x, y: e.y,
                    vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                    radius: Math.random() * 3 + 1,
                    color: '#ff3300', alpha: 1.0, decay: 0.03
                });
            }
        }
    }
}
