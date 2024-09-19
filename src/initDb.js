const sequelize = require('./sequelize');
const Message = require('./models/Message');

const initializeDatabase = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('Database & tables created!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initializeDatabase();
