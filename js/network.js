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
        showNetworkMessage('¡Un jugador se ha unido a tu partida!');
        let p2Status = document.getElementById('p2-status');
        if (p2Status) {
            p2Status.innerText = '[ONLINE]';
            p2Status.style.color = '#00ffcc';
        }
    });

    socket.on('remote-player-update', (data) => {
        // Encontrar o crear al jugador 2
        if (players.length < 2) {
            // Crear jugador 2 si no existe
            players.push({
                id: 2, x: data.x, y: data.y, radius: 15, speed: 4, hp: 100, maxHp: 100,
                credits: 0, level: 1, xp: 0, nextXp: 100, weapons: ['basic'], currentWeaponIndex: 0,
                color: isHost ? '#ff007f' : '#00ffcc', shield: 0, maxShield: 40, aimMode: 'AUTO'
            });
        }
        
        let p2 = players[1];
        if (p2) {
            p2.x = data.x;
            p2.y = data.y;
            p2.hp = data.hp;
            p2.shield = data.shield;
            p2.aimMode = data.aimMode;
            p2.currentWeaponIndex = data.currentWeaponIndex;
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
        currentWeaponIndex: p1.currentWeaponIndex
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
