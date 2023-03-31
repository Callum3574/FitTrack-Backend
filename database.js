const pg = require("pg");
require("dotenv").config();

const client = new pg.Client({
  host: process.env.HOST,
  port: process.env.PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

client.connect();

module.exports = client;
