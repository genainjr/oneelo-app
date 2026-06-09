const fs = require("fs");
const path = require("path");

const ptBR = JSON.parse(fs.readFileSync("C:/lookup/oneelo-app/apps/web/messages/pt-BR.json","utf8"));

function flatKeys(obj, prefix) {
  prefix = prefix || "";
  var result = [];
  Object.keys(obj).forEach(function(k) {
    var v = obj[k]; var key = prefix ? prefix+"."+k : k;
    if (typeof v === "object" && v !== null) result = result.concat(flatKeys(v, key));
    else result.push(key);
  });
  return result;
}
var allKeys = new Set(flatKeys(ptBR));

var srcDir = "C:/lookup/oneelo-app/apps/web/src";
function walk(dir) {
  var files = [];
  fs.readdirSync(dir).forEach(function(f) {
    var full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith(".tsx") || f.endsWith(".ts")) files.push(full);
  });
  return files;
}

var files = walk(srcDir);
var problems = [];

files.forEach(function(file) {
  var src = fs.readFileSync(file, "utf8");
  var rel = file.replace("C:/lookup/oneelo-app/apps/web/src/","").replace(/\\/g,"/");
  var nsMatches = Array.from(src.matchAll(/useTranslations\(["']([^"']+)["']\)/g));
  nsMatches.forEach(function(nsM) {
    var ns = nsM[1];
    var tCalls = Array.from(src.matchAll(/\bt\(["']([a-zA-Z0-9_.]+)["']/g));
    tCalls.forEach(function(tc) {
      var key = tc[1];
      var fullKey = ns + "." + key;
      if (!allKeys.has(fullKey)) {
        problems.push("  " + rel + " [" + ns + "] t('" + key + "') -> '" + fullKey + "'");
      }
    });
  });
});

if (problems.length === 0) {
  console.log("OK — todas as chaves usadas existem em pt-BR.json");
} else {
  console.log("PROBLEMAS (" + problems.length + "):");
  problems.forEach(function(p){ console.log(p); });
}
