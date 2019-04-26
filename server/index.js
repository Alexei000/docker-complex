const keys = require("./keys");

// Express app setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres client setup
const { Pool } = require("pg");
const pgCLient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgCLient.on("error", (error) => {
    console.log("Lost pg connection: ", error)
});

pgCLient.query("CREATE TABLE IF NOT EXISTS values (number INTEGER)")
    .catch((error) => {
        console.log("Failed to create the values table", error);
    });

// Redis client setup
const redis = require("redis");
const redisClient = redis.createClient({
   host: keys.redisHost,
   port: keys.redisPort,
   retry_strategy: () => 1000 
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get("/", (req, res) => {
    res.send("Hi!");
});

app.get("/values/all", async (req, res) => {
    const values = await pgCLient.query("SELECT * FROM values");
    res.send(values.rows);
});

app.get("/values/current", async(req, res) => {
    redisClient.hgetall("values", (err, values) => {
        res.send(values);
    });
});

app.post("/values", async(req, res) => {
    console.log("Server received body ", req.body);

    const index = req.body.index;
    
    if (!index) {
        console.log("Invalid index received!");
        res.send({ working: false});
    }

    if (parseInt(index) > 40) {
        return res.status(422).send("Index too high");
    }

    redisClient.hset("values", index, "Nothing yet!");
    redisPublisher.publish("insert", index);
    pgCLient.query("INSERT INTO values (number) VALUES ($1)", [index]);

    res.send({ working: true});
});

app.listen(5000, error => {
    console.log("Server is listening on 5000 (if not redirected)");
});