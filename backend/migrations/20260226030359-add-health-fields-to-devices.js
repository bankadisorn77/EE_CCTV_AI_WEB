'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. เพิ่ม Columns ใหม่
    await queryInterface.addColumn('Devices', 'cpuTemp', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('Devices', 'memoryFree', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('Devices', 'memoryUsed', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    

    // 2. ลบ Column เก่า (ตรวจสอบชื่อ Column ใน DB จริงอีกทีนะครับว่าชื่อ storageFree หรือ storage_free)
    await queryInterface.removeColumn('Devices', 'storageFree');
  },

  async down(queryInterface, Sequelize) {
    // ส่วนสำหรับถอยกลับ (Rollback): ลบคอลัมน์ที่เพิ่ม และเพิ่มคอลัมน์ที่เคยลบกลับมา
    await queryInterface.removeColumn('Devices', 'cpuTemp');
    await queryInterface.removeColumn('Devices', 'memoryFree');
    await queryInterface.removeColumn('Devices', 'memoryUsed');

    await queryInterface.addColumn('Devices', 'storageFree', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
  }
};