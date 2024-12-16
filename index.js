require("dotenv").config();

//REQUIREMENTS
const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const upload = require("./multer");
const fs = require("fs");
const path = require("path");

const { authenticateToken } = require("./utilities");

//MONGOOSE MODELS/Schema
const User = require("./models/userModel");
const TravelStory = require("./models/travelStoryModel");

mongoose
  .connect(config.connectionString)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

//EXPRESS SERVER
const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

//CREATE ACCOUNT
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  //CHECKING ALL FIELDS
  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required" });
  }

  //CHECKING USER EXISTS WITH EMAIL
  const isUser = await User.findOne({ email });
  if (isUser) {
    return res
      .status(400)
      .json({ error: true, message: "User already exists !" });
  }

  //CREATING HASHED PASSWORD
  const hashedPassword = await bcrypt.hash(password, 10);

  //CREATING USER TO user
  const user = new User({
    fullName,
    email,
    password: hashedPassword,
  });

  await user.save();

  //CREATING ACCESS TOKEN
  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "72h",
    }
  );

  return res.status(201).json({
    error: false,
    user: { fullName: user.fullName, email: user.email },
    accessToken,
    message: "Registration Successful",
  });
});

//LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password are required" });
  }

  //CHECKING USER EXISTS OR NOT
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  //PASSWORD CHECKING WITH BCRYPT
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }

  //CREATING ACCESS TOKEN
  const accessToken = jwt.sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "72h",
    }
  );

  //SUCCESS RESPONSE
  return res.status(201).json({
    error: false,
    user: { fullName: user.fullName, email: user.email },
    accessToken,
    message: "Login Successful",
  });
});

//GET_USER
app.get("/get-user", authenticateToken, async (req, res) => {
  const { userId } = req.user;

  const isUser = await User.findOne({ _id: userId });
  if (!isUser) {
    return res.sendStatus(401);
  }
  return res.json({
    error: false,
    user: isUser,
    message: "User Found",
  });
});

//ADD TRAVEL STORY
app.post("/add-travel-story", authenticateToken, async (req, res) => {
  const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
  const { userId } = req.user;

  //VALIDATE REQUIRED FIELDS
  if (!title || !story || !visitedLocation || !visitedDate || !imageUrl) {
    return res
      .status(400)
      .json({ error: true, message: "Please fill all fields" });
  }

  //CONVERT VISITED DATE IN MILLISECONDS TO DATE OBJECT
  const parsedVisitedDate = new Date(parseInt(visitedDate));
  try {
    const travelStory = new TravelStory({
      title,
      story,
      visitedLocation,
      userId,
      imageUrl,
      visitedDate: parsedVisitedDate,
    });
    await travelStory.save();
    res.status(201).json({ story: travelStory, message: "Added Successfully" });
  } catch (error) {
    res.status(400).json({ error: true, message: error.message });
  }
});

//GET ALL TRAVEL STORIES
app.get("/get-all-stories", authenticateToken, async (req, res) => {
  const { userId } = req.user;

  try {
    const travelStories = await TravelStory.find({ userId: userId }).sort({
      isFavourite: -1,
    });
    res.status(200).json({ stories: travelStories });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//TO HANDLE IMAGE UPLOAD
app.post("/image-upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: true, message: "No image uploaded" });
    }
    const imageUrl = `${config.SERVER_BASE_URL}/uploads/${req.file.filename}`;
    res.status(201).json({ imageUrl, message: "Image uploaded successfully" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//STARTING SERVER AT PORT 8000
app.listen(8000);
module.exports = app;
