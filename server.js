const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 5173;
const root = __dirname;

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function routeToFile(urlPath) {
  if (urlPath === "/") return "index.html";
  if (urlPath === "/admin") return "admin.html";
  if (urlPath === "/dashboard") return "admin-dashboard.html";
  return urlPath.replace(/^\//, "");
}

http
  .createServer((req, res) => {
    const fileName = routeToFile(req.url.split("?")[0]);
    const filePath = path.join(root, fileName);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      const ext = path.extname(filePath);
      const type = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
