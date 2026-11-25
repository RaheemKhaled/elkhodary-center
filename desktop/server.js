/**
 * سيرفر محلي مدمج وخفيف جداً لنسخة سطح المكتب (Desktop Embedded Server)
 * يعمل بدون أي حزم خارجية باستخدام وحدات Node.js القياسية فقط
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.sql': 'text/plain; charset=utf-8'
};

export function startLocalServer(port = 8080) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // إزالة معاملات الاستعلام من المسار
      const urlPath = req.url.split('?')[0];
      let filePath = path.join(ROOT_DIR, urlPath === '/' ? 'index.html' : urlPath);

      // منع محاولات الخروج من مجلد المشروع
      if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Access Denied');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // جرب إضافة .html أو العودة لـ index.html
          filePath = path.join(ROOT_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
          if (readErr) {
            res.writeHead(500);
            res.end(`Server Error: ${readErr.code}`);
            return;
          }
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          });
          res.end(content);
        });
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use, assuming server is running.`);
        resolve({ server: null, port });
      } else {
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Local desktop server running at http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

// تشغيل مباشر إذا تم استدعاء الملف بالطرفية
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startLocalServer(8080);
}
