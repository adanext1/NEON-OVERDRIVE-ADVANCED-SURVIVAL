let socket;
let currentRoomId;
let isOnline = false;
let isHost = false;

function connectToServer(url = 'https://neon-overdrive-advanced-survival.onrender.com') {
    socket = io(url);

    socket.on('connect', () => {
        console.log('Conectado al servidor con ID:', socket.id);
        isOnline = true;
        document.getElementById('chat-box').style.display = 'block';
    });

    socket.on('player-joined', (data) => {
        console.log('Otro jugador se unió a la sala.');
        showNetworkMessage('🎮 ¡JUGADOR 2 CONECTADO! Listo para jugar.', 5000);
        let p2Status = document.getElementById('p2-status');
        if (p2Status) {
            p2Status.innerText = '[ONLINE]';
            p2Status.style.color = '#00ffcc';
        }
        // Indicador visual en la sala
        let joinBanner = document.createElement('div');
        joinBanner.innerText = '✅ ALIADO CONECTADO';
        joinBanner.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,255,100,0.15);border:2px solid #00ff55;color:#00ff55;font-family:Courier New;font-size:28px;padding:20px 40px;border-radius:8px;z-index:9999;pointer-events:none;transition:opacity 1s;';
        document.body.appendChild(joinBanner);
        setTimeout(() => { joinBanner.style.opacity = '0'; setTimeout(() => joinBanner.remove(), 1000); }, 2500);
    });

    socket.on('remote-player-update', (data) => {
        // Encontrar o crear al jugador 2
        if (players.length < 2) {
            // Crear jugador 2 si no existe
            players.push({
                id: 2, x: data.x, y: data.y, radius: 15, speed: 4, hp: 100, maxHp: 100,
                credits: 0, level: 1, xp: 0, nextXp: 100, weapons: ['basic'], currentWeaponIndex: 0,
                color: isHost ? '#ff007f' : '#00ffcc', shield: 0, maxShield: 40, aimMode: 'AUTO',
                damageModifier: 1.0, overdriveTimer: 0, dashTimer: 0,
                weaponUpgrades: { basic: { damage: 0, fireRate: 0 }, shotgun: { damage: 0, fireRate: 0 }, plasma: { damage: 0, fireRate: 0 } },
                upgradeCounts: { hp: 0, dmg: 0 }
            });
        }
        
        let p2 = players[1];
        if (p2) {
            p2.x = data.x;
            p2.y = data.y;
            p2.hp = data.hp;
            p2.shield = data.shield;
            p2.aimMode = data.aimMode;
            if (data.weapons) p2.weapons = data.weapons;
            p2.currentWeaponIndex = Math.min(data.currentWeaponIndex, (p2.weapons.length - 1));
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
                let localP = players.find(p => p.id === 2) || players[0];
                showLevelUpMenu(localP);
            }
        } else if (data.type === 'sync-stats') {
            if (!isHost) {
                let hostP = players.find(p => p.id === 1) || players[1];
                let clientP = players.find(p => p.id === 2) || players[0];
                
                if (hostP) {
                    hostP.xp = data.payload.p1.xp;
                    hostP.level = data.payload.p1.level;
                    hostP.credits = data.payload.p1.credits;
                    hostP.nextXp = data.payload.p1.nextXp;
                }
                if (clientP) {
                    clientP.xp = data.payload.p2.xp;
                    clientP.level = data.payload.p2.level;
                    clientP.credits = data.payload.p2.credits;
                    clientP.nextXp = data.payload.p2.nextXp;
                }
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
            msgEl.innerHTML = `<span style="color: #ff007f;">[Aliado]:</span> ${data.payload}`;
            messagesDiv.appendChild(msgEl);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
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
    players[0].color = '#00ffcc'; // Host siempre verde/cyan
    currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    connectToServer();
    socket.emit('join-room', currentRoomId);
    showNetworkMessage(`Sala creada. Código: <strong style="color:#fff;">${currentRoomId}</strong> <button onclick="navigator.clipboard.writeText('${currentRoomId}'); this.innerText='¡Copiado!';" style="background:#00ffcc; border:none; color:#000; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:11px; margin-left:10px; font-family:inherit; font-weight:bold;">Copiar</button>`, 10000);
    return currentRoomId;
}

function joinOnlineRoom(roomId) {
    isHost = false;
    isCoop = true;
    players[0].color = '#ff007f'; // Cliente siempre rosa/rojo
    currentRoomId = roomId.toUpperCase();
    connectToServer();
    socket.emit('join-room', currentRoomId);
}

function sendPlayerUpdate() {
    if (!socket || !currentRoomId || !isOnline) return;
    let p1 = players[0];
    socket.emit('player-update', {
        roomId: currentRoomId,
        x: p1.x,
        y: p1.y,
        hp: p1.hp,
        shield: p1.shield,
        aimMode: p1.aimMode,
        currentWeaponIndex: p1.currentWeaponIndex,
        weapons: p1.weapons
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
    msgEl.innerHTML = `<span style="color: #00ffcc;">[Tú]:</span> ${message}`;
    messagesDiv.appendChild(msgEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    sendGameEvent('chat', message);
    
    input.value = '';
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
