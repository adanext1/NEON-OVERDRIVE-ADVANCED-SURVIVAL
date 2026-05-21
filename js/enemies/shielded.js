// === COMPORTAMIENTO: ENEMIGO CON ESCUDO ===

function updateShieldedEnemy(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.angle = Math.atan2(dy, dx);
    let moveX = dist > 0 ? (dx / dist) : 0;
    let moveY = dist > 0 ? (dy / dist) : 0;
    e.x += moveX * e.speed + sx;
    e.y += moveY * e.speed + sy;
}
