const multer = require("multer");
const { Upload } = require("@aws-sdk/lib-storage");
const { s3Client, s3Enabled } = require("../config/aws");
const { env } = require("../config/env");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function uploadBufferToS3({ buffer, contentType, key }) {
  if (!s3Enabled || !s3Client) {
    throw Object.assign(new Error("S3 uploads are not configured"), {
      statusCode: 500,
      code: "S3_NOT_CONFIGURED",
      details: null,
    });
  }

  const uploader = new Upload({
    client: s3Client,
    params: {
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
  });

  await uploader.done();

  return {
    bucket: env.AWS_S3_BUCKET,
    key,
    url: `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
  };
}

module.exports = { upload, uploadBufferToS3 };
