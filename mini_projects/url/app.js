import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PORT = 3002;
const DATA_FILE = path.join("data", "links.json");

// Load saved links from JSON file
const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const empty = {};
            await writeFile(DATA_FILE, JSON.stringify(empty)); // create empty file if not found
            return empty;
        }
        throw error;
    }
};

// Save links to file
const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links));
};

// Serve static files (like index.html, style.css)
const serveFile = async (res, filePath, contentType) => {
    try {
        const data = await readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end("404 page not found");
    }
};

// Create the server
const server = createServer(async (req, res) => {
    if (req.method === 'GET') {
        if (req.url === '/') {
            return serveFile(res, path.join("public", "index.html"), "text/html");
        } else if (req.url === '/style.css') {
            return serveFile(res, path.join("public", "style.css"), "text/css");
        } else if (req.url === '/links') {
            const links = await loadLinks();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(links));
        } else {
            // Check if user is visiting a short link like /abc123
            const links = await loadLinks();
            const code = req.url.slice(1); // remove '/' from url
            if (links[code]) {
                res.writeHead(302, { Location: links[code] });  //redirect
                return res.end();
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end("Shortcode not found");
            }
        }
    }

    // Shortening logic
    if (req.method === 'POST' && req.url === '/shorten') {
        const links = await loadLinks();

        let body = "";
        req.on('data', chunk => (body += chunk));

        req.on('end', async () => {
            try {
                const { url, shortCode } = JSON.parse(body);

                if (!url) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    return res.end("url is required");
                }

                const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Shortcode already exists. Please choose another");
                }

                links[finalShortCode] = url;
                await saveLinks(links);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ shortCode: finalShortCode, url }));
            } catch (err) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Invalid JSON");
            }
        });
    }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

