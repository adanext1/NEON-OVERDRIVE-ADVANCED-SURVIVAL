// === COMPORTAMIENTO: HELIX WEAVER (ESTELAS LÁSER) ===

function updateHelixWeaver(e, dx, dy, dist, sx, sy, nearestPlayer) {
    let targetAngle = Math.atan2(dy, dx);
    e.angle = targetAngle;
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;
    e.x += moveX * e.speed + sx; 
    e.y += moveY * e.speed + sy;
    
    // Dejar estela láser dañina en el mapa periódicamente
    e.trailTimer = (e.trailTimer || 0) + 1;
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
}
