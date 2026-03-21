import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5174;
const DIAGRAMS_DIR = path.join(__dirname, 'diagrams');

app.use(express.json());

// Get all saved diagrams
app.get('/api/diagrams', async (req, res) => {
  try {
    await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
    const files = await fs.readdir(DIAGRAMS_DIR);
    const diagrams = [];
    
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(DIAGRAMS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const titleMatch = content.match(/^title:\s*(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : file.replace('.txt', '');
        const stats = await fs.stat(filePath);
        
        diagrams.push({
          filename: file,
          title,
          modified: stats.mtime,
          content
        });
      }
    }
    
    diagrams.sort((a, b) => b.modified - a.modified);
    res.json(diagrams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a diagram
app.post('/api/diagrams/save', async (req, res) => {
  try {
    const { content, currentFilename } = req.body;
    
    // Extract title from content (case-insensitive)
    const titleMatch = content.match(/^title:\s*(.+)/mi);
    let title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Sanitize filename
    let filename = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    if (!filename) filename = 'untitled';
    
    let filePath = path.join(DIAGRAMS_DIR, `${filename}.txt`);
    
    // If we have a current filename, update that file instead
    if (currentFilename) {
      filePath = path.join(DIAGRAMS_DIR, currentFilename);
      filename = currentFilename.replace('.txt', '');
    } else {
      // New file - check for conflicts
      try {
        await fs.access(filePath);
        // File exists - add timestamp
        const timestamp = Date.now();
        filename = `${filename}-${timestamp}`;
        filePath = path.join(DIAGRAMS_DIR, `${filename}.txt`);
      } catch {
        // File doesn't exist, no conflict
      }
    }
    
    await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    
    res.json({ success: true, filename: `${filename}.txt` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a diagram
app.delete('/api/diagrams/:filename', async (req, res) => {
  try {
    const filePath = path.join(DIAGRAMS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Diagrams API server running on http://localhost:${PORT}`);
});
