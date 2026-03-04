const express = require("express");
const server = express();
const path = require("path");

server.use("/", express.static(path.join(__dirname, "public")))
server.use(express.urlencoded({ extended: true }));

// DATABASE STARTS HERE 
const mongoose = require("mongoose");

const uri = "mongodb+srv://wad-users-01:YgaT6b6duLWrTHoC@wad.caqywub.mongodb.net/MovieHub?retryWrites=true&w=majority";

mongoose.connect(uri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));
// DATABASE ENDS HERE 

// ROUTES
const userRoutes = require("./routes/user");
const movieRoutes = require("./routes/movie");
const reviewRoutes = require("./routes/review");

server.use("/users", userRoutes);
server.use("/movies", movieRoutes);
server.use("/reviews", reviewRoutes);

const hostname = "127.0.0.1";
const port = 8000;

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});