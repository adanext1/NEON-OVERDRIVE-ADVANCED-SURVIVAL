function updateMenuSelection(modalId) {
    selectedMenuItem = [0, 0];
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const buttons = modal.querySelectorAll('.shop-btn, .level-up-card');
    buttons.forEach((btn, idx) => {
        if (idx === 0) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });
}

let levelUpQueue = [];
let levelUpCountdownInterval = null;
let isLocalLevelUpOpen = false;

function showLevelUpMenu(pObj) {
    if (!pObj) pObj = players[0];

    // Detección robusta de si es el jugador local
    let isLocalPlayer = false;
    if (typeof isOnline !== 'undefined' && isOnline) {
        if (typeof isHost !== 'undefined' && isHost) {
            isLocalPlayer = (pObj.id === 1);
        } else {
            isLocalPlayer = (pObj.id === 2);
        }
    } else {
        isLocalPlayer = (pObj === players[0]);
    }

    const modal = document.getElementById('level-up-modal');
    if (modal.style.display === 'block') {
        levelUpQueue.push(pObj);
        return;
    }
    
    modal.style.display = 'block';
    isPaused = true;

    const choicesDiv = document.getElementById('level-up-choices');
    choicesDiv.innerHTML = '';

    const titleElem = modal.querySelector('h2');
    const descElem = modal.querySelector('p');
    
    let playerColor = pObj.id === 1 ? '#00ffcc' : '#ff007f';
    titleElem.style.color = playerColor;

    let oldTimer = document.getElementById('levelup-timer');
    if (oldTimer) oldTimer.remove();
    let oldBar = document.getElementById('levelup-bar');
    if (oldBar) oldBar.remove();

    if (!isLocalPlayer) {
        isLocalLevelUpOpen = false;
        titleElem.innerText = `⏳ JUGADOR ${pObj.id} ELIGIENDO MEJORA...`;
        if (descElem) descElem.style.display = 'none';
        
        choicesDiv.innerHTML = `
            <div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.6);">
                <div style="font-size:48px; margin-bottom:16px; animation: pulse 1s infinite;">⚡</div>
                <div style="font-size:16px; letter-spacing:2px;">Tu aliado está eligiendo una mejora</div>
                <div style="font-size:12px; margin-top:12px; color: ${playerColor};">El juego se reanudará cuando elija</div>
            </div>`;
            
        if (typeof isOnline !== 'undefined' && isOnline && isHost) {
            sendGameEvent('open-level-up', { playerId: pObj.id });
        }
        return;
    }

    // --- MENU LOCAL ---
    isLocalLevelUpOpen = true;
    
    if (typeof isOnline !== 'undefined' && isOnline) {
        sendGameEvent('level-up-pause', { playerId: pObj.id });
    }
    if (descElem) descElem.style.display = 'block';
    let playerLabel = pObj.id === 1 ? 'JUGADOR 1' : 'JUGADOR 2';
    titleElem.innerText = `⚡ MEJORA DE SISTEMA — ${playerLabel}`;

    // Construir pool de mejoras
    let pool = [
        { title: 'Blindaje', desc: '+25 HP Máx', rarity: 'común', apply: () => { pObj.maxHp += 25; pObj.hp += 25; updateUI(); } },
        { title: 'Motores', desc: '+12% Velocidad', rarity: 'común', apply: () => { pObj.speed *= 1.12; } },
        { title: 'Regeneración', desc: 'Cura 30% de vida', rarity: 'común', apply: () => { pObj.hp = Math.min(pObj.maxHp, pObj.hp + pObj.maxHp * 0.3); updateUI(); } }
    ];

    pObj.weapons.forEach(wKey => {
        let wep = WEAPONS[wKey];
        if (!wep) return;
        if (!pObj.weaponUpgrades) pObj.weaponUpgrades = {};
        if (!pObj.weaponUpgrades[wKey]) pObj.weaponUpgrades[wKey] = { damage: 0, fireRate: 0 };
        pool.push({ title: `Calibre: ${wep.name}`, desc: `+20% Daño`, rarity: 'común', apply: () => { pObj.weaponUpgrades[wKey].damage += Math.floor(wep.damage * 0.20); } });
        pool.push({ title: `Cargador: ${wep.name}`, desc: `+15% Cadencia`, rarity: 'común', apply: () => { pObj.weaponUpgrades[wKey].fireRate += Math.floor(wep.fireRate * 0.15); } });
    });

    pool.push({ title: 'Hiper-Daño', desc: '+40% Daño Global', rarity: 'rara', apply: () => { pObj.damageModifier += 0.40; } });
    pool.push({ title: 'Súper Escudo', desc: 'Otorga +50 Escudo Temporal', rarity: 'rara', apply: () => { pObj.shield = Math.min(pObj.maxShield + 50, pObj.shield + 50); updateUI(); } });

    if (pObj.weapons.includes('shotgun') && pObj.weaponUpgrades && pObj.weaponUpgrades.shotgun) {
        pool.push({ title: 'Metralla', desc: '+2 Proyectiles (Escopeta)', rarity: 'legendaria', apply: () => {
            if (pObj.weaponUpgrades.shotgun.count === undefined) pObj.weaponUpgrades.shotgun.count = 0;
            pObj.weaponUpgrades.shotgun.count += 2;
        }});
    }

    pool.push({ title: 'Maestría Total', desc: '+15% Daño a TODAS las armas', rarity: 'legendaria', apply: () => {
        for (let k in pObj.weaponUpgrades) { if (WEAPONS[k]) pObj.weaponUpgrades[k].damage += Math.floor(WEAPONS[k].damage * 0.15); }
    }});

    // --- NUEVAS CARTAS v0.8.0 ---
    pool.push({ title: 'Enfriamiento Acelerado', desc: '-20% Calor en Minigun', rarity: 'rara', apply: () => { pObj.minigunHeatMod = (pObj.minigunHeatMod || 1.0) - 0.20; } });
    pool.push({ title: 'Láser de Alta Frecuencia', desc: '+30% Daño en Mega-Láser', rarity: 'rara', apply: () => { pObj.laserDmgMod = (pObj.laserDmgMod || 1.0) + 0.30; } });
    pool.push({ title: 'Batería de Respaldo', desc: '-15% Cooldown en Célula Q', rarity: 'rara', apply: () => { pObj.qCdMod = (pObj.qCdMod || 1.0) - 0.15; } });
    pool.push({ title: 'Hiper-Ventilación', desc: '-30% Tiempo de Bloqueo por Sobrecalentamiento', rarity: 'rara', apply: () => { pObj.minigunCooldownMod = (pObj.minigunCooldownMod || 1.0) - 0.30; } });
    
    pool.push({ title: 'Protocolo Bastión Optimizado', desc: '+15% Reducción de Daño en Torreta', rarity: 'legendaria', apply: () => { pObj.turretDamageReduction = (pObj.turretDamageReduction || 0.3) + 0.15; } });

    // --- MÁS CARTAS NUEVAS ---
    // Comunes
    pool.push({ title: 'Rastreador', desc: '+50 Rango de Atracción', rarity: 'común', apply: () => { pObj.magnetRange = (pObj.magnetRange || 150) + 50; } });
    pool.push({ title: 'Reflejos', desc: '+8% Velocidad de Movimiento', rarity: 'común', apply: () => { pObj.speed *= 1.08; } });
    
    // Raras
    pool.push({ title: 'Vampirismo Nano', desc: 'Recupera 1 HP al matar un enemigo', rarity: 'rara', apply: () => { pObj.lifeSteal = (pObj.lifeSteal || 0) + 1; } });
    pool.push({ title: 'Munición Pesada', desc: '+25% Daño pero -10% Velocidad', rarity: 'rara', apply: () => { pObj.damageModifier += 0.25; pObj.speed *= 0.90; } });
    
    // Legendarias
    pool.push({ title: 'Dron de Combate', desc: 'Invoca un dron de apoyo autónomo', rarity: 'legendaria', apply: () => { helperDrones.push({ x: pObj.x, y: pObj.y, ownerId: pObj.id, shootCooldown: 0, angle: 0 }); } });
    pool.push({ title: 'Segunda Oportunidad', desc: 'Revive automáticamente con 50% HP al morir (1 vez)', rarity: 'legendaria', apply: () => { pObj.hasSecondChance = true; } });

    // Sortear 3 opciones
    let choices = [];
    let attempts = 0;
    while (choices.length < 3 && attempts < 50) {
        attempts++;
        let roll = Math.random();
        let rarity = roll < 0.05 ? 'legendaria' : roll < 0.20 ? 'rara' : 'común';
        let filtered = pool.filter(u => u.rarity === rarity);
        if (filtered.length === 0) filtered = pool.filter(u => u.rarity === 'común');
        let pick = filtered[Math.floor(Math.random() * filtered.length)];
        if (!choices.includes(pick)) choices.push(pick);
    }

    // Función para aplicar una mejora y cerrar
    function applyChoice(u) {
        if (levelUpCountdownInterval) { clearInterval(levelUpCountdownInterval); levelUpCountdownInterval = null; }
        u.apply();
        modal.style.display = 'none';
        isPaused = false;
        isLocalLevelUpOpen = false;
        
        // Remover elementos insertados dinámicamente
        let t = document.getElementById('levelup-timer'); if (t) t.remove();
        let b = document.getElementById('levelup-bar'); if (b) b.remove();

        if (typeof isOnline !== 'undefined' && isOnline) {
            sendGameEvent('level-up-resume', { playerId: pObj.id });
        }
        if (levelUpQueue.length > 0) {
            let nextP = levelUpQueue.shift();
            setTimeout(() => showLevelUpMenu(nextP), 300);
        }
    }

    // Countdown de 15 segundos - INSERTAR FUERA DE CHOICES (antes)
    let timeLeft = 15;
    let timerEl = document.createElement('div');
    timerEl.id = 'levelup-timer';
    timerEl.style.cssText = `text-align:center; font-size:28px; font-weight:bold; font-family:'Courier New',monospace; color:#ffff00; margin-bottom:12px; letter-spacing:4px; text-shadow: 0 0 10px #ffff00;`;
    timerEl.innerText = `⏱ ${timeLeft}s`;
    modal.insertBefore(timerEl, choicesDiv);

    let urgencyBar = document.createElement('div');
    urgencyBar.id = 'levelup-bar';
    urgencyBar.style.cssText = `height:4px; background: linear-gradient(90deg, #00ffcc, #ffff00); border-radius:2px; margin-bottom:16px; transition: width 1s linear; width:100%;`;
    modal.insertBefore(urgencyBar, choicesDiv);

    // Crear las cartas
    choices.forEach((u) => {
        let card = document.createElement('div');
        card.className = 'level-up-card';
        let rarityColor = u.rarity === 'legendaria' ? '#ff00ff' : u.rarity === 'rara' ? '#ffff00' : '#00ffcc';
        card.style.borderColor = rarityColor;
        card.innerHTML = `
            <div>
                <div style="font-weight:bold; font-size:18px; color:#fff; text-shadow:0 0 5px rgba(255,255,255,0.3);">${u.title}</div>
                <div style="color:rgba(255,255,255,0.9); font-size:13px; margin-top:8px; line-height:1.4;">${u.desc}</div>
            </div>
            <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; font-weight:bold; color:${rarityColor}">${u.rarity}</div>
        `;
        card.onclick = () => applyChoice(u);
        choicesDiv.appendChild(card);
    });

    // Iniciar countdown
    levelUpCountdownInterval = setInterval(() => {
        timeLeft--;
        if (timerEl) timerEl.innerText = `⏱ ${timeLeft}s`;
        
        let pct = (timeLeft / 15) * 100;
        if (urgencyBar) urgencyBar.style.width = `${pct}%`;
        
        if (timeLeft <= 5) {
            if (timerEl) timerEl.style.color = '#ff4444';
            if (timerEl) timerEl.style.textShadow = '0 0 15px #ff0000';
        }
        if (timeLeft <= 0) {
            let randomChoice = choices[Math.floor(Math.random() * choices.length)];
            applyChoice(randomChoice);
        }
    }, 1000);

    updateMenuSelection('level-up-modal');
}


