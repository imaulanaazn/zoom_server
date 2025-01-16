const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "mysql-production-9e40.up.railway.app",
  user: "root",
  password: "dmRZcdLCZxnWsuGStIvQuBjSpbOMhtxZ",
  database: "railway",
});

// Cek koneksi
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    return;
  }
  console.log("Connected to the MySQL database!");
});

module.exports = db;

// MYSQL_DATABASE=railway
// MYSQL_PUBLIC_URL=mysql://root:SoCMrgGCFLOxZtixBkaIaxAnOfXHIPIC@autorack.proxy.rlwy.net:27342/railway
// MYSQL_ROOT_PASSWORD=SoCMrgGCFLOxZtixBkaIaxAnOfXHIPIC
// MYSQL_URL=mysql://root:SoCMrgGCFLOxZtixBkaIaxAnOfXHIPIC@mysql.railway.internal:3306/railway
// MYSQLDATABASE=railway
// MYSQLHOST=mysql.railway.internal
// MYSQLPASSWORD=SoCMrgGCFLOxZtixBkaIaxAnOfXHIPIC
// MYSQLPORT=3306
// MYSQLUSER=root
