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
                createExplosion(e.x, e.y, e.color || '#ff00ff', 20, 1.5);
            }
        }
    } 
 
    else {
        // Kamikaze común y corriente (Rastreador Kamikaze RK-03)
        if (!e.kamiState) {
            e.kamiState = 'CHASING';
            e.stateTimer = 40; // Delay inicial de cortesía antes del primer ataque
        }
        e.stateTimer--;

        if (e.kamiState === 'CHASING') {
            e.angle = Math.atan2(dy, dx);
            let moveX = dist > 0 ? (dx / dist) : 0;
            let moveY = dist > 0 ? (dy / dist) : 0;
            e.x += moveX * e.speed + sx * 0.2; e.y += moveY * e.speed + sy * 0.2;
            
            // Si el delay inicial pasó y está a rango, comienza a cargar el dash
            if (e.stateTimer <= 0 && dist < 220) {
                e.kamiState = 'CHARGING';
                e.stateTimer = 45; // 45 frames (0.75s) de carga telegrafiada
            }
        } else if (e.kamiState === 'CHARGING') {
            e.angle = Math.atan2(dy, dx);
            e.flashTicks = 2; // Parpadeo blanco
            if (e.stateTimer <= 0) {
                e.kamiState = 'DASHING';
                e.stateTimer = 20; // 20 frames (0.33s) de dash rápido
                let len = Math.hypot(dx, dy);
                e.dashVx = (dx / (len || 1)) * 9.5; // Velocidad lineal de 9.5
                e.dashVy = (dy / (len || 1)) * 9.5;
            }
        } else if (e.kamiState === 'DASHING') {
            e.x += e.dashVx; e.y += e.dashVy;
            if (e.stateTimer <= 0) {
                e.kamiState = 'CHASING';
                e.stateTimer = 60; // 60 frames (1s) de cooldown/fatiga
            }
        }
    }
}