function updateUI() {
    let p1 = players[0];
    let p2 = players[1];

    // Jugador 1
    document.getElementById('hud-wave').innerText = `OLEADA: ${wave}`;
    document.getElementById('hud-hp').innerText = `${Math.max(0, Math.ceil(p1.hp))}/${p1.maxHp}`;
    document.getElementById('hp-bar-fill').style.width = `${(p1.hp / p1.maxHp) * 100}%`;
    
    document.getElementById('hud-credits').innerText = `CRÉDITOS: $${p1.credits}`;
    document.getElementById('hud-xp').innerText = `NV: ${p1.level} (${Math.floor((p1.xp / p1.nextXp) * 100)}%)`;
    document.getElementById('hud-weapon').innerText = `ARMA: ${WEAPONS[p1.weapons[p1.currentWeaponIndex]].name}`;
    document.getElementById('hud-aim').innerText = `APUNTADO: ${p1.aimMode}`;

    let wep = WEAPONS[p1.weapons[p1.currentWeaponIndex]];
    if (wep) {
        let mods = p1.weaponUpgrades ? (p1.weaponUpgrades[p1.weapons[p1.currentWeaponIndex]] || { damage: 0, fireRate: 0 }) : { damage: 0, fireRate: 0 };
        let baseDmg = wep.damage + mods.damage;
        let finalDmg = Math.floor(baseDmg * p1.damageModifier);
        let dmgText = `DAÑO: ${finalDmg}`;
        if (wep.type === 'spread') {
            let count = wep.count + (mods.count || 0);
            dmgText += ` x${count}`;
        }
        document.getElementById('hud-damage').innerText = dmgText;
        document.getElementById('hud-dmg-mod').innerText = `MOD: ${p1.damageModifier.toFixed(1)}x`;
    }

    let shElement = document.getElementById('hud-shield');
    let shStat = document.getElementById('shield-stat');
    if (p1.maxShield > 0) {
        if (shStat) shStat.style.display = 'flex';
        if (shElement) shElement.innerText = `${Math.ceil(p1.shield)}/${p1.maxShield}`;
        document.getElementById('shield-bar-fill').style.width = `${(p1.shield / p1.maxShield) * 100}%`;
    } else if (shStat) {
        shStat.style.display = 'none';
    }

    if (document.getElementById('hud-mats')) {
        document.getElementById('hud-mats').innerText = `C:${userSave.materials.core} | P:${userSave.materials.plate} | Cr:${userSave.materials.crystal} | R:${userSave.materials.bossRelic || 0}`;
    }

    // Jugador 2
    let hudP2 = document.getElementById('hud-box-p2');
    if (isCoop && p2) {
        if (hudP2) hudP2.style.display = 'block';
        document.getElementById('hud-hp-p2').innerText = `${Math.max(0, Math.ceil(p2.hp))}/${p2.maxHp}`;
        document.getElementById('hp-bar-fill-p2').style.width = `${(p2.hp / p2.maxHp) * 100}%`;
        
        document.getElementById('hud-credits-p2').innerText = `CRÉDITOS: $${p2.credits}`;
        document.getElementById('hud-xp-p2').innerText = `NV: ${p2.level} (${Math.floor((p2.xp / p2.nextXp) * 100)}%)`;
        document.getElementById('hud-weapon-p2').innerText = `ARMA: ${(WEAPONS[p2.weapons[p2.currentWeaponIndex]] || {name: '?'}).name}`;
        document.getElementById('hud-aim-p2').innerText = `APUNTADO: ${p2.aimMode}`;

        let shElementP2 = document.getElementById('hud-shield-p2');
        let shStatP2 = document.getElementById('shield-stat-p2');
        if (p2.maxShield > 0) {
            if (shStatP2) shStatP2.style.display = 'flex';
            if (shElementP2) shElementP2.innerText = `${Math.ceil(p2.shield)}/${p2.maxShield}`;
            document.getElementById('shield-bar-fill-p2').style.width = `${(p2.shield / p2.maxShield) * 100}%`;
        } else if (shStatP2) {
            shStatP2.style.display = 'none';
        }
    } else if (hudP2) {
        hudP2.style.display = 'none';
    }

    if (document.getElementById('hud-mats-p2')) {
        document.getElementById('hud-mats-p2').innerText = `C:${userSave.materials.core}|P:${userSave.materials.plate}|Cr:${userSave.materials.crystal}|R:${userSave.materials.bossRelic || 0}`;
    }

    // Botones de la tienda - Jugador 1
    document.getElementById('btn-up-hp').disabled = p1.credits < 50;
    document.getElementById('btn-up-dmg').disabled = p1.credits < 60;
    document.getElementById('btn-wep-shotgun').disabled = p1.credits < 150 || p1.weapons.includes('shotgun') || p1.weapons.length >= 3;
    document.getElementById('btn-wep-plasma').disabled = p1.credits < 300 || p1.weapons.includes('plasma') || p1.weapons.length >= 3;

    // Botones de la tienda - Jugador 2
    let btnUpHpP2 = document.getElementById('btn-up-hp-p2');
    if (btnUpHpP2) {
        btnUpHpP2.disabled = !p2 || p2.credits < 50;
        document.getElementById('btn-up-dmg-p2').disabled = !p2 || p2.credits < 60;
        document.getElementById('btn-wep-shotgun-p2').disabled = !p2 || p2.weapons.includes('shotgun') || p2.weapons.length >= 3;
        document.getElementById('btn-wep-plasma-p2').disabled = !p2 || p2.weapons.includes('plasma') || p2.weapons.length >= 3;
    }
}

