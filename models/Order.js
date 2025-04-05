import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  credits: {
    type: Number,
    required: true,
    min: 1
  },
  paymentMethod: {
    type: String,
    enum: ['wechat', 'alipay', 'paypal', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled', 'expired'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    required: false
  },
  paymentTime: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiredAt: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    default: '积分充值'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// 添加索引以便于查询
orderSchema.index({ user: 1, createdAt: -1 });
// orderNumber已经在schema中设置了unique:true
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order; 