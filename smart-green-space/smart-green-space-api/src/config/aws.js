const { S3Client } = require("@aws-sdk/client-s3");
const { env } = require("./env");

const s3Enabled = Boolean(
  env.AWS_REGION &&
    env.AWS_S3_BUCKET &&
    env.AWS_ACCESS_KEY_ID &&
    env.AWS_SECRET_ACCESS_KEY,
);

const s3Client = s3Enabled
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

module.exports = { s3Client, s3Enabled };
