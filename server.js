const express = require("express");
const { createServer } = require("http");
var bodyParser = require("body-parser");

const { Server } = require("socket.io");
const app = express();
// create application/json parser
var jsonParser = bodyParser.json();

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const verifySocketToken = (socket, callback) => {
  // console.log("socket.request.headers",socket.request.headers.bearertoken);
  let token = socket.request.headers.bearertoken;
  if (token === null || typeof token === "undefined") {
    return new Error("Unauthorized (token not valid)");
  }
  try {
    // console.log("token",token);
    let payload = token.split(".")[1];
    payload = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    // console.log("payload", payload);
    socket.request.tenantId = payload.id;
    socket.request.userId = payload.userID;
    callback(socket);
  } catch (ex) {
    return new Error("Unauthorized (token not valid)");
  }
};

const socketUtility = (socket) => {
  //   console.log("Connected!!",socket);
  socket.on("subscribe", (filter) => {
    // console.log("subscribe", filter);
    let filterSerialized = JSON.stringify(filter);
    // console.log("filterSerialized", filterSerialized);
    socket.join(filterSerialized);
    socket
      .to(filterSerialized)
      .emit(
        "response",
        JSON.stringify({ status: "Subscribed", id: socket.id })
      );
  });

  // Runs when client disconncts
  socket.on("disconnect", () => {
    console.log("Disconnected!!");
  });
};

io.on("connection", (socket) => {
  // console.log("a user connected", socket.id);
  verifySocketToken(socket, socketUtility);
  app.socketIo = io;
});

const socketNotify = (filter, event) => {
//   console.log("filter", filter);
//   console.log("event", event);
console.log("app.socketIo",app.socketIo);
    app.socketIo.to(filter).emit("response", JSON.stringify(event));
};

app.post("/notify", jsonParser, (req, res) => {
  //   console.log("req.body", req.body);
  if (
    req?.body?.filter === null ||
    req?.body?.filter === "" ||
    req?.body?.filter === undefined
  ) {
    return res.status(400).json({ error: "filter is required" });
  }
  var filter = JSON.stringify(req?.body?.filter);
  //   console.log("filter", filter);
  socketNotify(filter, req.body.payload);
  return res.status(200).json({ status: "success" });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

httpServer.listen(3000, () => {
  console.log(`listening on http://localhost:3000`);
});
