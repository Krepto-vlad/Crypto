const crypto = require("crypto");

/* Find correct symmetric key using SHA-256*/

const keys = [
  "68544020247570407220244063724074",
  "54684020247570407220244063724074",
  "54684020247570407220244063727440",
];

const targetHash =
  "f28fe539655fd6f7275a09b7c3508a3f81573fc42827ce34ddf1ec8d5c2421c3";

let correctKey = null;

for (const key of keys) {
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(key, "hex"))
    .digest("hex");

  if (hash === targetHash) {
    correctKey = key;
    break;
  }
}

console.log("\nCorrect symmetric key:");
console.log(correctKey);

/*Decrypt AES-128-CBC message*/

const encryptedMessage =
  "876b4e970c3516f333bcf5f16d546a87aaeea5588ead29d213557efc1903997e";
const ivHex = "656e6372797074696f6e496e74566563";

const keyBuffer = Buffer.from(correctKey, "hex");
const ivBuffer = Buffer.from(ivHex, "hex");

const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuffer, ivBuffer);

let decrypted = decipher.update(encryptedMessage, "hex", "utf8");
decrypted += decipher.final("utf8");

console.log("\nDecrypted message:");
console.log(decrypted);

/*Generate Elliptic Curve key pair*/

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});

const publicKeyPem = publicKey.export({
  type: "spki",
  format: "pem",
});

console.log("\nPublic key:");
console.log(publicKeyPem);

/*Create digital signature*/

const sign = crypto.createSign("SHA256");
sign.update(decrypted);
sign.end();

const signature = sign.sign(privateKey, "hex");

console.log("Digital signature:");
console.log(signature);
