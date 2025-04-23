// pages/api/classify.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Image } = req.body as { base64Image: string };
    // write temp file
    const buffer = Buffer.from(base64Image, 'base64');
    const tmpPath = path.join(process.cwd(), `temp_${Date.now()}.jpg`);
    await fs.promises.writeFile(tmpPath, buffer);

    // spawn YOLO classifier
    const py = spawn('python', ['src/scripts/run_yolo.py', tmpPath]);
    let output = '';
    py.stdout.on('data', data => { output += data.toString(); });
    py.stderr.on('data', data => console.error(data.toString()));

    py.on('close', code => {
      // cleanup
      fs.unlink(tmpPath, () => {});
      if (code !== 0) {
        return res.status(500).json({ error: 'Python script error' });
      }
      res.status(200).json({ classification: output.trim() });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