function toggleShop(show) { 
    isShopActive = show; 
    isPaused = show; 
    document.getElementById('shop-modal').style.display = show ? 'block' : 'none'; 
    
    let shopP1Col = document.getElementById('shop-p1-col');
    let shopP2Col = document.getElementById('shop-p2-col');
    
    if (typeof isOnline !== 'undefined' && isOnline) {
        if (typeof isHost !== 'undefined' && isHost) {
            if (shopP1Col) shopP1Col.style.display = 'block';
            if (shopP2Col) shopP2Col.style.display = 'none';
        } else {
            if (shopP1Col) shopP1Col.style.display = 'none';
            if (shopP2Col) shopP2Col.style.display = 'block';
        }
    } else {
        if (shopP1Col) shopP1Col.style.display = 'block';
        if (shopP2Col) shopP2Col.style.display = isCoop ? 'block' : 'none';
    }
    
    if (show) updateMenuSelection('shop-modal'); 
    updateUI(); 
}

function togglePause() {
    isPaused = !isPaused;
    let disp = document.getElementById('pause-display');
    if (disp) {
        disp.style.display = isPaused ? 'block' : 'none';
        if (isPaused) {
            updateMenuSelection('pause-display');
        }
    }
}

function togglePauseFromBtn() {
    togglePause();
}

