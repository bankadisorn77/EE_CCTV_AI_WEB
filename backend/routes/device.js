const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const crypto = require('crypto');
const { Device, Alarm } = require('../models');
const { verifyApiKey } = require('../middleware/auth');
const sharp = require('sharp');
router.get('/check-api-key', verifyApiKey, (req, res) => {
  res.status(200).json({ success: true });
});

// Register เครื่องใหม่ (Unassigned)
router.post('/register', async (req, res) => {
  try {
    const { mac, ip, frame} = req.body;
    const mcId = 'MC-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = crypto.randomBytes(32).toString('hex');

    const existingDevice = await Device.findOne({ where: { mac } });
    if (existingDevice) {
      return res.status(400).json({ error: "Device already registered" });
    }
    for(let i=1; i<=4; i++){
      if(frame[`cam${i}`]){
        const base64Data = frame[`cam${i}`].replace(/^data:image\/\w+;base64,/, "");
        const fileName = `device_${mcId}_cam${i}.jpg`;
        const fullPath = path.join(__dirname, '../uploads', fileName);
        fs.writeFileSync(fullPath, base64Data, 'base64');
      }
    }
    await Device.create({ 
      mcId, 
      apiKey,
      deviceName: mcId, 
      mac, 
      ip,
      plant: 'Unassigned', 
      zone: 'Unassigned',
      confidentLevel: 0.7,
      roi:"",
      cam1: `device_${mcId}_cam1.jpg` || '',
      cam2: `device_${mcId}_cam2.jpg` || '',
      cam3: `device_${mcId}_cam3.jpg` || '',
      cam4: `device_${mcId}_cam4.jpg` || ''
    });
    // const io = req.app.get('socketio');
    // io.to('Unassigned').emit('device-status', {

    // });
    // io.to('ALL').emit('device-status', {
    // });
    res.json({ mcId, apiKey });
  } catch (err) {
    // กรณี MAC Address ซ้ำ (เพราะเราตั้ง unique: true ไว้ใน Model)
    console.log(err);
    res.status(400).json({ error: "Device already registered or error occurred" });
  }
});


router.post('/heartbeat', verifyApiKey, async (req, res) => {
  await req.device.update({ ...req.body, lastSeen: new Date() });
  res.json({ success: true });
});

router.post('/alarm', verifyApiKey, async (req, res) => {
  try {
    const { alarmType, message, imageBase64, confidence, cameraId } = req.body;
    let imagePath = null;
if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, 'base64');
    const fileName = `alarm_${Date.now()}_${req.device.mcId}.jpg`;
    const fullPath = path.join(__dirname, '../uploads', fileName);

    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
        fs.mkdirSync(path.join(__dirname, '../uploads'));
    }
    await sharp(imgBuffer)
      .resize(1920, 1080, {fit: 'fill'},{
        kernel: sharp.kernel.lanczos3
      })
      .sharpen()
      .jpeg({ quality: 95 })
      .toFile(fullPath);
    imagePath = `/uploads/${fileName}`;
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