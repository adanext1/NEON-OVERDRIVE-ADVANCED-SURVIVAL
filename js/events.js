// === SISTEMA DE EVENTOS DINÁMICOS Y ELEMENTOS DEL ENTORNO ===

function triggerHazard() {
    hazards.push({ x: Math.random() * (canvas.width - 200) + 100, y: Math.random() * (canvas.height - 200) + 100, radius: Math.random() * 60 + 50, timer: 120, maxTimer: 120, duration: 300, active: false, shockwaveRadius: 0 });
}

function getEventName(type) {
    return { extractor: 'EXTRACTOR DE PLASMA', overload: 'SOBRECARGA DEL NÚCLEO', portal: 'PORTALES DE DATOS INESTABLES', lockdown: 'BLOQUEO DE RED', anomaly: 'CACERÍA DE LA ANOMALÍA' }[type] || type;
}

function spawnDynamicEvent(type) {
    let cx = Math.random() * (canvas.width - 300) + 150;
    let cy = Math.random() * (canvas.height - 300) + 150;
    let ev = { type, active: true };

    if (type === 'extractor') {
        ev = { type, x: cx, y: cy, radius: 80, progress: 0, active: true };
    } else if (type === 'overload') {
        ev = { type, x: cx, y: cy, radius: 35, hp: 400, maxHp: 400, timer: 300, maxTimer: 300, active: true };
    } else if (type === 'portal') {
        let bx = Math.random() * (canvas.width - 300) + 150;
        let by = Math.random() * (canvas.height - 300) + 150;
        ev = { type, ax: cx, ay: cy, bx, by, portalRadius: 30, crossings: 0, cooldown: 0, active: true };
    } else if (type === 'lockdown') {
        let sw = 180, sh = 150;
        let sx = Math.random() * (canvas.width - sw - 40) + 20;
        let sy = Math.random() * (canvas.height - sh - 40) + 20;
        ev = { type, sw, sh, sx, sy, tx: sx, ty: sy, timer: 900, maxTimer: 900, moveTimer: 0, active: true };
    } else if (type === 'anomaly') {
        ev = { type, x: cx, y: cy, radius: 14, speed: 3.8, hp: 240, maxHp: 240, segmentsDropped: 0, dashTimer: 0, active: true };
    }

    dynamicEvents.push(ev);
    showNetworkMessage(`⚡ EVENTO: ${getEventName(type)}`, 3000);

    if (typeof isOnline !== 'undefined' && isOnline && isHost) {
        sendGameEvent('spawn-dynamic-event', ev);
    }
}

