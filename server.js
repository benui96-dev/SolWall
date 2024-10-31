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
    //origin: "*",
    origin: ["https://solwall.live", "https://www.solwall.live"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'build')));

const updatePlatformStats = async (newMessage) => {
  try {
    const currentStats = await PlatformStats.findOne({
      order: [['createdAt', 'DESC']]
    });

    const newMessageCount = (currentStats ? currentStats.messageCount : 0) + 1;
    const newPlatformFees = (currentStats ? currentStats.platformFees : 0) + 0.00005;

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
    const messages = await Message.findAll({
      order: [['id', 'DESC']],
      limit: 100
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.post('/messages', async (req, res) => {
  const { message, signature, solscanLink } = req.body;
  try {

    const { customAlphabet } = await import('nanoid');
    const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 5);
    const shortId = nanoid();

    const newMessage = await Message.create({ message, signature, solscanLink, shortId });

    await updatePlatformStats(newMessage);

    io.emit('message', newMessage);
    res.status(201).json(newMessage);

    const messages = await Message.findAll({
      order: [['id', 'DESC']],
      limit: 100
    });
    io.emit('allMessages', messages);
  } catch (error) {
    res.status(500).json({ error: 'Error adding message' });
  }
});

app.get('/:shortId', async (req, res) => {
  const { shortId } = req.params;

  try {
    const message = await Message.findOne({ where: { shortId } });

    if (!message) {
      return res.status(404).send('Not found');
    }

    return res.redirect(message.solscanLink);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});

io.on('connection', async (socket) => {
  try {
    const messages = await Message.findAll({
      order: [['id', 'DESC']],
      limit: 100
    });
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