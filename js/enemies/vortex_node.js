// === COMPORTAMIENTO: VORTEX NODE (GRAVITATORIO) ===

function updateVortexNode(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.angle += 0.05; // Hace rotar la espiral visual
    
    // Movimiento muy lento hacia el jugador
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;
    e.x += moveX * e.speed + sx;
    e.y += moveY * e.speed + sy;
    
    // Fuerza de atracción gravitatoria a los jugadores cercanos
    players.forEach(p => {
        if (p.isDead || p.dashTimer > 0) return;
        let pdx = e.x - p.x;
        let pdy = e.y - p.y;
        let pdist = Math.hypot(pdx, pdy);
        if (pdist < 250) {
            // Aumentar el contador de atracción (si hay >= 2, ralentiza al 50% en player.js / game.js)
            p.vortexPullCount = (p.vortexPullCount || 0) + 1;
            
            // Fuerza proporcional a la cercanía
            let pullForce = (250 - pdist) * 0.008;
            p.x += (pdx / (pdist || 1)) * pullForce;
            p.y += (pdy / (pdist || 1)) * pullForce;
        }
    });
}
