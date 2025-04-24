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
    const buffer = Buffer.from(base64Image, 'base64');
    const tmpPath = path.join(process.cwd(), `temp_${Date.now()}.jpg`);
    await fs.promises.writeFile(tmpPath, buffer);

    // Wrap spawn in a Promise so Next.js waits for it
    await new Promise<void>((resolve, reject) => {
      const py = spawn('python', ['src/scripts/run_yolo.py', tmpPath]);
      let output = '';

      py.stdout.on('data', data => {
        output += data.toString();
      });

      py.stderr.on('data', data => {
        console.error(data.toString());
      });

      py.on('error', err => {
        // script failed to start
        fs.unlink(tmpPath, () => {});
        res.status(500).json({ error: 'Failed to start Python script' });
        reject(err);
      });

      py.on('close', code => {
        fs.unlink(tmpPath, () => {});
        if (code !== 0) {
          res.status(500).json({ error: 'Python script error' });
          return reject(new Error('Non-zero exit code'));
        }
        res.status(200).json({ classification: output.trim() });
        resolve();
      });
    });
  } catch (err) {
    console.error(err);
    // Only send one response!
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
