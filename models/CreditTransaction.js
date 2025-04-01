import mongoose from 'mongoose';

const creditTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'usage', 'gift', 'refund'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 如果是购买积分，记录订单信息
  orderId: {
    type: String,
    default: null
  },
  // 如果是使用积分，记录生成的图像信息
  imageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GeneratedImage',
    default: null
  }
});

const CreditTransaction = mongoose.model('CreditTransaction', creditTransactionSchema);

export default CreditTransaction;
