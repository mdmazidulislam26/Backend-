import mongoose ,{model, Schema} from "mongoose";

const subscribetionSchema = new Schema({
    subcriber: {
        // * One who is subscribing
        type : Schema.Types.ObjectId,
        ref : 'User'
    },
    channel: {
        // * One to whom 'subscriber' is subscribing
        type : Schema.Types.ObjectId,
        ref : 'User'
    },
},{timestamps : true});

export const Subscribetion = new mongoose.model('Subscribetion',subscribetionSchema);