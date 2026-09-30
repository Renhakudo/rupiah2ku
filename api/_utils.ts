export async function parseJsonBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf-8'));
      } catch {
        return {};
      }
    }
  }

  if (req.readableEnded) {
    return {};
  }

  return new Promise((resolve) => {
    const chunks: any[] = [];
    const timeout = setTimeout(() => resolve({}), 4000);

    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => {
      clearTimeout(timeout);
      if (chunks.length === 0) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(text));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      clearTimeout(timeout);
      resolve({});
    });
  });
}

export function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}
