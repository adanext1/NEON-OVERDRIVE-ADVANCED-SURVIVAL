const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Sistema de salas para soportar hasta 4 jugadores
let rooms = {};

app.get('/', (req, res) => {
    res.send('Servidor de Neon Overdrive corriendo.');
});

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Usuario ${socket.id} se unió a la sala ${roomId}`);
        
        // Crear sala si no existe
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                hostId: socket.id
            };
        }
        
        let room = rooms[roomId];
        
        // Asignar primer ID libre de jugador (1-4)
        let usedIds = room.players.map(p => p.playerId);
        let playerId = [1, 2, 3, 4].find(id => !usedIds.includes(id));
        if (!playerId) {
            socket.emit('room-full', { message: 'Sala llena (máximo 4 jugadores)' });
            socket.leave(roomId);
            return;
        }
        
        // Agregar jugador a la sala
        room.players.push({
            socketId: socket.id,
            playerId: playerId
        });
        
        console.log(`Jugador ${playerId} asignado a socket ${socket.id} en sala ${roomId}`);
        
        // Enviar ID asignado al jugador
        socket.emit('player-assigned-id', { playerId: playerId });
        
        // Informar a otros jugadores que alguien se unió
        socket.to(roomId).emit('player-joined', { 
            playerId: playerId,
            totalPlayers: room.players.length
        });
        
        // Enviar lista de jugadores actuales al nuevo jugador
        let otherPlayers = room.players.filter(p => p.socketId !== socket.id);
        socket.emit('existing-players', otherPlayers);
    });

    // Retransmitir actualización de jugador
    socket.on('player-update', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('remote-player-update', data);
        }
    });

    // Retransmitir eventos de disparo o acciones
    socket.on('game-event', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('remote-game-event', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        
        // Eliminar jugador de todas las salas
        Object.keys(rooms).forEach(roomId => {
            let room = rooms[roomId];
            let playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            
            if (playerIndex !== -1) {
                let disconnectedPlayer = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                
                // Informar a otros jugadores
                socket.to(roomId).emit('player-disconnected', { 
                    playerId: disconnectedPlayer.playerId 
                });
                
                // Si el host se desconecta, asignar nuevo host
                if (room.hostId === socket.id && room.players.length > 0) {
                    room.hostId = room.players[0].socketId;
                    io.to(roomId).emit('new-host', { hostId: room.hostId });
                }
                
                // Eliminar sala si está vacía
                if (room.players.length === 0) {
                    delete rooms[roomId];
                }
            }
        });
    });
});

http.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
