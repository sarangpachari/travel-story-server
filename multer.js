const multer = require("multer");
const path = require("path");

//STORAGE CONFIGURATION
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/"); //DESTINATION FOR STORING UPLOADED FILES
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); //FILE NAME WILL BE ORIGINAL NAME WITH DATE OF FILE
  },
});

//FILTERING ACCEPT ONLY IMAGES
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

//INITIALIZE MULTER INSTANCE
const upload = multer({ storage, fileFilter });

module.exports = upload;
