import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
export default mongoose.model('Category', categorySchema);