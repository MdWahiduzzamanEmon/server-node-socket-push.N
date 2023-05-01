const express = require("express");
const { createServer } = require("http");
var bodyParser = require("body-parser");
require("dotenv").config();
var CryptoJS = require("crypto-js");

const { Server } = require("socket.io");
const app = express();

const { MongoClient, ServerApiVersion } = require("mongodb");
const jwtFunction = require("./JWT/CrateJWT");
const uri = process.env.MONGODB_URI;
// console.log("uri", uri);

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

let subscribers = [];
let user = [];

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("pushNotification").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const UserAppIdCollection = client
      .db("pushNotification")
      .collection("UserAppID");

    const saveUserJWTTokencollection = client
      .db("pushNotification")
      .collection("JWTTokenForUserInfo");

    //get data from mongodb
    app.get("/getdata", async (req, res) => {
      const results = await UserAppIdCollection.find({}).toArray();
      console.log("results", results);
      res.json(results);
    });

    app.post("/jwt", jsonParser, async (req, res) => {
      const body = req.body;
      const token = jwtFunction(body);
      //first check is token already exist in mongodb
      const getToken = await saveUserJWTTokencollection.findOne({
        token: token,
      });
      if (getToken) {
        res.status(400).json({ message: "token already exist" });
        return;
      }
      //decode token
      let decoded = token.split(".")[1];
      decoded = CryptoJS.enc.Base64.parse(decoded).toString(CryptoJS.enc.Utf8);
      //save token in mongodb
      await saveUserJWTTokencollection.insertOne({
        token: token,
        decoded: decoded,
      });

      res.status(200).json({ token: token, decoded: decoded });
    });

    //delete token from mongodb
    app.delete("/jwt", jsonParser, async (req, res) => {
      const token = req.body.token;
      // console.log("token", token);
      // only this match token will be deleted
      const getToken = await saveUserJWTTokencollection.findOne({
        token: token,
      });
      if (getToken) {
        await saveUserJWTTokencollection.deleteOne({ token: token });
        res.status(200).json({ message: "token deleted" });
      } else {
        res.status(400).json({ message: "token not found" });
      }
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
      socket.on("subscribe", (data) => {
        if (
          subscribers.find(
            (item) =>
              item.projectName === data.projectName &&
              item.userId === data.userId
          ) === undefined
        ) {
          subscribers.push({
            projectName: data.projectName,
            userId: data.userId,
          });
        }

        // save user id with socket id in user array
        if (user.find((item) => item.userId === data.userId) === undefined) {
          user.push({
            userId: data.userId,
            socketId: socket.id,
          });
        }
        // console.log("user", user);

        // console.log("subscribe", subscribers);
        let filterSerialized = subscribers.map((item) => {
          return item;
        });
        // console.log("filterSerialized", filterSerialized);
        socket.join(
          filterSerialized.find(
            (item) =>
              item.projectName === data.projectName &&
              Number(item.userId) === Number(data.userId)
          ).projectName +
            "_" +
            filterSerialized.find(
              (item) =>
                item.projectName === data.projectName &&
                Number(item.userId) === Number(data.userId)
            ).userId
        );

        socket.join(
          filterSerialized.find(
            (item) =>
              item.projectName === data.projectName &&
              Number(item.userId) === Number(data.userId)
          ).projectName
        );

        const body = {
          projectName: data.projectName,
          payload: JSON.stringify({ status: "Subscribed", id: socket.id }),
          userId: data.userId,
        };
        // socket
        //   .to(filterSerialized)
        //   .to(user.find((item) => item.userId === data.userId)?.socketId)
        //   .emit("response", body);
      });

      // Runs when client disconncts
      socket.on("disconnect", () => {
        const index = subscribers.indexOf(socket.id);
        if (index > -1) {
          subscribers.splice(index, 1);
        }
        //remove user from user array
        const removeUser = user.find((item) => item.socketId === socket.id);
        if (removeUser) {
          const index = user.indexOf(removeUser);
          if (index > -1) {
            user.splice(index, 1);
          }
        }
        //

        console.log("disconnect", subscribers, user);
      });
    };

    //socket connection
    io.on("connection", (socket) => {
      console.log("a user connected", socket.id);
      verifySocketToken(socket, socketUtility);
      app.socketIo = io;
      // app.socket = socket;
    });

    const socketNotify = async (filter, event, userId, send, res) => {
      // console.log("filter", filter);
      // console.log("event", event);
      //   console.log("app.socketIo", app.socketIo);
      const data = {
        projectName: filter,
        payload: JSON.stringify(event),
        userId: userId,
      };
      // app.socketIo.to(filter).emit("response",data);
      //send specific project notification to that project specific user
      const socketId = user.find((item) => {
        return Number(item.userId) === Number(userId);
      })?.socketId;
      // console.log("socketId", socketId);
      // app.socketIo.to(filter).emit("response", data);// to send a specific project notification
      // app.socketIo.to(socketId).emit("response", data); // to send a specific project notification to a specific user
      // first check the user id is exist in correct project name then send notification

      const isExist = subscribers.find((item) => {
        return (
          item?.projectName === filter &&
          Number(item?.userId) === Number(userId)
        );
      });

      // console.log("isExist", isExist);
      if (isExist) {
        if (send === "all") {
          app.socketIo.to(filter).emit("response", data);
        } else if (send === "user") {
          // app.socketIo.to(socketId).emit("response", data);
          const results = await UserAppIdCollection.insertOne({
            projectName: filter,
            payload: event,
            userId: userId,
          });
          // console.log("results", results);
          // res.status(200).json({ message: "success", data: results });

          app.socketIo.to(`${filter}_${userId}`).emit("response", data);
        }
      } else {
        // console.log("user not found in this project");
        return res
          .status(400)
          .json({ error: "user not found in this project" });
      }
    };

    //post for notifications
    app.post("/notify", jsonParser, (req, res) => {
      // console.log("req.body", req.body);
      if (
        req?.body?.projectName === null ||
        req?.body?.projectName === "" ||
        req?.body?.projectName === undefined
      ) {
        return res.status(400).json({ error: "projectName is required" });
      }

      //check project name is exist or not
      const isExistProject = subscribers.find((item) => {
        return item?.projectName === req?.body?.projectName;
      })?.projectName;
      // console.log("isExist", isExist);
      if (!isExistProject) {
        return res
          .status(400)
          .json({ error: `Project ${req?.body?.projectName} not found` });
      }
      //
      const socketId = user.find((item) => {
        return Number(item.userId) === Number(req.body.user);
      })?.socketId;
      if (!socketId) {
        return res.status(400).json({ error: "user not found" });
      }

      var filter = req?.body?.projectName;
      // console.log("filter", req?.body);
      const isExist = subscribers.find((item) => {
        return item?.projectName === filter;
      })?.projectName;
      // console.log("isExist", isExist);
      if (isExist) {
        socketNotify(
          filter,
          req.body.payload,
          req.body.user,
          req.body.send,
          res
        );
        return res.status(200).json({
          status: `Notification sent to ${filter} project successfully`,
        });
      } else {
        return res.status(400).json({ error: `Project ${filter} not found` });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

httpServer.listen(3000, () => {
  console.log(`listening on http://localhost:3000`);
});
