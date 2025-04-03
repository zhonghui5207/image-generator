import mongoose from 'mongoose';

const generatedImageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalImage: {
    type: String,
    required: false // 文生图模式没有原始图像，所以设为可选
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
  },
  mode: {
    type: String,
    enum: ['image-to-image', 'text-to-image'],
    default: 'image-to-image'
  },
  model: {
    type: String,
    required: true
  }
});

const GeneratedImage = mongoose.model('GeneratedImage', generatedImageSchema);

export default GeneratedImage;
