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
        const titleMatch = content.match(/^\s*title:\s*(.+)/mi);
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
    const { content, filename } = req.body;
    
    await fs.mkdir(DIAGRAMS_DIR, { recursive: true });
    
    let finalFilename = filename;
    
    // If no filename provided, generate new one with timestamp
    if (!finalFilename) {
      const timestamp = Date.now();
      finalFilename = `diagram-${timestamp}.txt`;
    }
    
    const filePath = path.join(DIAGRAMS_DIR, finalFilename);
    await fs.writeFile(filePath, content, 'utf-8');
    
    res.json({ success: true, filename: finalFilename });
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
