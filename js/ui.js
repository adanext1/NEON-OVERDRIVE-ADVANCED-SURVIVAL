function updateMenuSelection(modalId) {
    selectedMenuItem = [0, 0, 0, 0];
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const buttons = modal.querySelectorAll('.shop-btn, .level-up-card, .menu-btn');
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

    window.currentLevelUpPlayer = pObj;

    // Detección robusta de si es el jugador local
    let isLocalPlayer = false;
    if (typeof isOnline !== 'undefined' && isOnline) {
        isLocalPlayer = (pObj.id === localPlayerId);
    } else {
        isLocalPlayer = true; // En coop local, todos los jugadores son locales y usan la misma pantalla
    }

    const modal = document.getElementById('level-up-modal');
    let playerColor = PLAYER_COLORS[pObj.id - 1] || '#00ffcc';
    
    if (modal.style.display === 'block') {
        if (!levelUpQueue.some(p => p.id === pObj.id)) {
            levelUpQueue.push(pObj);
        }
        return;
    }
    
    modal.style.display = 'block';
    isPaused = true;

    const choicesDiv = document.getElementById('level-up-choices');
    choicesDiv.innerHTML = '';

    const titleElem = modal.querySelector('h2');
    const descElem = modal.querySelector('p');
    
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
            
        return;
    }

    // --- MENU LOCAL ---
    isLocalLevelUpOpen = true;
    
    if (typeof isOnline !== 'undefined' && isOnline) {
        sendGameEvent('level-up-pause', { playerId: pObj.id });
    }
    if (descElem) descElem.style.display = 'block';
    let playerLabel = `JUGADOR ${pObj.id}`;
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
        window.currentLevelUpPlayer = null;
        
        // Remover elementos insertados dinámicamente
        let t = document.getElementById('levelup-timer'); if (t) t.remove();
        let b = document.getElementById('levelup-bar'); if (b) b.remove();

        if (typeof isOnline !== 'undefined' && isOnline) {
            if (typeof sendPlayerUpgradeSync === 'function') {
                sendPlayerUpgradeSync(pObj);
            }
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
    let p1 = (typeof getLocalPlayer === 'function') ? getLocalPlayer() : players[0];
    if (!p1) p1 = players[0];

    // HUD principal: en online muestra al jugador local; en local muestra J1
    document.getElementById('hud-wave').innerText = `OLEADA: ${wave}`;
    document.getElementById('hud-hp').innerText = `${Math.max(0, Math.ceil(p1.hp))}/${p1.maxHp}`;
    document.getElementById('hp-bar-fill').style.width = `${(p1.hp / p1.maxHp) * 100}%`;
    document.getElementById('hud-credits').innerText = `CRÉ: $${p1.credits}`;
    document.getElementById('hud-xp').innerText = `NV: ${p1.level} (${Math.floor((p1.xp / p1.nextXp) * 100)}%)`;
    document.getElementById('hud-weapon').innerText = `ARMA: ${(WEAPONS[p1.weapons[p1.currentWeaponIndex]] || {name:'?'}).name}`;
    document.getElementById('hud-aim').innerText = `APUNTADO: ${p1.aimMode}`;

    let wep = WEAPONS[p1.weapons[p1.currentWeaponIndex]];
    if (wep) {
        let mods = p1.weaponUpgrades ? (p1.weaponUpgrades[p1.weapons[p1.currentWeaponIndex]] || { damage: 0, fireRate: 0 }) : { damage: 0, fireRate: 0 };
        let baseDmg = wep.damage + mods.damage;
        let finalDmg = Math.floor(baseDmg * p1.damageModifier);
        let dmgText = `DAÑO: ${finalDmg}`;
        if (wep.type === 'spread') { let count = wep.count + (mods.count || 0); dmgText += ` x${count}`; }
        document.getElementById('hud-damage').innerText = dmgText;
        document.getElementById('hud-dmg-mod').innerText = `MOD: ${p1.damageModifier.toFixed(1)}x`;
    }

    let shElement = document.getElementById('hud-shield');
    let shStat = document.getElementById('shield-stat');
    if (p1.maxShield > 0) {
        if (shStat) shStat.style.display = 'flex';
        if (shElement) shElement.innerText = `${Math.ceil(p1.shield)}/${p1.maxShield}`;
        document.getElementById('shield-bar-fill').style.width = `${(p1.shield / p1.maxShield) * 100}%`;
    } else if (shStat) { shStat.style.display = 'none'; }

    let p1Save = getPlayerSave(p1);
    if (document.getElementById('hud-mats')) {
        document.getElementById('hud-mats').innerText = `C:${p1Save.materials.core} | P:${p1Save.materials.plate} | Cr:${p1Save.materials.crystal} | R:${p1Save.materials.bossRelic || 0}`;
    }

    // HUDs generalizados para P2, P3, P4
    for (let pi = 1; pi < 4; pi++) {
        let p = players[pi];
        let isActive = isCoop && pi < activePlayers;
        let hudId = pi === 1 ? 'hud-box-p2' : `hud-box-p${pi + 1}`;
        let hud = document.getElementById(hudId);
        if (!hud) continue;

        if (isActive && p) {
            hud.style.display = 'block';
            let sfx = pi === 1 ? '-p2' : `-p${pi + 1}`;
            let hpEl = document.getElementById(`hud-hp${sfx}`);
            let hpBar = document.getElementById(`hp-bar-fill${sfx}`);
            let credEl = document.getElementById(`hud-credits${sfx}`);
            let xpEl = document.getElementById(`hud-xp${sfx}`);
            let wepEl = document.getElementById(`hud-weapon${sfx}`);

            if (hpEl) hpEl.innerText = `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}`;
            if (hpBar) hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
            if (credEl) credEl.innerText = pi === 1 ? `CRÉDITOS: $${p.credits}` : `$${p.credits}`;
            if (xpEl) xpEl.innerText = pi === 1 ? `NV: ${p.level} (${Math.floor((p.xp / p.nextXp) * 100)}%)` : `NV:${p.level}`;
            if (wepEl) wepEl.innerText = pi === 1 ? `ARMA: ${(WEAPONS[p.weapons[p.currentWeaponIndex]] || {name:'?'}).name}` : (WEAPONS[p.weapons[p.currentWeaponIndex]] || {name:'?'}).name.substr(0,3).toUpperCase();

            let shEl = document.getElementById(`hud-shield${sfx}`);
            let shSt = document.getElementById(`shield-stat${sfx}`);
            if (p.maxShield > 0) {
                if (shSt) shSt.style.display = 'flex';
                if (shEl) shEl.innerText = `${Math.ceil(p.shield)}/${p.maxShield}`;
                let shBar = document.getElementById(`shield-bar-fill${sfx}`);
                if (shBar) shBar.style.width = `${(p.shield / p.maxShield) * 100}%`;
            } else if (shSt) { shSt.style.display = 'none'; }

            // Materiales para P2 (compacto para P3/P4)
            if (pi === 1) {
                let p2Save = getPlayerSave(p);
                let matsEl = document.getElementById('hud-mats-p2');
                if (matsEl) matsEl.innerText = `C:${p2Save.materials.core}|P:${p2Save.materials.plate}|Cr:${p2Save.materials.crystal}|R:${p2Save.materials.bossRelic || 0}`;
            }

            // Cooldown bars (solo P2 tiene las barras de cooldown completas)
            if (pi === 1) {
                let aimEl = document.getElementById('hud-aim-p2');
                if (aimEl) aimEl.innerText = `APUNTADO: ${p.aimMode}`;
            }
        } else {
            hud.style.display = 'none';
        }
    }

    // Botones de tienda — HUD principal/jugador local
    let btnHp = document.getElementById('btn-up-hp');
    if (btnHp) btnHp.disabled = p1.credits < 50;
    let btnDmg = document.getElementById('btn-up-dmg');
    if (btnDmg) btnDmg.disabled = p1.credits < 60;
    let btnSg = document.getElementById('btn-wep-shotgun');
    if (btnSg) btnSg.disabled = p1.credits < 150 || p1.weapons.includes('shotgun') || p1.weapons.length >= 3;
    let btnPl = document.getElementById('btn-wep-plasma');
    if (btnPl) btnPl.disabled = p1.credits < 300 || p1.weapons.includes('plasma') || p1.weapons.length >= 3;

    // Botones de tienda — P2-P4 genérico
    for (let pi = 1; pi < 4; pi++) {
        let p = players[pi];
        if (!p) continue;
        let sfx = pi === 1 ? '-p2' : `-p${pi + 1}`;
        let ids = ['hp', 'dmg', `shotgun`, `plasma`];
        let prices = [50, 60, 150, 300];
        ids.forEach((id, idx) => {
            let btn = document.getElementById(`btn-up-${id}${sfx}`) || document.getElementById(`btn-wep-${id}${sfx}`);
            if (!btn) return;
            btn.disabled = !p || p.credits < prices[idx] || (id === 'shotgun' && p.weapons.includes('shotgun')) || (id === 'plasma' && p.weapons.includes('plasma'));
        });
    }
}

