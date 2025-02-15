import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { apiResponse } from '../utils/apiResponse.js';

const registerUser = asyncHandler(async (req, res) => {
  // * get user details from frontend
  const { fullName, email, username, password } = req.body;
  
  console.log(`${fullName} - ${email} - ${password} - ${username}`);
  

  // * validation - not empty
  if ([fullName,email,username,password].some((field) => field.trim() ==='' )){
    throw new apiError(400, "All fields are required");
   }

  // * check if user already exists : username, email
  const existsUsername = await User.findOne({ username });
  const existsUserEmail = await User.findOne({ email});
  if (existsUsername && existsUserEmail) {
    throw new apiError( 409, "User with this email and username already exists!");
  } else if (existsUsername) {
    throw new apiError( 409, "User with this username already exists!");
  }else if (existsUserEmail) {
    throw new apiError( 409, "User with this email already exists!");
  }

  // * check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath ;//= req.files?.coverImage[0]?.path;

  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new apiError( 400, "Avatar file is required");
  }

  const ex = !(avatarLocalPath == coverImageLocalPath);

  // * upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath,ex);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath,true);

  if (!avatar) {
    throw new apiError( 400, "Avatar file is required");
  }

  // * create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username : username.toLowerCase()
  })

  // * remove password and refresh token field from response
  const creatUser = await User.findById(user._id).select(
    '-password -refreshToken '
  )
  // * check for user creation
  if(!creatUser){
    throw new apiError(500, "Something went wrong while registering the user");
  }

  // ? return response 
  return res.status(201).json(
    new apiResponse(200, creatUser, 'User registered successfully!')
  );
  
});

export { registerUser };


