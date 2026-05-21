// === COMPORTAMIENTO: EMP STALKER (INHABILITADOR) ===

function updateStalkerEnemy(e, dx, dy, dist, sx, sy, nearestPlayer) {
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