function updateDynamicEvents() {
    for (let ei = dynamicEvents.length - 1; ei >= 0; ei--) {
        let ev = dynamicEvents[ei];
        if (!ev.active) { dynamicEvents.splice(ei, 1); continue; }

        // ---- EXTRACTOR DE PLASMA ----
        if (ev.type === 'extractor') {
            let playersInside = players.filter(p => Math.hypot(p.x - ev.x, p.y - ev.y) < ev.radius);
            let rate = playersInside.length === 2 ? 0.5 : (playersInside.length === 1 ? 0.33 : -0.15);
            ev.progress = Math.max(0, Math.min(100, ev.progress + rate));
            if (ev.progress >= 100) {
                createExplosion(ev.x, ev.y, '#00ffcc', 50, 2);
                screenShake = 10;
                let mat = Math.random() > 0.5 ? 'crystal' : 'plate';
                players.forEach(p => {
                    let pSave = getPlayerSave(p);
                    if (pSave && pSave.materials) {
                        pSave.materials[mat] += 2;
                    }
                });
                saveGame();
                showNetworkMessage('✅ EXTRACTOR COMPLETADO — Material raro obtenido!', 3000);
                ev.active = false;
            }
        }

        // ---- SOBRECARGA DEL NÚCLEO ----
        else if (ev.type === 'overload') {
            if (!isOnline || isHost) ev.timer--;
            // Colisión con balas aliadas
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                let b = bullets[bi];
                if (b.type === 'enemy') continue;
                if (Math.hypot(b.x - ev.x, b.y - ev.y) < ev.radius + b.radius) {
                    ev.hp -= b.damage; spawnDamageText(ev.x, ev.y, b.damage);
                    createExplosion(b.x, b.y, '#ffaa00', 3, 0.5);
                    bullets.splice(bi, 1);
                }
            }
            if (ev.hp <= 0) {
                // Éxito
                createExplosion(ev.x, ev.y, '#ffff00', 60, 2.5); screenShake = 12;
                let reward = 100 + Math.floor(Math.random() * 51);
                players.forEach(p => p.credits += reward);
                showNetworkMessage(`✅ NÚCLEO ESTABILIZADO — +$${reward} créditos!`, 3000);
                updateUI(); ev.active = false;
            } else if (ev.timer <= 0) {
                // Fracaso — onda expansiva
                createExplosion(ev.x, ev.y, '#ff0000', 80, 3); screenShake = 20;
                players.forEach(p => {
                    let dmg = p.maxHp * 0.4;
                    takeDamage(p, dmg);
                });
                showNetworkMessage('❌ NÚCLEO DETONADO — 40% de vida perdida!', 3000);
                ev.active = false;
            }
        }

        // ---- PORTAL DE DATOS ----
        else if (ev.type === 'portal') {
            if (ev.cooldown > 0) ev.cooldown--;
            players.forEach(p => {
                if (ev.cooldown > 0) return;
                let dA = Math.hypot(p.x - ev.ax, p.y - ev.ay);
                let dB = Math.hypot(p.x - ev.bx, p.y - ev.by);
                if (dA < ev.portalRadius) {
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    p.x = ev.bx; p.y = ev.by;
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    ev.crossings++; ev.cooldown = 45;
                } else if (dB < ev.portalRadius) {
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    p.x = ev.ax; p.y = ev.ay;
                    createExplosion(p.x, p.y, '#aa00ff', 20, 1.5);
                    ev.crossings++; ev.cooldown = 45;
                }
            });
            if (ev.crossings >= 3) {
                // Spawn dron aliado
                let owner = players[0];
                helperDrones.push({ x: owner.x, y: owner.y, ownerId: owner.id, shootCooldown: 0, angle: 0 });
                showNetworkMessage('✅ DRON DE DATOS ACTIVO — te ayuda hasta el final de la oleada!', 4000);
                ev.active = false;
            }
        }

        // ---- BLOQUEO DE RED ----
        else if (ev.type === 'lockdown') {
            if (!isOnline || isHost) {
                ev.timer--;
                ev.moveTimer++;
                if (ev.moveTimer >= 150) {
                    ev.tx = Math.random() * (canvas.width - ev.sw - 40) + 20;
                    ev.ty = Math.random() * (canvas.height - ev.sh - 40) + 20;
                    ev.moveTimer = 0;
                }
                ev.sx += (ev.tx - ev.sx) * 0.008;
                ev.sy += (ev.ty - ev.sy) * 0.008;
            }
            // Daño fuera de zona
            players.forEach(p => {
                let inside = p.x > ev.sx && p.x < ev.sx + ev.sw && p.y > ev.sy && p.y < ev.sy + ev.sh;
                if (!inside) takeDamage(p, 0.08);
            });
            if (ev.timer <= 0) {
                // Éxito
                enemies = enemies.filter(e => e.isBoss || e.type === 'anomaly');
                xpMultiplier = 2;
                showNetworkMessage('✅ RED REINICIADA — Enemigos eliminados! XP x2 esta oleada!', 4000);
                ev.active = false;
            }
        }

        // ---- CACERÍA DE LA ANOMALÍA ----
        else if (ev.type === 'anomaly') {
            if (ev.dashTimer > 0) ev.dashTimer--;
            let nearest = players[0]; let minD = Infinity;
            players.forEach(p => { let d = Math.hypot(p.x - ev.x, p.y - ev.y); if (d < minD) { minD = d; nearest = p; } });
            let dx = ev.x - nearest.x; let dy = ev.y - nearest.y; let dist = Math.hypot(dx, dy) || 1;
            if (ev.dashTimer > 0) {
                ev.x += ev.dashVx; ev.y += ev.dashVy;
            } else {
                ev.x += (dx / dist) * ev.speed;
                ev.y += (dy / dist) * ev.speed;
            }
            if (Math.random() < 0.4) particles.push({ x: ev.x, y: ev.y, vx: (Math.random()-0.5)*1.5, vy: (Math.random()-0.5)*1.5, radius: Math.random()*3+1, color: '#ffcc00', alpha: 1, decay: 0.03 });
            ev.x = Math.max(ev.radius, Math.min(canvas.width - ev.radius, ev.x));
            ev.y = Math.max(ev.radius, Math.min(canvas.height - ev.radius, ev.y));

            // Colisión con balas aliadas
            let segment = Math.floor(ev.segmentsDropped);
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                let b = bullets[bi];
                if (b.type === 'enemy') continue;
                if (Math.hypot(b.x - ev.x, b.y - ev.y) < ev.radius + b.radius) {
                    ev.hp -= b.damage; spawnDamageText(ev.x, ev.y, b.damage, 'crit');
                    createExplosion(b.x, b.y, '#ffcc00', 4, 0.8);
                    bullets.splice(bi, 1);
                    let newSeg = Math.floor(ev.segmentsDropped + (1 - ev.hp / ev.maxHp) * 3);
                    if (newSeg > ev.segmentsDropped && newSeg <= 2) {
                        let reward = 80 + Math.floor(Math.random() * 40);
                        players.forEach(p => p.credits += reward);
                        updateUI();
                        showNetworkMessage(`⚡ ANOMALÍA DAÑADA — +$${reward} créditos!`, 2000);
                        let escapeAngle = Math.atan2(ev.y - nearest.y, ev.x - nearest.x);
                        ev.dashVx = Math.cos(escapeAngle) * 12; ev.dashVy = Math.sin(escapeAngle) * 12; ev.dashTimer = 25;
                        ev.segmentsDropped = newSeg;
                    }
                    break;
                }
            }

            if (ev.hp <= 0) {
                createExplosion(ev.x, ev.y, '#ffffff', 70, 2.5); screenShake = 15;
                players.forEach(p => {
                    let pSave = getPlayerSave(p);
                    if (pSave && pSave.materials) {
                        pSave.materials.crystal++;
                        pSave.materials.core++;
                    }
                });
                saveGame();
                drops.push({ x: ev.x, y: ev.y, credits: 200, xp: 150, radius: 6, matType: 'crystal' });
                showNetworkMessage('✅ ANOMALÍA DESTRUIDA — Cristal y Núcleo garantizados!', 4000);
                ev.active = false;
            }
            if (ev.x < -50 || ev.x > canvas.width + 50 || ev.y < -50 || ev.y > canvas.height + 50) ev.active = false;
        }
    }
}