function toggleShop(show) {
    isShopActive = show;
    isPaused = show;
    document.getElementById('shop-modal').style.display = show ? 'block' : 'none';

    // Mostrar columnas según modo de juego y número de jugadores activos
    if (typeof isOnline !== 'undefined' && isOnline) {
        for (let i = 1; i <= 4; i++) {
            let col = document.getElementById(`shop-p${i}-col`);
            if (!col) continue;
            let isLocalCol = i === localPlayerId;
            col.style.display = (show && isLocalCol) ? 'block' : 'none';
            col.style.borderColor = PLAYER_COLORS[i - 1] || '#00ffcc';
        }
    } else {
        // Modo local: mostrar columnas según activePlayers
        for (let i = 1; i <= 4; i++) {
            let col = document.getElementById(`shop-p${i}-col`);
            if (col) col.style.display = (show && i <= activePlayers) ? 'block' : (i === 1 ? 'block' : 'none');
        }
    }

    if (show) {
        updateMenuSelection('shop-modal');
        // Inicializar los cursores y clases para cada jugador en la tienda
        selectedMenuItem = [0, 0, 0, 0];
        document.querySelectorAll('.shop-btn').forEach(btn => {
            btn.classList.remove('selected', 'selected-p1', 'selected-p2', 'selected-p3', 'selected-p4');
        });
        
        let pLimit = (typeof isOnline !== 'undefined' && isOnline) ? 1 : activePlayers;
        for (let i = 0; i < pLimit; i++) {
            let colIndex = i;
            if (typeof isOnline !== 'undefined' && isOnline) {
                colIndex = localPlayerId - 1;
            }
            let col = document.getElementById(`shop-p${colIndex + 1}-col`);
            if (col) {
                let firstBtn = col.querySelector('.shop-btn');
                if (firstBtn) {
                    firstBtn.classList.add(`selected-p${colIndex + 1}`);
                }
            }
        }
    }
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
        if (activePlayers > 1) {
            // Modo multi-panel
            document.getElementById('nexus-single-panel').style.display = 'none';
            document.getElementById('nexus-multipanel').style.display = 'block';
            renderNexusMultiPanel();
        } else {
            // Panel único normal
            document.getElementById('nexus-single-panel').style.display = 'block';
            document.getElementById('nexus-multipanel').style.display = 'none';
            switchNexusTab(activeNexusTab);
        }
    }
}

