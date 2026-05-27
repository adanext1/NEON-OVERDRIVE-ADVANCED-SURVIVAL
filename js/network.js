let socket;
let currentRoomId;
let isOnline = false;
let isHost = false;
let localPlayerId = 1; // ID del jugador local (1-4)
let onlineConnectedPlayers = [];

function updateOnlinePlayerList() {
    for (let i = 1; i <= 4; i++) {
        let slot = document.getElementById(`online-player-slot-${i}`);
        if (!slot) continue;
        let connected = onlineConnectedPlayers.includes(i);
        let color = PLAYER_COLORS[i - 1] || '#00ffcc';
        slot.innerHTML = `J${i}<br>${connected ? (i === localPlayerId ? 'TÚ' : 'ONLINE') : 'VACÍO'}`;
        slot.style.color = connected ? color : '#555';
        slot.style.borderColor = connected ? color : '#333';
        slot.style.boxShadow = connected ? `0 0 8px ${color}` : 'none';
        slot.style.background = connected ? 'rgba(255,255,255,0.04)' : 'transparent';
    }
}

function markOnlinePlayerConnected(playerId) {
    if (!onlineConnectedPlayers.includes(playerId)) onlineConnectedPlayers.push(playerId);
    onlineConnectedPlayers.sort((a, b) => a - b);
    activePlayers = Math.max(activePlayers || 1, onlineConnectedPlayers.length);
    updateOnlinePlayerList();
}

function markOnlinePlayerDisconnected(playerId) {
    onlineConnectedPlayers = onlineConnectedPlayers.filter(id => id !== playerId);
    activePlayers = Math.max(1, onlineConnectedPlayers.length);
    updateOnlinePlayerList();
}

