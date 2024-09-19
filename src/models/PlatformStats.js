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
  timestamps: false, // Désactive les timestamps automatiques (createdAt, updatedAt) car nous avons notre propre createdAt
  tableName: 'PlatformStats' // Assure que le nom de la table est bien `PlatformStats`
});

module.exports = PlatformStats;
