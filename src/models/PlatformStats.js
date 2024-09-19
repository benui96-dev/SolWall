const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const PlatformStats = sequelize.define('PlatformStats', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  platformFees: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: false
  },
  messageCount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'PlatformStats'
});

module.exports = PlatformStats;
