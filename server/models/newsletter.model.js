import mongoose from 'mongoose';
const { Schema } = mongoose;

const newsletterSchema = new Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  status: {
    type: String,
    enum: ['Not Sent', 'pending', 'approved', 'sent', 'declined'],
    default: 'Not Sent'
  },
  articles: [{ type: Schema.Types.ObjectId, ref: 'CuratedArticle' }],
  recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pdfContent: {
    data: Buffer,
    contentType: String
  },
  htmlContent: { type: String }, // Add this line
}, {
  timestamps: true,
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter;