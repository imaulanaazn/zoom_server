var express = require("express");
var router = express.Router();
const {
  generateJWTSignature,
  getMeetingDetails,
  getDetectionsByHostId,
  updateDetections,
  addDetections,
  createMeeting,
} = require("./controller");

router.post("/:meetingId/jwt-signature", generateJWTSignature);
router.post("/:meetingId/detections", addDetections);
router.get("/:meetingId/detections", getDetectionsByHostId);
router.put("/:meetingId/detections", updateDetections);
router.get("/:meetingId", getMeetingDetails);
router.post("/:meetingId", createMeeting);
module.exports = router;
