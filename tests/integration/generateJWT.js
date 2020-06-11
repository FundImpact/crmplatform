const request = require("request");
const fs = require("fs");
const { SERVER_URL } = require("./config/config");
request.post(
  SERVER_URL + "/auth/local",
  {
    json: {
      identifier: "tanvisalkar@yahoo.in",
      password: "test123",
    },
  },
  (err, res, body) => {
    if (err) {
      console.log("err", err);
    }

    var JWT = body.jwt;

    fs.writeFile(
      "config/JWT.js",
      'const JWT="' + JWT + '"; module.exports = { JWT,};',
      function (err) {
        if (err) return console.log(err);
        console.log("file updated successfully!!");
      }
    );
  }
);
