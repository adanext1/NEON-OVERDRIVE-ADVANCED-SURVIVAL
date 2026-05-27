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
            remoteP.hp = data.hp;
            remoteP.shield = data.shield;
            remoteP.aimMode = data.aimMode;
            if (data.weapons) remoteP.weapons = data.weapons;
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
                let localP = players.find(p => p.id === data.payload.playerId) || players[0];
                showLevelUpMenu(localP);
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
        } else if (data.type === 'level-up-pause') {
            let remoteP = players.find(p => p.id === data.payload.playerId) || players[0];
            
            // Si nosotros estamos eligiendo mejora localmente, encolamos la del aliado
            if (typeof isLocalLevelUpOpen !== 'undefined' && isLocalLevelUpOpen) {
                levelUpQueue.push(remoteP);
            } else {
                // Si no, pausamos y mostramos la pantalla de espera
                isPaused = true;
                showLevelUpMenu(remoteP);
            }
        } else if (data.type === 'level-up-resume') {
            // Si nosotros estamos eligiendo mejora localmente, el aliado terminó su espera
            if (typeof isLocalLevelUpOpen !== 'undefined' && isLocalLevelUpOpen) {
                // Quitar al aliado de la cola si estaba ahí (ya no necesitamos mostrar su espera)
                if (typeof levelUpQueue !== 'undefined') {
                    levelUpQueue = levelUpQueue.filter(p => p.id !== data.payload.playerId);
                }
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
        shield: localP.shield,
        aimMode: localP.aimMode,
        currentWeaponIndex: localP.currentWeaponIndex,
        weapons: localP.weapons
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
        credits: pObj.credits,
        damageModifier: pObj.damageModifier,
        weapons: pObj.weapons,
        currentWeaponIndex: pObj.currentWeaponIndex,
        upgradeCounts: pObj.upgradeCounts,
        laserDmgMod: pObj.laserDmgMod,
        minigunHeatMod: pObj.minigunHeatMod,
        qCdMod: pObj.qCdMod
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
    pObj.credits = payload.credits;
    pObj.damageModifier = payload.damageModifier;
    pObj.weapons = payload.weapons || pObj.weapons;
    pObj.currentWeaponIndex = payload.currentWeaponIndex || 0;
    pObj.upgradeCounts = payload.upgradeCounts || pObj.upgradeCounts;
    pObj.laserDmgMod = payload.laserDmgMod;
    pObj.minigunHeatMod = payload.minigunHeatMod;
    pObj.qCdMod = payload.qCdMod;
    updateUI();
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
