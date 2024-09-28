const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Message = sequelize.define('Message', {
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  signature: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  solscanLink: {
    type: DataTypes.STRING,
    allowNull: false
  },
  shortId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
});

module.exports = Message;
