const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  userId: String,
  username: String,
  role: {
    type: String,
    enum: ["host", "moderator", "participant"],
    default: "participant"
  }
});

const roomSchema = new mongoose.Schema({
  roomId: String,
  hostId: String,
  participants: [participantSchema],
  videoState: {
    videoId: String,
    currentTime: Number,
    isPlaying: Boolean
  }
});

module.exports = mongoose.model("Room", roomSchema);