const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Device = sequelize.define('Device', {
  mcId: { type: DataTypes.STRING, primaryKey: true },
  apiKey: { type: DataTypes.STRING, unique: true }, // สำหรับใช้แทน JWT ที่หมดอายุ

  plant: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: 'Unassigned' // เปลี่ยนจาก Undefined เป็น Unassigned ให้ตรงกัน
 },
  deviceName: { 
    type: DataTypes.STRING, 
    defaultValue: 'New Device' // ค่าเริ่มต้น
  },
  zone: { 
    type: DataTypes.STRING, 
    defaultValue: 'Unassigned' // เช่น Zone A, ชั้น 1, คลังสินค้า
  },
  
  ip: DataTypes.STRING,
  mac: DataTypes.STRING, // ไม่ต้อง unique สำหรับ MAC Address เพราะอาจมีเครื่องซ้ำกันได้
  runningStatus: { type: DataTypes.ENUM('active', 'inactive', 'error'), defaultValue: 'active' },
  confidentLevel: DataTypes.FLOAT,
  cpuTemp: DataTypes.FLOAT,
  gpuTemp: DataTypes.FLOAT,
  memoryFree: DataTypes.FLOAT,
  memoryUsed: DataTypes.FLOAT,
  aiVersion: DataTypes.STRING,
  roiData : DataTypes.JSON, // ข้อมูล ROI ที่อาจมีหลายค่า
  activeDevice: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastSeen: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = Device;