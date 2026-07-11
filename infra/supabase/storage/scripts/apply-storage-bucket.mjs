const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BUCKET_ID',
  'BUCKET_NAME',
  'BUCKET_PUBLIC',
  'BUCKET_FILE_SIZE_LIMIT',
  'BUCKET_ALLOWED_MIME_TYPES',
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketId = process.env.BUCKET_ID;

const bucketPayload = {
  id: bucketId,
  name: process.env.BUCKET_NAME,
  public: process.env.BUCKET_PUBLIC === 'true',
  file_size_limit: Number(process.env.BUCKET_FILE_SIZE_LIMIT),
  allowed_mime_types: JSON.parse(process.env.BUCKET_ALLOWED_MIME_TYPES),
};

const headers = {
  apikey: serviceRoleKey,
  'Content-Type': 'application/json',
};

if (!serviceRoleKey.startsWith('sb_secret_')) {
  headers.Authorization = `Bearer ${serviceRoleKey}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  const body = await response.text();
  return { response, body };
}

function isBucketNotFound(response, body) {
  if (response.status === 404) return true;

  try {
    const error = JSON.parse(body);
    return String(error.statusCode) === '404';
  } catch {
    return false;
  }
}

async function createBucket() {
  const { response, body } = await request('/storage/v1/bucket', {
    method: 'POST',
    body: JSON.stringify(bucketPayload),
  });

  if (!response.ok) {
    if (response.status === 400 && body.toLowerCase().includes('already')) {
      return updateBucket();
    }

    throw new Error(`Could not create bucket ${bucketId}: ${response.status} ${body}`);
  }

  return 'created';
}

async function updateBucket() {
  const { response, body } = await request(`/storage/v1/bucket/${encodeURIComponent(bucketId)}`, {
    method: 'PUT',
    body: JSON.stringify(bucketPayload),
  });

  if (!response.ok) {
    throw new Error(`Could not update bucket ${bucketId}: ${response.status} ${body}`);
  }

  return 'updated';
}

async function applyBucket() {
  const { response, body } = await request(`/storage/v1/bucket/${encodeURIComponent(bucketId)}`);

  if (isBucketNotFound(response, body)) {
    return createBucket();
  }

  if (!response.ok) {
    throw new Error(`Could not inspect bucket ${bucketId}: ${response.status} ${body}`);
  }

  return updateBucket();
}

const result = await applyBucket();
console.log(`Supabase Storage bucket ${bucketId} ${result}.`);