function connectToServer(url = 'https://neon-overdrive-advanced-survival.onrender.com') {
    socket = io(url);

    socket.on('connect', () => {
        console.log('Conectado al servidor con ID:', socket.id);
        isOnline = true;
        document.getElementById('chat-box').style.display = 'block';
    });

    socket.on('player-assigned-id', (data) => {
        console.log('ID de jugador asignado:', data.playerId);
        localPlayerId = data.playerId;
        markOnlinePlayerConnected(localPlayerId);
        
        let localP = players.find(p => p.id === localPlayerId && p.inputSource !== 'remote');
        if (!localP) {
            localP = players.find(p => p.inputSource !== 'remote') || players[0];
        }
        if (localP) {
            localP.id = localPlayerId;
            localP.color = PLAYER_COLORS[localPlayerId - 1];
            localP.saveIndex = localPlayerId - 1;
            localP.inputSource = localPlayerId === 1 ? 'keyboard' : localP.inputSource;
        }
        
        // Si no somos el host, somos cliente
        isHost = (localPlayerId === 1);
        if (typeof updateHUDLabels === 'function') updateHUDLabels();
        if (typeof updateUI === 'function') updateUI();
        
        showNetworkMessage(`🎮 Eres JUGADOR ${localPlayerId}`, 3000);
    });

    socket.on('room-full', (data) => {
        alert(data.message);
        isOnline = false;
        document.getElementById('chat-box').style.display = 'none';
    });

    socket.on('player-joined', (data) => {
        console.log('Jugador', data.playerId, 'se unió a la sala. Total:', data.totalPlayers);
        markOnlinePlayerConnected(data.playerId);
        showNetworkMessage(`🎮 ¡JUGADOR ${data.playerId} CONECTADO! (${data.totalPlayers}/4)`, 5000);
        
        // Actualizar HUD del jugador que se unió
        let hudId = data.playerId === 1 ? 'hud-box' : `hud-box-p${data.playerId}`;
        let hudElem = document.getElementById(hudId);
        if (hudElem) {
            hudElem.style.display = 'block';
            let statusElem = document.getElementById(`p${data.playerId}-status`);
            if (statusElem) {
                statusElem.innerText = '[ONLINE]';
                statusElem.style.color = PLAYER_COLORS[data.playerId - 1];
            }
        }
        
        // Indicador visual
        let joinBanner = document.createElement('div');
        joinBanner.innerText = `✅ JUGADOR ${data.playerId} CONECTADO`;
        joinBanner.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(${parseInt(PLAYER_COLORS[data.playerId - 1].slice(1,3),16)},${parseInt(PLAYER_COLORS[data.playerId - 1].slice(3,5),16)},${parseInt(PLAYER_COLORS[data.playerId - 1].slice(5,7),16)},0.15);border:2px solid ${PLAYER_COLORS[data.playerId - 1]};color:${PLAYER_COLORS[data.playerId - 1]};font-family:Courier New;font-size:28px;padding:20px 40px;border-radius:8px;z-index:9999;pointer-events:none;transition:opacity 1s;`;
        document.body.appendChild(joinBanner);
        setTimeout(() => { joinBanner.style.opacity = '0'; setTimeout(() => joinBanner.remove(), 1000); }, 2500);
    });

    socket.on('existing-players', (data) => {
        console.log('Jugadores existentes en la sala:', data);
        // Crear jugadores remotos que ya están en la sala
        data.forEach(existingPlayer => {
            markOnlinePlayerConnected(existingPlayer.playerId);
            let remoteP = players.find(p => p.id === existingPlayer.playerId);
            if (!remoteP) {
                remoteP = createPlayer(existingPlayer.playerId, existingPlayer.playerId - 1);
                remoteP.inputSource = 'remote';
                remoteP.color = PLAYER_COLORS[existingPlayer.playerId - 1];
                players.push(remoteP);
            }
        });
        
        // Ordenar players por ID
        players.sort((a, b) => a.id - b.id);
    });

    socket.on('player-disconnected', (data) => {
        console.log('Jugador', data.playerId, 'se desconectó');
        markOnlinePlayerDisconnected(data.playerId);
        showNetworkMessage(`🔌 JUGADOR ${data.playerId} DESCONECTADO`, 3000);
        
        // Ocultar HUD del jugador desconectado
        let hudId = data.playerId === 1 ? 'hud-box' : `hud-box-p${data.playerId}`;
        let hudElem = document.getElementById(hudId);
        if (hudElem) {
            hudElem.style.display = 'none';
        }
        
        // Remover jugador del array
        let index = players.findIndex(p => p.id === data.playerId);
        if (index !== -1) {
            players.splice(index, 1);
        }
    });

    socket.on('new-host', (data) => {
        console.log('Nuevo host asignado:', data.hostId);
        if (socket.id === data.hostId) {
            isHost = true;
            showNetworkMessage('👑 Eres el nuevo HOST', 3000);
        }
    });

    socket.on('remote-player-update', (data) => {
        // Buscar jugador por ID en lugar de índice
        let remoteP = players.find(p => p.id === data.playerId);
        
        if (!remoteP && data.playerId) {
            // Crear jugador si no existe
            remoteP = createPlayer(data.playerId, data.playerId - 1);
            remoteP.inputSource = 'remote';
            remoteP.color = PLAYER_COLORS[data.playerId - 1];
            players.push(remoteP);
            
            // Ordenar players por ID
            players.sort((a, b) => a.id - b.id);
        }
        
        if (remoteP) {
            remoteP.x = data.x;
            remoteP.y = data.y;
            remoteP.angle = data.angle ?? remoteP.angle;
            remoteP.hp = data.hp;
            remoteP.maxHp = data.maxHp ?? remoteP.maxHp;
            remoteP.shield = data.shield;
            remoteP.maxShield = data.maxShield ?? remoteP.maxShield;
            remoteP.aimMode = data.aimMode;
            remoteP.level = data.level ?? remoteP.level;
            remoteP.xp = data.xp ?? remoteP.xp;
            remoteP.nextXp = data.nextXp ?? remoteP.nextXp;
            remoteP.credits = data.credits ?? remoteP.credits;
            remoteP.damageModifier = data.damageModifier ?? remoteP.damageModifier;
            remoteP.speed = data.speed ?? remoteP.speed;
            remoteP.dashCooldown = data.dashCooldown ?? remoteP.dashCooldown;
            remoteP.pulseCooldown = data.pulseCooldown ?? remoteP.pulseCooldown;
            remoteP.qCooldown = data.qCooldown ?? remoteP.qCooldown;
            remoteP.laserCooldown = data.laserCooldown ?? remoteP.laserCooldown;
            remoteP.teleportCooldown = data.teleportCooldown ?? remoteP.teleportCooldown;
            remoteP.isTurret = data.isTurret ?? remoteP.isTurret;
            remoteP.qTurboTimer = data.qTurboTimer ?? remoteP.qTurboTimer;
            remoteP.isDead = data.isDead ?? remoteP.isDead;
            if (data.weapons) remoteP.weapons = data.weapons;
            if (data.weaponUpgrades) remoteP.weaponUpgrades = data.weaponUpgrades;
            if (data.upgradeCounts) remoteP.upgradeCounts = data.upgradeCounts;
            remoteP.currentWeaponIndex = Math.min(data.currentWeaponIndex, (remoteP.weapons.length - 1));
        }
    });

    socket.on('remote-game-event', (data) => {
        if (data.type === 'shoot') {
            if (typeof spawnRemoteBullet === 'function') {
                spawnRemoteBullet(data.payload);
            }
        } else if (data.type === 'enemy-update') {
            if (!isHost && typeof updateRemoteEnemies === 'function') {
                updateRemoteEnemies(data.payload);
            }
        } else if (data.type === 'spawn-enemy') {
            if (!isHost) {
                enemies.push(data.payload);
                if (typeof enemiesToSpawn !== 'undefined' && enemiesToSpawn > 0) {
                    enemiesToSpawn--;
                }
            }
        } else if (data.type === 'wave-sync') {
            if (!isHost) {
                wave = data.payload.wave;
                waveActive = true;
                let ab = document.getElementById('wave-alert');
                if (ab) {
                    ab.innerHTML = `OLEADA ${wave}<br><span style='font-size:18px; color:#fff;'>SISTEMAS INVASORES DETECTADOS</span>`;
                    ab.style.opacity = 1; setTimeout(() => ab.style.opacity = 0, 2200);
                }
                updateUI();
            }
        } else if (data.type === 'open-shop') {
            if (!isHost) {
                toggleShop(true);
            }
        } else if (data.type === 'open-level-up') {
            if (!isHost) {
                let targetP = players.find(p => p.id === data.payload.playerId) || players[0];
                if (data.payload.playerId === localPlayerId) {
                    showLevelUpMenu(targetP);
                } else {
                    showNetworkMessage(`⏳ J${data.payload.playerId} está eligiendo mejora`, 2000);
                }
            }
        } else if (data.type === 'sync-stats') {
            if (!isHost) {
                // Sincronizar stats de todos los jugadores
                Object.keys(data.payload).forEach(key => {
                    let playerId = parseInt(key.replace('p', ''));
                    let localP = players.find(p => p.id === playerId);
                    if (localP) {
                        localP.xp = data.payload[key].xp;
                        localP.level = data.payload[key].level;
                        localP.credits = data.payload[key].credits;
                        localP.nextXp = data.payload[key].nextXp;
                    }
                });
                updateUI();
            }
        } else if (data.type === 'start-game') {
            if (!isHost && typeof startGameSimulation === 'function') {
                startGameSimulation();
            }
        } else if (data.type === 'spawn-dynamic-event') {
            if (!isHost) {
                dynamicEvents.push(data.payload);
            }
        } else if (data.type === 'chat') {
            let messagesDiv = document.getElementById('chat-messages');
            let msgEl = document.createElement('div');
            let senderId = data.payload.playerId || '?';
            let senderColor = PLAYER_COLORS[senderId - 1] || '#ff007f';
            msgEl.innerHTML = `<span style="color: ${senderColor};">[J${senderId}]:</span> ${data.payload.message || ''}`;
            messagesDiv.appendChild(msgEl);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else if (data.type === 'player-upgrade') {
            applyRemotePlayerUpgrade(data.payload);
        } else if (data.type === 'player-ability') {
            applyRemotePlayerAbility(data.payload);
        } else if (data.type === 'level-up-pause') {
            let remoteP = players.find(p => p.id === data.payload.playerId) || players[0];
            if (data.payload.playerId === localPlayerId) return;
            
            // Si nosotros estamos eligiendo mejora localmente, encolamos la del aliado
            if (typeof isLocalLevelUpOpen !== 'undefined' && isLocalLevelUpOpen) {
                if (!levelUpQueue.some(p => p.id === remoteP.id)) {
                    levelUpQueue.push(remoteP);
                }
            } else {
                // Si no, pausamos y mostramos la pantalla de espera
                isPaused = true;
                showLevelUpMenu(remoteP);
            }
        } else if (data.type === 'level-up-resume') {
            if (data.payload.playerId === localPlayerId) return;
            if (typeof levelUpQueue !== 'undefined') {
                levelUpQueue = levelUpQueue.filter(p => p.id !== data.payload.playerId);
            }
            // Si nosotros estamos eligiendo mejora localmente, el aliado terminó su espera
            if (typeof isLocalLevelUpOpen !== 'undefined' && isLocalLevelUpOpen) {
                // Quitar al aliado de la cola si estaba ahí (ya no necesitamos mostrar su espera)
            } else {
                // Estábamos en pantalla de espera: cerrar y reanudar
                let modal = document.getElementById('level-up-modal');
                if (modal) modal.style.display = 'none';
                isPaused = false;
                
                // Procesar cola por si teníamos algo pendiente nosotros
                if (typeof levelUpQueue !== 'undefined' && levelUpQueue.length > 0) {
                    let nextP = levelUpQueue.shift();
                    setTimeout(() => showLevelUpMenu(nextP), 300);
                }
            }
        }
    });
}

function createOnlineRoom() {
    isHost = true;
    isCoop = true;
    localPlayerId = 1; // Host siempre es jugador 1
    players[0].color = PLAYER_COLORS[0]; // Host siempre verde/cyan
    players[0].id = 1;
    players[0].saveIndex = 0;
    currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    connectToServer();
    socket.emit('join-room', currentRoomId);
    let codeEl = document.getElementById('online-room-code');
    if (codeEl) {
        codeEl.style.display = 'block';
        codeEl.innerHTML = `SALA: <strong style="color:#fff; letter-spacing:3px;">${currentRoomId}</strong>`;
    }
    showNetworkMessage(`Sala creada. Código: <strong style="color:#fff;">${currentRoomId}</strong> <button onclick="navigator.clipboard.writeText('${currentRoomId}'); this.innerText='¡Copiado!';" style="background:#00ffcc; border:none; color:#000; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:10px; font-family:inherit; font-weight:bold;">Copiar</button>`, 10000);
    return currentRoomId;
}

function joinOnlineRoom(roomId) {
    if (!roomId || !roomId.trim()) {
        showNetworkMessage('⚠️ Ingresa un código de sala válido', 2500);
        return;
    }
    isHost = false;
    isCoop = true;
    // El ID se asignará cuando el servidor responda con player-assigned-id
    currentRoomId = roomId.toUpperCase();
    connectToServer();
    socket.emit('join-room', currentRoomId);
}

function sendPlayerUpdate() {
    if (!socket || !currentRoomId || !isOnline) return;
    let localP = players.find(p => p.id === localPlayerId);
    if (!localP) return;
    
    socket.emit('player-update', {
        roomId: currentRoomId,
        playerId: localPlayerId,
        x: localP.x,
        y: localP.y,
        hp: localP.hp,
        maxHp: localP.maxHp,
        shield: localP.shield,
        maxShield: localP.maxShield,
        angle: localP.angle,
        aimMode: localP.aimMode,
        level: localP.level,
        xp: localP.xp,
        nextXp: localP.nextXp,
        credits: localP.credits,
        damageModifier: localP.damageModifier,
        speed: localP.speed,
        dashCooldown: localP.dashCooldown,
        pulseCooldown: localP.pulseCooldown,
        qCooldown: localP.qCooldown,
        laserCooldown: localP.laserCooldown,
        teleportCooldown: localP.teleportCooldown,
        isTurret: localP.isTurret,
        qTurboTimer: localP.qTurboTimer,
        isDead: localP.isDead,
        currentWeaponIndex: localP.currentWeaponIndex,
        weapons: localP.weapons,
        weaponUpgrades: localP.weaponUpgrades,
        upgradeCounts: localP.upgradeCounts
    });
}

function sendGameEvent(type, payload) {
    if (!socket || !currentRoomId || !isOnline) return;
    socket.emit('game-event', {
        roomId: currentRoomId,
        type: type,
        payload: payload
    });
}

function sendChat() {
    let input = document.getElementById('chat-input');
    let message = input.value.trim();
    if (message === '') return;
    
    let messagesDiv = document.getElementById('chat-messages');
    let msgEl = document.createElement('div');
    let localColor = PLAYER_COLORS[localPlayerId - 1] || '#00ffcc';
    msgEl.innerHTML = `<span style="color: ${localColor};">[Tú J${localPlayerId}]:</span> ${message}`;
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    sendGameEvent('chat', { playerId: localPlayerId, message: message });
    
    input.value = '';
}

function sendPlayerUpgradeSync(pObj) {
    if (!pObj || !isOnline) return;
    sendGameEvent('player-upgrade', {
        playerId: pObj.id,
        hp: pObj.hp,
        maxHp: pObj.maxHp,
        shield: pObj.shield,
        maxShield: pObj.maxShield,
        level: pObj.level,
        xp: pObj.xp,
        nextXp: pObj.nextXp,
        credits: pObj.credits,
        damageModifier: pObj.damageModifier,
        speed: pObj.speed,
        weapons: pObj.weapons,
        currentWeaponIndex: pObj.currentWeaponIndex,
        weaponUpgrades: pObj.weaponUpgrades,
        upgradeCounts: pObj.upgradeCounts,
        laserDmgMod: pObj.laserDmgMod,
        minigunHeatMod: pObj.minigunHeatMod,
        minigunCooldownMod: pObj.minigunCooldownMod,
        qCdMod: pObj.qCdMod,
        magnetRange: pObj.magnetRange,
        lifeSteal: pObj.lifeSteal,
        hasSecondChance: pObj.hasSecondChance,
        turretDamageReduction: pObj.turretDamageReduction
    });
}

function applyRemotePlayerUpgrade(payload) {
    if (!payload || payload.playerId === localPlayerId) return;
    let pObj = players.find(p => p.id === payload.playerId);
    if (!pObj) {
        pObj = createPlayer(payload.playerId, payload.playerId - 1);
        pObj.inputSource = 'remote';
        pObj.color = PLAYER_COLORS[payload.playerId - 1];
        players.push(pObj);
        players.sort((a, b) => a.id - b.id);
    }
    pObj.hp = payload.hp;
    pObj.maxHp = payload.maxHp;
    pObj.shield = payload.shield ?? pObj.shield;
    pObj.maxShield = payload.maxShield ?? pObj.maxShield;
    pObj.level = payload.level ?? pObj.level;
    pObj.xp = payload.xp ?? pObj.xp;
    pObj.nextXp = payload.nextXp ?? pObj.nextXp;
    pObj.credits = payload.credits;
    pObj.damageModifier = payload.damageModifier;
    pObj.speed = payload.speed ?? pObj.speed;
    pObj.weapons = payload.weapons || pObj.weapons;
    pObj.currentWeaponIndex = payload.currentWeaponIndex || 0;
    pObj.weaponUpgrades = payload.weaponUpgrades || pObj.weaponUpgrades;
    pObj.upgradeCounts = payload.upgradeCounts || pObj.upgradeCounts;
    pObj.laserDmgMod = payload.laserDmgMod;
    pObj.minigunHeatMod = payload.minigunHeatMod;
    pObj.minigunCooldownMod = payload.minigunCooldownMod;
    pObj.qCdMod = payload.qCdMod;
    pObj.magnetRange = payload.magnetRange ?? pObj.magnetRange;
    pObj.lifeSteal = payload.lifeSteal ?? pObj.lifeSteal;
    pObj.hasSecondChance = payload.hasSecondChance ?? pObj.hasSecondChance;
    pObj.turretDamageReduction = payload.turretDamageReduction ?? pObj.turretDamageReduction;
    updateUI();
}

function applyRemotePlayerAbility(payload) {
    if (!payload || payload.playerId === localPlayerId) return;
    let pObj = players.find(p => p.id === payload.playerId);
    if (!pObj) {
        pObj = createPlayer(payload.playerId, payload.playerId - 1);
        pObj.inputSource = 'remote';
        pObj.color = PLAYER_COLORS[payload.playerId - 1];
        players.push(pObj);
        players.sort((a, b) => a.id - b.id);
    }
    pObj.x = payload.x ?? pObj.x;
    pObj.y = payload.y ?? pObj.y;
    pObj.angle = payload.angle ?? pObj.angle;
    pObj.dashCooldown = payload.dashCooldown ?? pObj.dashCooldown;
    pObj.pulseCooldown = payload.pulseCooldown ?? pObj.pulseCooldown;
    pObj.qCooldown = payload.qCooldown ?? pObj.qCooldown;
    pObj.laserCooldown = payload.laserCooldown ?? pObj.laserCooldown;
    pObj.teleportCooldown = payload.teleportCooldown ?? pObj.teleportCooldown;
    pObj.isTurret = payload.isTurret ?? pObj.isTurret;
    pObj.qTurboTimer = payload.qTurboTimer ?? pObj.qTurboTimer;
    
    if (typeof isHost !== 'undefined' && isHost) {
        let abilityId = payload.abilityId;
        if (abilityId === 'pulse' || abilityId === 'pulso_choque') {
            createExplosion(pObj.x, pObj.y, '#ff007f', 40, 2);
            enemies.forEach(e => {
                let dx = e.x - pObj.x;
                let dy = e.y - pObj.y;
                let dist = Math.hypot(dx, dy);
                if (dist < 260) {
                    let angle = Math.atan2(dy, dx);
                    let force = (260 - dist) / 1.2;
                    if (dist > 0) {
                        e.x += Math.cos(angle) * force;
                        e.y += Math.sin(angle) * force;
                    }
                    let dmg = Math.floor(35 * (pObj.damageModifier || 1));
                    e.hp -= dmg;
                    e.flashTicks = 5;
                    if (typeof spawnDamageText === 'function') spawnDamageText(e.x, e.y, dmg, 'normal');
                }
            });
        } else if (abilityId === 'teleport' || abilityId === 'salto_falla') {
            createExplosion(pObj.x, pObj.y, '#7700ff', 20, 1);
        } else if (abilityId === 'overload' || abilityId === 'sobrecarga_armas') {
            createExplosion(pObj.x, pObj.y, '#00ffaa', 30, 2);
        }
    }
}

function spawnRemoteBullet(data) {
    if (data.weaponType === 'single' || data.weaponType === 'plasma') {
        bullets.push({ 
            x: data.x, y: data.y, 
            vx: Math.cos(data.angle) * data.speed, 
            vy: Math.sin(data.angle) * data.speed, 
            radius: data.weaponType === 'plasma' ? 9 : 5, 
            color: data.bulletColor, 
            damage: data.damage, 
            type: data.weaponType, 
            radiusAoE: 0 
        });
    } else if (data.weaponType === 'spread') {
        // Simplificado: disparamos una sola bala en la dirección
        bullets.push({ 
            x: data.x, y: data.y, 
            vx: Math.cos(data.angle) * data.speed, 
            vy: Math.sin(data.angle) * data.speed, 
            radius: 4, 
            color: data.bulletColor, 
            damage: data.damage, 
            type: 'single' 
        });
    }
}

function updateRemoteEnemies(enemyData) {
    enemyData.forEach(remoteEnemy => {
        let localEnemy = enemies.find(e => e.id === remoteEnemy.id);
        if (localEnemy) {
            localEnemy.x = remoteEnemy.x;
            localEnemy.y = remoteEnemy.y;
            localEnemy.hp = remoteEnemy.hp;
        }
    });
}
