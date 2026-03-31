const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  socketId: String
});

export default mongoose.model("User", userSchema);