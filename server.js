const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // Pour le traitement des requêtes JSON

let messages = []; // Stocke les messages en mémoire (pour une solution plus robuste, utiliser une base de données)

// Route pour obtenir les messages
app.get('/messages', (req, res) => {
  res.json(messages);
});

// Route pour ajouter un message
app.post('/messages', (req, res) => {
  const { message, signature, solscanLink } = req.body;
  const newMessage = { message, signature, solscanLink };
  messages.push(newMessage);
  if (messages.length > 100) {
    messages.shift(); // Conserver uniquement les 100 derniers messages
  }
  io.emit('message', newMessage); // Émettre le nouveau message à tous les clients
  res.status(201).json(newMessage);
});

io.on('connection', (socket) => {
  console.log('New client connected');

  // Émettre les messages existants à un nouveau client
  socket.emit('allMessages', messages);

  socket.on('newMessage', (message) => {
    io.emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
