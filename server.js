const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sequelize = require('./src/sequelize');
const Message = require('./src/models/Message');
const PlatformStats = require('./src/models/PlatformStats'); // Import du modèle PlatformStats

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques de "build"
app.use(express.static(path.join(__dirname, 'build')));

// Rediriger toutes les routes vers index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Nettoyage des anciens messages (limite à 500)
const cleanOldMessages = async () => {
  try {
    const messageCount = await Message.count();
    if (messageCount > 500) {
      const excess = messageCount - 500;
      await Message.destroy({
        where: {},
        order: [['id', 'ASC']],
        limit: excess
      });
    }
  } catch (error) {
    console.error('Error cleaning old messages:', error);
  }
};

// Mettre à jour ou créer les statistiques de la plateforme
const updatePlatformStats = async () => {
  try {
    const messageCount = await Message.count();
    const platformFees = messageCount * 0.0001; // Par exemple, chaque message génère 0.0001 SOL de frais

    const existingStats = await PlatformStats.findOne();
    if (existingStats) {
      // Mettre à jour les statistiques existantes
      existingStats.messageCount = messageCount;
      existingStats.platformFees = platformFees;
      await existingStats.save();
    } else {
      // Créer de nouvelles statistiques
      await PlatformStats.create({
        messageCount: messageCount,
        platformFees: platformFees
      });
    }
  } catch (error) {
    console.error('Error updating platform stats:', error);
  }
};

// Routes API pour gérer les messages
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.findAll();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.get('/messages/count', async (req, res) => {
  try {
    const messageCount = await Message.count();
    res.json({ count: messageCount });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching message count' });
  }
});

// Route API pour obtenir les statistiques de la plateforme
app.get('/platform-stats', async (req, res) => {
  try {
    const stats = await PlatformStats.findOne();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching platform stats' });
  }
});

app.post('/messages', async (req, res) => {
  const { message, signature, solscanLink } = req.body;
  try {
    const newMessage = await Message.create({ message, signature, solscanLink });

    await cleanOldMessages();
    await updatePlatformStats(); // Mettre à jour les statistiques après chaque ajout de message

    io.emit('message', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Error adding message' });
  }
});

// WebSocket pour gérer les messages en temps réel
io.on('connection', async (socket) => {
  try {
    // Récupérer tous les messages dès qu'un utilisateur se connecte
    const messages = await Message.findAll();
    socket.emit('allMessages', messages);
  } catch (error) {
    socket.emit('error', 'Error retrieving messages');
  }

  socket.on('newMessage', (message) => {
    io.emit('message', message);
  });

  socket.on('disconnect', () => {});
});

// Démarrage du serveur après la synchronisation de Sequelize
sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
