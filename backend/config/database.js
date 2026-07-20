const { Sequelize } = require('sequelize');
const config = require('../config/config.js').development;

const sequelize = new Sequelize(config);

// // รันคำสั่ง PRAGMA หลังจากเชื่อมต่อ
// sequelize.query("PRAGMA journal_mode=WAL;");
// // รันคำสั่ง PRAGMA หลังจากเชื่อมต่อ

module.exports = sequelize;