// === SISTEMA DE ARMAS ===

function fireMegaLaser(pObj) {
    let charge = pObj.laserCharge;
    pObj.laserCharge = 0; // Resetear carga
    
    let targetAngle = pObj.angle;
    
    // Fases de Potencia
    if (charge < 60) {
        // Fase 1: Spameo (Menos de 1s)
        let dmg = 15 * pObj.damageModifier * (pObj.laserDmgMod || 1.0);
        bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(targetAngle) * 12, vy: Math.sin(targetAngle) * 12, radius: 3, color: '#00ffcc', damage: dmg, type: 'laser_thin', duration: 15 });
        pObj.laserCooldown = 30; // 0.5s de cooldown
        pObj.maxLaserCooldown = 30;
        playLaserFireSound(0.5);
        if (pObj.recoilEnabled) applyWeaponRecoil(pObj, targetAngle);
    }
    else if (charge >= 60 && charge < 120) {
        // Fase 2: Carga Óptima (1s a 2s)
        let dmg = 100 * pObj.damageModifier * (pObj.laserDmgMod || 1.0);
        bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(targetAngle) * 15, vy: Math.sin(targetAngle) * 15, radius: 8, color: '#ffff00', damage: dmg, type: 'laser_medium', duration: 30 });
        pObj.laserCooldown = 240; // 4s de cooldown
        pObj.maxLaserCooldown = 240;
        playLaserFireSound(1.0);
        if (pObj.recoilEnabled) { applyWeaponRecoil(pObj, targetAngle); applyWeaponRecoil(pObj, targetAngle); }
    }
    else if (charge >= 120 && charge < 180) {
        // Fase 3: Carga Crítica (2s a 3s)
        let dmg = 300 * pObj.damageModifier * (pObj.laserDmgMod || 1.0);
        bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(targetAngle) * 20, vy: Math.sin(targetAngle) * 20, radius: 15, color: '#ff007f', damage: dmg, type: 'laser_heavy', duration: 100 });
        pObj.laserCooldown = 480; // 8s de cooldown
        pObj.maxLaserCooldown = 480;
        screenShake = 15;
        playLaserFireSound(2.0);
        // Retroceso fuerte en fase crítica
        if (pObj.recoilEnabled) {
            applyWeaponRecoil(pObj, targetAngle);
            applyWeaponRecoil(pObj, targetAngle);
            applyWeaponRecoil(pObj, targetAngle);
            screenShake = Math.max(screenShake, 18);
        }
    }
    else {
        // Fase 4: El Castigo (Más de 3s)
        let selfDmg = pObj.maxHp * 0.15;
        takeDamage(pObj, selfDmg);
        pObj.laserCooldown = 360; // 6s de cooldown (bloqueo)
        pObj.maxLaserCooldown = 360;
        createExplosion(pObj.x, pObj.y, '#ff0000', 30, 2);
        screenShake = 20;
        spawnDamageText(pObj.x, pObj.y, selfDmg, 'hazard');
        playExplosionSound(); // Sonido de explosión por castigo
    }
}

function fireMinigun(pObj) {
    if (pObj.minigunOverheat) return;
    
    let now = Date.now();
    pObj.minigunSpool++; // Incrementar spool-up
    
    // Cadencia y daño según el spool
    let fireRate = 120; // Lento al principio
    let dmg = 5 * pObj.damageModifier;
    
    if (pObj.minigunSpool > 30) {
        // Después de 0.5s
        fireRate = 40; // Hiper-cadencia
        dmg = 8 * pObj.damageModifier;
    }
    
    if (!pObj.lastMinigunShot) pObj.lastMinigunShot = 0;
    if (now - pObj.lastMinigunShot < fireRate) return;
    pObj.lastMinigunShot = now;
    playMinigunFireSound();
    
    // Dispersión dinámica
    let spread = 0.05;
    if (pObj.minigunSpool > 60) spread = 0.2; // Más dispersión con el tiempo
    
    let targetAngle = pObj.angle + (Math.random() - 0.5) * spread;
    
    bullets.push({ 
        x: pObj.x, y: pObj.y, 
        vx: Math.cos(targetAngle) * 15, vy: Math.sin(targetAngle) * 15, 
        radius: 4, color: '#ffff00', damage: dmg, type: 'minigun' 
    });
    
    // Incrementar calor
    pObj.minigunHeat += 2 * (pObj.minigunHeatMod || 1.0);
    if (pObj.minigunHeat >= 300) {
        pObj.minigunOverheat = true;
        pObj.minigunCooldown = 180 * (pObj.minigunCooldownMod || 1.0); // 3s base
        showNetworkMessage('🔥 ¡MINIGUN SOBRECALENTADA!', 2000);
    }
}

