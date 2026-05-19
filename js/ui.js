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
    if (userSave.artifacts.shieldGen && p1.maxShield > 0) {
        if (shStat) shStat.style.display = 'flex';
        if (shElement) shElement.innerText = `${Math.ceil(p1.shield)}/${p1.maxShield}`;
        document.getElementById('shield-bar-fill').style.width = `${(p1.shield / p1.maxShield) * 100}%`;
    } else if (shStat) {
        shStat.style.display = 'none';
    }

    if (document.getElementById('hud-mats')) {
        document.getElementById('hud-mats').innerText = `C:${userSave.materials.core} | P:${userSave.materials.plate} | Cr:${userSave.materials.crystal}`;
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
        if (userSave.artifacts.shieldGen && p2.maxShield > 0) {
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
        document.getElementById('hud-mats-p2').innerText = `C:${userSave.materials.core}|P:${userSave.materials.plate}|Cr:${userSave.materials.crystal}`;
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

function toggleCollection(show) {
    inCollectionMenu = show;
    isPaused = show || isGameOver;
    if (!gameStarted) document.getElementById('main-menu').style.display = show ? 'none' : 'block';
    if (isGameOver) document.getElementById('game-over-modal').style.display = show ? 'none' : 'block';
    document.getElementById('collection-modal').style.display = show ? 'block' : 'none';

    if (show) {
        document.getElementById('mats-display').innerText = `Núcleos: ${userSave.materials.core} | Placas: ${userSave.materials.plate} | Cristales: ${userSave.materials.crystal}`;
        let grid = document.getElementById('collection-grid'); grid.innerHTML = '';
        for (let key in ARTIFACT_RECIPES) {
            let art = ARTIFACT_RECIPES[key];
            let level = userSave.artifacts[key] || 0;
            let maxLevel = art.maxLevel;
            let cost = {
                core: art.baseCost.core * (level + 1),
                plate: art.baseCost.plate * (level + 1),
                crystal: art.baseCost.crystal * (level + 1)
            };
            let hasMats = userSave.materials.core >= cost.core && userSave.materials.plate >= cost.plate && userSave.materials.crystal >= cost.crystal;
            
            let itemDiv = document.createElement('div'); itemDiv.className = `collection-item ${level > 0 ? 'item-owned' : ''}`;
            itemDiv.innerHTML = `
        <strong style="color: ${level > 0 ? '#ffff00' : '#ff007f'}; font-size: 14px;">${art.name} (Nv. ${level}/${maxLevel})</strong><br>
        <div style="font-size:12px; color:rgba(255,255,255,0.9); margin: 4px 0;">${art.desc}</div>
        <div style="font-size:11px; color:#00ffcc; font-weight:bold;">Costo: C:${cost.core} P:${cost.plate} Cr:${cost.crystal}</div>
        ${(level < maxLevel) ? `<button class="shop-btn" style="padding:6px; margin-top:8px; font-size:11px;" ${!hasMats ? 'disabled' : ''} onclick="craftArtifact('${key}')">MEJORAR</button>` : '<div style="color:#00ffcc; font-size:11px; font-weight:bold; margin-top:8px;">MÁXIMO NIVEL</div>'}
    `;
            grid.appendChild(itemDiv);
        }
        updateMenuSelection('collection-modal');
    }
}

function closeCollectionMenu() {
    if (!gameStarted) {
        inCollectionMenu = false;
        document.getElementById('collection-modal').style.display = 'none';
        document.getElementById('main-menu').style.display = 'block';
    } else { toggleCollection(false); }
}

function craftArtifact(key) {
    let art = ARTIFACT_RECIPES[key];
    let level = userSave.artifacts[key] || 0;
    let cost = {
        core: art.baseCost.core * (level + 1),
        plate: art.baseCost.plate * (level + 1),
        crystal: art.baseCost.crystal * (level + 1)
    };
    
    if (userSave.materials.core >= cost.core && userSave.materials.plate >= cost.plate && userSave.materials.crystal >= cost.crystal && level < art.maxLevel) {
        userSave.materials.core -= cost.core;
        userSave.materials.plate -= cost.plate;
        userSave.materials.crystal -= cost.crystal;
        userSave.artifacts[key] = level + 1;
        saveGame();
        toggleCollection(true);
    }
}

function buyUpgrade(type, pObj) {
    if (!pObj) pObj = players[0];
    
    let hpPrice = Math.floor(50 * Math.pow(1.5, pObj.upgradeCounts.hp));
    let dmgPrice = Math.floor(60 * Math.pow(1.5, pObj.upgradeCounts.dmg));

    if (type === 'hp' && pObj.credits >= hpPrice) { 
        pObj.maxHp += 25; pObj.hp += 25; pObj.credits -= hpPrice; 
        pObj.upgradeCounts.hp++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-hp' : 'btn-up-hp-p2');
        let nextPrice = Math.floor(50 * Math.pow(1.5, pObj.upgradeCounts.hp));
        if (btn) btn.innerText = `+25 HP Máxima - $${nextPrice}`;
    }
    else if (type === 'dmg' && pObj.credits >= dmgPrice) { 
        pObj.damageModifier += 0.20; pObj.credits -= dmgPrice; 
        pObj.upgradeCounts.dmg++;
        let btn = document.getElementById(pObj.id === 1 ? 'btn-up-dmg' : 'btn-up-dmg-p2');
        let nextPrice = Math.floor(60 * Math.pow(1.5, pObj.upgradeCounts.dmg));
        if (btn) btn.innerText = `+20% Daño - $${nextPrice}`;
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