function updateHelperDrones() {
    for (let di = helperDrones.length - 1; di >= 0; di--) {
        let drone = helperDrones[di];
        let owner = players.find(p => p.id === drone.ownerId) || players[0];
        drone.x += (owner.x + 30 - drone.x) * 0.08;
        drone.y += (owner.y - 20 - drone.y) * 0.08;
        drone.angle += 0.05;
        drone.shootCooldown--;
        if (drone.shootCooldown <= 0 && enemies.length > 0) {
            let target = enemies[0]; let minD = Infinity;
            enemies.forEach(e => { let d = Math.hypot(e.x - drone.x, e.y - drone.y); if (d < minD) { minD = d; target = e; } });
            let a = Math.atan2(target.y - drone.y, target.x - drone.x);
            bullets.push({ x: drone.x, y: drone.y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, radius: 4, damage: 15, color: '#00ffcc', type: 'drone' });
            drone.shootCooldown = 45;
        }
    }
}

function drawDynamicEvents() {
    let t = Date.now();
    dynamicEvents.forEach(ev => {
        if (!ev.active) return;
        ctx.save();

        if (ev.type === 'extractor') {
            let pulse = 0.06 + Math.sin(t * 0.005) * 0.04;
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 204, ${pulse})`; ctx.fill();
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${0.5 + Math.sin(t * 0.008) * 0.3})`; ctx.lineWidth = 3; ctx.stroke();
            ctx.beginPath(); ctx.arc(ev.x, ev.y, ev.radius, -Math.PI / 2, -Math.PI / 2 + (ev.progress / 100) * Math.PI * 2);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillRect(ev.x - 3, ev.y - 20, 6, 40);
            ctx.font = "bold 18px 'Courier New'"; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.fillText(`${Math.floor(ev.progress)}%`, ev.x, ev.y - 28);
            ctx.textAlign = 'left';
        }

        else if (ev.type === 'overload') {
            ctx.translate(ev.x, ev.y);
            let flicker = 0.7 + Math.sin(t * 0.02) * 0.3;
            ctx.rotate(t * 0.002);
            ctx.beginPath(); ctx.moveTo(0, -ev.radius * 2); ctx.lineTo(ev.radius * 1.4, 0); ctx.lineTo(0, ev.radius * 2); ctx.lineTo(-ev.radius * 1.4, 0);
            ctx.closePath(); ctx.fillStyle = `rgba(255, 180, 0, ${0.2 * flicker})`; ctx.fill();
            ctx.strokeStyle = `rgba(255, 200, 0, ${flicker})`; ctx.lineWidth = 3; ctx.stroke();
            ctx.rotate(-(t * 0.002));
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-ev.radius * 1.5, -ev.radius * 2.5, ev.radius * 3, 8);
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(-ev.radius * 1.5, -ev.radius * 2.5, ev.radius * 3 * (ev.hp / ev.maxHp), 8);
            ctx.beginPath(); ctx.arc(0, 0, ev.radius + 18, -Math.PI / 2, -Math.PI / 2 + (ev.timer / ev.maxTimer) * Math.PI * 2);
            ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 5; ctx.stroke();
            ctx.font = "bold 14px 'Courier New'"; ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center';
            ctx.fillText('NÚCLEO', 0, ev.radius * 2.7); ctx.textAlign = 'left';
        }

        else if (ev.type === 'portal') {
            let pulseA = 0.6 + Math.sin(t * 0.007) * 0.4;
            ctx.beginPath(); ctx.arc(ev.ax, ev.ay, ev.portalRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(170, 0, 255, ${0.15 * pulseA})`; ctx.fill();
            ctx.strokeStyle = `rgba(200, 0, 255, ${pulseA})`; ctx.lineWidth = 4; ctx.stroke();
            ctx.font = "bold 12px 'Courier New'"; ctx.fillStyle = '#cc88ff'; ctx.textAlign = 'center';
            ctx.fillText('A', ev.ax, ev.ay + 5); ctx.fillText(`${ev.crossings}/3`, ev.ax, ev.ay - ev.portalRadius - 8);
            let pulseB = 0.6 + Math.sin(t * 0.007 + Math.PI) * 0.4;
            ctx.beginPath(); ctx.arc(ev.bx, ev.by, ev.portalRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(170, 0, 255, ${0.15 * pulseB})`; ctx.fill();
            ctx.strokeStyle = `rgba(200, 0, 255, ${pulseB})`; ctx.lineWidth = 4; ctx.stroke();
            ctx.fillStyle = '#cc88ff';
            ctx.fillText('B', ev.bx, ev.by + 5);
            ctx.textAlign = 'left';
        }

        else if (ev.type === 'lockdown') {
            ctx.fillStyle = 'rgba(220, 0, 0, 0.25)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            let grd = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width/4, canvas.width/2, canvas.height/2, canvas.width/1.5);
            grd.addColorStop(0, 'rgba(0,0,0,0)');
            grd.addColorStop(1, 'rgba(255,0,0,0.6)');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 255, 100, 0.25)'; ctx.fillRect(ev.sx, ev.sy, ev.sw, ev.sh);
            ctx.strokeStyle = `rgba(0, 255, 100, ${0.8 + Math.sin(t * 0.01) * 0.2})`; ctx.lineWidth = 4; ctx.setLineDash([12, 6]);
            ctx.strokeRect(ev.sx, ev.sy, ev.sw, ev.sh); ctx.setLineDash([]);
            let secs = Math.ceil(ev.timer / 60);
            ctx.font = "bold 22px 'Courier New'"; ctx.fillStyle = '#00ff55';
            ctx.textAlign = 'center'; ctx.fillText(`BLOQUEO: ${secs}s`, ev.sx + ev.sw / 2, ev.sy - 10);
            ctx.textAlign = 'left';
        }

        else if (ev.type === 'anomaly') {
            ctx.translate(ev.x, ev.y);
            ctx.beginPath(); ctx.moveTo(0, ev.radius * 1.5); ctx.lineTo(-ev.radius * 1.3, -ev.radius * 0.9); ctx.lineTo(ev.radius * 1.3, -ev.radius * 0.9);
            ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
            let bw = ev.radius * 5;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, -ev.radius * 2.5, bw, 7);
            let seg3 = Math.max(0, ev.hp / ev.maxHp);
            let segColor = seg3 > 0.66 ? '#ffffff' : (seg3 > 0.33 ? '#ffcc00' : '#ff4400');
            ctx.fillStyle = segColor; ctx.fillRect(-bw / 2, -ev.radius * 2.5, bw * seg3, 7);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            for (let s = 1; s < 3; s++) { ctx.beginPath(); ctx.moveTo(-bw / 2 + (bw / 3) * s, -ev.radius * 2.5); ctx.lineTo(-bw / 2 + (bw / 3) * s, -ev.radius * 2.5 + 7); ctx.stroke(); }
        }

        ctx.restore();
    });
}

function drawHelperDrones() {
    helperDrones.forEach(drone => {
        ctx.save(); ctx.translate(drone.x, drone.y); ctx.rotate(drone.angle);
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffcc'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
    });
}
