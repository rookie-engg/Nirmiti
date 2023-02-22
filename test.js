import { DateTime } from "luxon";
import { models } from "./database/models.js";

const d1 = DateTime.now();
const d2 = DateTime.now().set({ hour: 21, minute: 0, second: 0 });
const d3 = DateTime.now().set({ hour: 23, minute: 0, second: 0 });

console.log(d1.toISO());
console.log(d2.toISO());
console.log(d3.toISO());

console.log(d2 < d1 < d3);
