const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alarm = sequelize.define('Alarm', {
  mcId: { 
    type: DataTypes.STRING, 
    allowNull: false,
    references: {
      model: 'Devices', 
      key: 'mcId'
    }
  },
  alarmType: { type: DataTypes.STRING },
  message: { type: DataTypes.STRING },
  cameraId: { type: DataTypes.INTEGER },
  confidence: { type: DataTypes.FLOAT },
  imageUrl: { type: DataTypes.STRING }, 
  isFlagged: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false 
  },
  
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = Alarm;