import mongoose from 'mongoose';
const { Schema } = mongoose;

const newsletterSchema = new Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  status: { 
    type: String, 
    // MODIFIED: Replaced 'draft' with 'Not Sent' in the list of valid statuses
    enum: ['Not Sent', 'pending', 'approved', 'sent', 'declined'], 
    // MODIFIED: Changed the default status for new newsletters
    default: 'Not Sent' 
  },
  articles: [{ type: Schema.Types.ObjectId, ref: 'CuratedArticle' }],
  recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pdfContent: {
    data: Buffer,
    contentType: String
  }
}, {
  timestamps: true,
});

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter;