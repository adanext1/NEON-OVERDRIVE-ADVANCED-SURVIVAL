// === COMPORTAMIENTO: CURADOR (HEALER) ===

function updateHealerEnemy(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.shootCooldown--;
    // Se acerca al enemigo más herido (que no sea él mismo u otro curador)
    let target = null;
    let minHpRatio = 1;
    
    enemies.forEach(o => {
        if (o !== e && !o.isHealer) {
            let ratio = o.hp / o.maxHp;
            if (ratio < minHpRatio) {
                minHpRatio = ratio;
                target = o;
            }
        }
    });

    if (target && minHpRatio < 0.8) {
        let hdx = target.x - e.x;
        let hdy = target.y - e.y;
        let hdist = Math.hypot(hdx, hdy);
        e.angle = Math.atan2(hdy, hdx);
        
        if (hdist > 150) {
            e.x += (hdx / (hdist || 1)) * e.speed + sx;
            e.y += (hdy / (hdist || 1)) * e.speed + sy;
        }
        
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
