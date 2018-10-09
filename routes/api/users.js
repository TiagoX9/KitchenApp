const express = require("express");
const router = express.Router();
const gravatar = require("gravatar");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const keys = require("../../config/keys");
const passport = require("passport");

// Load Input Validation
const validateRegisterInput = require("../../validation/register");
const validateLoginInput = require("../../validation/login");

// Load User model
const User = require("../../models/User");

// @route   GET api/users/test
// @desc    Tests users route
// @access  Public
router.get("/test/", (req, res) => res.json({ msg: "User Works" }));

// @route   POST api/users/register
// @desc    Register user
// @access  Public
router.post("/register", (req, res) => {
  const { errors, isValid } = validateRegisterInput(req.body);

  // Check Validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  User.findOne({ email: req.body.email }).then(user => {
    if (user) {
      errors.email = "Email already exists";
      return res.status(400).json(errors);
    } else {
      const avatar = gravatar.url(req.body.email, {
        s: "200",
        r: "pg",
        d: "mm"
      });

      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        avatar,
        password: req.body.password
      });

      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err;
          newUser.password = hash;
          newUser
            .save()
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
      });
    }
  });
});

// @route   GET api/users/login
// @desc    Login User / Returning JWT token
// @access  Public
router.post("./login", (req, res) => {
  const { errors, isValid } = validateLoginInput(req.body);

  // Check Validation
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const email = req.body.email;
  const password = req.body.password;

  // Find user by email
  User.findOne({ email }).then(user => {
    // Check for user
    if (!user) {
      errors.email = "User not found";
      return res.status(404).json(errors);
    }

    // Check Password
    bcrypt.compare(password, user.password).then(isMatch => {
      if (isMatch) {
        if (isMatch) {
          // User Matched
          const payload = { id: user.id, name: user.name, avatar: user.avatar }; // Create JWT payload

          // Sign Token
          jwt.sign(
            payload,
            keys.secretOrKey,
            { expiresIn: 3600 },
            (err, token) => {
              res.json({
                success: true,
                token: "Bearer " + token
              });
            }
          );
        } else {
          errors.password = "Password incorrect";
          return res.status(400).json(errors);
        }
      }
    });
  });
});

// @route   GET api/users/current
// @desc    REturn current user
// @access  Private
router.get(
  "/current",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    });
  }
);

/////////// FOLLOWING FUNCTIONALITY ////////////

// @route   POST api/users/follow/:id
// @desc    Follow user
// @access  Private
router.post(
  "/follow/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Profile.findOne({ user: req.user.id }).then(profile => {
      User.findById(req.params.id)
        .then(user => {
          if (
            user.following.filter(
              follow => follow.user.toString() === req.user.id
            ).length > 0
          ) {
            return res
              .status(400)
              .json({ alreadyfollowed: "User already followed this user" });
          }

          // Add user id to follow array
          user.following.unshift({ user: req.user.id });

          user.save().then(user => res.json(user));
        })
        .catch(err => res.status(404).json({ usernotfound: "No user found" }));
    });
  }
);

// @route   POST api/user/unfollow/:id
// @desc    Unfollow user
// @access  Private
router.post(
  "/unfollow/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Profile.findOne({ user: req.user.id }).then(profile => {
      User.findById(req.params.id)
        .then(user => {
          if (
            user.following.filter(
              follow => follow.user.toString() === req.user.id
            ).length === 0
          ) {
            return res
              .status(400)
              .json({ notfollowed: "You have not yet followed this user" });
          }

          // Get remove index
          const removeIndex = user.following
            .map(item => item.user.toString())
            .indexOf(req.user.id);

          // Splice out of array
          user.following.splice(removeIndex, 1);

          // Save
          user.save().then(user => res.json(user));
        })
        .catch(err => res.status(404).json({ usernotfound: "No user found" }));
    });
  }
);

module.exports = router;
