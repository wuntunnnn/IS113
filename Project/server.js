require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session"); 
const app = express();


// DATABASE STARTS HERE 
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI, { 
  serverSelectionTimeoutMS: 10000
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));
// DATABASE ENDS HERE 

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "moviehubsecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30 //30 days 
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = {
    userId: req.session.userId || null,
    username: req.session.username || null,
    role: req.session.role || null
  };
  next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const auth = require("./routes/auth");
const home = require("./routes/home");
const movie = require("./routes/movie");
const review = require("./routes/review");
const user = require("./routes/user")
const watchlist = require("./routes/watchlist");
const profile = require("./routes/profile"); 


app.use("/", auth);
app.use("/", home); 
app.use("/", movie);
app.use("/", review);
app.use("/users", user);
app.use("/", watchlist);
app.use("/", profile)

app.get("/", (req, res) => {
  // res.send(`
  //   <h1>Movies Watchlist</h1>
  //   <a href="signup">Sign Up</a>
  //   <a href="login">Login</a>
  // `);
  res.redirect("/movies")
});

const hostname = "127.0.0.1";
const port = 8000;

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});