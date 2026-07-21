const express = require('express');
const axios = require('axios');
const router = express.Router();
const { Op } = require('sequelize');
const { Device } = require('../models');
const { verifyToken, verifyApiKey } = require('../middleware/auth');
// const {sendParameterByDeviceId} = require('./parameter.js');

// get minimal detail for sidebar display
router.get('/', verifyToken, async (req, res) => {
  try {
    const { role, plant: userPlant } = req.user;


    if(role === 'admin') {
      const devices = await Device.findAll();
      const deviceList = devices.map(d => ({
        mcId: d.mcId,
        deviceName: d.deviceName,
        plant: d.plant,
        zone: d.zone,
        activeDevice: d.activeDevice,
        runningStatus: d.runningStatus,
      }));
      //------------------------------------------------------------------------------------------------------------
      return res.json(deviceList);
    }
    else if(role === 'engineer') {
      const devices = await Device.findAll({ 
        where: { 
          [Op.or]: [{ plant: userPlant }, { plant: 'Unassigned' }]
        } 
      });
      const deviceList = devices.map(d => ({
        mcId: d.mcId,
        deviceName: d.deviceName,
        plant: d.plant,
        zone: d.zone,
        activeDevice: d.activeDevice,
        runningStatus: d.runningStatus,
        lastSeen : d.lastSeen
      }));
      // sendParameterstoDevice(ip, confidentLevel, roiData)//------------------------------------------------------------------------------------------------------------
      return res.json(deviceList);
    }
    else
      return res.status(403).json({ error: "User role cannot access device list" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  } 
});

// 2. แก้ไข Name/Zone/Plant (PUT /api/monitor/settings/:mcId)
router.get('/:mcId', verifyToken, async (req, res) => {

  try {
    const device = await Device.findByPk(req.params.mcId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json({device,
              cam1Roi: device.roiData?.cam1 || null, 
              cam2Roi: device.roiData?.cam2 || null, 
              cam3Roi: device.roiData?.cam3 || null, 
              cam4Roi: device.roiData?.cam4 || null});
  } catch (err) {
    res.status(500).json({ error: err.message });
  } 
});

router.put('/:mcId', verifyToken, async (req, res) => {
  // console.log("Received request to update device settings:", req.body);
  const { role, plant: userPlant } = req.user;
  const { deviceName, 
          zone, 
          activeDevice: targetActiveDevice,
          confidentLevel,
          roiData,
          ip,
        } = req.body;
        const targetPlant = req.body.plant?.toLowerCase();
        console.log("Received request to update device settings:", req.body);
        // console.log(`Debug: ActiveDevice: ${targetActiveDevice}`)
  try {
    const device = await Device.findByPk(req.params.mcId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    // console.log(`Debug: ActiveDevice before update: ${device.activeDevice}`)
    // --- ตรวจสอบสิทธิ์ (Permission Check) ---
    const roiDataForProcessing = roiData; // Assume express.json() has already parsed it into an object/array

    // [CASE ADMIN]: Full Access
    if (role === 'admin') {
      await device.update({
        deviceName: deviceName || device.deviceName,
        zone: zone || device.zone,
        plant: targetPlant || device.plant,
        activeDevice: targetActiveDevice ?? device.activeDevice,
        confidentLevel: confidentLevel || device.confidentLevel,
        roiData: roiDataForProcessing || device.roiData // Store the parsed object in DB

      });
      // console.log(`Debug: ActiveDevice after update: ${device.activeDevice}`)
      sendParameterstoDevice(ip, confidentLevel, roiDataForProcessing, targetActiveDevice) // Pass the parsed object
      return res.json({ message: "Admin updated device successfully", device });
    }

    // [CASE ENGINEER]: 
    if (role === 'engineer') {
      // ก. เครื่องใหม่ (Unassigned) -> ยึดเข้า Plant และตั้งชื่อ/โซน
      if (device.plant === 'Unassigned' || device.plant === 'unassigned'|| device.plant === userPlant) {
        await device.update({
          deviceName: deviceName || device.mcId,
          zone: zone || 'Unassigned',
          plant: userPlant, // บังคับลง Plant ตัวเอง
          activeDevice: targetActiveDevice ?? device.activeDevice,
          confidentLevel: confidentLevel || device.confidentLevel,
          roiData: roiDataForProcessing || device.roiData // Store the parsed object in DB
        });
        sendParameterstoDevice(ip, confidentLevel, roiDataForProcessing, targetActiveDevice) // Pass the parsed object
        return res.json({ message: "Engineer assigned device to plant", device });
      }

      // ข. เครื่องที่อยู่ใน Plant ตัวเองอยู่แล้ว -> เปลี่ยน Name/Zone ได้ตลอด (Any time)
      if (device.plant === userPlant) {
        await device.update({
          deviceName: deviceName || device.deviceName,
          zone: zone || device.zone,
          activeDevice: targetActiveDevice ?? device.activeDevice,
          confidentLevel: confidentLevel || device.confidentLevel,
          roiData: roiDataForProcessing || device.roiData // Store the parsed object in DB
        });
        sendParameterstoDevice(ip, confidentLevel, roiDataForProcessing, targetActiveDevice) // Pass the parsed object
        return res.json({ message: "Engineer updated name/zone", device });
      }

      // ค. ถ้าพยายามแก้เครื่องคนอื่น
      return res.status(403).json({ error: "No permission for this device" });
    }

    // [CASE USER]: อนุญาตให้แก้ไขเฉพาะ roiData เท่านั้น
    if (role === 'user') {
      if (device.plant === userPlant) {
        await device.update({
          roiData: roiDataForProcessing || device.roiData ,
          activeDevice: targetActiveDevice ?? device.activeDevice,
          confidentLevel: confidentLevel || device.confidentLevel
        });
        sendParameterstoDevice(ip, confidentLevel, roiDataForProcessing, targetActiveDevice) // Pass the parsed object
        return res.json({ message: "User updated ROI data", device });
      }
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// router.put('/roi/:mcId', verifyToken, async (req, res) => {
//   try {
//     const device = await Device.findByPk(req.params.mcId);
//     if (!device) return res.status(404).json({ error: "Device not found" });
//     //admin role can update any device, engineer can only update device in their plant
//     const { role, plant: userPlant } = req.user;

//     if(role === 'user') {
//       return res.status(403).json({ error: "User role cannot edit ROI data" });
//     }
//     if (role === 'engineer' && device.plant !== userPlant) {
//       return res.status(403).json({ error: "No permission to update this device's ROI" });
//     }
//     await device.update({ roiData: req.body.roiData });
//     res.json({ message: "ROI data updated successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   } 
// });

//for device called to get its settings
router.get('/',verifyApiKey, async (req, res) => {
  try {
    // console.log("Device %s requested settings", req.device.mcId);
    const device = await Device.findByPk(req.device.mcId);
    if (!device) return res.status(404).json({ error: "Device not found" });
    res.json({
      mcId: device.mcId,
      deviceName: device.deviceName,
      plant: device.plant,
      zone: device.zone,
      roiData: device.roiData,
      activeDevice: device.activeDevice
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//send parameter to jetson server at endpoit /parameters
function sendParameterstoDevice(ip, confidentLevel, roiData, activeDevice) {
  const url = `http://${ip}:5000/control`;
  // roiData is now guaranteed to be a JavaScript object/array because it's parsed before calling this function.
  // So, we stringify it once for the device.
  const payload = {
    "action": activeDevice ? "start" : "stop",
    "roi": roiData, // Pass the JavaScript object/array directly, axios will stringify it once.
    "confidence_threshold": confidentLevel
  };
  // console.log("Sending parameters to device:", JSON.stringify(payload, null, 2));
  axios.post(url, payload)
    .then(response => {
      // console.log(response.data);
    })
    .catch(error => {
      console.error(error);
    });
}



module.exports = router;