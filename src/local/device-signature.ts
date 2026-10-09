import { generateKeyPairSync, createPrivateKey, sign } from "node:crypto";
import { devicePrivateKeySchema, signedMessage, type DevicePrivateKey, type DeviceMessage, type DeviceProof } from "../domain/device-proof.ts";
export function createDeviceKey(): DevicePrivateKey {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return devicePrivateKeySchema.parse(pair.privateKey.export({ format: "jwk" }));
}
export function signDeviceMessage(key: DevicePrivateKey, message: DeviceMessage): DeviceProof {
  const issuedAt = new Date().toISOString();
  const signature = sign("sha256", Buffer.from(signedMessage(message, issuedAt)), {
    key: createPrivateKey({ key: devicePrivateKeySchema.parse(key), format: "jwk" }), dsaEncoding: "ieee-p1363",
  }).toString("hex");
  return { issuedAt, signature };
}
