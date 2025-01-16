const clientId = "OJ6QysNcQLKVN8XkB1DY8A";
const clientSecret = "5jojjclxrmWdRCFldpjjaIrGrcZXWrt0";
const db = require("../db");

function getMeetingPayload(meeting) {
  const { topic, password, type, start_time, duration, timezone, settings } =
    meeting;
  let payload = { topic, type };

  if (meeting.type === 2) {
    payload = { topic, type, start_time, duration, timezone };
  }
  if (password) {
    payload = { ...payload, password };
  }
  if (settings) {
    payload = { ...payload, settings };
  }
  return JSON.stringify(payload);
}

function validatePayload(
  topic,
  _password,
  type,
  start_time,
  duration,
  _timezone
) {
  if (!topic) {
    return "Please provide the meeting topic";
  }
  if (type === 2) {
    if (!start_time) {
      return "Please provide a valid time";
    }
    if (!duration) {
      return "Please provide a valid duration";
    }
  }
  return "";
}

module.exports = {
  getAccessToken: async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: "Missing 'code' parameter" });
    }

    const basicCode = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    try {
      const response = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicCode}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: "http://localhost:3000/redirect",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error("Failed to fetch the access token:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getOauthToken: async (req, res) => {
    const { grant_type, refresh_token } = req.body;

    if (!refresh_token) {
      return res
        .status(400)
        .json({ error: "Missing 'refresh_token' parameter" });
    }

    const basicCode = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    try {
      const response = await fetch("https://zoom.us/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicCode}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: grant_type || "refresh_token",
          refresh_token,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();

      res.json(data);
    } catch (error) {
      console.error("Failed to fetch the access token:", error);
      res.status(500).json({ error: error.message });
    }
  },

  actionMeetings: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";
    const { topic, password, type, start_time, duration, timezone, settings } =
      req.body;
    const meetingPayload = {
      topic,
      password,
      type,
      start_time,
      duration,
      timezone,
      settings,
    };

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    const payloadErrorMessage = validatePayload(meetingPayload);
    if (payloadErrorMessage) {
      return res.status(400).json({ error: payloadErrorMessage });
    }

    try {
      const response = await fetch(`https://zoom.us/v2/users/me/meetings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: getMeetingPayload(meetingPayload),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch the access token:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getMeetings: async (req, res) => {
    const { type } = req.query;
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    try {
      const userId = "me";
      const zoomApiUrl = `https://api.zoom.us/v2/users/${userId}/meetings?type=${type}&page_size=10`;

      const response = await fetch(zoomApiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      });

      const meetings = await response.json();

      return res.json(meetings);
    } catch (error) {
      console.error(
        "Error fetching meetings:",
        error.response?.data || error.message
      );
      return res
        .status(500)
        .json({ error: "Failed to fetch meetings from Zoom" });
    }
  },

  createLabel: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a file" });
    }

    const { name, descriptor, owner_id } = req.body;

    if (!name || !descriptor || !owner_id) {
      return res
        .status(400)
        .json({ error: "All fields are required: name, descriptor, owner_id" });
    }

    const query =
      "INSERT INTO labels (name, descriptor, owner_id, image) VALUES (?, ?, ?, ?)";
    db.query(
      query,
      [name, descriptor, owner_id, req.file.filename],
      (err, result) => {
        if (err) {
          console.error("Error inserting data:", err.message);
          return res.status(500).json({ error: "Failed to insert data" });
        }

        res.status(201).json({
          id: result.insertId,
          name,
          descriptor,
          owner_id,
          image: `../../public/uploads/${req.file.filename}`,
        });
      }
    );
  },

  getLabels: async (req, res) => {
    const { id, name, descriptor, owner_id } = req.query;

    let query = "SELECT * FROM labels WHERE 1=1"; // `1=1` makes appending conditions easier
    const queryParams = [];

    if (id) {
      query += " AND id = ?";
      queryParams.push(id);
    }
    if (name) {
      query += " AND name LIKE ?";
      queryParams.push(`%${name}%`); // Use LIKE for partial matching
    }
    if (descriptor) {
      query += " AND descriptor LIKE ?";
      queryParams.push(`%${descriptor}%`);
    }
    if (owner_id) {
      query += " AND owner_id = ?";
      queryParams.push(owner_id);
    }

    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error("Error fetching data:", err.message);
        return res.status(500).json({ error: "Failed to fetch data" });
      }

      res.json(results);
    });
  },

  geMyDetails: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    try {
      const zoomApiUrl = `https://api.zoom.us/v2/users/me`;

      const response = await fetch(zoomApiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      const myDetails = await response.json();

      return res.json(myDetails);
    } catch (error) {
      console.error(
        "Error fetching user details:",
        error.response?.data || error.message
      );
      return res
        .status(500)
        .json({ error: "Failed to fetch meetings from Zoom" });
    }
  },

  getPastMeetings: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    try {
      const currentDate = new Date().toISOString();

      const query = `
        SELECT * 
        FROM meetings 
        WHERE started_at < ?
      `;

      // Execute the query
      db.query(query, [currentDate], (err, results) => {
        if (err) {
          console.error("Error retrieving meetings:", err.message);
          return res.status(500).json({ error: "Failed to fetch meetings." });
        }

        res.status(200).json({
          message: "Meetings retrieved successfully.",
          meetings: results,
        });
      });
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getPastMeetingDetails: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";
    const { meetingId } = req.params;

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    try {
      const query = `
        SELECT * 
        FROM meetings 
        WHERE id = ?
      `;

      // Execute the query
      db.query(query, [meetingId], (err, results) => {
        if (err) {
          console.error("Error retrieving meetings:", err.message);
          return res.status(500).json({ error: "Failed to fetch meetings." });
        }

        if (results.length === 0) {
          // If no meeting is found
          return res.status(404).json({ error: "Meeting not found." });
        }

        // Return the first result as an object
        res.status(200).json({
          message: "Meeting retrieved successfully.",
          meeting: results, // Only return the first result as an object
        });
      });
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
      res.status(500).json({ error: error.message });
    }
  },

  createLabelGroup: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Please upload a file" });
    }

    const { name, labels, owner_id } = req.body;
    const parsedLabels = JSON.parse(labels);

    if (
      !name ||
      !Array.isArray(parsedLabels) ||
      labels.length === 0 ||
      !owner_id
    ) {
      return res.status(400).json({
        error:
          "Label group name, owner id and an array of label IDs are required.",
      });
    }

    const connection = db.promise();

    try {
      await connection.beginTransaction();
      const [labelGroupResult] = await connection.query(
        "INSERT INTO label_groups (name, owner_id, image) VALUES (?, ?, ?)",
        [name, owner_id, req.file.filename]
      );

      const labelGroupId = labelGroupResult.insertId;
      const groupLabelsData = parsedLabels.map((labelId) => [
        labelGroupId,
        labelId,
      ]);

      await connection.query(
        "INSERT INTO group_labels (group_id, label_id) VALUES ?",
        [groupLabelsData]
      );

      await connection.commit();

      res.status(201).json({
        message: "Label group created successfully.",
        labelGroupId,
      });
    } catch (error) {
      console.error("Error creating label group:", error.message);
      await connection.rollback();
      res.status(500).json({ error: "Failed to create label group." });
    }
  },

  getLabelGroups: async (req, res) => {
    const { name, owner_id } = req.query;

    try {
      let query = `
            SELECT 
                lg.id, 
                lg.name, 
                lg.owner_id, 
                lg.image, 
                GROUP_CONCAT(gl.label_id) AS members
            FROM label_groups lg
            LEFT JOIN group_labels gl ON lg.id = gl.group_id
        `;
      const params = [];

      const conditions = [];
      if (owner_id) {
        conditions.push("lg.owner_id = ?");
        params.push(owner_id);
      }
      if (name) {
        conditions.push("lg.name LIKE ?");
        params.push(`%${name}%`);
      }
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += " GROUP BY lg.id";

      db.query(query, params, (err, results) => {
        if (err) {
          console.error("Error retrieving label groups:", err.message);
          return res
            .status(500)
            .json({ error: "Failed to retrieve label groups" });
        }

        const formattedResults = results.map((group) => ({
          ...group,
          members: group.members ? group.members.split(",").map(Number) : [],
        }));

        res.status(200).json(formattedResults);
      });
    } catch (error) {
      console.error("Error:", error.message);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  },

  updateLabelGroup: async (req, res) => {
    const authorization = req.headers.authorization;
    const bearerToken = authorization ? authorization.split(" ")[1] : "";

    if (!bearerToken) {
      return res
        .status(401)
        .json({ error: "You are unauthorized to access this resource" });
    }

    const { id } = req.params;
    const { name, labels, owner_id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Label group ID is required." });
    }

    if (!name || !owner_id || !labels) {
      return res.status(400).json({
        error:
          "Label group name, owner id, and an array of label IDs are required.",
      });
    }

    let parsedLabels;
    try {
      parsedLabels = JSON.parse(labels);
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Invalid labels format. Must be a JSON array." });
    }

    if (!Array.isArray(parsedLabels) || parsedLabels.length === 0) {
      return res
        .status(400)
        .json({ error: "Labels must be a non-empty array." });
    }

    const connection = db.promise();

    try {
      await connection.beginTransaction();

      const updateQuery = `
            UPDATE label_groups 
            SET name = ?, owner_id = ?, image = ? 
            WHERE id = ?
        `;
      const image = req.file ? req.file.filename : req.body.image || "";
      const updateValues = [name, owner_id, image, id];
      await connection.query(updateQuery, updateValues);

      await connection.query("DELETE FROM group_labels WHERE group_id = ?", [
        id,
      ]);

      const groupLabelsData = parsedLabels.map((labelId) => [id, labelId]);
      await connection.query(
        "INSERT INTO group_labels (group_id, label_id) VALUES ?",
        [groupLabelsData]
      );

      await connection.commit();

      res.status(200).json({ message: "Label group updated successfully." });
    } catch (error) {
      console.error("Error updating label group:", error.message);
      await connection.rollback();
      res.status(500).json({ error: "Failed to update label group." });
    }
  },

  updateLabel: async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Label ID is required." });
    }

    if (!name) {
      return res.status(400).json({
        error: "Nama harus terisi",
      });
    }

    try {
      const connection = db.promise();
      await connection.beginTransaction();

      const updates = [];
      const params = [];

      if (name) {
        updates.push("name = ?");
        params.push(name);
      }

      params.push(id); // Add label ID as the last parameter

      const updateQuery = `
            UPDATE labels
            SET ${updates.join(", ")}
            WHERE id = ?
        `;

      const [result] = await connection.query(updateQuery, params);

      await connection.commit();

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ error: "Label tidak ditemukan. tidak ada yang diubah." });
      }

      res.status(200).json({ message: "Label berhasil diperbarui." });
    } catch (error) {
      console.error("Error updating label:", error.message);
      if (connection) await connection.rollback();
      res.status(500).json({ error: "Gagal memperbarui label." });
    }
  },

  deleteLabel: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Label ID is required." });
    }

    try {
      const connection = db.promise();
      await connection.beginTransaction();

      // Delete the label
      const deleteQuery = `
            DELETE FROM labels
            WHERE id = ?
        `;
      const [result] = await connection.query(deleteQuery, [id]);

      await connection.commit();

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Label not found." });
      }

      res.status(200).json({ message: "Label deleted successfully." });
    } catch (error) {
      console.error("Error deleting label:", error.message);
      if (connection) await connection.rollback();
      res.status(500).json({ error: "Failed to delete label." });
    }
  },

  deleteLabelGroup: async (req, res) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Label Group ID is required." });
    }

    try {
      const connection = db.promise();
      await connection.beginTransaction();

      // Delete the label
      const deleteQuery = `
            DELETE FROM label_groups
            WHERE id = ?
        `;
      const [result] = await connection.query(deleteQuery, [id]);

      await connection.commit();

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Label not found." });
      }

      res.status(200).json({ message: "Label deleted successfully." });
    } catch (error) {
      console.error("Error deleting label:", error.message);
      if (connection) await connection.rollback();
      res.status(500).json({ error: "Failed to delete label." });
    }
  },
};
