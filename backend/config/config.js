require('dotenv').config();
module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './data/database.sqlite',
    dialectOptions: {
      // เปิดโหมด WAL
      mode: require('sqlite3').OPEN_READWRITE | require('sqlite3').OPEN_CREATE,
    },
    logging: false
  }
};