function toggleControlsModal(show) {
    const modal = document.getElementById('controls-modal');
    if (!modal) return;
    if (!gameStarted) {
        document.getElementById('main-menu').style.display = show ? 'none' : 'block';
    }
    modal.style.display = show ? 'block' : 'none';
    if (show) updateMenuSelection('controls-modal');
}

let activeNexusTab = 'passives';
let activePassiveTier = 'all';

function switchNexusTab(tab) {
    activeNexusTab = tab;
    document.querySelectorAll('.nexus-tab').forEach(btn => btn.classList.remove('active'));
    let activeBtn = document.getElementById('tab-' + tab);
    if (activeBtn) activeBtn.classList.add('active');
    
    const subfilters = document.getElementById('passive-tiers-filter');
    if (subfilters) {
        subfilters.style.display = (tab === 'passives') ? 'flex' : 'none';
    }
    
    updateNexusUI();
}

function filterPassives(tier) {
    activePassiveTier = tier;
    document.querySelectorAll('.nexus-subtab').forEach(btn => btn.classList.remove('active'));
    let activeBtn = document.getElementById('filter-tier-' + tier);
    if (activeBtn) activeBtn.classList.add('active');
    
    updateNexusUI();
}

function getUpgradeCost(id, nextLevel) {
    let comp = COMPONENT_CATALOG[id];
    if (!comp) return null;
    let base = comp.baseCost;
    let credits = 0;
    let mats = { core: 0, plate: 0, crystal: 0, bossRelic: 0 };
    
    if (comp.type === 'skill') {
        if (nextLevel === 2) {
            mats.core = 3;
        } else if (nextLevel === 3) {
            mats.core = 6;
            mats.plate = 1;
        } else if (nextLevel === 4) {
            mats.core = 12;
            mats.plate = 4;
        } else if (nextLevel === 5) {
            mats.core = 20;
            mats.plate = 8;
            mats.crystal = 2;
        } else if (nextLevel === 6) {
            mats.plate = 50;
            mats.crystal = 10;
        }
    } else {
        if (nextLevel === 2) {
            credits = Math.floor(base * 1.5);
            mats.core = 2;
        } else if (nextLevel === 3) {
            credits = Math.floor(base * 2.2);
            mats.core = 5;
            mats.plate = 1;
        } else if (nextLevel === 4) {
            credits = Math.floor(base * 3.5);
            mats.core = 10;
            mats.plate = 3;
        } else if (nextLevel === 5) {
            credits = Math.floor(base * 5.0);
            mats.core = 15;
            mats.plate = 5;
            mats.crystal = 1;
        } else if (nextLevel === 6) {
            credits = Math.floor(base * 10.0);
            mats.plate = 30;
            mats.crystal = 5;
            mats.bossRelic = 1;
        }
    }
    return { credits, mats };
}

