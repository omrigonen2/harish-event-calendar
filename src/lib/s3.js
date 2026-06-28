import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Build an S3 client from a decrypted platform S3 config.
 * iDrive e2 is S3-compatible and requires a custom endpoint + path-style access.
 */
export function buildS3Client(config) {
  if (!config || !config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error('S3 storage is not configured. Set it in Platform Settings.');
  }
  return new S3Client({
    region: config.region || 'us-east-1',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function putObject(config, { key, body, contentType }) {
  const client = buildS3Client(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function deleteObject(config, key) {
  const client = buildS3Client(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function getPresignedUrl(config, key, expiresIn = 3600) {
  const client = buildS3Client(config);
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}
