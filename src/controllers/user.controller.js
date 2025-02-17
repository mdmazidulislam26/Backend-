import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { apiResponse } from '../utils/apiResponse.js';
import  jwt  from 'jsonwebtoken';

const generateAccessAndRefreshToken = async(userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken}

  } catch (error) {
    throw new apiError(500, 'Something went wrong while generating referesh and access token!');
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // * get user details from frontend
  const { fullName, email, username, password } = req.body;
  
  //! this should remove
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

const loginUser = asyncHandler(async ( req, res ) =>{
  /* 
   * req body -> data
   * username or email
   * find the user
   * password check
   * access and referesh token
   * send cookie 
  */
 
  // * => 1
  const { email, username, password} = req.body;

  // * => 2
  if (!username && !email) {
    throw new apiError(400, 'username or email is required');
  }

  // * => 3
  const user = await User.findOne({
    $or: [{username}, {email}]
  });

  if (!user) {
    throw new apiError(404, 'User does not exist');
  }

  // * => 4
  const isPasswordValid = await user.isPasswordCorrect(password);
  
  if (!isPasswordValid) {
    throw new apiError(401, 'Invalid user password');
  }

  // * => 5
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);
  console.log('Copy the token and Paste in Postman Authorization header');
  console.log('Access token : ',accessToken);
  // console.log('referesh token : ',refreshToken);
  
  // * => 6
  const loggedInUser = await User.findById(user._id)
  .select('-password -refreshToken');

  const options = {
    httpOnly : true,
    secure : true
  }

  return res
  .status(200)
  .cookie('accessToken', accessToken, options)
  .cookie('refereshToken', refreshToken, options)
  .json(
    new apiResponse(
      200,
      {
        user : loggedInUser, 
        accessToken, 
        refreshToken
      },
      'User logged In successfully',
    )
  );
});

const logoutUser = asyncHandler(async ( req, res ) =>{
  
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken : undefined
      }
    },{
      new : true
    }
  );

  const options = {
    httpOnly : true,
    secure : true
  }
  // console.log();
  
  return res
  .status(200)
  // .clearCookie('accessToken',accessToken)
  // .clearCookie('refereshToken',refreshToken)
  .json(new apiResponse(200, {}, 'User logged Out'))
});

const refereshAccessToken = asyncHandler(async (req,res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;
  
  if (!incomingRefreshToken) {
    throw new apiError(401,'unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  
    const user = await User.findById(decodedToken?._id);
  
    if (!user) {
      throw new apiError(401,'Invalid referesh token');
    }
  
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new apiError(401,'Refresh token is expired or used');
    }
  
    const options = {
      httpOnly : true,
      secure : true
    }
  
    const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id);
  
    return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('referesh', newRefreshToken, options)
    .json(
      new apiResponse(
        200,
        {
          accessToken, 
          refreshToken : newRefreshToken,
        },'Access token refereshed'
      )
    );
  } catch (error) {
    throw new apiError(401, error?.message || 'Invalid referesh token');
  }

});

const changeCurrentPassword = asyncHandler(async(req,res) => {
  const {oldPassword, newPassword} = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if(!isPasswordCorrect){
    throw new apiError(400, "Invalid old password")
  }

  user.password = newPassword;
  await user.save({validateBeforeSave : false});

  return res.status(200)
  .json(
    new apiResponse(200,{},'Password changed successfully')
  )

});

const getCurrentUser = asyncHandler(async(req,res) => {
  return res
  .status(200)
  .json(200, req.user, 'current user fetched successfully!')
});

const updateAccountDetails = asyncHandler(async(req,res) =>{
  const {fullName, email} = req.body;

  if (!fullName || !email) {
    throw new apiError(400, 'All files are required')
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName : fullName,
        email : email
      }
    },
    {new : true}
  ).select('-password')
  return res
  .status(200)
  .json(new apiResponse(200, user, 'Account details updated successfully'))
});

const updateUserAvatar = asyncHandler(async(req,res) =>{
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new apiError(400, 'Avatar file is missing')
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if(!avatar.url){
    throw new apiError(400, 'Error while uploading on avatar');
  }

  const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      set:{
        avatar : avatar.url
      }
    },{
      new : true
    }
  ).select('-password')

  return res
  .status(200)
  .json(
    new apiError(200, user, 'Avatar updated successfully')
  )

});

const updateUserCoverImage = asyncHandler(async(req,res) =>{
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new apiError(400, 'Cover image is missing')
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!coverImage.url){
    throw new apiError(400, 'Error while uploading on Cover image');
  }

  const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      set:{
        coverImage : coverImage.url
      }
    },{
      new : true
    }
  ).select('-password')

  return res
  .status(200)
  .json(
    new apiError(200, user, 'Cover image updated successfully')
  )

});


export {  
  registerUser,
  loginUser,
  logoutUser,
  refereshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage
 };


