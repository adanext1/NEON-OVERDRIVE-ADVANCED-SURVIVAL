// === COMPORTAMIENTO: ELITE GOLD (ENEMIGO DORADO) ===

function updateEliteGoldEnemy(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.shootCooldown--;
    e.angle = Math.atan2(dy, dx);
    
    // Se mantiene a distancia media (entre 250px y 300px)
    if (dist > 300) {
        e.x += (dist > 0 ? (dx / dist) : 0) * e.speed + sx;
        e.y += (dist > 0 ? (dy / dist) : 0) * e.speed + sy;
    } else if (dist < 250) {
        e.x -= (dist > 0 ? (dx / dist) : 0) * e.speed * 1.5 + sx;
        e.y -= (dist > 0 ? (dy / dist) : 0) * e.speed * 1.5 + sy;
    }
    
    if (e.shootCooldown <= 0) {
        // Dispara 3 balas en abanico
        for (let j = -1; j <= 1; j++) {
            let ang = e.angle + j * 0.2;
            bullets.push({ 
                x: e.x, y: e.y, 
                vx: Math.cos(ang) * 5, vy: Math.sin(ang) * 5, 
                radius: 5, color: '#ffff00', damage: 15, type: 'enemy' 
            });
        }
        e.shootCooldown = 90;
    }
}
