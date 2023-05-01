// //create JWT token
// //Generating the JWT
var CryptoJS = require("crypto-js");

// create your secret to sign the token

const jwtFunction = (data) => {
  const toBase64 = (obj) => {
    // converts the obj to a string
    const str = JSON.stringify(obj);
    // returns string converted to base64
    return Buffer.from(str).toString("base64");
  };

  const replaceSpecialChars = (b64string) => {
    // create a regex to match any of the characters =,+ or / and replace them with their // substitutes
    return b64string.replace(/[=+/]/g, (charToBeReplaced) => {
      switch (charToBeReplaced) {
        case "=":
          return "";
        case "+":
          return "-";
        case "/":
          return "_";
      }
    });
  };

  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const b64Header = toBase64(header);
  const jwtB64Header = replaceSpecialChars(b64Header);

  const payload = {
    iss: data.iss,
    exp: data.exp,
    ...data,
  };
  const b64Payload = toBase64(payload);
  const jwtB64Payload = replaceSpecialChars(b64Payload);

  const createSignature = (jwtB64Header, jwtB64Payload, secret) => {
    // create a HMAC(hash based message authentication code) using sha256 hashing alg
    // and the secret key provided
    const signature = CryptoJS.HmacSHA256(
      `${jwtB64Header}.${jwtB64Payload}`,
      secret
    );
    // convert the signature to a base64 string
    const jwtB64Signature = replaceSpecialChars(
      signature.toString(CryptoJS.enc.Base64)
    );
    return jwtB64Signature;
  };

  const secret = "secret";
  const signature = createSignature(jwtB64Header, jwtB64Payload, secret);
  const jwt = `${jwtB64Header}.${jwtB64Payload}.${signature}`;
  return jwt;
};

module.exports = jwtFunction;
