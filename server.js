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

// Route to get messages
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
    io.emit('message', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Error adding message' });
  }
});

io.on('connection', (socket) => {
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

  socket.on('disconnect', () => {});
});

sequelize.sync().then(() => {
  server.listen(PORT);
});
