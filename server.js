const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sequelize = require('./src/sequelize');
const Message = require('./src/models/Message');

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
app.use(express.json());

// Route pour obtenir les messages
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.findAll();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

// Route pour ajouter un message
app.post('/messages', async (req, res) => {
  const { message, signature, solscanLink } = req.body;
  try {
    const newMessage = await Message.create({ message, signature, solscanLink });
    io.emit('message', newMessage); // Émettre le nouveau message à tous les clients
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout du message' });
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');

  // Émettre les messages existants à un nouveau client
  socket.on('getMessages', async () => {
    try {
      const messages = await Message.findAll();
      socket.emit('allMessages', messages);
    } catch (error) {
      socket.emit('error', 'Erreur lors de la récupération des messages');
    }
  });

  socket.on('newMessage', (message) => {
    io.emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Synchroniser les modèles avec la base de données
sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
