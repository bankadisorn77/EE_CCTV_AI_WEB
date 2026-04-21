const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const crypto = require('crypto');
const { Device, Alarm } = require('../models');
const { verifyApiKey } = require('../middleware/auth');
router.get('/check-api-key', verifyApiKey, (req, res) => {
  res.status(200).json({ success: true });
});

// Register เครื่องใหม่ (Unassigned)
router.post('/register', async (req, res) => {
  try {
    const { mac, ip } = req.body;
    
    // สร้าง ID สุ่มขึ้นมาก่อน
    const mcId = 'MC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = crypto.randomBytes(32).toString('hex');

    // ตรวจสอบว่า MAC Address ซ้ําหรือไม่
    const existingDevice = await Device.findOne({ where: { mac } });
    if (existingDevice) {
      return res.status(400).json({ error: "Device already registered" });
    }

    // สร้าง Record โดยใช้ mcId เป็นชื่อตั้งต้น (deviceName)
    await Device.create({ 
      mcId, 
      apiKey,
      deviceName: mcId, // <--- ใช้ ID เป็นชื่อเริ่มต้นตามที่คุณต้องการ
      mac, 
      ip,
      plant: 'Unassigned', // มั่นใจว่าสถานะเริ่มต้นคือรอการ Assign
      zone: 'Unassigned',
      confidentLevel: 0.7,
      roi:"",
    });
    // บอกว่ามีการสร้างเครื่องใหม่
    // const io = req.app.get('socketio');
    // io.to('Unassigned').emit('device-status', {

    // });

    // // สำหรับ Admin (plant="ALL") ให้มีสิทธิ์รับ event ด้วย
    // io.to('ALL').emit('device-status', {

    // });
    res.json({ mcId, apiKey });
  } catch (err) {
    // กรณี MAC Address ซ้ำ (เพราะเราตั้ง unique: true ไว้ใน Model)
    console.log(err);
    res.status(400).json({ error: "Device already registered or error occurred" });
  }
});

// ส่งสถานะเครื่อง (Heartbeat)
router.post('/heartbeat', verifyApiKey, async (req, res) => {
  await req.device.update({ ...req.body, lastSeen: new Date() });
  res.json({ success: true });
});

router.post('/alarm', verifyApiKey, async (req, res) => {
  try {
    // console.log("Received alarm from device %s: %o", req.device.mcId, req.body);
    const { alarmType, message, imageBase64, confidence, cameraId } = req.body;
    // console.log("Received alarm from device %s: %s", req.device.mcId, message);
    let imagePath = null;

    // ถ้ามีการส่งภาพมา ให้แปลงและบันทึก
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const fileName = `alarm_${Date.now()}_${req.device.mcId}.jpg`;
      const fullPath = path.join(__dirname, '../uploads', fileName);

      if(!fs.existsSync(path.join(__dirname, '../uploads'))) {
        fs.mkdirSync(path.join(__dirname, '../uploads'));
      }
      
      fs.writeFileSync(fullPath, base64Data, 'base64');
      imagePath = `/uploads/${fileName}`; // Path ที่จะเก็บลง DB
    }

    // 1. บันทึกลง Database
    const newAlarm = await Alarm.create({
      mcId: req.device.mcId,
      alarmType,
      message,
      cameraId,
      confidence,
      imageUrl: imagePath
    });

    // 2. Real-time Hook: ส่งไปให้เฉพาะคนใน Plant นั้นๆ เห็นทันที
    const io = req.app.get('socketio');
    io.to(req.device.plant).emit('new-alarm', {
      alarm: newAlarm,
      deviceName: req.device.deviceName,
      zone: req.device.zone
    });

    // สำหรับ Admin (plant="ALL") ให้มีสิทธิ์รับ event ด้วย
    io.to('ALL').emit('new-alarm', {
      alarm: newAlarm,
      deviceName: req.device.deviceName,
      zone: req.device.zone
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Alarm processing failed" });
  }
});



module.exports = router;