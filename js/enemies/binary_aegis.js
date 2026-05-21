// === COMPORTAMIENTO: BINARY AEGIS (ESCUDOS DEFLECTORES) ===

function updateBinaryAegis(e, dx, dy, dist, sx, sy, nearestPlayer) {
    let targetAngle = Math.atan2(dy, dx);
    e.angle = targetAngle;
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;
    e.x += moveX * e.speed + sx; 
    e.y += moveY * e.speed + sy;
    
    // Rotar los escudos deflectores
    e.shieldAngle = (e.shieldAngle || 0) + 0.04;
}