function closeCollectionMenu() {
    // Para modo multi-panel, verificar RAM de todos los jugadores activos
    if (activePlayers > 1) {
        for (let i = 0; i < activePlayers; i++) {
            let save = playerSaves[i];
            if (getEquippedRam(save) > 100) {
                showNetworkMessage(`⚠️ JUGADOR ${i + 1}: MEMORIA RAM SOBRECARGADA — ajusta tu equipamiento`, 2000);
                return;
            }
        }
    } else {
        if (getEquippedRam() > 100) {
            showNetworkMessage('⚠️ MEMORIA RAM SOBRECARGADA - AJUSTA TU EQUIPAMIENTO', 2000);
            return;
        }
    }
    
    if (!gameStarted) {
        inCollectionMenu = false;
        document.getElementById('collection-modal').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    } else { 
        toggleCollection(false); 
    }
}

// === SELECTOR DE JUGADORES EN MENÚ ===
let playerSlotsActive = [true, false, false, false]; // P1 siempre activo

function updatePlayerSlotUI() {
    if (gameStarted) return;
    const gamepads = navigator.getGamepads();
    let connectedCount = 0;
    for (let i = 0; i < 4; i++) {
        if (gamepads[i] && gamepads[i].connected) connectedCount++;
    }

    let selector = document.getElementById('player-slot-selector');
    let singleBtn = document.getElementById('btn-start-single');
    if (!selector) return;

    if (connectedCount > 0) {
        selector.style.display = 'block';
        if (singleBtn) singleBtn.style.display = 'none';
        
        // Actualizar slots según gamepads detectados
        for (let i = 0; i < 4; i++) {
            let slotEl = document.getElementById(`slot-p${i + 1}`);
            let statusEl = document.getElementById(`slot-status-p${i + 1}`);
            let gpConnected = gamepads[i] && gamepads[i].connected;
            
            if (i === 0) {
                // P1 siempre activo
                if (slotEl) { slotEl.classList.remove('inactive'); slotEl.querySelector('.slot-icon').innerText = '🎮'; }
                if (statusEl) statusEl.innerText = 'LISTO';
            } else if (gpConnected) {
                // Slot con mando disponible
                let isActive = playerSlotsActive[i];
                if (slotEl) {
                    slotEl.classList.toggle('inactive', !isActive);
                    slotEl.querySelector('.slot-icon').innerText = isActive ? '🎮' : '○';
                }
                if (statusEl) statusEl.innerText = isActive ? 'ACTIVO' : 'PRESIONA A';
            } else {
                // Sin mando
                if (slotEl) { slotEl.classList.add('inactive'); slotEl.querySelector('.slot-icon').innerText = '✕'; }
                if (statusEl) statusEl.innerText = 'SIN MANDO';
                playerSlotsActive[i] = false;
            }
        }

        // Contar activos para el botón
        let totalActive = playerSlotsActive.filter(a => a).length;
        activePlayers = totalActive; // Mantener activePlayers actualizado para el menú Nexus
        let label = document.getElementById('btn-start-coop-label');
        if (label) label.innerText = totalActive === 1 ? 'INICIAR SIMULACIÓN' : `INICIAR CON ${totalActive} JUGADORES`;
    } else {
        selector.style.display = 'none';
        if (singleBtn) singleBtn.style.display = '';
        playerSlotsActive = [true, false, false, false];
        activePlayers = 1;
    }
}

function togglePlayerSlot(slotId) {
    if (slotId < 2 || slotId > 4) return; // P1 no se puede desactivar
    let idx = slotId - 1;
    const gamepads = navigator.getGamepads();
    let gpConnected = gamepads[idx] && gamepads[idx].connected;
    if (!gpConnected) return; // Solo se puede activar si hay mando
    
    playerSlotsActive[idx] = !playerSlotsActive[idx];
    updatePlayerSlotUI();
}

