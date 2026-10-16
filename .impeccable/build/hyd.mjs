import puppeteer from "puppeteer";
const b = await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const p = await b.newPage(); await p.setViewport({width:390,height:844});
p.on("console", m => console.log("C", m.text().slice(0,3000)));
p.on("pageerror", e => console.log("PE", e.message.slice(0,3000)));
await p.goto("http://localhost:3100/"+(process.argv[2]||""),{waitUntil:"networkidle2"});
await new Promise(r=>setTimeout(r,2000)); await b.close();
