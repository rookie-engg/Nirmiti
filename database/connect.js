import { config } from "dotenv";
import { Sequelize } from "sequelize";

config();

export const dbInstance = new Sequelize({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dialect: process.env.DB_DAILECT
})

export default dbInstance;

