// Run with Node --env-file=<deployment credentials> --env-file=.env.
// Prints deployment identifiers only; never prints secret configuration.
const mode = process.argv[2];
if (!['configure', 'deploy', 'status'].includes(mode)) throw new Error('Expected configure, deploy or status');
const repo = 'https://github.com/hchengsz/daily-bible';
const bucket = 'daily-bible-cache';
async function render(path, method = 'GET', body) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Render ${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
const services = await render('/services?limit=100');
let service = services.map(x => x.service).find(s => s.repo?.replace(/\.git$/, '') === repo && s.name === 'daily-bible-api');
if (mode === 'configure') {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GOOGLE_TRANSLATE_API_KEY']) {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), 'Content-Type': 'application/json' };
  const base = `${process.env.SUPABASE_URL}/storage/v1/bucket`;
  const check = await fetch(`${base}/${bucket}`, { headers, signal: AbortSignal.timeout(30000) });
  if (check.ok) {
    if ((await check.json()).public !== false) throw new Error('Expected private cache bucket');
  } else {
    const error = await check.json();
    if (error.code !== 'NoSuchBucket' && error.message !== 'Bucket not found') throw new Error(`Supabase bucket lookup: ${check.status}`);
    const created = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 1048576 }), signal: AbortSignal.timeout(30000) });
    if (!created.ok) throw new Error(`Supabase bucket creation: ${created.status}`);
  }
  const values = {
    NODE_VERSION: '24.14.1', HOST: '0.0.0.0', SUPABASE_STORAGE_BUCKET: bucket,
    ...Object.fromEntries(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'GOOGLE_TRANSLATE_API_KEY', 'GEMINI_VOCAB_MODEL', 'GEMINI_TRANSLATE_MODEL'].filter(k => process.env[k]).map(k => [k, process.env[k]])),
  };
  if (!service) {
    const ownerId = services.map(x => x.service).find(s => s.repo === 'https://github.com/hchengsz/daily-reading')?.ownerId;
    if (!ownerId) throw new Error('Existing workspace not found');
    const result = await render('/services', 'POST', {
      type: 'web_service', name: 'daily-bible-api', ownerId, repo, branch: 'codex/testflight-release', autoDeploy: 'no',
      envVars: Object.entries(values).map(([key, value]) => ({ key, value })),
      serviceDetails: { env: 'node', plan: 'free', region: 'oregon', healthCheckPath: '/healthz', envSpecificDetails: { buildCommand: 'npm ci && npm run backend:build', startCommand: 'npm run backend:start' } },
    });
    service = result.service || result;
  } else {
    if (service.serviceDetails?.plan !== 'free') throw new Error('Unexpected service plan');
    for (const [name, value] of Object.entries(values)) await render(`/services/${service.id}/env-vars/${name}`, 'PUT', { value });
  }
  console.log(JSON.stringify({ serviceId: service.id, url: service.serviceDetails?.url, bucket }));
} else {
  if (!service) throw new Error('Configure backend first');
  if (mode === 'deploy') {
    const commitId = process.argv[3];
    if (!/^[a-f0-9]{40}$/.test(commitId || '')) throw new Error('An exact commit SHA is required');
    const deploy = await render(`/services/${service.id}/deploys`, 'POST', { commitId, clearCache: 'do_not_clear' });
    console.log(JSON.stringify({ id: deploy.id, status: deploy.status, url: service.serviceDetails?.url }));
  } else {
    const deploys = await render(`/services/${service.id}/deploys?limit=3`);
    console.log(JSON.stringify({ serviceId: service.id, url: service.serviceDetails?.url, deploys: deploys.map(x => ({ id: x.deploy.id, status: x.deploy.status, commit: x.deploy.commit?.id })) }));
  }
}
