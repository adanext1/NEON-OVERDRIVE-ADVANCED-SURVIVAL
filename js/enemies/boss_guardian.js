// === COMPORTAMIENTO: GUARDIÁN DEL NÚCLEO (BOSS LVL 5) ===

function updateBossGuardian(e, dx, dy, dist, sx, sy, nearestPlayer) {
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;
    
    e.spiralTimer = (e.spiralTimer || 0) + 1;
    e.summonTimer = (e.summonTimer || 0) + 1;
    e.dashCooldown = ((e.dashCooldown !== undefined ? e.dashCooldown : 180)) - 1;

    // === FASE 0: PROTOCOLO NÚAES (100% → 60% HP · Verde #00ff88) ===
    if (e.bossPhase === 0) {
        e.color = '#00ff88';

        // Ataque de Proyectiles balanceado: Espiral lenta de 5 proyectiles cada 22 frames (menos spammy)
        if (e.spiralTimer % 22 === 0) {
            e.spiralAngle = (e.spiralAngle || 0) + 0.4;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) { // 5 proyectiles
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(e.spiralAngle + a) * 3.2, vy: Math.sin(e.spiralAngle + a) * 3.2, 
                    radius: 6, color: '#00ff88', damage: 12, type: 'enemy' 
                });
            }
        }

        // Invocación balanceada: 1 kamikaze cada 6s (360 frames)
        if (e.summonTimer >= 360) {
            e.summonTimer = 0;
            let sa = Math.random() * Math.PI * 2;
            enemies.push({ 
                id: Date.now() + Math.random(), 
                x: e.x + Math.cos(sa) * 65, y: e.y + Math.sin(sa) * 65, 
                radius: 11, speed: 4.2, hp: 20, maxHp: 20, color: '#00ff55', 
                credits: 5, xp: 8, isKamikaze: true, isBossMinion: true, 
                angle: 0, flashTicks: 0, vx: 0, vy: 0, isShielded: false, 
                isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, 
                hazardHitTimer: 0, armor: 0, dropType: 'core', 
                kamiState: 'CHASING', stateTimer: 80, dashVx: 0, dashVy: 0 
            });
            createExplosion(e.x, e.y, '#00ff88', 12, 1.0);
            showNetworkMessage('⚠️ GUARDIÁN: Núcleo de Apoyo Desplegado', 2000);
        }

        // Embestida balanceada: idle → telegrafía → dash
        if (e.bossAttackState === 'idle') {
            e.x += moveX * e.speed + sx; 
            e.y += moveY * e.speed + sy;
            e.angle = Math.atan2(dy, dx);
            if (e.dashCooldown <= 0) { 
                e.bossAttackState = 'telegraphing'; 
                e.bossStateTimer = 70; 
            }
        } else if (e.bossAttackState === 'telegraphing') {
            e.flashTicks = 3;
            e.bossStateTimer--;
            if (e.bossStateTimer <= 0) {
                e.bossAttackState = 'dashing'; 
                e.bossStateTimer = 22;
                let len = Math.hypot(dx, dy);
                e.dashVx = (dx / (len || 1)) * 11; // Reducido de 13
                e.dashVy = (dy / (len || 1)) * 11;
                screenShake = 4;
                showNetworkMessage('⚠️ ¡EMBESTIDA DEL GUARDIÁN!', 600);
            }
        } else if (e.bossAttackState === 'dashing') {
            e.x += e.dashVx; 
            e.y += e.dashVy;
            e.bossStateTimer--;
            if (e.bossStateTimer <= 0) { 
                e.bossAttackState = 'idle'; 
                e.dashCooldown = 240; 
                // Mini-nova de 6 balas al terminar el dash en fase 0
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                    bullets.push({ 
                        x: e.x, y: e.y, 
                        vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, 
                        radius: 5, color: '#00ff88', damage: 10, type: 'enemy' 
                    });
                }
            }
        }

        // Transición al 60% HP (FASE 1)
        if (e.hp < e.maxHp * 0.6) {
            e.bossPhase = 1;
            e.bossAttackState = 'idle';
            e.dashCooldown = 120;
            e.summonTimer = 0;
            e.spiralTimer = 0;
            e.speed += 0.3;
            // Gran explosión de transición
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, 
                    radius: 7, color: '#ffaa00', damage: 15, type: 'enemy' 
                });
            }
            createExplosion(e.x, e.y, '#ffaa00', 50, 2.5);
            screenShake = 18;
            showNetworkMessage('🔥 GUARDIÁN DEL NÚCLEO — FASE 2: TRIPLE HAZ DE PULSO ACTIVADO', 4000);
        }
    }

    // === FASE 1: SOBRECARGA DE REDUNDANCIA (60% → 30% HP · Naranja #ffaa00) ===
    else if (e.bossPhase === 1) {
        e.color = '#ffaa00';

        // Ataque dinámico: Dispara ráfagas de 3 tiros rápidos al jugador cada 120 frames
        e.pulseShootTimer = (e.pulseShootTimer || 0) + 1;
        if (e.pulseShootTimer >= 120) {
            e.pulseShootTimer = 0;
            let burstCount = 0;
            let burstInterval = setInterval(() => {
                if (e.hp <= 0 || e.bossPhase !== 1) { clearInterval(burstInterval); return; }
                // Recalcular dirección hacia el jugador
                let pdx = nearestPlayer.x - e.x;
                let pdy = nearestPlayer.y - e.y;
                let pdist = Math.hypot(pdx, pdy);
                bullets.push({
                    x: e.x, y: e.y,
                    vx: (pdx / (pdist || 1)) * 6.5, vy: (pdy / (pdist || 1)) * 6.5,
                    radius: 6, color: '#ffaa00', damage: 14, type: 'enemy'
                });
                burstCount++;
                if (burstCount >= 3) clearInterval(burstInterval);
            }, 150);
        }

        // Espiral balanceada de apoyo: 6 proyectiles cada 15 frames (en lugar de 8 cada 8)
        if (e.spiralTimer % 15 === 0) {
            e.spiralAngle = (e.spiralAngle || 0) + 0.45;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(e.spiralAngle + a) * 3.8, vy: Math.sin(e.spiralAngle + a) * 3.8, 
                    radius: 6, color: '#ffaa00', damage: 12, type: 'enemy' 
                });
            }
        }

        // Invocación balanceada: 2 kamikazes cada 5s (300 frames)
        if (e.summonTimer >= 300) {
            e.summonTimer = 0;
            for (let k = 0; k < 2; k++) {
                let sa = (k * Math.PI) + (e.spiralAngle || 0);
                enemies.push({ 
                    id: Date.now() + Math.random() + k, 
                    x: e.x + Math.cos(sa) * 70, y: e.y + Math.sin(sa) * 70, 
                    radius: 11, speed: 4.8, hp: 25, maxHp: 25, color: '#ffaa00', 
                    credits: 5, xp: 8, isKamikaze: true, isBossMinion: true, 
                    angle: 0, flashTicks: 0, vx: 0, vy: 0, isShielded: false, 
                    isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, 
                    hazardHitTimer: 0, armor: 0, dropType: 'core', 
                    kamiState: 'CHASING', stateTimer: 80, dashVx: 0, dashVy: 0 
                });
            }
            createExplosion(e.x, e.y, '#ffaa00', 15, 1.2);
        }

        // Embestida moderada
        if (e.bossAttackState === 'idle') {
            e.x += moveX * e.speed + sx; 
            e.y += moveY * e.speed + sy;
            e.angle = Math.atan2(dy, dx);
            if (e.dashCooldown <= 0) { 
                e.bossAttackState = 'telegraphing'; 
                e.bossStateTimer = 45; 
            }
        } else if (e.bossAttackState === 'telegraphing') {
            e.flashTicks = 3;
            e.bossStateTimer--;
            if (e.bossStateTimer <= 0) {
                e.bossAttackState = 'dashing'; 
                e.bossStateTimer = 24;
                let len = Math.hypot(dx, dy);
                e.dashVx = (dx / (len || 1)) * 14; 
                e.dashVy = (dy / (len || 1)) * 14;
                screenShake = 6;
            }
        } else if (e.bossAttackState === 'dashing') {
            e.x += e.dashVx; 
            e.y += e.dashVy;
            e.bossStateTimer--;
            if (e.bossStateTimer <= 0) {
                e.bossAttackState = 'idle'; 
                e.dashCooldown = 180;
                // Nova de 8 balas al terminar el dash en fase 1
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    bullets.push({ 
                        x: e.x, y: e.y, 
                        vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, 
                        radius: 5, color: '#ffaa00', damage: 12, type: 'enemy' 
                    });
                }
            }
        }

        // Transición al 30% HP (FASE 2: FALLO CATASTRÓFICO / GRAVEDAD DE COLAPSO)
        if (e.hp < e.maxHp * 0.3) {
            e.bossPhase = 2;
            e.speed = 0.2; 
            e.summonTimer = 0;
            e.spiralTimer = 0;
            // Explosión masiva de transición
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, 
                    radius: 8, color: '#ff0033', damage: 20, type: 'enemy' 
                });
            }
            createExplosion(e.x, e.y, '#ff0033', 60, 3.0);
            screenShake = 24;
            showNetworkMessage('🚨 GUARDIÁN DEL NÚCLEO — FASE FINAL: FALLO CRÍTICO Y COLAPSO GRAVITATORIO', 5000);
        }
    }

    // === FASE 2: FALLO CATASTRÓFICO DEL NÚCLEO (30% → 0% HP · Rojo Brillante #ff0033) ===
    else if (e.bossPhase === 2) {
        e.color = '#ff0033';

        // Movimiento errático y lento
        let floatAngle = Date.now() * 0.003;
        e.x += Math.cos(floatAngle) * 0.6;
        e.y += Math.sin(floatAngle) * 0.6;
        e.angle += 0.08;

        // Atracción gravitatoria: El núcleo colapsando atrae al jugador
        players.forEach(p => {
            if (p.isDead || p.dashTimer > 0) return;
            let pdx = e.x - p.x;
            let pdy = e.y - p.y;
            let pdist = Math.hypot(pdx, pdy);
            if (pdist < 400) {
                p.vortexPullCount = (p.vortexPullCount || 0) + 1;
                let pullForce = (400 - pdist) * 0.005;
                p.x += (pdx / (pdist || 1)) * pullForce;
                p.y += (pdy / (pdist || 1)) * pullForce;
            }
        });

        // Ataque: Anillos periódicos en expansión cada 60 frames (360º de peligro)
        if (e.spiralTimer % 60 === 0) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) { // 12 proyectiles
                bullets.push({ 
                    x: e.x, y: e.y, 
                    vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5, 
                    radius: 7, color: '#ff0033', damage: 16, type: 'enemy' 
                });
            }
            screenShake = Math.max(screenShake, 3);
        }

        // Mini ráfaga de chispas destructivas dirigidas al jugador cada 40 frames
        if (e.spiralTimer % 40 === 0) {
            let pdx = nearestPlayer.x - e.x;
            let pdy = nearestPlayer.y - e.y;
            let pdist = Math.hypot(pdx, pdy);
            bullets.push({
                x: e.x, y: e.y,
                vx: (pdx / (pdist || 1)) * 4.5 + (Math.random() - 0.5) * 1.5,
                vy: (pdy / (pdist || 1)) * 4.5 + (Math.random() - 0.5) * 1.5,
                radius: 5, color: '#ff5500', damage: 12, type: 'enemy'
            });
        }
    }
}
