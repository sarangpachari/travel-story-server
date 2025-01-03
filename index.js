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

//TO HANDLE IMAGE UPLOAD
app.post("/image-upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: true, message: "No image uploaded" });
    }
    const imageUrl = `${config.SERVER_BASE_URL}/uploads/${req.file.filename}`;
    res.status(200).json({ imageUrl, message: "Image uploaded successfully" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//DELETE AN IMAGE FROM UPLOADS
app.delete("/delete-image", async (req, res) => {
  const { imageUrl } = req.query;

  if (!imageUrl) {
    return res
      .status(400)
      .json({ error: true, message: "imageUrl parameter is required" });
  }
  try {
    //EXTRACT FILENAME FROM imageUrl
    const filename = path.basename(imageUrl);

    //DEFINE THE FILE PATH
    const filePath = path.join(__dirname, "uploads", filename);

    //CHECK IF THE FILE EXISTS
    if (fs.existsSync(filePath)) {
      //DELETE THE FILE
      fs.unlinkSync(filePath);
      res.status(200).json({ message: "Image deleted successfully" });
    } else {
      res.status(200).json({ error: true, message: "Image not found" });
    }
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//SERVE STATIC FILES FROM UPLOADS AND ASSETS DIRECTORY
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

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

//EDIT TRAVEL STORY
app.put("/edit-story/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
  const { userId } = req.user;

  //VALIDATE REQUIRED FIELDS
  if (!title || !story || !visitedLocation || !visitedDate ) {
    return res
      .status(400)
      .json({ error: true, message: "Please fill all fields" });
  }

  //CONVERT VISITED DATE IN MILLISECONDS TO DATE OBJECT
  const parsedVisitedDate = new Date(parseInt(visitedDate));

  try {
    //FIND THE TRAVEL STORY BY ID AND ENSURE IT BELONGS TO THE AUTHENTICATED USER
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });
    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel Story not found" });
    }

    const placeholderImgUrl = `${config.SERVER_BASE_URL}/assets/placeholder.png`;

    travelStory.title = title;
    travelStory.story = story;
    travelStory.visitedLocation = visitedLocation;
    travelStory.imageUrl = imageUrl || placeholderImgUrl;
    travelStory.visitedDate = parsedVisitedDate;

    await travelStory.save();
    res.status(200).json({
      story: travelStory,
      message: "Travel Story updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//DELETE TRAVEL STORY
app.delete("/delete-story/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;

  try {
    //FIND THE TRAVEL STORY BY ID AND ENSURE IT BELONGS TO THE AUTHENTICATED USER
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });
    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel Story not found" });
    }

    //DELETE THE TRAVEL STORY FROM DB
    await travelStory.deleteOne({ _id: id, userId: userId });

    //EXTRACT THE FILENAME FROM THE imageUrl
    const imageUrl = travelStory.imageUrl;
    const filename = path.basename(imageUrl);

    //DEFINE THE FILEPATH
    const filePath = path.join(__dirname, "uploads", filename);

    //DELETE THE IMAGE FILE FROM THE UPLOADS FOLDER
    fs.unlink(filePath, (err) => {
      if (err) console.log("Failed to delete image file :", err);
    });

    res.status(200).json({ message: "Travel Story deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//UPDATE isFavourite
app.put("/update-is-favourite/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isFavourite } = req.body;
  const { userId } = req.user;

  try {
    //FIND THE TRAVEL STORY BY ID
    const travelStory = await TravelStory.findOne({ _id: id, userId: userId });
    if (!travelStory) {
      return res
        .status(404)
        .json({ error: true, message: "Travel Story Not Found" });
    }
    //UPDATE THE isFavourite FIELD
    travelStory.isFavourite = isFavourite;
    await travelStory.save();

    res.status(200).json({
      story: travelStory,
      message: "isFavourite updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//SEARCH TRAVEL STORIES
app.get("/search", authenticateToken, async (req, res) => {
  const { query } = req.query;
  const { userId } = req.user;

  if (!query) {
    return res
      .status(404)
      .json({ error: true, message: "Please provide a query" });
  }

  try {
    const searchResults = await TravelStory.find({
      userId: userId,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { story: { $regex: query, $options: "i" } },
        { visitedLocation: { $regex: query, $options: "i" } },
      ],
    }).sort({ isFavourite: -1 })

    res.status(200).json({stories: searchResults})
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
});

//FILTER TRAVEL STORIES BY DATE RANGE
app.get("/travel-stories/filter", authenticateToken, async (req, res) => {
  const { startDate, endDate } = req.query;
  const { userId } = req.user;

  try {
    //CONVERT START DATE AND END DATE FROM MILLISECONDS TO DATE OBJECT
    const start = new Date(parseInt(startDate))
    const end = new Date(parseInt(endDate))

    //FIND TRAVEL STORIES THAT BELONGS TO AUTHENTICATED USER AND FALL WITHIN THE DATE RANGE
    const filteredStories = await TravelStory.find({
      userId: userId,
      visitedDate: { $gte: start, $lte: end },
    }).sort({isFavourite: -1})
    
    res.status(200).json({stories: filteredStories})
    
  } catch (error) {
    res.status(500).json({ error: true, message: error.message });
  }
})

//STARTING SERVER AT PORT 8000
app.listen(8000);
module.exports = app;
