// === COMPORTAMIENTO: SINGULARITY SENTINEL (GENERADOR DE ESCUDOS CRUZADOS) ===
// Aparece en Oleada 13+. Busca al enemigo con más HP y proyecta un Enlace Cuántico.
// El enemigo enlazado es 100% inmune; el daño se redirige al Sentinel.

function updateSingularitySentinel(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.ssTimer = (e.ssTimer || 0) + 1;
    e.ssLinkTarget = e.ssLinkTarget || null;
    e.ssLinkSearchCooldown = (e.ssLinkSearchCooldown !== undefined ? e.ssLinkSearchCooldown : 0) - 1;
    e.ssOrbitAngle = (e.ssOrbitAngle || 0) + 0.015;

    // Movimiento: orbita lentamente, manteniéndose a distancia media del jugador
    let orbitRadius = 320;
    if (dist > orbitRadius + 60) {
        e.x += (dx / (dist || 1)) * e.speed + sx;
        e.y += (dy / (dist || 1)) * e.speed + sy;
    } else if (dist < orbitRadius - 60) {
        e.x -= (dx / (dist || 1)) * e.speed * 0.6;
        e.y -= (dy / (dist || 1)) * e.speed * 0.6;
    } else {
        let perpX = -dy / (dist || 1);
        let perpY = dx / (dist || 1);
        e.x += perpX * e.speed + sx;
        e.y += perpY * e.speed + sy;
    }

    e.angle = Math.atan2(dy, dx);

    // Buscar objetivo para el enlace cada 3 segundos
    if (e.ssLinkSearchCooldown <= 0) {
        e.ssLinkSearchCooldown = 180;
        _findSentinelLinkTarget(e);
    }

    // Verificar que el objetivo del enlace sigue vivo
    if (e.ssLinkTarget !== null) {
        let targetStillAlive = typeof enemies !== 'undefined' && enemies.some(en => en.id === e.ssLinkTarget);
        if (!targetStillAlive) {
            e.ssLinkTarget = null;
            if (typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('🔗 ENLACE CUÁNTICO ROTO — objetivo eliminado.', 1500);
            }
        }
    }

    // Pulso visual del anillo doble cada 45 frames
    if (e.ssTimer % 45 === 0 && typeof createExplosion !== 'undefined') {
        createExplosion(e.x, e.y, '#ffff00', 8, 0.7);
    }
}

function _findSentinelLinkTarget(sentinel) {
    if (typeof enemies === 'undefined') return;

    let bestTarget = null;
    let bestHp = 0;

    enemies.forEach(en => {
        if (en === sentinel) return;
        if (en.isSingularitySentinel) return; // No enlazar a otro Sentinel
        if (en.isBoss || en.isVectorSupreme || en.isCoreGuardian || en.isOverlordApex) return; // No enlazar a jefes
        if (en.hp > bestHp) {
            bestHp = en.hp;
            bestTarget = en;
        }
    });

    if (bestTarget) {
        sentinel.ssLinkTarget = bestTarget.id;
        if (typeof showNetworkMessage !== 'undefined') {
            showNetworkMessage('🔗 SINGULARITY SENTINEL — ¡ENLACE CUÁNTICO ACTIVO! Destruye al Sentinel primero.', 3000);
        }
        if (typeof createExplosion !== 'undefined') {
            createExplosion(sentinel.x, sentinel.y, '#ffff00', 20, 1.5);
        }
    }
}

// Llamada desde el sistema de daño: redirige el daño del objetivo enlazado al Sentinel
// Retorna true si el daño fue redirigido (el enemigo objetivo es inmune)
function checkSentinelLinkRedirect(targetEnemy, damage) {
    if (typeof enemies === 'undefined') return false;

    // Buscar si hay algún Sentinel que tenga a este enemigo como objetivo
    for (let i = 0; i < enemies.length; i++) {
        let sentinel = enemies[i];
        if (!sentinel.isSingularitySentinel) continue;
        if (sentinel.ssLinkTarget === targetEnemy.id) {
            // Redirigir daño al Sentinel
            sentinel.hp -= damage;
            sentinel.flashTicks = 5;
            if (typeof spawnDamageText !== 'undefined') {
                spawnDamageText(sentinel.x, sentinel.y, damage, 'crit');
            }
            if (typeof createExplosion !== 'undefined') {
                createExplosion(sentinel.x, sentinel.y, '#ffff00', 6, 0.8);
            }
            return true; // Daño redirigido, el objetivo es inmune
        }
    }
    return false; // Sin enlace activo
}
