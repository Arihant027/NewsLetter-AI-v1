import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const curatedArticleSchema = new Schema({
    title: { type: String, required: true },
    sourceName: { type: String },
    originalUrl: { type: String, required: true, unique: true },
    description: { type: String },
    content: { type: String },
    summary: { type: String },
    imageUrl: { type: String },
    publishedAt: { type: Date },
    category: { type: String, required: true },
    savedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
    timestamps: true
});
export default mongoose.model('CuratedArticle', curatedArticleSchema);