const express = require("express");
const router = express.Router();


// ADD YOUR CODE BELOW
const USERS = [
  { username: "test", password: "asd123", watchlist: []},
  { username: "asd", password: "password", watchlist: []}
];


router.get("/signup", (req, res) =>{
  res.send(`
     <form method="post" action="/signup">
        <label>Username</label></br>
        <input type="text" name="username"></br>
        <label>Password</label></br>
        <input type="password" name="password"></br>
        <label>Confirm Password</label></br>
        <input type="password" name="cpassword"></br>
        </br>
        <button type="submit">Sign Up</button>
    </form>
    `);
});

router.get("/login", (req, res) =>{
  res.send(`
     <form method="post" action="/login">
        <label>Username</label></br>
        <input type="text" name="username"></br>
        <label>Password</label></br>
        <input type="password" name="password"></br>
        </br>
        <button type="submit">Login</button>
    </form>
    `);
});

router.post("/signup", (req, res) =>{
  const username = req.body.username;
  const password = req.body.password;
  const cpassword = req.body.cpassword;
  let msg = "";

  if (password != cpassword){
    msg = "Password do not match";
    res.send(`<p>${msg}</p>
      <form method="post" action="/signup">
      <label>Username</label></br>
      <input type="text" name="username"></br>
      <label>Password</label></br>
      <input type="password" name="password"></br>
      <label>Confirm Password</label></br>
      <input type="password" name="cpassword"></br>
      </br>
      <button type="submit">Sign Up</button>
  </form>
      `)
  }
  
  for (i in USERS){
    if (username === USERS[i].username){
      msg = "Username already existed";
      res.send(`<p>${msg}</p>
        <form method="post" action="/signup">
        <label>Username</label></br>
        <input type="text" name="username"></br>
        <label>Password</label></br>
        <input type="password" name="password"></br>
        <label>Confirm Password</label></br>
        <input type="password" name="cpassword"></br>
        </br>
        <button type="submit">Sign Up</button>
    </form>
        `);
    }
  }
  const user = {username: username, password: password}
  USERS.push(user);
  res.render("user",{user});
});

router.post("/login", (req, res) =>{
  const username = req.body.username;
  const password = req.body.password;
  let msg = "";
  
  for (i in USERS){
    if (username === USERS[i].username && password === USERS[i].password){
      const user = {username: username, password: password}
      res.render("user",{user});
    }

    msg = "Username or Password Invalid";
    res.send(`<p>${msg}</p>
      <form method="post" action="/login">
      <label>Username</label></br>
      <input type="text" name="username"></br>
      <label>Password</label></br>
      <input type="password" name="password"></br>
      </br>
      <button type="submit">Login</button>
  </form>
      `);
  }
});

// END OF ADDING YOUR CODE

module.exports = router;
