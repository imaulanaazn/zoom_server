var express = require("express");
var router = express.Router();
const {
  getAccessToken,
  actionMeetings,
  createLabel,
  getLabels,
  getMeetings,
  getOauthToken,
  geMyDetails,
  getPastMeetings,
  getPastMeetingDetails,
  createLabelGroup,
  getLabelGroups,
  updateLabelGroup,
  updateLabel,
  deleteLabel,
  deleteLabelGroup,
} = require("./controller");

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(
      "Destination folder:",
      path.resolve(__dirname, "../../public/uploads")
    );
    cb(null, path.resolve(__dirname, "../../public/uploads")); // Folder tempat file disimpan
  },
  filename: (req, file, cb) => {
    console.log("Uploading file:", file.originalname);
    cb(null, Date.now() + path.extname(file.originalname)); // Nama file unik
  },
});

const upload = multer({ storage });

router.get("/me", geMyDetails);
router.get("/me/token", getAccessToken);
router.post("/me/oauth/token", getOauthToken);
router.post("/me/labels", upload.single("image"), createLabel);
router.put("/me/labels/:id", updateLabel);
router.delete("/me/labels/:id", deleteLabel);
router.get("/me/labels", getLabels);
router.post("/me/label-groups", upload.single("image"), createLabelGroup);
router.put("/me/label-groups/:id", upload.single("image"), updateLabelGroup);
router.delete("/me/label-groups/:id", deleteLabelGroup);
router.get("/me/label-groups", getLabelGroups);
router.get("/me/meetings/history", getPastMeetings);
router.get("/me/meetings/history/:meetingId", getPastMeetingDetails);
router.post("/me/meetings", actionMeetings);
router.get("/me/meetings", getMeetings);
// router.post("/me/attendance", , postAttendance);

module.exports = router;
