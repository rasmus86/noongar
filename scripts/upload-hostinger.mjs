/**
 * Upload out/ to Hostinger via FTP.
 * Requires: HOSTINGER_FTP_HOST, HOSTINGER_FTP_USER, HOSTINGER_FTP_PASSWORD
 * Optional: HOSTINGER_FTP_REMOTE_DIR (default /public_html), HOSTINGER_FTP_PORT (default 21)
 */
import { join } from "node:path";
import { Client } from "basic-ftp";

const host = process.env.HOSTINGER_FTP_HOST;
const user = process.env.HOSTINGER_FTP_USER;
const password = process.env.HOSTINGER_FTP_PASSWORD;
const remoteRoot = process.env.HOSTINGER_FTP_REMOTE_DIR || "/public_html";
const port = Number(process.env.HOSTINGER_FTP_PORT || 21);
const secure = process.env.HOSTINGER_FTP_SECURE === "1";
const localRoot = join(process.cwd(), "out");

if (!host || !user || !password) {
  console.error(
    "Missing HOSTINGER_FTP_HOST / HOSTINGER_FTP_USER / HOSTINGER_FTP_PASSWORD",
  );
  process.exit(1);
}

const client = new Client(120_000);
client.ftp.verbose = Boolean(process.env.HOSTINGER_FTP_VERBOSE);

try {
  await client.access({
    host,
    user,
    password,
    port,
    secure,
  });
  console.log(`Connected to ${host}. Uploading ${localRoot} → ${remoteRoot}`);
  await client.ensureDir(remoteRoot);
  await client.uploadFromDir(localRoot, remoteRoot);
  console.log("Upload complete.");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  client.close();
}
