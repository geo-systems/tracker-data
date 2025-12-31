import fs from 'fs';

console.log("Writing:");
fs.writeFileSync('./data/test.txt', `Hello, World: ${new Date().toISOString()}!\n`);

let res = await fetch("https://raw.githubusercontent.com/geo-systems/tracker-data/refs/heads/main/data/test.txt", {mode: "cors"})
let text = await res.text();

console.log("Fetched content:", text);