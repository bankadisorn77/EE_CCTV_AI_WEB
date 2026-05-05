const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Device = sequelize.define('Device', {
  mcId: { type: DataTypes.STRING, primaryKey: true },
  apiKey: { type: DataTypes.STRING, unique: true }, 

  plant: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: 'Unassigned' 
 },
  deviceName: { 
    type: DataTypes.STRING, 
    defaultValue: 'New Device' 
  },
  zone: { 
    type: DataTypes.STRING, 
    defaultValue: 'Unassigned' 
  },
  
  ip: DataTypes.STRING,
  mac: DataTypes.STRING, 
  runningStatus: { type: DataTypes.ENUM('active', 'inactive', 'error'), defaultValue: 'active' },
  confidentLevel: DataTypes.FLOAT,
  cpuTemp: DataTypes.FLOAT,
  gpuTemp: DataTypes.FLOAT,
  memoryFree: DataTypes.FLOAT,
  memoryUsed: DataTypes.FLOAT,
  aiVersion: DataTypes.STRING,
  roiData : DataTypes.JSON, 
  activeDevice: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastSeen: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  cam1:{type: DataTypes.STRING, defaultValue: ''},
  cam2:{type: DataTypes.STRING, defaultValue: ''},
  cam3:{type: DataTypes.STRING, defaultValue: ''},
  cam4:{type: DataTypes.STRING, defaultValue: ''},
});

module.exports = Device;