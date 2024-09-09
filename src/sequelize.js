// src/sequelize.js

const { Sequelize } = require('sequelize');

// Créer une instance Sequelize pour SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite' // Nom du fichier SQLite
});

// Tester la connexion
sequelize.authenticate()
  .then(() => {
    console.log('Connection to SQLite has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

module.exports = sequelize;