function updateNexusUI() {
    if (!document.getElementById('collection-modal') || document.getElementById('collection-modal').style.display === 'none') return;

    // 1. Materials Display
    document.getElementById('nexus-cores').innerText = userSave.materials.core || 0;
    document.getElementById('nexus-plates').innerText = userSave.materials.plate || 0;
    document.getElementById('nexus-crystals').innerText = userSave.materials.crystal || 0;
    document.getElementById('nexus-relics').innerText = userSave.materials.bossRelic || 0;
    document.getElementById('nexus-credits').innerText = (userSave.credits || 0).toLocaleString();

    // 2. Real-time stats
    let maxHp = 100 + getPassiveLevel('passive_hp') * 15;
    let maxShield = getPassiveLevel('passive_shield') > 0 ? (40 + getPassiveLevel('passive_shield') * 10) : 0;
    let damageModifier = 1.0 + getPassiveLevel('passive_dmg') * 0.05;
    let speedPct = 100 + getPassiveLevel('passive_speed') * 3;
    let cdPct = getPassiveLevel('passive_cooldown') * 4;

    document.getElementById('stat-max-hp').innerText = maxHp + ' HP';
    document.getElementById('stat-max-shield').innerText = maxShield + ' SH';
    document.getElementById('stat-damage').innerText = damageModifier.toFixed(2) + 'x';
    document.getElementById('stat-speed').innerText = speedPct + '%';
    document.getElementById('stat-cooldown').innerText = '-' + cdPct + '%';

    // 3. RAM usage text
    let ramUsed = getEquippedRam();
    let ramLimit = 100;
    document.getElementById('ram-usage-text').innerText = ramUsed + ' / ' + ramLimit + ' GB';
    let ramBar = document.getElementById('ram-bar-fill');
    let ramAlert = document.getElementById('ram-warning-alert');
    let launchBtn = document.getElementById('nexus-launch-btn');
    
    if (ramBar) {
        ramBar.style.width = Math.min(100, (ramUsed / ramLimit) * 100) + '%';
        if (ramUsed > ramLimit) {
            ramBar.classList.add('exceeded');
            if (ramAlert) ramAlert.style.display = 'block';
            if (launchBtn) launchBtn.disabled = true;
        } else {
            ramBar.classList.remove('exceeded');
            if (ramAlert) ramAlert.style.display = 'none';
            if (launchBtn) launchBtn.disabled = false;
        }
    }

    // 4. Render equipped components list (right panel) and update SVG blueprint lanes/nodes
    let build = userSave.nexusBuild;
    
    function updateSvgSlot(lineId, nodeId, compId) {
        let line = document.getElementById(lineId);
        let node = document.getElementById(nodeId);
        let comp = COMPONENT_CATALOG[compId];
        
        if (comp) {
            let typeClass = comp.type.includes('weapon') ? 'weapon' : (comp.type === 'skill' ? 'skill' : 'passive');
            if (line) {
                line.setAttribute('class', `nexus-svg-line active ${typeClass}`);
            }
            if (node) {
                node.setAttribute('class', `nexus-svg-node active ${typeClass}`);
            }
        } else {
            if (line) {
                line.setAttribute('class', 'nexus-svg-line');
            }
            if (node) {
                node.setAttribute('class', 'nexus-svg-node');
            }
        }
    }

    updateSvgSlot('line-primary-weapon', 'node-primary-weapon', build.primaryWeapon);
    updateSvgSlot('line-special-weapon', 'node-special-weapon', build.specialWeapon);
    updateSvgSlot('line-skill-q', 'node-skill-q', build.skills.Q);
    updateSvgSlot('line-skill-e', 'node-skill-e', build.skills.E);
    updateSvgSlot('line-skill-shift', 'node-skill-shift', build.skills.Shift);
    updateSvgSlot('line-skill-space', 'node-skill-space', build.skills.Space);
    
    updateSvgSlot('line-passive-0', 'node-passive-0', build.passives[0]);
    updateSvgSlot('line-passive-1', 'node-passive-1', build.passives[1]);
    updateSvgSlot('line-passive-2', 'node-passive-2', build.passives[2]);

    // Renderizar la lista de equipamiento activo en la derecha
    let equippedList = document.getElementById('nexus-equipped-list');
    if (equippedList) {
        equippedList.innerHTML = '';
        
        let slots = [
            { label: 'ARMA PRIMARIA', type: 'primaryWeapon', key: null, compId: build.primaryWeapon, icon: '🔫', class: 'weapon' },
            { label: 'ARMA ESPECIAL', type: 'specialWeapon', key: null, compId: build.specialWeapon, icon: '🚀', class: 'weapon' },
            { label: 'HABILIDAD [Q]', type: 'skills', key: 'Q', compId: build.skills.Q, icon: '⚡', class: 'skill' },
            { label: 'HABILIDAD [E]', type: 'skills', key: 'E', compId: build.skills.E, icon: '🛡️', class: 'skill' },
            { label: 'HABILIDAD [SHIFT]', type: 'skills', key: 'Shift', compId: build.skills.Shift, icon: '🏃', class: 'skill' },
            { label: 'HABILIDAD [ESPACIO]', type: 'skills', key: 'Space', compId: build.skills.Space, icon: '🔧', class: 'skill' },
            { label: 'PASIVA 1', type: 'passives', key: 0, compId: build.passives[0], icon: '⚙️', class: 'passive' },
            { label: 'PASIVA 2', type: 'passives', key: 1, compId: build.passives[1], icon: '⚙️', class: 'passive' },
            { label: 'PASIVA 3', type: 'passives', key: 2, compId: build.passives[2], icon: '⚙️', class: 'passive' }
        ];
        
        slots.forEach((slot, index) => {
            // Visual section headers
            if (index === 0) {
                let header = document.createElement('div');
                header.className = 'equipped-section-header weapon-sec';
                header.innerHTML = '⚔️ Armamento';
                equippedList.appendChild(header);
            } else if (index === 2) {
                let header = document.createElement('div');
                header.className = 'equipped-section-header skill-sec';
                header.innerHTML = '⚡ Habilidades';
                equippedList.appendChild(header);
            } else if (index === 6) {
                let header = document.createElement('div');
                header.className = 'equipped-section-header passive-sec';
                header.innerHTML = '⚙️ Módulos Pasivos';
                equippedList.appendChild(header);
            }

            let row = document.createElement('div');
            row.className = `equipped-item-row ${slot.class}`;
            
            let comp = COMPONENT_CATALOG[slot.compId];
            if (comp) {
                row.innerHTML = `
                    <div class="equipped-item-info">
                        <span class="equipped-item-label">${slot.label}</span>
                        <span class="equipped-item-name">${slot.icon} ${comp.name}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="equipped-item-ram">${comp.ram} GB</span>
                        <button class="equipped-item-remove" onclick="unequipSlot('${slot.type}', ${slot.key !== null ? `'${slot.key}'` : 'null'})">✖</button>
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div class="equipped-item-info">
                        <span class="equipped-item-label" style="color:#555;">${slot.label}</span>
                        <span class="equipped-item-name" style="color:#444; font-style:italic;">[VACÍO]</span>
                    </div>
                    <span class="equipped-item-ram" style="color:#333;">0 GB</span>
                `;
            }
            equippedList.appendChild(row);
        });
    }

    // 5. Render left inventory list
    let listContainer = document.getElementById('nexus-inventory-list');
    if (listContainer) {
        listContainer.innerHTML = '';
        
        for (let key in COMPONENT_CATALOG) {
            let comp = COMPONENT_CATALOG[key];
            
            // Filter by type
            if (activeNexusTab === 'passives' && comp.type !== 'passive') continue;
            if (activeNexusTab === 'weapons' && !comp.type.includes('weapon')) continue;
            if (activeNexusTab === 'skills' && comp.type !== 'skill') continue;
            
            // Filter passives by tier
            if (activeNexusTab === 'passives' && activePassiveTier !== 'all' && comp.tier !== activePassiveTier) continue;
            
            let level = userSave.componentLevels[key] || 0;
            let isUnlocked = userSave.unlockedComponents.includes(key) || comp.baseCost === 0;
            
            // Check if equipped
            let isEquipped = false;
            if (comp.type === 'primary_weapon') isEquipped = (build.primaryWeapon === key);
            else if (comp.type === 'special_weapon') isEquipped = (build.specialWeapon === key);
            else if (comp.type === 'skill') isEquipped = Object.values(build.skills).includes(key);
            else if (comp.type === 'passive') isEquipped = build.passives.includes(key);
            
            let card = document.createElement('div');
            card.className = `nexus-card ${isEquipped ? 'equipped' : ''}`;
            
            let tierLabel = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario', mythic: 'Mítico' }[comp.tier];
            let nameWithLvl = comp.name + (((comp.type === 'passive' || comp.type === 'skill') && isUnlocked) ? ` (Nv. ${level}/6)` : '');
            
            let reqText = '';
            let cannotUnlock = false;
            
            // Requisitos
            if (!isUnlocked && comp.req) {
                if (comp.req === 'Lvl 5 de 1 Pasiva Común') {
                    let unlocked = false;
                    for (let k in COMPONENT_CATALOG) {
                        if (COMPONENT_CATALOG[k].tier === 'common' && (userSave.componentLevels[k] || 0) >= 5) {
                            unlocked = true;
                            break;
                        }
                    }
                    if (!unlocked) {
                        reqText = `<div style="color:#ff0055; font-size:10px; font-weight:bold; margin-top:2px;">Requisito: Lvl 5 de 1 Pasiva Común</div>`;
                        cannotUnlock = true;
                    }
                } else if (comp.req === 'Derrotar a Vector Supreme') {
                    if (!userSave.unlockedArtifacts.includes('heavy_hull')) {
                        reqText = `<div style="color:#ff0055; font-size:10px; font-weight:bold; margin-top:2px;">Requisito: Derrotar a Vector Supreme (Lv10)</div>`;
                        cannotUnlock = true;
                    }
                } else if (comp.req === 'Derrotar a Overlord Apex') {
                    if (!userSave.unlockedArtifacts.includes('kinetic_core')) {
                        reqText = `<div style="color:#ff0055; font-size:10px; font-weight:bold; margin-top:2px;">Requisito: Derrotar a Overlord Apex (Lv15)</div>`;
                        cannotUnlock = true;
                    }
                }
            }
            
            let desc = comp.desc;
            if (level === 5) {
                desc = `<strong>ULTRA (Nv6):</strong> ${comp.ultraDesc}`;
            } else if (level === 6) {
                desc = `<strong>ULTRA (Nv6):</strong> ${comp.ultraDesc}`;
            }
            
            let costHtml = '';
            let upgradeCost = null;
            let canUpgrade = false;
            
            if (!isUnlocked) {
                costHtml = `<div class="card-cost-row">Costo: ${comp.baseCost} Créditos</div>`;
                canUpgrade = (userSave.credits || 0) >= comp.baseCost && !cannotUnlock;
            } else if ((comp.type === 'passive' || comp.type === 'skill') && level < 6) {
                upgradeCost = getUpgradeCost(key, level + 1);
                let matCheck = userSave.materials.core >= (upgradeCost.mats.core || 0) &&
                               userSave.materials.plate >= (upgradeCost.mats.plate || 0) &&
                               userSave.materials.crystal >= (upgradeCost.mats.crystal || 0) &&
                               userSave.materials.bossRelic >= (upgradeCost.mats.bossRelic || 0);
                let credCheck = (userSave.credits || 0) >= upgradeCost.credits;
                
                let matsCostText = [];
                if (upgradeCost.mats.core) matsCostText.push(`${upgradeCost.mats.core} C`);
                if (upgradeCost.mats.plate) matsCostText.push(`${upgradeCost.mats.plate} P`);
                if (upgradeCost.mats.crystal) matsCostText.push(`${upgradeCost.mats.crystal} Cr`);
                if (upgradeCost.mats.bossRelic) matsCostText.push(`${upgradeCost.mats.bossRelic} Rel.`);
                
                let matsCostStr = matsCostText.join(' | ') || 'Gratis';
                
                if (upgradeCost.credits > 0) {
                    costHtml = `<div class="card-cost-row">Costo: $${upgradeCost.credits} [${matsCostStr}]</div>`;
                } else {
                    costHtml = `<div class="card-cost-row">Costo: [${matsCostStr}]</div>`;
                }
                canUpgrade = credCheck && matCheck;
            } else if ((comp.type === 'passive' || comp.type === 'skill') && level === 6) {
                costHtml = `<div class="card-cost-row" style="color:#ffff00; background:rgba(255,255,0,0.05);">¡SISTEMA AL MÁXIMO!</div>`;
            }
            
            let actionButtons = '';
            if (!isUnlocked) {
                actionButtons = `<button class="card-btn upgrade-btn" ${!canUpgrade ? 'disabled' : ''} onclick="unlockComponent('${key}', ${comp.baseCost})">DESBLOQUEAR</button>`;
            } else {
                let equipBtnLabel = isEquipped ? 'DESEQUIPAR' : 'EQUIPAR';
                let equipAction = isEquipped ? `unequipComponent('${key}')` : `equipComponent('${key}')`;
                
                actionButtons = `
                    ${((comp.type === 'passive' || comp.type === 'skill') && level < 6) ? `<button class="card-btn upgrade-btn" ${!canUpgrade ? 'disabled' : ''} onclick="upgradeComponent('${key}')">MEJORAR</button>` : ''}
                    <button class="card-btn equip-btn" onclick="${equipAction}">${equipBtnLabel}</button>
                `;
            }
            
            card.innerHTML = `
                <div class="card-header-row">
                    <span class="card-title">${nameWithLvl}</span>
                    <span class="card-tier-badge ${comp.tier}">${tierLabel} (${comp.ram} GB)</span>
                </div>
                <div class="card-desc">${desc}</div>
                ${reqText}
                ${costHtml}
                <div class="card-actions">${actionButtons}</div>
            `;
            listContainer.appendChild(card);
        }
    }
}

