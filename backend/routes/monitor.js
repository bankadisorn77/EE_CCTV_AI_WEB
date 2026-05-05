const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Device, Alarm } = require('../models');
const { verifyToken } = require('../middleware/auth');
const path = require('path');
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// 1. ดึงข้อมูลไปโชว์ที่ Dashboard (GET /api/monitor/devices)
router.get('/devices', verifyToken, async (req, res) => {
  const { role, plant } = req.user;
  let whereClause = {};

  if (role === 'admin') {
    // Admin เห็นหมด ไม่ต้องแก้ whereClause
  } 
  else if (role === 'engineer') {
    // Engineer เห็นเครื่องใน Plant ตัวเอง + Unassigned
    whereClause = {
      [Op.or]: [{ plant: plant }, { plant: 'Unassigned' }]
    };
  } 
  else if (role === 'user') {
    // --- LOGIC ใหม่สำหรับ USER ---
    // ห้าม User เห็น Unassigned โดยเด็ดขาด
    if (plant === 'ALL') {
      whereClause.plant = { [Op.ne]: 'Unassigned' }; // ถ้าเป็น User ที่ดูได้ทุก Plant ก็ต้องมองไม่เห็น Unassigned
    } else if (plant === 'Unassigned') {
      whereClause.plant = 'BLOCKED'; // ป้องกันกรณีเผื่อมี User ถูกจับใส่กลุ่ม Unassigned ให้บล็อกข้อมูลไปเลย
    } else {
      whereClause.plant = plant; // User ปกติจะเห็นแค่ Plant ตัวเองเท่านั้น
    }

    const accessibleZones = req.user.accessibleZones;
    if (accessibleZones && accessibleZones !== 'ALL') {
      const zoneList = accessibleZones.split(','); // แปลง "Zone A,Zone B" เป็น Array
      whereClause.zone = { [Op.in]: zoneList }; // กรองเอาเฉพาะโซนที่มีสิทธิ์
    }
  }

  const devices = await Device.findAll({ where: whereClause,attributes: { exclude: ['apiKey'] } });
  res.json(devices);
});




// 2. ดึง Alarm ล่าสุด (GET /api/monitor/alarms)
router.get('/alarms', verifyToken, async (req, res) => {
  const { role, plant } = req.user;
  let deviceWhere = {};

  if (role === 'admin') {
    // Admin เห็นหมด
  } else if (role === 'engineer') {
    deviceWhere = { [Op.or]: [{ plant }, { plant: 'Unassigned' }] };
  } else if (role === 'user') {
    // --- LOGIC ใหม่สำหรับ USER ---
    // ห้าม User เห็น Alarm จากเครื่อง Unassigned โดยเด็ดขาด
    if (plant === 'ALL') {
      deviceWhere.plant = { [Op.ne]: 'Unassigned' };
    } else if (plant === 'Unassigned') {
      deviceWhere.plant = 'BLOCKED';
    } else {
      deviceWhere.plant = plant;
    }

    // เพิ่มการกรองโซน (Zone) สำหรับ Alarm เพื่อให้สิทธิ์ครอบคลุมและถูกต้องเหมือนหน้า Dashboard
    const accessibleZones = req.user.accessibleZones;
    if (accessibleZones && accessibleZones !== 'ALL') {
      const zoneList = accessibleZones.split(',');
      deviceWhere.zone = { [Op.in]: zoneList };
    }
  }

  const alarms = await Alarm.findAll({
    include: [{ model: Device, where: deviceWhere, attributes: ['mcId', 'deviceName', 'zone', 'plant'] }],
    order: [['createdAt', 'DESC']],
    // limit: 30,
  });

 

  const formatted = alarms.map((a) => ({
    id: a.id,
    mcId: a.mcId,
    deviceName: a.Device?.deviceName || null,
    zone: a.Device?.zone || null,
    plant: a.Device?.plant || null,
    type: a.alarmType,
    message: a.message,
    status: a.isFlagged ,
    timestamp: a.timestamp || a.createdAt,
    confidence: a.confidence,
    imageUrl: a.imageUrl ,
  }));
  // console.log("Fetched and formatted alarms:", formatted);
  res.json(formatted);
});

router.put('/alarms/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const alarm = await Alarm.findByPk(id);
  if (!alarm) return res.status(404).json({ error: "Alarm not found" });
  await alarm.update({ isFlagged: status });
  res.json({ message: "Alarm status updated successfully" });
});

router.get("/frame/:mcId/:cameraId", async (req, res) => {
  try {
    const { mcId, cameraId } = req.params;
    const device = await Device.findOne({ where: { mcId } });
    if (!device) return res.status(404).json({ error: "Device not found" });

    const imagePath = device[`cam${cameraId}`];
    console.log(`Fetching frame for ${mcId} camera ${cameraId}:`, imagePath);
    if (!imagePath) return res.status(404).json({ error: "Image not found" });

    res.sendFile(path.join(__dirname, '../uploads', imagePath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error occurred while fetching frame" });
  }
});
module.exports = router;