function triggerRearDischarge(pObj) {
    let dmg = 30 * pObj.damageModifier;
    let backAngle = pObj.angle + Math.PI;
    
    enemies.forEach(e => {
        let dx = e.x - pObj.x;
        let dy = e.y - pObj.y;
        let dist = Math.hypot(dx, dy);
        
        if (dist < 150) {
            let angleToEnemy = Math.atan2(dy, dx);
            let angleDiff = Math.abs(angleToEnemy - backAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (angleDiff < Math.PI / 2) {
                e.hp -= dmg;
                spawnDamageText(e.x, e.y, dmg);
                
                let pushForce = 5;
                e.x += Math.cos(angleToEnemy) * pushForce;
                e.y += Math.sin(angleToEnemy) * pushForce;
                
                createExplosion(e.x, e.y, '#00ffff', 5, 0.5);
            }
        }
    });
    
    // Efecto visual
    for (let i = 0; i < 20; i++) {
        let a = backAngle + (Math.random() - 0.5) * Math.PI;
        particles.push({
            x: pObj.x + Math.cos(a) * 20,
            y: pObj.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 4,
            vy: Math.sin(a) * 4,
            radius: Math.random() * 3 + 1,
            color: '#00ffff',
            alpha: 1,
            decay: 0.05
        });
    }
}

function fireWeapon(pObj) {
    if (!pObj) pObj = players[0];
    
    if (pObj.isTurret) {
        fireMinigun(pObj);
        return;
    }
    
    let now = Date.now(); 
    let wep = WEAPONS[pObj.weapons[pObj.currentWeaponIndex]];
    if (!wep) return; // arma no reconocida, ignorar disparo
    
    let mods = pObj.weaponUpgrades[pObj.weapons[pObj.currentWeaponIndex]] || { damage: 0, fireRate: 0 };
    let baseRate = wep.fireRate - mods.fireRate;
    if (baseRate < 60) baseRate = 60;
    let currentFireRate = pObj.overdriveTimer > 0 ? baseRate / 2 : baseRate;
    if (currentFireRate < 30) currentFireRate = 30;
    let bulletColor = pObj.overdriveTimer > 0 ? '#ffff00' : wep.color;

    if (!pObj.lastShot) pObj.lastShot = 0;
    if (now - pObj.lastShot < currentFireRate || pObj.dashTimer > 0) return;
    pObj.lastShot = now;
    let targetAngle = pObj.angle; 
    screenShake = wep.type === 'plasma' ? 10 : 3;

    let baseDmg = wep.damage + mods.damage;
    let finalDmg = baseDmg * pObj.damageModifier;

    if (wep.type === 'plasma') {
        playPlasmaSound();
    } else {
        playLaserSound();
    }

    if (wep.type === 'single' || wep.type === 'plasma') {
        let baseAoERadius = wep.radius || 0;
        let finalAoERadius = (baseAoERadius > 0 && userSave.artifacts.singularity > 0)
            ? baseAoERadius * (1 + userSave.artifacts.singularity * 0.1)
            : baseAoERadius;
        bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(targetAngle) * wep.speed, vy: Math.sin(targetAngle) * wep.speed, radius: wep.type === 'plasma' ? 9 : 5, color: bulletColor, damage: finalDmg, type: wep.type, radiusAoE: finalAoERadius });
    } else if (wep.type === 'spread') {
        let count = wep.count + (mods.count || 0);
        for (let i = 0; i < count; i++) {
            let sa = targetAngle + (Math.random() - 0.5) * wep.spread;
            bullets.push({ x: pObj.x, y: pObj.y, vx: Math.cos(sa) * (wep.speed * (Math.random() * 0.25 + 0.88)), vy: Math.sin(sa) * (wep.speed * (Math.random() * 0.25 + 0.88)), radius: 4, color: bulletColor, damage: finalDmg, type: 'single' });
        }
    }

    // Emitir evento si estamos online y somos el jugador local
    if (typeof isOnline !== 'undefined' && isOnline && pObj.id === 1) {
        sendGameEvent('shoot', {
            x: pObj.x, y: pObj.y,
            angle: targetAngle,
            weaponType: wep.type,
            bulletColor: bulletColor,
            damage: finalDmg,
            speed: wep.speed
        });
    }
}