function unlockComponent(id, cost) {
    if ((userSave.credits || 0) >= cost) {
        userSave.credits -= cost;
        userSave.unlockedComponents.push(id);
        if (COMPONENT_CATALOG[id].type === 'passive' || COMPONENT_CATALOG[id].type === 'skill') {
            userSave.componentLevels[id] = 1;
        }
        saveGame();
        updateNexusUI();
    }
}

function upgradeComponent(id) {
    let level = userSave.componentLevels[id] || 0;
    if (level >= 6) return;
    let costObj = getUpgradeCost(id, level + 1);
    if (!costObj) return;
    
    let hasMats = userSave.materials.core >= (costObj.mats.core || 0) &&
                   userSave.materials.plate >= (costObj.mats.plate || 0) &&
                   userSave.materials.crystal >= (costObj.mats.crystal || 0) &&
                   userSave.materials.bossRelic >= (costObj.mats.bossRelic || 0);
    let hasCredits = (userSave.credits || 0) >= costObj.credits;
    
    if (hasMats && hasCredits) {
        userSave.credits -= costObj.credits;
        userSave.materials.core -= (costObj.mats.core || 0);
        userSave.materials.plate -= (costObj.mats.plate || 0);
        userSave.materials.crystal -= (costObj.mats.crystal || 0);
        userSave.materials.bossRelic -= (costObj.mats.bossRelic || 0);
        userSave.componentLevels[id] = level + 1;
        saveGame();
        updateNexusUI();
    }
}

