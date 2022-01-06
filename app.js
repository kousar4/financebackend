const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "finance.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertStatesDbObjectToResponseObject = (dbObject) => {
  return {
    userId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "zxcvbnm", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//User Register API
app.post("/users/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM userdetails WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        userdetails (username, password) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}'
        )`;
    await db.run(createUserQuery);
    response.send(`User created successfully`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM userdetails WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "mnbvcxz");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// POSTLIST

app.post("/posts/", async (request, response) => {
  const postDetails = request.body;

  const values = postDetails.map(
    (eachPost) =>
      `('${eachPost.userId}', ${eachPost.id}, '${eachPost.title}','${eachPost.body}')`
  );

  const valuesString = values.join(",");

  const addBookQuery = `
    INSERT INTO
      postlist (user_id,id,title,body)
    VALUES
       ${valuesString};`;

  const dbResponse = await db.run(addBookQuery);
  const postId = dbResponse.lastID;
  response.send({ postId: postId });
});

//GET POSTS
app.get("/posts", async (request, response) => {
  const getPostsQuery = `
        SELECT * FROM postlist ORDER BY id
    `;
  const dbResponse = await db.all(getPostsQuery);
  response.send(dbResponse);
});

module.exports = app;
