const { KJUR } = require("jsrsasign");
const {
  inNumberArray,
  isBetween,
  isRequiredAllOrNone,
  validateRequest,
} = require("../../utils/validations.js");
const db = require("../db.js");

const propValidations = {
  role: inNumberArray([0, 1]),
  expirationSeconds: isBetween(1800, 172800),
};

const schemaValidations = [isRequiredAllOrNone(["meetingNumber", "role"])];

const coerceRequestBody = (body) => ({
  ...body,
  ...["role", "expirationSeconds"].reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: typeof body[cur] === "string" ? parseInt(body[cur]) : body[cur],
    }),
    {}
  ),
});

module.exports = {
  generateJWTSignature: async (req, res) => {
    const requestBody = coerceRequestBody(req.body);
    const validationErrors = validateRequest(
      requestBody,
      propValidations,
      schemaValidations
    );

    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const { meetingNumber, role, expirationSeconds } = requestBody;
    const iat = Math.floor(Date.now() / 1000);
    const exp = expirationSeconds ? iat + expirationSeconds : iat + 60 * 60 * 2;
    const oHeader = { alg: "HS256", typ: "JWT" };

    const oPayload = {
      appKey: process.env.ZOOM_MEETING_SDK_KEY,
      sdkKey: process.env.ZOOM_MEETING_SDK_KEY,
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp,
    };

    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    const sdkJWT = KJUR.jws.JWS.sign(
      "HS256",
      sHeader,
      sPayload,
      process.env.ZOOM_MEETING_SDK_SECRET
    );
    return res.json({ signature: sdkJWT });
  },
  getMeetingDetails: async (req, res) => {
    const meetingId = req.params.meetingId;
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    try {
      const response = await fetch(`https://zoom.us/v2/meetings/${meetingId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error("Failed to fetch the access token:", error);
      res.status(500).json({ error: error.message });
    }
  },
  addDetections: async (req, res) => {
    const { meeting_id } = req.body;
    const attendances = JSON.parse(req.body.attendances || "{[]}");

    if (!Array.isArray(attendances) || attendances.length === 0) {
      return res.status(400).json({ error: "Invalid or empty data array" });
    }

    const query = `
    INSERT INTO detections (meeting_id, attendance_id, detection_time) 
    VALUES ?
  `;

    const values = attendances.map((attendance_id) => [
      meeting_id,
      attendance_id,
      0,
    ]);

    db.query(query, [values], (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ error: "Failed to insert data" });
      }

      res.status(201).json({
        message: "Data successfully inserted",
        rowsInserted: result.affectedRows,
      });
    });
  },
  getDetectionsByHostId: async (req, res) => {
    const { meetingId } = req.params;

    const query = `SELECT 
    d.id AS detection_id,
    d.meeting_id,
    d.detection_time,
    a.id AS label_id,
    a.descriptor,
    a.name,
    a.image
  FROM 
    detections d
  INNER JOIN 
  labels a ON d.attendance_id = a.id
  WHERE 
    d.meeting_id = ?
  ORDER BY 
    d.detection_time;`;

    db.query(query, [meetingId], (err, result) => {
      if (err) {
        console.error("Error getting data:", err);
        return res.status(500).json({ error: "Failed to get data" });
      }

      res.status(200).json(result);
    });
  },

  updateDetections: async (req, res) => {
    const { updates } = req.body;
    console.log(updates);

    // Validate input
    if (!Array.isArray(updates) || updates.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid input. Provide an array of updates." });
    }

    // Construct SQL query with CASE statements
    try {
      const updateCases = updates
        .map(({ id, detection_time }) => {
          if (!id || isNaN(detection_time)) {
            throw new Error(
              "Each update must contain a valid id and detection_time."
            );
          }
          return `WHEN id = ${db.escape(id)} THEN ${db.escape(detection_time)}`;
        })
        .join(" ");

      const ids = updates.map(({ id }) => db.escape(id)).join(",");

      const query = `
      UPDATE detections
      SET detection_time = CASE ${updateCases} END
      WHERE id IN (${ids})
    `;

      // Execute the query
      db.query(query, (err, results) => {
        if (err) {
          console.error("Error updating detections:", err.message);
          return res
            .status(500)
            .json({ error: "Failed to update detections." });
        }

        res.status(200).json({
          message: "Detections updated successfully.",
          updatedRows: results.affectedRows,
        });
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  },
  createMeeting: async (req, res) => {
    const {
      id,
      host_id,
      host_email,
      topic,
      type,
      start_url,
      join_url,
      password,
      encrypted_password,
    } = req.body;

    if (
      !id ||
      !host_id ||
      !host_email ||
      !topic ||
      !type ||
      !start_url ||
      !join_url ||
      !password ||
      !encrypted_password
    ) {
      return res.status(400).json({
        error:
          "All fields (host_id, host_email, topic, type, start_url, join_url, password, encrypted_password) are required.",
      });
    }

    const created_at = new Date().toISOString(); // Auto-generate timestamp for created_at

    const query = `
    INSERT INTO meetings (
      id, host_id, host_email, topic, type, created_at, started_at, start_url, join_url, password, encrypted_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const values = [
      id,
      host_id,
      host_email,
      topic,
      type,
      created_at,
      new Date().toISOString(),
      start_url,
      join_url,
      password,
      encrypted_password,
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Error inserting data into meetings table:", err.message);
        return res
          .status(500)
          .json({ error: "Failed to insert meeting data." });
      }

      res.status(201).json({
        message: "Meeting created successfully.",
        meetingId: result.insertId,
      });
    });
  },
};