function equipComponent(id) {
    let comp = COMPONENT_CATALOG[id];
    if (!comp) return;
    
    let build = userSave.nexusBuild;
    if (comp.type === 'primary_weapon') {
        build.primaryWeapon = id;
    } else if (comp.type === 'special_weapon') {
        build.specialWeapon = id;
    } else if (comp.type === 'skill') {
        let slotKey = Object.keys(build.skills).find(k => build.skills[k] === id);
        if (slotKey) return; 
        
        let slots = ['Q', 'E', 'Shift', 'Space'];
        let emptySlot = slots.find(s => !build.skills[s]);
        if (emptySlot) {
            build.skills[emptySlot] = id;
        } else {
            build.skills['Q'] = id; 
        }
    } else if (comp.type === 'passive') {
        if (build.passives.includes(id)) return;
        let emptyIdx = build.passives.findIndex(p => p === null);
        if (emptyIdx !== -1) {
            build.passives[emptyIdx] = id;
        } else {
            build.passives[0] = id; 
        }
    }
    saveGame();
    updateNexusUI();
}

function unequipComponent(id) {
    let build = userSave.nexusBuild;
    if (build.primaryWeapon === id) build.primaryWeapon = null;
    if (build.specialWeapon === id) build.specialWeapon = null;
    for (let k in build.skills) {
        if (build.skills[k] === id) build.skills[k] = null;
    }
    let pIdx = build.passives.indexOf(id);
    if (pIdx !== -1) build.passives[pIdx] = null;
    saveGame();
    updateNexusUI();
}

function unequipSlot(type, keyOrIdx) {
    let build = userSave.nexusBuild;
    if (type === 'primaryWeapon') {
        build.primaryWeapon = null;
    } else if (type === 'specialWeapon') {
        build.specialWeapon = null;
    } else if (type === 'skills') {
        build.skills[keyOrIdx] = null;
    } else if (type === 'passives') {
        build.passives[keyOrIdx] = null;
    }
    saveGame();
    updateNexusUI();
}

function toggleCollection(show) {
    inCollectionMenu = show;
    isPaused = show || isGameOver;
    if (!gameStarted) document.getElementById('main-menu').style.display = show ? 'none' : 'block';
    if (isGameOver) document.getElementById('game-over-modal').style.display = show ? 'none' : 'block';
    document.getElementById('collection-modal').style.display = show ? 'block' : 'none';

    if (show) {
        switchNexusTab(activeNexusTab);
    }
}

function closeCollectionMenu() {
    if (getEquippedRam() > 100) {
        showNetworkMessage('⚠️ MEMORIA RAM SOBRECARGADA - AJUSTA TU EQUIPAMIENTO', 2000);
        return;
    }
    
    if (!gameStarted) {
        inCollectionMenu = false;
        document.getElementById('collection-modal').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    } else { 
        toggleCollection(false); 
    }
}

