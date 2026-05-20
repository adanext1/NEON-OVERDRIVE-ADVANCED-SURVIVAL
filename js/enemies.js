// === LÓGICA DE ENEMIGOS Y JEFES ===

function spawnEnemy() {
    let x = Math.random() < 0.5 ? -40 : canvas.width + 40; let y = Math.random() * canvas.height;
    if (Math.random() < 0.5) { x = Math.random() * canvas.width; y = Math.random() < 0.5 ? -40 : canvas.height + 40; }
    let isBoss = (wave % 5 === 0) && enemiesToSpawn === 1; let typeChance = Math.random();
    let enemy = { 
        id: Date.now() + Math.random(), 
        x: x, y: y, angle: 0, flashTicks: 0, vx: 0, vy: 0, isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0, armor: 0 
    };

    if (isBoss) {
        enemy.radius = 45; enemy.speed = 1.0; enemy.hp = 350 + (wave * 120); enemy.maxHp = enemy.hp;
        enemy.color = '#ff0044'; enemy.credits = 150; enemy.xp = 200; enemy.isBoss = true; enemy.shootCooldown = 0; enemy.bossInvulnTimer = 90; enemy.dropType = 'crystal';
        enemy.armor = 10 + (wave * 2);
        
        // Propiedades específicas para el Jefe de la Oleada 5
        if (wave === 5) {
            enemy.bossAttackState = 'idle';
            enemy.bossStateTimer = 120; // Tiempo antes del primer ataque
            enemy.bossLaserAngle = 0;
            enemy.isCoreGuardian = true;
            enemy.hp = 3600;
            enemy.maxHp = enemy.hp;
            
        } else if (wave === 10) {
            enemy.isVectorSupreme = true;
            enemy.bossAttackState = 'idle';
            enemy.bossStateTimer = 120;
            enemy.shield = 1500; enemy.maxShield = 1500; // Escudo regenerable
            enemy.hp = 8500;
            enemy.maxHp = enemy.hp;
        }
    } else if (typeChance < 0.12 && wave >= 3) {
        // Escudado
        enemy.radius = 22; enemy.speed = 1.6; enemy.hp = 100 + (wave * 15); enemy.maxHp = enemy.hp;
        enemy.color = '#ffaa00'; enemy.credits = 25; enemy.xp = 40; enemy.isShielded = true; enemy.dropType = 'crystal';
        enemy.armor = 3 + (wave * 0.4);
    } else if (typeChance < 0.22 && wave >= 2) {
        // Kamikaze
        enemy.radius = 12; enemy.speed = 4.2; enemy.hp = 18 + (wave * 4); enemy.maxHp = enemy.hp;
        enemy.color = '#ff00ff'; enemy.credits = 15; enemy.xp = 15; enemy.isKamikaze = true; enemy.dropType = 'plate';
    } else if (typeChance < 0.27 && wave >= 4) {
        // Curador
        enemy.radius = 25; enemy.speed = 1.0; enemy.hp = 160 + (wave * 25); enemy.maxHp = enemy.hp;
        enemy.color = '#00ffaa'; enemy.credits = 30; enemy.xp = 50; enemy.isHealer = true; enemy.shootCooldown = 0; enemy.dropType = 'crystal';
    } else if (typeChance < 0.32 && wave >= 6) {
        // EMP Stalker
        enemy.radius = 16; enemy.speed = 2.0; enemy.hp = 70 + (wave * 10); enemy.maxHp = enemy.hp;
        enemy.color = '#ffffff'; enemy.credits = 20; enemy.xp = 30; enemy.isEMPStalker = true; enemy.isRevealed = false; enemy.dropType = 'core';
    } else if (typeChance < 0.35 && wave >= 7) {
        // Elite Gold
        enemy.radius = 35; enemy.speed = 0.5; enemy.hp = 300 + (wave * 50); enemy.maxHp = enemy.hp;
        enemy.color = '#ffff00'; enemy.credits = 100; enemy.xp = 150; enemy.isEliteGold = true; enemy.shootCooldown = 0; enemy.dropType = 'crystal';
    } else if (typeChance < 0.40 && wave >= 8) {
        enemy.radius = 18; enemy.speed = 2.5; enemy.hp = 100 + (wave * 15); enemy.maxHp = enemy.hp;
        enemy.color = '#00ffff'; enemy.credits = 10; enemy.xp = 20; enemy.dropType = 'core';
    } else {
        // Enemigo común
        enemy.radius = 17; enemy.speed = 2.2 + (wave * 0.12); enemy.hp = 30 + (wave * 6); enemy.maxHp = enemy.hp;
        enemy.color = '#9900ff'; enemy.credits = 7; enemy.xp = 12; enemy.dropType = Math.random() > 0.5 ? 'core' : 'plate';
    }
    enemies.push(enemy);
    
    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('spawn-enemy', enemy);
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i]; if (e.bossInvulnTimer > 0) e.bossInvulnTimer--;

        if (e.hp <= 0) {
            createExplosion(e.x, e.y, e.color, e.isBoss ? 70 : 12, e.isBoss ? 2 : 1);
            playExplosionSound();
            
            // Vampirismo (Life Steal) para el jugador más cercano
            let nearestP = players[0];
            let minDist = Math.hypot(e.x - players[0].x, e.y - players[0].y);
            players.forEach(p => {
                let d = Math.hypot(e.x - p.x, e.y - p.y);
                if (d < minDist) { minDist = d; nearestP = p; }
            });
            if (nearestP.lifeSteal) {
                nearestP.hp = Math.min(nearestP.maxHp, nearestP.hp + nearestP.lifeSteal);
                updateUI();
            }
            let dropMat = null; let roll = Math.random();
            if (e.isBoss || e.isEliteGold) dropMat = e.dropType; else if (roll < 0.25) dropMat = e.dropType;
            drops.push({ x: e.x, y: e.y, credits: e.credits, xp: e.xp, radius: 4, matType: dropMat });
            
            if (e.isSplitter) {
                for (let k = 0; k < 3; k++) {
                    let a = Math.random() * Math.PI * 2;
                    enemies.push({
                        x: e.x + Math.cos(a) * 15, y: e.y + Math.sin(a) * 15,
                        radius: 11, speed: 3.2, hp: 35, maxHp: 35,
                        color: '#00ff55', credits: 4, xp: 8,
                        angle: a, flashTicks: 0, vx: 0, vy: 0,
                        isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0,
                        dropType: 'core'
                    });
                }
            }
            enemies.splice(i, 1); 
            
            // Logro primer jefe
            if (e.isCoreGuardian && !userSave.unlockedArtifacts.includes('hyperdrive')) {
                userSave.unlockedArtifacts.push('hyperdrive');
                showNetworkMessage('🏆 LOGRO: ¡Derrotaste al Guardián! Desbloqueaste Motor Hiperespacial.', 5000);
                saveGame();
            }
            if (e.isVectorSupreme && !userSave.unlockedArtifacts.includes('heavy_hull')) {
                userSave.unlockedArtifacts.push('heavy_hull');
                showNetworkMessage('🏆 LOGRO: ¡Derrotaste a Vector Supremo! Desbloqueaste Casco Pesado.', 5000);
                saveGame();
            }
            
            continue;
        }

        // Encontrar jugador más cercano
        let nearestPlayer = players[0];
        minDist = Math.hypot(e.x - players[0].x, e.y - players[0].y);
        players.forEach(p => {
            if (p.isDead) return;
            let d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < minDist) { minDist = d; nearestPlayer = p; }
        });
        let dx = nearestPlayer.x - e.x;
        let dy = nearestPlayer.y - e.y;
        let dist = minDist;

        let sx = 0; let sy = 0;
        enemies.forEach(o => { if (o === e) return; let d = Math.hypot(o.x - e.x, o.y - e.y); if (d < (e.radius + o.radius) * 1.4) { sx -= (o.x - e.x) * 0.12; sy -= (o.y - e.y) * 0.12; } });

        if (e.isClone) {
            // IA de Kamikaze Avanzado para Clones de Vector
            e.stateTimer--;
            if (e.kamiState === 'CHASING') {
                e.angle = Math.atan2(dy, dx);
                let moveX = dist > 0 ? (dx / dist) : 0;
                let moveY = dist > 0 ? (dy / dist) : 0;
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
                
                if (e.stateTimer <= 0) {
                    e.kamiState = 'CHARGING';
                    e.stateTimer = 30; // 0.5 segundos
                }
            } else if (e.kamiState === 'CHARGING') {
                // Se detiene y brilla (flashTicks se usa visualmente)
                e.flashTicks = 2;
                if (e.stateTimer <= 0) {
                    e.kamiState = 'DASHING';
                    e.stateTimer = 20; // Dash rápido de 0.3s
                    // Fijar dirección del dash hacia el jugador en ese instante
                    let len = Math.hypot(dx, dy);
                    e.dashVx = (dx / len) * 12;
                    e.dashVy = (dy / len) * 12;
                }
            } else if (e.kamiState === 'DASHING') {
                e.x += e.dashVx;
                e.y += e.dashVy;
                if (e.stateTimer <= 0) {
                    // Explota al final del dash
                    e.hp = 0;
                    createExplosion(e.x, e.y, '#ff00ff', 20, 1.5);
                }
            }
        }
        else if (e.isCoreGuardian) {
            e.bossStateTimer--;
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            
            if (e.bossAttackState === 'idle') {
                // Movimiento normal persiguiendo
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
                e.angle = Math.atan2(dy, dx);
                
                if (e.bossStateTimer <= 0) {
                    // Cambiar a un ataque aleatorio
                    let attackRoll = Math.random();
                    if (attackRoll < 0.4) {
                        e.bossAttackState = 'spiral'; e.bossStateTimer = 180;
                    } else if (attackRoll < 0.7) {
                        e.bossAttackState = 'laser'; e.bossStateTimer = 120;
                        e.bossLaserAngle = e.angle;
                    } else {
                        e.bossAttackState = 'nova'; e.bossStateTimer = 60;
                    }
                    showNetworkMessage(`⚠️ JEFE: ¡Iniciando protocolo [${e.bossAttackState.toUpperCase()}]!`, 2000);
                }
            } else if (e.bossAttackState === 'spiral') {
                // Se mueve más lento y dispara en espiral
                e.x += moveX * 0.5 + sx; e.y += moveY * 0.5 + sy;
                e.angle += 0.05;
                if (e.bossStateTimer % 6 === 0) {
                    bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * 5, vy: Math.sin(e.angle) * 5, radius: 5, color: '#ff0055', damage: 15, type: 'enemy' });
                }
                if (e.bossStateTimer <= 0) { e.bossAttackState = 'idle'; e.bossStateTimer = 150; }
            } else if (e.bossAttackState === 'laser') {
                // Se detiene y dispara un láser gigante que barre
                e.bossLaserAngle += 0.015;
                // El dibujo se hace en el render, aquí calculamos daño si colisiona con el haz
                // Para simplificar, dispara balas en línea recta a gran velocidad simulando el haz
                if (e.bossStateTimer % 2 === 0) {
                     bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.bossLaserAngle) * 12, vy: Math.sin(e.bossLaserAngle) * 12, radius: 8, color: '#00ffff', damage: 25, type: 'enemy' });
                }
                if (e.bossStateTimer <= 0) { e.bossAttackState = 'idle'; e.bossStateTimer = 150; }
            } else if (e.bossAttackState === 'nova') {
                // Se detiene, carga y suelta un anillo de balas
                if (e.bossStateTimer === 1) {
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
                        bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, radius: 6, color: '#ffff00', damage: 20, type: 'enemy' });
                    }
                }
                if (e.bossStateTimer <= 0) { e.bossAttackState = 'idle'; e.bossStateTimer = 150; }
            }
        }
        else if (e.isVectorSupreme) {
            e.bossStateTimer--;
            
            // Regeneración de escudo si no está roto
            if (e.shield < e.maxShield && e.shield > 0) e.shield += 0.5;
            
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;

            if (e.bossPhase === 0) {
                // Fase 0: Intacto (Usa ataques básicos)
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
                e.angle = Math.atan2(dy, dx);
                
                // Ataque 1: Ráfaga de proyectiles dirigidos
                if (e.bossStateTimer % 60 === 0) {
                    for(let j=0; j<3; j++) {
                        let ang = e.angle + (j - 1) * 0.2;
                        bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6, radius: 6, color: '#00ffff', damage: 15, type: 'enemy' });
                    }
                }
                
                if (e.shield <= 0) {
                    e.bossPhase = 1;
                    e.bossStateTimer = 240; // 4 segundos de furia
                    e.speed = 2.0;
                    showNetworkMessage('⚠️ ¡ESCUDO DE VECTOR SUPREMO CAÍDO! Modo Agresivo activado.', 3000);
                }
            } 
            else if (e.bossPhase === 1) {
                // Fase 1: Sin Escudo (Agresivo, invoca clones kamikaze)
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
                e.angle = Math.atan2(dy, dx);
                
                // Invocar clones
                if (e.bossStateTimer % 80 === 0) {
                    let clone = {
                        id: Date.now() + Math.random(),
                        x: e.x + (Math.random() - 0.5) * 100,
                        y: e.y + (Math.random() - 0.5) * 100,
                        radius: 12, speed: 3.5, hp: 40, maxHp: 40,
                        color: '#ff00ff', credits: 0, xp: 5, isKamikaze: true, isClone: true,
                        kamiState: 'CHASING', stateTimer: 90, angle: 0, flashTicks: 0, vx: 0, vy: 0, armor: 0
                    };
                    enemies.push(clone);
                    createExplosion(clone.x, clone.y, '#ff00ff', 10, 1);
                }
                
                if (e.hp < e.maxHp * 0.4) {
                    e.bossPhase = 2;
                    e.bossStateTimer = 9999; // Fase final sostenida
                    showNetworkMessage('🚨 ¡FASE FINAL! Vector Supremo se ancla al centro.', 4000);
                }
            }
            else if (e.bossPhase === 2) {
                // Fase 2: El Haz de Luz Bifurcado (Color Magenta #ff007f)
                e.x = canvas.width / 2; e.y = canvas.height / 2; // Anclado
                e.angle += 0.03; // Rotación constante
                
                // Disparo de haz continuo (representado por ráfagas densas de balas)
                if (e.bossStateTimer % 3 === 0) {
                    // Dos chorros opuestos
                    bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle) * 8, vy: Math.sin(e.angle) * 8, radius: 7, color: '#ff007f', damage: 20, type: 'enemy' });
                    bullets.push({ x: e.x, y: e.y, vx: Math.cos(e.angle + Math.PI) * 8, vy: Math.sin(e.angle + Math.PI) * 8, radius: 7, color: '#ff007f', damage: 20, type: 'enemy' });
                }
                
                // Ataque secundario: Nova lenta cada 3 segundos
                if (e.bossStateTimer % 180 === 0) {
                    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                        bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, radius: 8, color: '#ffaa00', damage: 25, type: 'enemy' });
                    }
                }
            }
        }
        else if (e.isHealer) {
            e.shootCooldown--;
            // Se acerca al enemigo más herido (que no sea él mismo)
            let target = null; let minHpRatio = 1;
            enemies.forEach(o => {
                if (o !== e && !o.isHealer) {
                    let ratio = o.hp / o.maxHp;
                    if (ratio < minHpRatio) { minHpRatio = ratio; target = o; }
                }
            });

            if (target && minHpRatio < 0.8) {
                let hdx = target.x - e.x; let hdy = target.y - e.y; let hdist = Math.hypot(hdx, hdy);
                e.angle = Math.atan2(hdy, hdx);
                if (hdist > 150) { e.x += (hdx / hdist) * e.speed + sx; e.y += (hdy / hdist) * e.speed + sy; }
                
                if (e.shootCooldown <= 0 && hdist < 200) {
                    target.hp = Math.min(target.maxHp, target.hp + 50);
                    target.flashTicks = 5;
                    createExplosion(target.x, target.y, '#00ffaa', 10, 1);
                    spawnDamageText(target.x, target.y, 50, 'shield');
                    e.shootCooldown = 120;
                }
            } else {
                // Si no hay nadie a quien curar, sigue al jugador
                e.angle = Math.atan2(dy, dx);
                e.x += (dist > 0 ? (dx / dist) : 0) * e.speed + sx;
                e.y += (dist > 0 ? (dy / dist) : 0) * e.speed + sy;
            }
        }
        else if (e.isEMPStalker) {
            // Se acerca sigilosamente. Si está cerca y revelado, huye. Si no está revelado, se acerca.
            e.angle = Math.atan2(dy, dx);
            let moveDir = 1;
            if (e.isRevealed && dist < 200) moveDir = -1.5; // Huye rápido si lo descubren
            
            e.x += (dist > 0 ? (dx / dist) : 0) * e.speed * moveDir + sx;
            e.y += (dist > 0 ? (dy / dist) : 0) * e.speed * moveDir + sy;
            
            // Si llega muy cerca del jugador y no está revelado, explota y mete EMP
            if (dist < 50 && !e.isRevealed) {
                createExplosion(e.x, e.y, '#ffffff', 30, 2);
                nearestPlayer.empTimer = 180; // 3 segundos sin habilidades
                showNetworkMessage('📟 ¡SISTEMAS BLOQUEADOS POR INHABILITADOR!', 3000);
                e.hp = 0;
            }
        }
        else if (e.isEliteGold) {
             e.shootCooldown--;
             e.angle = Math.atan2(dy, dx);
             // Se mantiene a distancia media (300px)
             if (dist > 300) {
                 e.x += (dx / dist) * e.speed + sx;
                 e.y += (dy / dist) * e.speed + sy;
             } else if (dist < 250) {
                 e.x -= (dx / dist) * e.speed * 1.5 + sx;
                 e.y -= (dy / dist) * e.speed * 1.5 + sy;
             }
             
             if (e.shootCooldown <= 0) {
                 // Dispara 3 balas en abanico
                 for (let j = -1; j <= 1; j++) {
                     let ang = e.angle + j * 0.2;
                     bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, radius: 5, color: '#ffff00', damage: 15, type: 'enemy' });
                 }
                 e.shootCooldown = 90;
             }
        }
        else if (e.isHelixWeaver) {
            let targetAngle = Math.atan2(dy, dx);
            e.angle = targetAngle;
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
            
            // Dejar estela láser
            e.trailTimer++;
            if (e.trailTimer >= 15) {
                e.trailTimer = 0;
                hazards.push({ 
                    x: e.x, y: e.y, 
                    radius: 12, 
                    timer: 0, maxTimer: 0, 
                    duration: 240, 
                    active: true, 
                    isLaserTrail: true, 
                    color: '#33ff33' 
                });
            }
        } else if (e.isBinaryAegis) {
            let targetAngle = Math.atan2(dy, dx);
            e.angle = targetAngle;
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
            
            // Rotar escudos
            e.shieldAngle += 0.04;
        }
        else {
            // Enemigo común o Kamikaze
            e.angle = Math.atan2(dy, dx);
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            
            if (e.isKamikaze) {
                // Los kamikazes no frenan por colisión con otros enemigos (sx, sy reducidos)
                e.x += moveX * e.speed + sx * 0.2; e.y += moveY * e.speed + sy * 0.2;
            } else {
                e.x += moveX * e.speed + sx; e.y += moveY * e.speed + sy;
            }
        }

        if (e.flashTicks > 0) e.flashTicks--;

        // Colisión con jugador
        if (dist < e.radius + nearestPlayer.radius && nearestPlayer.dashTimer === 0 && !e.isHealer) {
            let dmg = 10;
            if (e.isKamikaze) { dmg = 30; e.hp = 0; createExplosion(e.x, e.y, '#ff00ff', 20, 1.5); }
            else if (e.isBoss) dmg = 25;
            else if (e.isEliteGold) dmg = 20;
            
            let finalDmg = dmg;
            if (nearestPlayer.overdriveTimer > 0) finalDmg = Math.floor(dmg * 0.5);
            
            takeDamage(nearestPlayer, finalDmg); 
            screenShake = (e.isKamikaze && e.kamiState === 'DASHING') ? 8 : 4;
        }
    }
}
