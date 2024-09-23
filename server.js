const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sequelize = require('./src/sequelize');
const Message = require('./src/models/Message');
const PlatformStats = require('./src/models/PlatformStats');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    //DEV origin: "*",
    origin: "https://solwall.live",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'build')));

const { Op } = require('sequelize');

const cleanOldMessagesAndStats = async () => {
  try {
    const messageCount = await Message.count();
    if (messageCount > 150) {
      const excess = messageCount - 150;
      const messagesToDelete = await Message.findAll({
        order: [['id', 'DESC']], 
        limit: excess
      });

      const idsToDelete = messagesToDelete.map(msg => msg.id);
      await Message.destroy({
        where: {
          id: {
            [Op.notIn]: idsToDelete
          }
        }
      });
    }

    const statsCount = await PlatformStats.count();
    if (statsCount > 150) {
      const excessStats = statsCount - 150;
      const statsToDelete = await PlatformStats.findAll({
        order: [['id', 'DESC']],
        limit: excessStats
      });

      const idsToDeleteStats = statsToDelete.map(stat => stat.id);
      await PlatformStats.destroy({
        where: {
          id: {
            [Op.notIn]: idsToDeleteStats
          }
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning old messages and platform stats:', error);
  }
};

const updatePlatformStats = async (newMessage) => {
  try {
    const currentStats = await PlatformStats.findOne({
      order: [['createdAt', 'DESC']]
    });

    const newMessageCount = (currentStats ? currentStats.messageCount : 0) + 1;
    const newPlatformFees = (currentStats ? currentStats.platformFees : 0) + 0.0001;

    await PlatformStats.create({
      platformFees: newPlatformFees,
      messageCount: newMessageCount
    });

    io.emit('platformStats', { platformFees: newPlatformFees, messageCount: newMessageCount });

  } catch (error) {
    console.error('Error updating platform stats:', error);
  }
};


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

app.post('/messages', async (req, res) => {
  const { message, signature, solscanLink } = req.body;
  try {
    const newMessage = await Message.create({ message, signature, solscanLink });

    await cleanOldMessagesAndStats();
    await updatePlatformStats(newMessage);

    io.emit('message', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Error adding message' });
  }
});

io.on('connection', async (socket) => {
  try {
    const messages = await Message.findAll();
    socket.emit('allMessages', messages);

    const stats = await PlatformStats.findOne({
      order: [['createdAt', 'DESC']],
    });

    socket.emit('platformStats', {
      platformFees: stats ? stats.platformFees : 0,
      messageCount: stats ? stats.messageCount : 0,
    });

  } catch (error) {
    socket.emit('error', 'Error retrieving messages');
  }

  socket.on('newMessage', (message) => {
    io.emit('message', message);
  });

  socket.on('disconnect', () => {});
});

sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});