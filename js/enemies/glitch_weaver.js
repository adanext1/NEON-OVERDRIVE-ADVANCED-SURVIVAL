// === COMPORTAMIENTO: GLITCH WEAVER (INTERFERENCIA DE PANTALLA) ===
// Aparece en Oleada 12+. Se teletransporta a micro-distancias (glitch).
// Mientras esté vivo, el HUD del jugador parpadea y falla.

function updateGlitchWeaver(e, dx, dy, dist, sx, sy, nearestPlayer) {
    e.gwTimer = (e.gwTimer || 0) + 1;
    e.gwGlitchCooldown = (e.gwGlitchCooldown !== undefined ? e.gwGlitchCooldown : 0) - 1;
    e.gwHudDistortActive = true; // Siempre activo mientras viva

    // Movimiento errático base
    if (e.gwGlitchCooldown <= 0) {
        // Micro-teletransporte (glitch)
        let glitchRange = 60 + Math.random() * 80;
        let glitchAngle = Math.random() * Math.PI * 2;
        e.x += Math.cos(glitchAngle) * glitchRange;
        e.y += Math.sin(glitchAngle) * glitchRange;

        // Mantener dentro del canvas
        if (typeof canvas !== 'undefined') {
            e.x = Math.max(20, Math.min(canvas.width - 20, e.x));
            e.y = Math.max(20, Math.min(canvas.height - 20, e.y));
        }

        e.gwGlitchCooldown = 25 + Math.floor(Math.random() * 20); // Cada 0.4–0.75s
        e.flashTicks = 4;

        // Efecto visual de glitch
        if (typeof createExplosion !== 'undefined') {
            createExplosion(e.x, e.y, '#ff007f', 5, 0.6);
        }
    } else {
        // Movimiento normal entre glitches
        let moveX = dist > 0 ? (dx / dist) : 0;
        let moveY = dist > 0 ? (dy / dist) : 0;
        e.x += moveX * e.speed * 0.7 + sx;
        e.y += moveY * e.speed * 0.7 + sy;
    }

    e.angle = Math.atan2(dy, dx);

    // Distorsión del HUD: parpadeo de elementos críticos
    if (e.gwTimer % 18 === 0) {
        _applyGlitchHudDistort();
    }
}

// Aplica distorsión visual al HUD mientras el Glitch Weaver esté vivo
function _applyGlitchHudDistort() {
    // Verificar si hay algún Glitch Weaver vivo
    if (typeof enemies === 'undefined') return;
    let weaverAlive = enemies.some(e => e.isGlitchWeaver);
    if (!weaverAlive) {
        _clearGlitchHudDistort();
        return;
    }

    // Parpadear aleatoriamente uno de los elementos del HUD
    let targets = ['hud-hp', 'hp-bar-fill', 'dash-cd', 'pulse-cd', 'minigun-heat-bar'];
    let target = targets[Math.floor(Math.random() * targets.length)];
    let el = document.getElementById(target);
    if (el) {
        let originalOpacity = el.style.opacity || '1';
        el.style.opacity = Math.random() < 0.5 ? '0' : '0.3';
        setTimeout(() => {
            if (el) el.style.opacity = originalOpacity || '1';
        }, 120 + Math.random() * 200);
    }

    // Ocultar retícula de apuntado automático ocasionalmente
    if (Math.random() < 0.3) {
        let aimEl = document.getElementById('hud-aim');
        if (aimEl) {
            aimEl.style.visibility = 'hidden';
            setTimeout(() => { if (aimEl) aimEl.style.visibility = 'visible'; }, 300);
        }
    }
}

function _clearGlitchHudDistort() {
    // Restaurar todos los elementos del HUD al estado normal
    let targets = ['hud-hp', 'hp-bar-fill', 'dash-cd', 'pulse-cd', 'minigun-heat-bar', 'hud-aim'];
    targets.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
        }
    });
}
