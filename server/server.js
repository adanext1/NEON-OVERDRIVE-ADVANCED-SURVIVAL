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

app.get('/', (req, res) => {
    res.send('Servidor de Neon Overdrive corriendo.');
});

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Usuario ${socket.id} se unió a la sala ${roomId}`);
        
        // Informar al otro jugador que nos conectamos
        socket.to(roomId).emit('player-joined', { id: socket.id });
    });

    // Retransmitir actualización de jugador
    socket.on('player-update', (data) => {
        // data debe incluir roomId para saber a quién enviar
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
    });
});

http.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