function buyUpgrade(type, pObj) {
    if (!pObj) pObj = players[0];
    
    let hpPrice = Math.floor(50 * Math.pow(1.3, pObj.upgradeCounts.hp));
    let dmgPrice = Math.floor(60 * Math.pow(1.3, pObj.upgradeCounts.dmg));
    let laserPrice = Math.floor(200 * Math.pow(1.3, pObj.upgradeCounts.laser || 0));
    let minigunPrice = Math.floor(180 * Math.pow(1.3, pObj.upgradeCounts.minigun || 0));
    let qPrice = Math.floor(250 * Math.pow(1.3, pObj.upgradeCounts.q_cooldown || 0));

    if (type === 'hp' && pObj.credits >= hpPrice) { 
        pObj.maxHp += 25; pObj.hp += 25; pObj.credits -= hpPrice; 
        pObj.upgradeCounts.hp++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-hp' : 'btn-up-hp-p2');
        let nextPrice = Math.floor(50 * Math.pow(1.3, pObj.upgradeCounts.hp));
        if (btn) btn.innerText = `+25 HP Máxima - $${nextPrice}`;
    }
    else if (type === 'dmg' && pObj.credits >= dmgPrice) { 
        pObj.damageModifier += 0.20; pObj.credits -= dmgPrice; 
        pObj.upgradeCounts.dmg++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-dmg' : 'btn-up-dmg-p2');
        let nextPrice = Math.floor(60 * Math.pow(1.3, pObj.upgradeCounts.dmg));
        if (btn) btn.innerText = `+20% Daño - $${nextPrice}`;
    }
    else if (type === 'laser' && pObj.credits >= laserPrice) {
        if (!pObj.laserDmgMod) pObj.laserDmgMod = 1.0;
        pObj.laserDmgMod += 0.25; // +25% daño láser
        pObj.credits -= laserPrice;
        pObj.upgradeCounts.laser = (pObj.upgradeCounts.laser || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-laser' : 'btn-up-laser-p2');
        let nextPrice = Math.floor(200 * Math.pow(1.3, pObj.upgradeCounts.laser));
        if (btn) btn.innerText = `Potencia Láser - $${nextPrice}`;
    }
    else if (type === 'minigun' && pObj.credits >= minigunPrice) {
        if (!pObj.minigunHeatMod) pObj.minigunHeatMod = 1.0;
        pObj.minigunHeatMod -= 0.15; // -15% generación de calor
        pObj.credits -= minigunPrice;
        pObj.upgradeCounts.minigun = (pObj.upgradeCounts.minigun || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-minigun' : 'btn-up-minigun-p2');
        let nextPrice = Math.floor(180 * Math.pow(1.3, pObj.upgradeCounts.minigun));
        if (btn) btn.innerText = `Enfriamiento Minigun - $${nextPrice}`;
    }
    else if (type === 'q_cooldown' && pObj.credits >= qPrice) {
        if (!pObj.qCdMod) pObj.qCdMod = 1.0;
        pObj.qCdMod -= 0.10; // -10% cooldown
        pObj.credits -= qPrice;
        pObj.upgradeCounts.q_cooldown = (pObj.upgradeCounts.q_cooldown || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-q' : 'btn-up-q-p2');
        let nextPrice = Math.floor(250 * Math.pow(1.3, pObj.upgradeCounts.q_cooldown));
        if (btn) btn.innerText = `Recarga Célula Q - $${nextPrice}`;
    }
    else if (type === 'shotgun' && pObj.credits >= 150 && !pObj.weapons.includes('shotgun')) { pObj.weapons.push('shotgun'); pObj.credits -= 150; pObj.currentWeaponIndex = pObj.weapons.length - 1; }
    else if (type === 'plasma' && pObj.credits >= 300 && !pObj.weapons.includes('plasma')) { pObj.weapons.push('plasma'); pObj.credits -= 300; pObj.currentWeaponIndex = pObj.weapons.length - 1; }
    updateUI();
}

function showNetworkMessage(text, duration = 3000) {
    let el = document.getElementById('network-alert');
    if (!el) {
        el = document.createElement('div');
        el.id = 'network-alert';
        el.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); background:rgba(5,5,20,0.9); color:#00ffcc; padding:10px 20px; border-radius:5px; border:1px solid #00ffcc; z-index:1000; font-family:monospace; box-shadow:0 0 10px #00ffcc; text-align:center; pointer-events:auto;";
        document.getElementById('ui-layer').appendChild(el);
    }
    el.innerHTML = text;
    el.style.display = 'block';
    
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => { el.style.display = 'none'; }, duration);
}

function triggerBossWarning(title, name, subtitle) {
    let banner = document.getElementById('boss-banner');
    if (!banner) return;
    
    let titleEl = banner.querySelector('.boss-title');
    let nameEl = banner.querySelector('.boss-name');
    let subtitleEl = banner.querySelector('.boss-subtitle');
    
    if (titleEl) titleEl.innerText = title;
    if (nameEl) nameEl.innerText = name;
    if (subtitleEl) subtitleEl.innerText = subtitle;
    
    banner.style.display = 'block';
    
    // Forzar reflow para la animación de transición CSS
    banner.offsetHeight;
    
    banner.classList.add('active');
    
    // Screen Shake dramático al aparecer el jefe
    screenShake = 30;
    
    setTimeout(() => {
        banner.classList.remove('active');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 500);
    }, 3500);
}

function resetShopUI() {
    let btnHp = document.getElementById('btn-up-hp');
    if (btnHp) btnHp.innerText = `+25 HP Máxima - $50`;
    let btnHpP2 = document.getElementById('btn-up-hp-p2');
    if (btnHpP2) btnHpP2.innerText = `+25 HP Máxima - $50`;

    let btnDmg = document.getElementById('btn-up-dmg');
    if (btnDmg) btnDmg.innerText = `+20% Daño - $60`;
    let btnDmgP2 = document.getElementById('btn-up-dmg-p2');
    if (btnDmgP2) btnDmgP2.innerText = `+20% Daño - $60`;

    let btnLaser = document.getElementById('btn-up-laser');
    if (btnLaser) btnLaser.innerText = `Potencia Láser - $200`;
    let btnLaserP2 = document.getElementById('btn-up-laser-p2');
    if (btnLaserP2) btnLaserP2.innerText = `Potencia Láser - $200`;

    let btnMinigun = document.getElementById('btn-up-minigun');
    if (btnMinigun) btnMinigun.innerText = `Enfriamiento Minigun - $180`;
    let btnMinigunP2 = document.getElementById('btn-up-minigun-p2');
    if (btnMinigunP2) btnMinigunP2.innerText = `Enfriamiento Minigun - $180`;

    let btnQ = document.getElementById('btn-up-q');
    if (btnQ) btnQ.innerText = `Recarga Célula Q - $250`;
    let btnQP2 = document.getElementById('btn-up-q-p2');
    if (btnQP2) btnQP2.innerText = `Recarga Célula Q - $250`;
}
