const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});


const verifySocketToken = (socket, callback) => {
    console.log("socket.request.headers",socket.request.headers.bearertoken);
  let token = socket.request.headers.bearertoken;
  if (token === null || typeof token === "undefined") {
    return new Error("Unauthorized (token not valid)");
  }
  try {
    var payload = jwt.verify(token, this.config.secretKey, {
      algorithms: ["RS256"],
    });
    socket.request.tenantId = payload.tenantId;
    socket.request.userId = payload._id;
    callback(socket);
  } catch (ex) {
    return new Error("Unauthorized (token not valid)");
  }
};

const socketUtility = (socket) => {
    console.log("Connected!!",socket);
    socket.on('subscribe', (filter) => {
      let filterSerialized = JSON.stringify(filter);
      socket.join(filterSerialized);
      socket
        .to(filterSerialized)
        .emit(
          "response",
          JSON.stringify({status: 'Subscribed', id: socket.id})
        );
    });
  
    // Runs when client disconnects
    socket.on('disconnect', () => {
      console.log("Disconnected!!");
    });
};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  verifySocketToken(socket, socketUtility);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

httpServer.listen(3000, () => {
  console.log(`listening on http://localhost:3000`);
});
