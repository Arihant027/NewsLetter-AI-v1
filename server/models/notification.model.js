import mongoose from 'mongoose';
const { Schema } = mongoose;

const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  newsletter: { type: Schema.Types.ObjectId, ref: 'Newsletter', required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false, index: true },
  actionUrl: { type: String },
}, {
  timestamps: true,
});

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;