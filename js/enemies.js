// === LÓGICA DE ENEMIGOS Y JEFES (ORQUESTRADOR) ===

function spawnEnemy() {
    let x = Math.random() < 0.5 ? -40 : canvas.width + 40; let y = Math.random() * canvas.height;
    if (Math.random() < 0.5) { x = Math.random() * canvas.width; y = Math.random() < 0.5 ? -40 : canvas.height + 40; }
    let isBoss = (wave % 5 === 0) && enemiesToSpawn === 1; let typeChance = Math.random();
    let enemy = { 
        id: Date.now() + Math.random(), 
        x: x, y: y, angle: 0, flashTicks: 0, vx: 0, vy: 0, isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0, armor: 0, stunTimer: 0 
    };

    if (isBoss) {
        enemy.radius = 45; enemy.speed = 1.0; enemy.hp = 350 + (wave * 120); enemy.maxHp = enemy.hp;
        enemy.color = '#ff0044'; enemy.credits = 150; enemy.xp = 200; enemy.isBoss = true; enemy.shootCooldown = 0; enemy.bossInvulnTimer = 90; enemy.dropType = 'bossRelic';
        enemy.armor = 10 + (wave * 2);
        
        // Propiedades específicas para el Jefe de la Oleada 5
        if (wave === 5) {
            enemy.isCoreGuardian = true;
            enemy.bossAttackState = 'idle';
            enemy.bossStateTimer = 100;
            enemy.spiralAngle = 0;
            enemy.spiralTimer = 0;
            enemy.summonTimer = 0;
            enemy.dashCooldown = 180;
            enemy.dashVx = 0;
            enemy.dashVy = 0;
            enemy.hp = 3600;
            enemy.maxHp = enemy.hp;
            
            // Visuales de Advertencia y Música
            if (typeof triggerBossWarning !== 'undefined') {
                triggerBossWarning('ALERTA DE AMENAZA CRÍTICA', 'GUARDIÁN DEL NÚCLEO', 'PROTOCOLO DE SEGURIDAD NÚAES COMPROMETIDO');
            }
            if (typeof playMusic !== 'undefined') {
                playMusic('red_hazard_zone.mp3');
            }
            let hpCont = document.getElementById('boss-hp-container');
            if (hpCont) {
                hpCont.style.display = 'block';
                let label = hpCont.querySelector('.boss-hp-label');
                if (label) label.innerText = 'GUARDIÁN DEL NÚCLEO';
            }
        } else if (wave === 10) {
            enemy.isVectorSupreme = true;
            enemy.bossStateTimer = 120;
            enemy.bossLaserAngle = 0;
            enemy.ringTimer = 0;
            enemy.crossTimer = 0;
            enemy.matrixAngle = 0;
            enemy.shieldFlashTicks = 0;
            enemy.fragmentsSpawned = false;
            enemy.hp = 8500;
            enemy.maxHp = enemy.hp;
            
            // Visuales de Advertencia y Música
            if (typeof triggerBossWarning !== 'undefined') {
                triggerBossWarning('ALERTA DE AMENAZA DE CLASE VECTOR', 'VECTOR SUPREMO', 'DESTRUCTOR DE MATRICES Y CÉLULAS');
            }
            if (typeof playMusic !== 'undefined') {
                playMusic('the_geometric_siege.mp3');
            }
            let hpCont = document.getElementById('boss-hp-container');
            if (hpCont) {
                hpCont.style.display = 'block';
                let label = hpCont.querySelector('.boss-hp-label');
                if (label) label.innerText = 'VECTOR SUPREMO';
            }
        } else if (wave === 15) {
            enemy.isOverlordApex = true;
            enemy.bossPhase = 0;
            enemy.olTimer = 0;
            enemy.olPillarsSpawned = false;
            enemy.olPillarHealth = [0, 0, 0, 0];
            enemy.olPillarAlive = [false, false, false, false];
            enemy.olPillarPositions = null;
            enemy.olPillarSpawnTimer = 120;
            enemy.olCageCloseTimer = 600;
            enemy.olSpiralAngle = 0;
            enemy.olWallX = -20;
            enemy.olWallSpeed = 0.8;
            enemy.olPhase2Immune = false;
            enemy.hp = 14000;
            enemy.maxHp = enemy.hp;
            enemy.radius = 50;
            enemy.speed = 1.2;
            enemy.armor = 15 + (wave * 2);
            
            // Visuales de Advertencia y Música
            if (typeof triggerBossWarning !== 'undefined') {
                triggerBossWarning('ALERTA DE AMENAZA CLASE TITÁN', 'OVERLORD APEX', 'THE KINETIC ARCHITECT');
            }
            if (typeof playMusic !== 'undefined') {
                playMusic('final_boss_encounter.mp3');
            }
            let hpContOA = document.getElementById('boss-hp-container');
            if (hpContOA) {
                hpContOA.style.display = 'block';
                let label = hpContOA.querySelector('.boss-hp-label');
                if (label) label.innerText = 'OVERLORD APEX';
            }
        }
    } else if (typeChance < 0.10 && wave >= 3) {
        // Escudado
        enemy.radius = 22; enemy.speed = 1.6; enemy.hp = 100 + (wave * 15); enemy.maxHp = enemy.hp;
        enemy.color = '#ffaa00'; enemy.credits = 25; enemy.xp = 40; enemy.isShielded = true; enemy.dropType = 'crystal';
        enemy.armor = 3 + (wave * 0.4);
    } else if (typeChance < 0.18 && wave >= 2) {
        // Kamikaze
        enemy.radius = 12; enemy.speed = 4.2; enemy.hp = 18 + (wave * 4); enemy.maxHp = enemy.hp;
        enemy.color = '#f97316'; enemy.credits = 15; enemy.xp = 15; enemy.isKamikaze = true; enemy.dropType = 'plate';
    } else if (typeChance < 0.23 && wave >= 4) {
        // Curador
        enemy.radius = 25; enemy.speed = 1.0; enemy.hp = 160 + (wave * 25); enemy.maxHp = enemy.hp;
        enemy.color = '#00ffaa'; enemy.credits = 30; enemy.xp = 50; enemy.isHealer = true; enemy.shootCooldown = 0; enemy.dropType = 'crystal';
    } else if (typeChance < 0.28 && wave >= 6) {
        // EMP Stalker
        enemy.radius = 16; enemy.speed = 2.0; enemy.hp = 70 + (wave * 10); enemy.maxHp = enemy.hp;
        enemy.color = '#ffffff'; enemy.credits = 20; enemy.xp = 30; enemy.isEMPStalker = true; enemy.isRevealed = false; enemy.dropType = 'core';
    } else if (typeChance < 0.31 && wave >= 7) {
        // Elite Gold
        enemy.radius = 35; enemy.speed = 0.5; enemy.hp = 300 + (wave * 50); enemy.maxHp = enemy.hp;
        enemy.color = '#ffff00'; enemy.credits = 100; enemy.xp = 150; enemy.isEliteGold = true; enemy.shootCooldown = 0; enemy.dropType = 'crystal';
    } else if (typeChance < 0.35 && wave >= 7) {
        // Vortex Node
        enemy.radius = 24; enemy.speed = 0.8; enemy.hp = 180 + (wave * 20); enemy.maxHp = enemy.hp;
        enemy.color = '#00aaff'; enemy.credits = 30; enemy.xp = 40; enemy.isVortexNode = true; enemy.dropType = 'core';
    } else if (typeChance < 0.39 && wave >= 8) {
        // Helix Weaver
        enemy.radius = 18; enemy.speed = 1.8; enemy.hp = 80 + (wave * 12); enemy.maxHp = enemy.hp;
        enemy.color = '#33ff33'; enemy.credits = 20; enemy.xp = 30; enemy.isHelixWeaver = true; enemy.trailTimer = 0; enemy.dropType = 'crystal';
    } else if (typeChance < 0.43 && wave >= 9) {
        // Binary Aegis
        enemy.radius = 20; enemy.speed = 1.4; enemy.hp = 120 + (wave * 18); enemy.maxHp = enemy.hp;
        enemy.color = '#00ffff'; enemy.credits = 25; enemy.xp = 35; enemy.isBinaryAegis = true; enemy.shieldAngle = 0; enemy.dropType = 'plate';
        enemy.armor = 2 + (wave * 0.3);
    } else if (typeChance < 0.48 && wave >= 8) {
        // Enemigo Splitter (Se divide al morir)
        enemy.radius = 18; enemy.speed = 2.5; enemy.hp = 100 + (wave * 15); enemy.maxHp = enemy.hp;
        enemy.color = '#00ff88'; enemy.credits = 10; enemy.xp = 20; enemy.isSplitter = true; enemy.dropType = 'core';
    } else if (typeChance < 0.53 && wave >= 11) {
        // Flux Nullifier — Supresor de Torreta
        enemy.radius = 20; enemy.speed = 1.5; enemy.hp = 140 + (wave * 18); enemy.maxHp = enemy.hp;
        enemy.color = '#ffffff'; enemy.credits = 35; enemy.xp = 55; enemy.isFluxNullifier = true;
        enemy.fnTimer = 0; enemy.fnBeamActive = false; enemy.fnBeamTimer = 0; enemy.fnGlitchCooldown = 0;
        enemy.dropType = 'crystal';
    } else if (typeChance < 0.57 && wave >= 12) {
        // Glitch Weaver — Interferencia de Pantalla
        enemy.radius = 16; enemy.speed = 2.0; enemy.hp = 90 + (wave * 14); enemy.maxHp = enemy.hp;
        enemy.color = '#ff007f'; enemy.credits = 28; enemy.xp = 45; enemy.isGlitchWeaver = true;
        enemy.gwTimer = 0; enemy.gwGlitchCooldown = 30; enemy.gwHudDistortActive = false;
        enemy.dropType = 'core';
    } else if (typeChance < 0.60 && wave >= 13) {
        // Singularity Sentinel — Generador de Escudos Cruzados
        enemy.radius = 26; enemy.speed = 1.0; enemy.hp = 200 + (wave * 22); enemy.maxHp = enemy.hp;
        enemy.color = '#ffff00'; enemy.credits = 45; enemy.xp = 70; enemy.isSingularitySentinel = true;
        enemy.ssTimer = 0; enemy.ssLinkTarget = null; enemy.ssLinkSearchCooldown = 60; enemy.ssOrbitAngle = 0;
        enemy.dropType = 'crystal';
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
        let e = enemies[i]; 
        if (e.bossInvulnTimer > 0) e.bossInvulnTimer--;
        if (e.stunTimer > 0) {
            e.stunTimer--;
            if (e.isVectorFragment && Math.random() < 0.15) {
                let a = Math.random() * Math.PI * 2;
                let r = Math.random() * e.radius;
                particles.push({
                    x: e.x + Math.cos(a) * r,
                    y: e.y + Math.sin(a) * r,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    radius: Math.random() * 2 + 1,
                    color: Math.random() > 0.5 ? '#00ffff' : '#ffff00',
                    alpha: 1.0,
                    decay: Math.random() * 0.03 + 0.02
                });
            }
        }
        
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
            
            // Sobrecarga de Armas Ultra (Lv6): Matar cura 5 HP
            if (nearestP.qTurboTimer > 0) {
                let overloadMod = getActiveSkillModifier('sobrecarga_armas');
                if (overloadMod.level === 6) {
                    nearestP.hp = Math.min(nearestP.maxHp, nearestP.hp + 5);
                    spawnDamageText(nearestP.x, nearestP.y, '+5 HP', 'heal');
                    updateUI();
                }
            }
            
            // Batería de Repuesto Ultra (Reciclaje): matar reduce 0.5s CD activo
            let cdLvl = getPassiveLevel('passive_cooldown');
            if (cdLvl === 6) {
                let cdReduction = 30; // 0.5s en 60fps
                if ((nearestP.pulseCooldown || 0) > 0) nearestP.pulseCooldown = Math.max(0, nearestP.pulseCooldown - cdReduction);
                else if ((nearestP.qCooldown || 0) > 0) nearestP.qCooldown = Math.max(0, nearestP.qCooldown - cdReduction);
                else if ((nearestP.dashCooldown || 0) > 0) nearestP.dashCooldown = Math.max(0, nearestP.dashCooldown - cdReduction);
            }
            
            // Inyector de Adrenalina: matar élite da boost de cadencia de fuego
            let adrenalLvl = getPassiveLevel('passive_adrenal');
            if (adrenalLvl > 0 && (e.isEliteGold || e.isBoss)) {
                nearestP.overdriveTimer = Math.max(nearestP.overdriveTimer || 0, 300); // 5s boost cadencia
                if (adrenalLvl === 6) {
                    nearestP.minigunHeatMod = 0; // Sin consumo de calor (Estado de Flujo)
                    setTimeout(() => { if (nearestP) nearestP.minigunHeatMod = 1; }, 5000);
                }
                showNetworkMessage('💉 ¡ADRENALINA! Cadencia +100% por 5s', 1500);
            }
            
            // Transmisor de Energía: al morir enemigo con crystal, dar boost a aliados
            if (e.dropType === 'crystal') {
                let transmLvl = getPassiveLevel('passive_ally_dmg');
                if (transmLvl > 0) {
                    players.forEach(p => {
                        p.transmitterBuff = Math.max(p.transmitterBuff || 0, 600); // 10s
                        p.transmitterLvl = transmLvl;
                    });
                }
            }
            let dropMat = null; let roll = Math.random();
            if (e.isBoss || e.isEliteGold) dropMat = e.dropType; else if (roll < 0.25) dropMat = e.dropType;
            drops.push({ x: e.x, y: e.y, credits: e.credits, xp: e.xp, radius: 4, matType: dropMat });
            
            if (e.isSplitter) {
                for (let k = 0; k < 3; k++) {
                    let a = Math.random() * Math.PI * 2;
                    enemies.push({
                        id: Date.now() + Math.random() + k,
                        x: e.x + Math.cos(a) * 15, y: e.y + Math.sin(a) * 15,
                        radius: 11, speed: 3.2, hp: 35, maxHp: 35,
                        color: '#00ff55', credits: 4, xp: 8,
                        angle: a, flashTicks: 0, vx: 0, vy: 0,
                        isShielded: false, isKamikaze: false, isEliteGold: false, bossPhase: 0, bossInvulnTimer: 0, hazardHitTimer: 0,
                        dropType: 'core'
                    });
                }
            }
            if (e.isVectorFragment) {
                // Crear zona de Glitch de ralentización (hazard)
                hazards.push({
                    x: e.x, y: e.y,
                    radius: 75, timer: 0, maxTimer: 0, duration: 360,
                    active: true, shockwaveRadius: 0, isGlitchZone: true
                });
                createExplosion(e.x, e.y, '#ff007f', 25, 2.0);
            }
            enemies.splice(i, 1); 
            
            // Logro primer jefe
            if (e.isCoreGuardian && userSave && userSave.unlockedArtifacts && !userSave.unlockedArtifacts.includes('hyperdrive')) {
                userSave.unlockedArtifacts.push('hyperdrive');
                showNetworkMessage('🏆 LOGRO: ¡Derrotaste al Guardián! Desbloqueaste Motor Hiperespacial.', 5000);
                saveGame();
            }
            if (e.isVectorSupreme && userSave && userSave.unlockedArtifacts && !userSave.unlockedArtifacts.includes('heavy_hull')) {
                userSave.unlockedArtifacts.push('heavy_hull');
                showNetworkMessage('🏆 LOGRO: ¡Derrotaste a Vector Supremo! Desbloqueaste Casco Pesado.', 5000);
                saveGame();
            }
            if (e.isOverlordApex && userSave && userSave.unlockedArtifacts && !userSave.unlockedArtifacts.includes('kinetic_core')) {
                userSave.unlockedArtifacts.push('kinetic_core');
                showNetworkMessage('🏆 LOGRO LEGENDARIO: ¡Derrotaste al OVERLORD APEX! Desbloqueaste Núcleo Cinético.', 7000);
                saveGame();
            }
            // Limpiar minions invocados por el boss para evitar trabarse
            if (e.isBoss || e.isCoreGuardian || e.isVectorSupreme || e.isOverlordApex) {
                // Limpiar efectos especiales del Overlord Apex
                if (e.isOverlordApex) {
                    if (typeof players !== 'undefined') {
                        players.forEach(p => {
                            p.controlsInverted = false;
                            p.recoilEnabled = false;
                        });
                    }
                    document.body.classList.remove('magnetic-inversion');
                    if (typeof _clearGlitchHudDistort !== 'undefined') _clearGlitchHudDistort();
                }
                for (let j = enemies.length - 1; j >= 0; j--) {
                    if (enemies[j].isBossMinion) enemies.splice(j, 1);
                }
                enemiesToSpawn = 0; // forzar fin de oleada en el próximo check
            }
            
            continue;
        }

        // Encontrar jugador más cercano
        let nearestPlayer = players[0];
        let minDist = Math.hypot(e.x - players[0].x, e.y - players[0].y);
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

        // Ruteo a los módulos correspondientes
        if (e.stunTimer > 0) {
            // Aturdido: no hacer nada
        } else if (e.isClone || e.isKamikaze) {
            updateKamikazeEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isVectorFragment) {
            updateVectorFragment(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isCoreGuardian) {
            updateBossGuardian(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isVectorSupreme) {
            updateBossVector(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isOverlordApex) {
            updateBossOverlord(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isFluxNullifier) {
            updateFluxNullifier(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isGlitchWeaver) {
            updateGlitchWeaver(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isSingularitySentinel) {
            updateSingularitySentinel(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isHealer) {
            updateHealerEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isEMPStalker) {
            updateStalkerEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isEliteGold) {
            updateEliteGoldEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isVortexNode) {
            updateVortexNode(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isHelixWeaver) {
            updateHelixWeaver(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isBinaryAegis) {
            updateBinaryAegis(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else if (e.isShielded) {
            updateShieldedEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        } else {
            updateCommonEnemy(e, dx, dy, dist, sx, sy, nearestPlayer);
        }

        if (e.flashTicks > 0) e.flashTicks--;

        // Colisión con jugador
        if (dist < e.radius + nearestPlayer.radius && nearestPlayer.dashTimer === 0 && !e.isHealer) {
            let dmg = 10;
            if (e.isKamikaze) { dmg = 30; e.hp = 0; createExplosion(e.x, e.y, e.color, 20, 1.5); }
            else if (e.isBoss) dmg = 25;
            else if (e.isEliteGold) dmg = 20;
            
            let finalDmg = dmg;
            if (nearestPlayer.overdriveTimer > 0) finalDmg = Math.floor(dmg * 0.5);
            
            takeDamage(nearestPlayer, finalDmg, e); 
            screenShake = (e.isKamikaze && e.kamiState === 'DASHING') ? 8 : 4;
        }
    }
}
