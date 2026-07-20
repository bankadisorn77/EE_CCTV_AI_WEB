const User = require('./User');
const Device = require('./Device');
const Alarm = require('./Alarm');

// การเชื่อมความสัมพันธ์ (Associations)
Device.hasMany(Alarm, { foreignKey: 'mcId', sourceKey: 'mcId' });
Alarm.belongsTo(Device, { foreignKey: 'mcId', targetKey: 'mcId' });

module.exports = { User, Device, Alarm };