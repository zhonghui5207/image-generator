import mongoose from 'mongoose';

const generatedImageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalImage: {
    type: String,
    required: true
  },
  generatedImage: {
    type: String,
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  creditsUsed: {
    type: Number,
    default: 1,
    min: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const GeneratedImage = mongoose.model('GeneratedImage', generatedImageSchema);

export default GeneratedImage;
