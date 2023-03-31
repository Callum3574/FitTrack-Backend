const express = require("express");
const app = express();
const { Configuration, OpenAIApi } = require("openai");

const client = require("./database.js");
const port = 4000 || process.env.PORT;
const http = require("http");
const cors = require("cors");
const serviceAccount = require("./gym-auth-development-firebase-adminsdk-lzm2x-34721cf03e.json");
const admin = require("firebase-admin");
const { Server } = require("socket.io");
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://effortless-kashata-ae3732.netlify.app",
    ],
    methods: ["POST", "GET"],
  },
});

io.on("connection", (socket) => {
  socket.on("send_message", (data, room) => {
    console.log(data);

    socket.to(room).emit("receive_message", data);
  });

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`user with ID: ${socket.id} joined ${room}`);
  });

  socket.on("disconnect", (socket) => {
    console.log(`User Disconnected ${socket.id}`);
  });
});

app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(
  cors({
    origin: ["http://localhost:3000"],
  })
);

app.use(express.json());

app.post("/input_exercise", async (req, res) => {
  try {
    const data = await req.body;
    const query = {
      text: "INSERT INTO exercises (workout_id, duration, calories, steps, date, distance, user_id, location, rating) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      values: [
        data.exercise_id,
        data.duration,
        data.calories,
        data.steps,
        data.date,
        data.distance,
        data.user_id,
        data.location,
        data.rating,
      ],
    };
    await client.query(query);
    return res.status(200).send({ status: 200, message: "success" });
  } catch (error) {
    res.status(500).send({ message: "server error!" });
  }
});

app.get("/all_walk_data/:user_id", async (req, res) => {
  const user_id = req.params.user_id;

  try {
    const data = await client.query(
      "SELECT workout_id, exercises.id, distance, date, steps, calories, duration, type, location, rating FROM exercises JOIN workouts ON workouts.id = exercises.workout_id WHERE user_id = $1 ORDER BY exercises.id DESC",
      [user_id]
    );
    res.status(200).send(data.rows);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "server error!" });
  }
});

app.patch("/update_rating", async (req, res) => {
  try {
    const data = await req.body;
    const query = {
      text: "UPDATE exercises SET rating = $1 WHERE id = $2",
      values: [data.rating, data.id],
    };
    await client.query(query);
    await res.status(200).send({ message: "updated rating successfully" });
  } catch (e) {
    res.status(500).send({ message: "could not update rating", e });
  }
});

app.post("/create_user", async (req, res) => {
  try {
    const data = await req.body;

    const query = {
      text: "INSERT INTO users (user_id, firstName, lastName, email) VALUES ($1, $2, $3, $4)",
      values: [data.id, data.firstName, data.lastName, data.email],
    };
    await client.query(query);

    await admin.auth().setCustomUserClaims(data.id, { role: "user" });
    res.status(200).send({ message: "user added and claim added" });
  } catch (e) {
    console.error(e);
    res.status(500).send("error posting user id");
  }
});

app.post("/send_message", async (req, res) => {
  try {
    const data = await req.body;

    const query = {
      text: "INSERT INTO messages (chat_room_id, from_user, to_user, message) VALUES ($1, $2, $3, $4)",
      values: [data.chat_room_id, data.from_user, data.to_id, data.message],
    };

    client.query(query);

    res.status(200).send({ message: "message sent", code: 200 });
  } catch {
    res.status(500).send({ message: "message not sent", code: 500 });
  }
});

app.get("/display_messages/:room_id", async (req, res) => {
  const room_id = await req.params.room_id;
  console.log(room_id);
  try {
    const query = {
      text: "SELECT message, from_user from messages WHERE chat_room_id = $1",
      values: [room_id],
    };

    const allMessages = await client.query(query);
    res.status(200).send({ messages: allMessages.rows, code: 200 });
  } catch {
    res.status(500).send({ message: "Unable to retrieve messages", code: 500 });
  }
});

app.post("/friend_request", async (req, res) => {
  try {
    const data = await req.body;
    const all_users = await client.query("SELECT * FROM users");
    const findUser = all_users.rows.filter((user) => {
      return req.body.requestEmail === user.email;
    });
    const query = {
      text: "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)",
      values: [data.userId, findUser[0].user_id],
    };

    if (data.userId === findUser[0].user_id) {
      res.status(404).send({ message: "You cannot add your self", code: 404 });
    } else {
      await client.query(query);
      res.status(200).send({ message: "friend added", code: 200 });
    }
  } catch {
    res.status(500).send({ message: "unable to add friend", code: 500 });
  }
});

app.get("/all_friends/:user_id", async (req, res) => {
  try {
    const data = await req.params;
    const currentUserId = data.user_id;
    const all_users = await client.query("SELECT * FROM users");
    const friendsList = await client.query("SELECT * FROM friends");
    const friendsListNames = [];

    const friendListIds = friendsList.rows.filter((friend) => {
      return friend.user_id === currentUserId;
    });

    for (let i = 0; i < friendListIds.length; i++) {
      for (let j = 0; j < all_users.rows.length; j++) {
        if (friendListIds[i].friend_id === all_users.rows[j].user_id) {
          friendsListNames.push({
            firstname: all_users.rows[j].firstname,
            id: all_users.rows[j].user_id,
          });
        }
      }
    }
    res
      .status(200)
      .send({ message: "friends found", friendsList: friendsListNames });
  } catch {
    res.status(500).send({ message: "no friends found", friendsList: [] });
  }
});

app.get("/get_user/:user_id", async (req, res) => {
  const data = req.params.user_id;
  try {
    const query = {
      text: "SELECT firstname FROM users WHERE user_id = $1",
      values: [data],
    };
    const name = await client.query(query);
    res.status(200).send({ message: "user found!", name: name.rows });
  } catch (e) {
    console.error(e);
  }
});

app.post("/verify_token", async (req, res) => {
  try {
    const { idToken } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    // Check if user has admin role
    const user = await admin.auth().getUser(uid);
    const customClaims = user.customClaims;
    if (customClaims && customClaims.role === "admin") {
      res.status(200).send({ auth: true });
    } else {
      res.status(403).send({ auth: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Something went wrong" });
  }
});

app.get("/all_users", async (req, res) => {
  try {
    const query = {
      text: "SELECT * FROM users",
    };
    const users = await client.query(query);

    res.status(200).send({
      message: "success fetching users",
      data: users.rows,
    });
  } catch (e) {
    res.status(500).send({ message: e });
  }
});

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.CHAT_GPT_API_KEY,
  })
);

app.post("/exercise_recommendation", (req, res) => {
  try {
    const message = req.body;
    let AI_mess = "";
    openai
      .createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message.text }],
      })
      .then((response) => {
        res.send(response.data.choices);
      })
      .catch((error) => {
        console.log(error);
        res.status(500).send("Error generating exercise recommendation.");
      });
  } catch (error) {
    console.log(error);
    res.status(400).send("Invalid request body.");
  }
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
