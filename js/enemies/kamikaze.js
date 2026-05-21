// === COMPORTAMIENTO: KAMIKAZE, CLONES Y FRAGMENTOS DE VECTOR ===

function updateKamikazeEnemy(e, dx, dy, dist, sx, sy, nearestPlayer) {
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
            e.flashTicks = 2;
            if (e.stateTimer <= 0) {
                e.kamiState = 'DASHING';
                e.stateTimer = 20; // Dash rápido de 0.3s
                let len = Math.hypot(dx, dy);
                e.dashVx = (dx / (len || 1)) * 12;
                e.dashVy = (dy / (len || 1)) * 12;
            }
        } else if (e.kamiState === 'DASHING') {
            e.x += e.dashVx;
            e.y += e.dashVy;
            if (e.stateTimer <= 0) {
                e.hp = 0;
                createExplosion(e.x, e.y, '#ff00ff', 20, 1.5);
            }
        }
    } 
    else if (e.isVectorFragment) {
        // IA de Kamikaze Avanzado (Fragmento de Vector)
        e.stateTimer--;
        e.angle = Math.atan2(dy, dx);
        let moveX = dist > 0 ? (dx / dist) : 0;
        let moveY = dist > 0 ? (dy / dist) : 0;

        if (e.kamiState === 'CHASING') {
            e.x += moveX * e.speed + sx * 0.2; e.y += moveY * e.speed + sy * 0.2;
            if (e.stateTimer <= 0) { e.kamiState = 'CHARGING'; e.stateTimer = 25; }
        } else if (e.kamiState === 'CHARGING') {
            e.flashTicks = 2; // Parpadeo de carga
            if (e.stateTimer <= 0) {
                e.kamiState = 'DASHING'; e.stateTimer = 18;
                let dashAngle = e.angle + (Math.random() - 0.5) * 0.4;
                e.dashVx = Math.cos(dashAngle) * 15;
                e.dashVy = Math.sin(dashAngle) * 15;
            }
        } else if (e.kamiState === 'DASHING') {
            e.x += e.dashVx; e.y += e.dashVy;
            screenShake = Math.max(screenShake, 4);
            if (e.stateTimer <= 0) { e.kamiState = 'CHASING'; e.stateTimer = 55; }
        }
    } 
    else {
        // Kamikaze común y corriente
        e.angle = Math.atan2(dy, dx);
        let moveX = dist > 0 ? (dx / dist) : 0;
        let moveY = dist > 0 ? (dy / dist) : 0;
        e.x += moveX * e.speed + sx * 0.2; e.y += moveY * e.speed + sy * 0.2;
    }
}
