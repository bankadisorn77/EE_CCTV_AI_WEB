const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  en: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'engineer', 'user'), defaultValue: 'user' },
  plant: { type: DataTypes.STRING, allowNull: false },
  accessibleZones: { 
    type: DataTypes.TEXT, 
    allowNull: true, 
    defaultValue: 'ALL',
    comment: 'เก็บเป็น CSV เช่น "Zone A,Zone B" หรือ "ALL"'
  },
  // ปรับเป็น TEXT เพราะ Refresh Token มักจะยาวกว่าปกติ
  refreshToken: { type: DataTypes.TEXT, allowNull: true } 
}, {
  hooks: {
    // ฟังก์ชันช่วย Hash รหัสผ่าน
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    // เพิ่มตรงนี้: เพื่อให้ตอน Update รหัสผ่าน มันทำการ Hash ด้วย
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

module.exports = User;