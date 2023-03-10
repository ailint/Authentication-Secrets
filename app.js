//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose"); mongoose.set('strictQuery', false);
const session = require("express-session");
const MemoryStore = require('memorystore')(session)
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: "incorrect. Try again",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://ailin-admin:ailin-admin-password@cluster0.htqyino.mongodb.net/userDB", {useNewUrlParser: true});
// mongoose.set("useCreateIndex", true); //it has been deprecated and it's not needed

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secrets: [{type:String}]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL:"http://localhost:3000/auth/google/secrets",  
     },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});

app.get('/auth/google', 
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    User.find({"secrets": {$ne: null}}, function(err, foundUsers){
         if (err) {
             console.log(err);
         } else {
            if (foundUsers) {
                var allUserSecrets = ["Add your secrets below"];
                // loop through each user
                foundUsers.forEach(function(user){
                    // loop through secrets for the user
                    user.secrets.forEach(function(secret){
                        // add their secrets one by one to the mega secrets array
                        allUserSecrets.push(secret);
                    });
                });
                // my shuffle() function
                // function shuffle(array) {
                //     array.sort(() => Math.random() - 0.5);
                // };
                // allUserSecrets = shuffle(allUserSecrets);
                // console.log(allUserSecrets);

                res.render("secrets", {allSecrets: allUserSecrets}); 
            }
         }
    });
});

app.get("/submit", function(req, res){
     if (req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login")
    }
});

app.post("/submit", function(req, res){
     const submittedSecret = req.body.secret;

    // console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.secrets.push(submittedSecret);
                foundUser.save(function(){
                    res.redirect("/secrets");
                });
            }
        }
    }); 
});

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
});

app.post("/register", function(req, res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            res.redirect("register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
   
});

app.post("/login", function(req, res){

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
    
});


app.listen(PORT, () => {
    console.log("Server started on port ${PORT}.");
});