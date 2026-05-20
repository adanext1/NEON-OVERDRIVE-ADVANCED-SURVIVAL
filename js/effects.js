// === SISTEMA DE EFECTOS VISUALES ===

function createExplosion(x, y, color, count = 10, spd = 1) {
    for (let i = 0; i < count; i++) {
        let a = Math.random() * Math.PI * 2; let s = (Math.random() * 4 + 2) * spd;
        particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, radius: Math.random() * 3 + 1, color: color, alpha: 1, decay: Math.random() * 0.02 + 0.015 });
    }
}

function spawnDamageText(x, y, amount, type = 'normal') {
    let textColor = '#ffffff'; let isCritSize = false;
    let decay = 0.015; let vx = (Math.random() - 0.5) * 2; let vy = -2 - Math.random() * 2;
    if (type === 'crit') { textColor = '#ffff00'; isCritSize = true; decay = 0.008; vx *= 1.5; vy *= 1.5; }
    else if (type === 'hazard') { textColor = '#ff0055'; }
    else if (type === 'shield') { textColor = '#00aaff'; }
    damageTexts.push({ x: x, y: y - 10, text: Math.floor(amount), isCrit: isCritSize, color: textColor, alpha: 1, vx: vx, vy: vy, decay: decay });
}