function startCoopGame() {
    // Construir el array de jugadores según slots activos
    players = [];
    activePlayers = 0;
    for (let i = 0; i < 4; i++) {
        if (playerSlotsActive[i]) {
            let p = createPlayer(i + 1, i);
            if (i === 0 && !navigator.getGamepads()[0]?.connected) {
                p.inputSource = 'keyboard';
            }
            players.push(p);
            activePlayers++;
        }
    }
    isCoop = activePlayers > 1;
    
    // Reasignar IDs secuencialmente
    players.forEach((p, idx) => { p.id = idx + 1; p.saveIndex = playerSlotsActive.indexOf(true, idx === 0 ? 0 : players[idx-1]?.saveIndex + 1) || idx; });
    
    startGameSimulation();
}

// === NEXUS MULTI-PANEL ===
let nexusPanelCursors = [0, 0, 0, 0]; // Posición del cursor por jugador
let nexusPanelTabs = ['passives', 'passives', 'passives', 'passives']; // Tab activa por jugador

function renderNexusMultiPanel() {
    let container = document.getElementById('nexus-multipanel');
    if (!container) return;
    container.innerHTML = '';

    let grid = document.createElement('div');
    grid.className = 'nexus-multipanel-grid';
    grid.setAttribute('data-players', activePlayers);

    for (let pi = 0; pi < activePlayers; pi++) {
        let save = playerSaves[pi];
        let color = PLAYER_COLORS[pi] || '#00ffcc';
        let pLabel = `J${pi + 1}`;
        let tab = nexusPanelTabs[pi] || 'passives';

        let panel = document.createElement('div');
        panel.className = 'nexus-player-panel';
        panel.style.setProperty('--pcolor', color);

        // Header
        let ram = getEquippedRam(save);
        let ramColor = ram > 100 ? '#ff0055' : ram > 80 ? '#ffff00' : color;
        panel.innerHTML = `
            <div class="nexus-player-header">
                <span style="color:${color}; font-size:14px;">⚡ ${pLabel}</span>
                <span style="font-size:10px; color:#aaa;">💵 $${save.credits || 0}</span>
            </div>
            <div class="nexus-player-tabs">
                <button class="nexus-player-tab-btn ${tab==='passives'?'active':''}" style="--pcolor:${color}" onclick="switchNexusPanelTab(${pi},'passives')">PASIVOS</button>
                <button class="nexus-player-tab-btn ${tab==='weapons'?'active':''}" style="--pcolor:${color}" onclick="switchNexusPanelTab(${pi},'weapons')">ARMAS</button>
                <button class="nexus-player-tab-btn ${tab==='skills'?'active':''}" style="--pcolor:${color}" onclick="switchNexusPanelTab(${pi},'skills')">SKILLS</button>
            </div>
        `;

        // Lista de componentes según tab
        let listDiv = document.createElement('div');
        listDiv.className = 'nexus-player-list';
        listDiv.id = `nexus-list-p${pi}`;

        let components = [];
        for (let key in COMPONENT_CATALOG) {
            let comp = COMPONENT_CATALOG[key];
            let matchesTab = (tab === 'passives' && comp.type === 'passive') ||
                             (tab === 'weapons' && comp.type.includes('weapon')) ||
                             (tab === 'skills' && comp.type === 'skill');
            if (matchesTab) {
                components.push(key);
            }
        }

        components.forEach((compId, cidx) => {
            let comp = COMPONENT_CATALOG[compId];
            if (!comp) return;

            let isUnlocked = (save.unlockedComponents || []).includes(compId) || comp.baseCost === 0;
            let build = save.nexusBuild || {};
            let isEquipped = (build.passives && build.passives.includes(compId)) ||
                             (build.skills && Object.values(build.skills).includes(compId)) ||
                             build.primaryWeapon === compId || build.specialWeapon === compId;
            let lvl = save.componentLevels[compId] || (isUnlocked ? 1 : 0);
            let isSelected = nexusPanelCursors[pi] === cidx;

            let cannotUnlock = false;
            let reqText = '';
            if (!isUnlocked && comp.req) {
                if (comp.req === 'Lvl 5 de 1 Pasiva Común') {
                    let unlocked = false;
                    for (let k in COMPONENT_CATALOG) {
                        if (COMPONENT_CATALOG[k].tier === 'common' && (save.componentLevels[k] || 0) >= 5) {
                            unlocked = true;
                            break;
                        }
                    }
                    if (!unlocked) {
                        reqText = `<div style="color:#ff0055; font-size:9px; font-weight:bold; margin-top:2px;">Req: Nv.5 Pasiva Común</div>`;
                        cannotUnlock = true;
                    }
                } else if (comp.req === 'Derrotar a Vector Supreme') {
                    if (!save.unlockedArtifacts || !save.unlockedArtifacts.includes('heavy_hull')) {
                        reqText = `<div style="color:#ff0055; font-size:9px; font-weight:bold; margin-top:2px;">Req: Derrotar a Vector (Lv10)</div>`;
                        cannotUnlock = true;
                    }
                } else if (comp.req === 'Derrotar a Overlord Apex') {
                    if (!save.unlockedArtifacts || !save.unlockedArtifacts.includes('kinetic_core')) {
                        reqText = `<div style="color:#ff0055; font-size:9px; font-weight:bold; margin-top:2px;">Req: Derrotar a Overlord (Lv15)</div>`;
                        cannotUnlock = true;
                    }
                }
            }

            let tierLabel = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario', mythic: 'Mítico' }[comp.tier] || comp.tier;

            let actionButtons = '';
            let costText = '';
            
            if (!isUnlocked) {
                costText = `<div style="font-size:0.7em; color:#ffcc00; margin-top:2px;">Costo: $${comp.baseCost}</div>`;
                let canUnlock = (save.credits || 0) >= comp.baseCost && !cannotUnlock;
                actionButtons = cannotUnlock 
                    ? `<span style="color:#ff0055; font-size:0.75em; font-weight:bold;">BLOQUEADO</span>` 
                    : `<button class="nexus-item-btn" style="--pcolor:${color}" ${!canUnlock ? 'disabled' : ''} onclick="nexusPanelUnlock(${pi},'${compId}')">COMPRAR (X)</button>`;
            } else {
                let equipLabel = isEquipped ? 'DEQ' : 'EQ';
                actionButtons = `<button class="nexus-item-btn" style="--pcolor:${color}" onclick="nexusPanelEquip(${pi},'${compId}')">${equipLabel} (A)</button>`;
                
                if ((comp.type === 'passive' || comp.type === 'skill') && lvl < 6) {
                    let upgradeCost = getUpgradeCost(compId, lvl + 1);
                    let matCheck = (save.materials.core || 0) >= (upgradeCost.mats.core || 0) &&
                                   (save.materials.plate || 0) >= (upgradeCost.mats.plate || 0) &&
                                   (save.materials.crystal || 0) >= (upgradeCost.mats.crystal || 0) &&
                                   (save.materials.bossRelic || 0) >= (upgradeCost.mats.bossRelic || 0);
                    let credCheck = (save.credits || 0) >= upgradeCost.credits;
                    let canUpgrade = matCheck && credCheck;
                    
                    let matsText = [];
                    if (upgradeCost.mats.core) matsText.push(`${upgradeCost.mats.core}C`);
                    if (upgradeCost.mats.plate) matsText.push(`${upgradeCost.mats.plate}P`);
                    if (upgradeCost.mats.crystal) matsText.push(`${upgradeCost.mats.crystal}Cr`);
                    if (upgradeCost.mats.bossRelic) matsText.push(`${upgradeCost.mats.bossRelic}R`);
                    let matsStr = matsText.join('|') || 'Gratis';
                    
                    costText = `<div style="font-size:0.7em; color:#ffff00; margin-top:2px;">Costo: $${upgradeCost.credits} [${matsStr}]</div>`;
                    actionButtons = `<button class="nexus-item-btn" style="--pcolor:${color}; margin-right:4px;" ${!canUpgrade ? 'disabled' : ''} onclick="nexusPanelUpgrade(${pi},'${compId}')">MEJORAR (X)</button>` + actionButtons;
                } else if ((comp.type === 'passive' || comp.type === 'skill') && lvl === 6) {
                    costText = `<div style="font-size:0.7em; color:#00ffcc; margin-top:2px; font-weight:bold;">¡SISTEMA MÁXIMO!</div>`;
                }
            }

            let item = document.createElement('div');
            item.className = `nexus-player-item ${isEquipped ? 'equipped' : ''} ${isSelected ? 'selected' : ''}`;
            item.style.setProperty('--pcolor', color);
            item.innerHTML = `
                <div style="overflow:hidden; flex:1; text-align:left; padding-right:8px;">
                    <div style="font-size:0.85em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; justify-content:space-between; font-weight:bold;">
                        <span>${comp.icon || ''} ${comp.name}</span>
                        <span class="card-tier-badge ${comp.tier}" style="font-size:0.7em; padding:0px 4px; border-radius:3px;">${tierLabel.toUpperCase()}</span>
                    </div>
                    <div style="font-size:0.72em; color:#888; margin-top:2px; line-height:1.2;">${comp.desc}</div>
                    ${reqText}
                    ${costText}
                    <div style="font-size:0.75em; color:${color}; margin-top:4px; font-weight:bold;">
                        Nv.${lvl} | ${comp.ram} GB
                    </div>
                </div>
                <div class="nexus-item-actions" style="display:flex; align-items:center;">
                    ${actionButtons}
                </div>
            `;
            item.onclick = (e) => { 
                if (!e.target.classList.contains('nexus-item-btn')) {
                    nexusPanelCursors[pi] = cidx;
                    renderNexusMultiPanel();
                }
            };
            listDiv.appendChild(item);
        });

        if (listDiv.children.length === 0) {
            listDiv.innerHTML = `<div style="color:#555; font-size:0.85em; padding:8px;">Sin componentes de este tipo</div>`;
        }

        panel.appendChild(listDiv);

        // RAM bar footer
        let ramFooter = document.createElement('div');
        ramFooter.className = 'nexus-player-ram';
        let ramPct = Math.min(100, (ram / 100) * 100);
        ramFooter.innerHTML = `
            RAM: <span style="color:${ramColor};">${ram}/100 GB</span>
            <div class="nexus-player-ram-bar">
                <div class="nexus-player-ram-fill" style="width:${ramPct}%; background:${ramColor};"></div>
            </div>
        `;
        panel.appendChild(ramFooter);

        grid.appendChild(panel);
    }

    let footer = document.createElement('div');
    footer.className = 'nexus-multipanel-footer';
    footer.innerHTML = `
        <div style="font-size:10px; color:#555; margin-bottom:8px; letter-spacing:2px;">D-PAD↑↓ navegar | A=Equipar | X=Comprar/Mejorar | ←→ cambiar pestaña | START=Cerrar</div>
        <button class="menu-btn menu-btn-primary" onclick="closeCollectionMenu()" style="max-width:300px; margin:0 auto;">🚀 DESPEGAR</button>
    `;

    container.appendChild(grid);
    container.appendChild(footer);

    // Auto-scroll para mantener el elemento seleccionado a la vista con el mando
    setTimeout(() => {
        for (let pi = 0; pi < activePlayers; pi++) {
            let listEl = document.getElementById(`nexus-list-p${pi}`);
            if (listEl) {
                let selectedEl = listEl.querySelector('.nexus-player-item.selected');
                if (selectedEl) {
                    selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            }
        }
    }, 0);
}

function switchNexusPanelTab(playerIdx, tab) {
    nexusPanelTabs[playerIdx] = tab;
    renderNexusMultiPanel();
}

function nexusPanelEquip(playerIdx, compId) {
    let save = playerSaves[playerIdx];
    if (!save || !save.nexusBuild) return;
    let comp = COMPONENT_CATALOG[compId];
    if (!comp) return;

    let build = save.nexusBuild;
    if (comp.type === 'passive') {
        let idx = build.passives.indexOf(compId);
        if (idx >= 0) { build.passives[idx] = null; } // desequipar
        else {
            let freeSlot = build.passives.indexOf(null);
            if (freeSlot >= 0) build.passives[freeSlot] = compId;
            else { showNetworkMessage(`⚠️ J${playerIdx+1}: No hay slots de pasivos libres`, 2000); return; }
        }
    } else if (comp.type === 'skill') {
        // Cycle through skill slots
        let skillKeys = Object.keys(build.skills);
        let currentSlot = skillKeys.find(k => build.skills[k] === compId);
        if (currentSlot) { build.skills[currentSlot] = null; }
        else {
            let freeSlot = skillKeys.find(k => !build.skills[k]);
            if (freeSlot) build.skills[freeSlot] = compId;
        }
    } else if (comp.type === 'weapon') {
        if (build.primaryWeapon === compId) build.primaryWeapon = 'basic';
        else if (build.specialWeapon === compId) build.specialWeapon = 'laser';
        else build.specialWeapon = compId;
    }

    let ram = getEquippedRam(save);
    if (ram > 100) {
        showNetworkMessage(`⚠️ J${playerIdx+1}: RAM excedida (${ram}/100 GB)`, 2000);
    }
    savePlayerProgress(playerIdx);
    renderNexusMultiPanel();
}

function nexusPanelUnlock(playerIdx, compId) {
    let save = playerSaves[playerIdx];
    if (!save) return;
    let comp = COMPONENT_CATALOG[compId];
    if (!comp) return;

    let cost = comp.baseCost;
    if ((save.credits || 0) >= cost) {
        save.credits -= cost;
        if (!save.unlockedComponents) save.unlockedComponents = [];
        save.unlockedComponents.push(compId);
        if (comp.type === 'passive' || comp.type === 'skill') {
            if (!save.componentLevels) save.componentLevels = {};
            save.componentLevels[compId] = 1;
        }
        savePlayerProgress(playerIdx);
        renderNexusMultiPanel();
    } else {
        showNetworkMessage(`⚠️ J${playerIdx + 1}: Créditos insuficientes ($${save.credits}/${cost})`, 2000);
    }
}

function nexusPanelUpgrade(playerIdx, compId) {
    let save = playerSaves[playerIdx];
    if (!save) return;
    let comp = COMPONENT_CATALOG[compId];
    if (!comp) return;

    if (!save.componentLevels) save.componentLevels = {};
    let level = save.componentLevels[compId] || 0;
    if (level >= 6) return;
    let costObj = getUpgradeCost(compId, level + 1);
    if (!costObj) return;

    if (!save.materials) save.materials = { core: 0, plate: 0, crystal: 0, bossRelic: 0 };
    let hasMats = (save.materials.core || 0) >= (costObj.mats.core || 0) &&
                  (save.materials.plate || 0) >= (costObj.mats.plate || 0) &&
                  (save.materials.crystal || 0) >= (costObj.mats.crystal || 0) &&
                  (save.materials.bossRelic || 0) >= (costObj.mats.bossRelic || 0);
    let hasCredits = (save.credits || 0) >= costObj.credits;

    if (hasMats && hasCredits) {
        save.credits -= costObj.credits;
        save.materials.core = (save.materials.core || 0) - (costObj.mats.core || 0);
        save.materials.plate = (save.materials.plate || 0) - (costObj.mats.plate || 0);
        save.materials.crystal = (save.materials.crystal || 0) - (costObj.mats.crystal || 0);
        save.materials.bossRelic = (save.materials.bossRelic || 0) - (costObj.mats.bossRelic || 0);
        save.componentLevels[compId] = level + 1;
        savePlayerProgress(playerIdx);
        renderNexusMultiPanel();
    } else {
        showNetworkMessage(`⚠️ J${playerIdx + 1}: Recursos o créditos insuficientes`, 2000);
    }
}

function handleNexusGamepadInput(gpIdx, gp, lastButtons) {
    if (!gp) return;
    let pi = gpIdx; // índice del jugador = índice del gamepad
    if (pi >= activePlayers) return;

    let save = playerSaves[pi];
    let tab = nexusPanelTabs[pi] || 'passives';
    let components = [];
    for (let key in COMPONENT_CATALOG) {
        let comp = COMPONENT_CATALOG[key];
        let matchesTab = (tab === 'passives' && comp.type === 'passive') ||
                         (tab === 'weapons' && comp.type.includes('weapon')) ||
                         (tab === 'skills' && comp.type === 'skill');
        if (matchesTab) {
            components.push(key);
        }
    }

    let moved = false;
    // D-Pad o Joystick ↑↓: navegar lista
    if ((gp.buttons[12]?.pressed && !lastButtons[12]) || (gp.axes[1] < -0.5 && menuNavCooldown === 0)) {
        if (nexusPanelCursors[pi] > 0) {
            nexusPanelCursors[pi]--;
            moved = true;
            if (gp.axes[1] < -0.5) menuNavCooldown = 15;
        }
    } else if ((gp.buttons[13]?.pressed && !lastButtons[13]) || (gp.axes[1] > 0.5 && menuNavCooldown === 0)) {
        if (nexusPanelCursors[pi] < components.length - 1) {
            nexusPanelCursors[pi]++;
            moved = true;
            if (gp.axes[1] > 0.5) menuNavCooldown = 15;
        }
    }
    // D-Pad o Joystick ←→: cambiar pestaña
    if ((gp.buttons[14]?.pressed && !lastButtons[14]) || (gp.axes[0] < -0.5 && menuNavCooldown === 0)) {
        let tabs = ['passives', 'weapons', 'skills'];
        let curr = tabs.indexOf(nexusPanelTabs[pi]);
        nexusPanelTabs[pi] = tabs[(curr - 1 + tabs.length) % tabs.length];
        nexusPanelCursors[pi] = 0;
        moved = true;
        if (gp.axes[0] < -0.5) menuNavCooldown = 15;
    } else if ((gp.buttons[15]?.pressed && !lastButtons[15]) || (gp.axes[0] > 0.5 && menuNavCooldown === 0)) {
        let tabs = ['passives', 'weapons', 'skills'];
        let curr = tabs.indexOf(nexusPanelTabs[pi]);
        nexusPanelTabs[pi] = tabs[(curr + 1) % tabs.length];
        nexusPanelCursors[pi] = 0;
        moved = true;
        if (gp.axes[0] > 0.5) menuNavCooldown = 15;
    }
    // A: equipar / desequipar componente seleccionado (solo si está desbloqueado)
    if (gp.buttons[0]?.pressed && !lastButtons[0]) {
        let compId = components[nexusPanelCursors[pi]];
        if (compId) {
            let isUnlocked = (save.unlockedComponents || []).includes(compId) || COMPONENT_CATALOG[compId].baseCost === 0;
            if (isUnlocked) {
                nexusPanelEquip(pi, compId);
            } else {
                showNetworkMessage(`⚠️ J${pi+1}: Debes desbloquear este componente primero`, 2000);
            }
        }
        moved = true;
    }
    // X (botón 2): desbloquear / mejorar
    if (gp.buttons[2]?.pressed && !lastButtons[2]) {
        let compId = components[nexusPanelCursors[pi]];
        if (compId) {
            let isUnlocked = (save.unlockedComponents || []).includes(compId) || COMPONENT_CATALOG[compId].baseCost === 0;
            if (!isUnlocked) {
                // Verificar requisitos
                let cannotUnlock = false;
                let comp = COMPONENT_CATALOG[compId];
                if (comp.req) {
                    if (comp.req === 'Lvl 5 de 1 Pasiva Común') {
                        let unlocked = false;
                        for (let k in COMPONENT_CATALOG) {
                            if (COMPONENT_CATALOG[k].tier === 'common' && (save.componentLevels[k] || 0) >= 5) {
                                unlocked = true;
                                break;
                            }
                        }
                        if (!unlocked) cannotUnlock = true;
                    } else if (comp.req === 'Derrotar a Vector Supreme') {
                        if (!save.unlockedArtifacts || !save.unlockedArtifacts.includes('heavy_hull')) cannotUnlock = true;
                    } else if (comp.req === 'Derrotar a Overlord Apex') {
                        if (!save.unlockedArtifacts || !save.unlockedArtifacts.includes('kinetic_core')) cannotUnlock = true;
                    }
                }
                if (!cannotUnlock) {
                    nexusPanelUnlock(pi, compId);
                }
            } else {
                let lvl = save.componentLevels[compId] || 0;
                if ((COMPONENT_CATALOG[compId].type === 'passive' || COMPONENT_CATALOG[compId].type === 'skill') && lvl < 6) {
                    nexusPanelUpgrade(pi, compId);
                }
            }
        }
        moved = true;
    }
    // Start: cerrar Nexus
    if (gp.buttons[9]?.pressed && !lastButtons[9]) {
        closeCollectionMenu();
    }

    if (moved) renderNexusMultiPanel();
}

function buyUpgrade(type, pObj) {
    if (!pObj) pObj = players[0];
    if (typeof isOnline !== 'undefined' && isOnline && pObj.id !== localPlayerId) return;
    
    let hpPrice = Math.floor(50 * Math.pow(1.3, pObj.upgradeCounts.hp));
    let dmgPrice = Math.floor(60 * Math.pow(1.3, pObj.upgradeCounts.dmg));
    let laserPrice = Math.floor(200 * Math.pow(1.3, pObj.upgradeCounts.laser || 0));
    let minigunPrice = Math.floor(180 * Math.pow(1.3, pObj.upgradeCounts.minigun || 0));
    let qPrice = Math.floor(250 * Math.pow(1.3, pObj.upgradeCounts.q_cooldown || 0));

    if (type === 'hp' && pObj.credits >= hpPrice) { 
        pObj.maxHp += 25; pObj.hp += 25; pObj.credits -= hpPrice; 
        pObj.upgradeCounts.hp++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-hp' : `btn-up-hp-p${pObj.id}`);
        let nextPrice = Math.floor(50 * Math.pow(1.3, pObj.upgradeCounts.hp));
        if (btn) btn.innerText = `+25 HP Máxima - $${nextPrice}`;
    }
    else if (type === 'dmg' && pObj.credits >= dmgPrice) { 
        pObj.damageModifier += 0.20; pObj.credits -= dmgPrice; 
        pObj.upgradeCounts.dmg++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-dmg' : `btn-up-dmg-p${pObj.id}`);
        let nextPrice = Math.floor(60 * Math.pow(1.3, pObj.upgradeCounts.dmg));
        if (btn) btn.innerText = `+20% Daño - $${nextPrice}`;
    }
    else if (type === 'laser' && pObj.credits >= laserPrice) {
        if (!pObj.laserDmgMod) pObj.laserDmgMod = 1.0;
        pObj.laserDmgMod += 0.25; // +25% daño láser
        pObj.credits -= laserPrice;
        pObj.upgradeCounts.laser = (pObj.upgradeCounts.laser || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-laser' : `btn-up-laser-p${pObj.id}`);
        let nextPrice = Math.floor(200 * Math.pow(1.3, pObj.upgradeCounts.laser));
        if (btn) btn.innerText = `Potencia Láser - $${nextPrice}`;
    }
    else if (type === 'minigun' && pObj.credits >= minigunPrice) {
        if (!pObj.minigunHeatMod) pObj.minigunHeatMod = 1.0;
        pObj.minigunHeatMod -= 0.15; // -15% generación de calor
        pObj.credits -= minigunPrice;
        pObj.upgradeCounts.minigun = (pObj.upgradeCounts.minigun || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-minigun' : `btn-up-minigun-p${pObj.id}`);
        let nextPrice = Math.floor(180 * Math.pow(1.3, pObj.upgradeCounts.minigun));
        if (btn) btn.innerText = `Enfriamiento Minigun - $${nextPrice}`;
    }
    else if (type === 'q_cooldown' && pObj.credits >= qPrice) {
        if (!pObj.qCdMod) pObj.qCdMod = 1.0;
        pObj.qCdMod -= 0.10; // -10% cooldown
        pObj.credits -= qPrice;
        pObj.upgradeCounts.q_cooldown = (pObj.upgradeCounts.q_cooldown || 0) + 1;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-q' : `btn-up-q-p${pObj.id}`);
        let nextPrice = Math.floor(250 * Math.pow(1.3, pObj.upgradeCounts.q_cooldown));
        if (btn) btn.innerText = `Recarga Célula Q - $${nextPrice}`;
    }
    else if (type === 'shotgun' && pObj.credits >= 150 && !pObj.weapons.includes('shotgun')) { pObj.weapons.push('shotgun'); pObj.credits -= 150; pObj.currentWeaponIndex = pObj.weapons.length - 1; }
    else if (type === 'plasma' && pObj.credits >= 300 && !pObj.weapons.includes('plasma')) { pObj.weapons.push('plasma'); pObj.credits -= 300; pObj.currentWeaponIndex = pObj.weapons.length - 1; }
    if (typeof isOnline !== 'undefined' && isOnline && typeof sendPlayerUpgradeSync === 'function') {
        sendPlayerUpgradeSync(pObj);
    }
    updateUI();
}

function buyUpgradeForPlayer(type, playerId) {
    let pObj = players.find(p => p.id === playerId);
    if (!pObj) return;
    buyUpgrade(type, pObj);
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
