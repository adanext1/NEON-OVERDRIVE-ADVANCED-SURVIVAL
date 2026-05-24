// === COMPORTAMIENTO: FLUX NULLIFIER (SUPRESOR DE TORRETA) ===
// Aparece en Oleada 11+. Detecta si el jugador está estático (Modo Torreta)
// y proyecta un Haz de Supresión que triplica el calor de la Minigun.

function updateFluxNullifier(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.angle = Math.atan2(dy, dx);
    e.fnTimer = (e.fnTimer || 0) + 1;
    e.fnBeamActive = e.fnBeamActive || false;
    e.fnBeamTimer = e.fnBeamTimer || 0;

    // Movimiento: orbita lentamente alrededor del jugador a distancia media
    let orbitRadius = 280;
    if (dist > orbitRadius + 40) {
        // Acercarse
        e.x += (dx / (dist || 1)) * e.speed + sx;
        e.y += (dy / (dist || 1)) * e.speed + sy;
    } else if (dist < orbitRadius - 40) {
        // Alejarse
        e.x -= (dx / (dist || 1)) * e.speed * 0.8 + sx;
        e.y -= (dy / (dist || 1)) * e.speed * 0.8 + sy;
    } else {
        // Orbitar
        let perpX = -dy / (dist || 1);
        let perpY = dx / (dist || 1);
        e.x += perpX * e.speed * 1.2 + sx;
        e.y += perpY * e.speed * 1.2 + sy;
    }

    // Detectar si el jugador está en Modo Torreta (velocidad = 0)
    let playerIsStatic = nearestPlayer.isTurret === true;

    if (playerIsStatic && dist < 350) {
        // Activar haz de supresión
        if (!e.fnBeamActive) {
            e.fnBeamActive = true;
            e.fnBeamTimer = 0;
            if (typeof showNetworkMessage !== 'undefined') {
                showNetworkMessage('⚠️ FLUX NULLIFIER — ¡HAZ DE SUPRESIÓN ACTIVO! Sal del Modo Torreta.', 2000);
            }
        }
    } else {
        e.fnBeamActive = false;
    }

    // Efecto del haz: triplicar calor de Minigun mientras esté activo
    if (e.fnBeamActive) {
        e.fnBeamTimer++;
        // Aplicar calor extra al jugador más cercano en Modo Torreta
        if (nearestPlayer.isTurret && nearestPlayer.minigunHeat !== undefined) {
            // Añadir calor extra (2 extra por frame = 3x total cuando dispara)
            nearestPlayer.minigunHeat += 4 * (nearestPlayer.minigunHeatMod || 1.0);
            if (nearestPlayer.minigunHeat >= 300 && !nearestPlayer.minigunOverheat) {
                nearestPlayer.minigunOverheat = true;
                nearestPlayer.minigunCooldown = 180 * (nearestPlayer.minigunCooldownMod || 1.0);
                if (typeof showNetworkMessage !== 'undefined') {
                    showNetworkMessage('🔥 ¡MINIGUN SOBRECALENTADA POR SUPRESIÓN!', 2000);
                }
            }
        }
        // Pulso visual de advertencia cada 30 frames
        if (e.fnBeamTimer % 30 === 0) {
            if (typeof createExplosion !== 'undefined') {
                createExplosion(e.x, e.y, '#ffffff', 6, 0.8);
            }
        }
    }

    // Disparo secundario: proyectiles de supresión lentos cada 120 frames
    if (e.fnTimer % 120 === 0) {
        let ang = Math.atan2(nearestPlayer.y - e.y, nearestPlayer.x - e.x);
        if (typeof bullets !== 'undefined') {
            bullets.push({
                x: e.x, y: e.y,
                vx: Math.cos(ang) * 3.5, vy: Math.sin(ang) * 3.5,
                radius: 7, color: '#ffffff', damage: 14, type: 'enemy'
            });
        }
    }
}
