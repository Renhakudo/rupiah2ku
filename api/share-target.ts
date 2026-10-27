export const config = {
  maxDuration: 15,
};

export const maxDuration = 15;

export default async function handler(req: any, res: any) {
  if (req.method === 'GET' || req.method === 'POST') {
    // Redirect browser to main dashboard with share-target flag
    res.statusCode = 303;
    res.setHeader('Location', '/?shared-target=1');
    res.end();
    return;
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}
