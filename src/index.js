//? require('dotenv').config({path:'./env'});

import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path : './.env'
});

let port = process.env.PORT || 3000 ;

connectDB()
.then(() => {
    app.on("error", (error) => {
        confirm.error("Error : ", error);
        throw error
    })
    app.listen( port , () => {
        console.log(`Server is running at port : ${port}`);
    });
})
.catch((err) => {
    console.error("MONGO-DB connection failed !!! ", err);
})