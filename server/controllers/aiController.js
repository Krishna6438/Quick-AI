import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import { v2 as cloudinary } from 'cloudinary';
import FormData from "form-data";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";




const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const generateArticle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Free usage limit reached...Upgrade to premium plan for more usage."
            });
        }

        // ✅ Use the user's actual prompt
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: length
        });

        // ✅ Handle both possible response shapes
        const content =
            response.choices[0]?.message?.content ||
            response.choices[0]?.message?.content[0]?.text ||
            "";

        // ✅ Save to DB
        await sql`
        INSERT INTO creations(user_id, prompt, content, type)
        VALUES(${userId}, ${prompt}, ${content}, 'article')`;

        // ✅ Update free usage
        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            });
        }

        res.json({ success: true, content });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};



export const generateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Free usage limit reached...Upgrade to premium plan for more usage."
            });
        }

        // ✅ Use the user's actual prompt
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        // ✅ Handle both possible response shapes
        const content =
            response.choices[0]?.message?.content ||
            response.choices[0]?.message?.content[0]?.text ||
            "";

        // ✅ Save to DB
        await sql`
        INSERT INTO creations(user_id, prompt, content, type)
        VALUES(${userId}, ${prompt}, ${content}, 'blog-title')`;

        // ✅ Update free usage
        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            });
        }

        res.json({ success: true, content });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};


// export const generateImage = async (req, res) => {
//     try {
//         const { userId } = req.auth();
//         const { prompt } = req.body;
//         const plan = req.plan;
//         const free_usage = req.free_usage;

//         // ✅ Stop execution if free limit reached
//         if (plan !== "premium" && free_usage >= 10) {
//             return res.json({
//                 success: false,
//                 message: "This feature is only available for premium user."
//             });
//         }



//         const formData = new FormData()
//         form.append('prompt', prompt)
//         const {data} = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData,{
//             headers: { 'x-api-key': process.env.CLIPDROP_API_KEY },
//             responseType: 'arraybuffer'
//         })

//         const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

//         const {secure_url} = await cloudinary.uploader.upload(base64Image)

//         // ✅ Save to DB
//         await sql`
//         INSERT INTO creations(user_id, prompt, content, type , publish)
//         VALUES(${userId}, ${prompt}, ${secure_url}, 'image' , ${publish ?? false})`;



//         res.json({ success: true, content : secure_url });
//     } catch (error) {
//         console.error(error);
//         res.json({ success: false, message: error.message });
//     }
// };


export const generateImage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { prompt, publish } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "This feature is only available for premium user."
            });
        }

        // ✅ Build form data properly
        const formData = new FormData();
        formData.append("prompt", prompt);

        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: {
                    ...formData.getHeaders(), // ✅ include correct headers for multipart
                    "x-api-key": process.env.CLIPDROP_API_KEY,
                },
                responseType: "arraybuffer",
            }
        );

        // ✅ Convert buffer to base64 for Cloudinary
        const base64Image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;

        const { secure_url } = await cloudinary.uploader.upload(base64Image);

        // ✅ Save to DB
        await sql`
            INSERT INTO creations(user_id, prompt, content, type, publish)
            VALUES(${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
        `;

        res.json({ success: true, content: secure_url });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};



export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth();
        const  image  = req.file;
        const plan = req.plan;


        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "This feature is only available for premium user."
            });
        }





        const { secure_url } = await cloudinary.uploader.upload(image.path , {
            transformation:[{
                effect : 'background_removal',
                background_removal : 'remove_the_background'
            }]
        });


        // ✅ Save to DB
        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES(${userId}, 'Remove Background from the image', ${secure_url}, 'image' )
        `;

        res.json({ success: true, content: secure_url });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};



export const removeImageObject = async (req, res) => {
    try {
        const { userId } = req.auth();
        const  image  = req.file;
        const {object} = req.body;
        const plan = req.plan;
        


        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "This feature is only available for premium user."
            });
        }





        const { public_id } = await cloudinary.uploader.upload(image.path );

        const image_Url = cloudinary.url(public_id, {
            transformation: [{
                effect: `gen_remove:${object}`,
                
            }],
            resource_type: 'image',
        });


        // ✅ Save to DB
        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES(${userId}, ${`Removed ${object} from the image`}, ${image_Url}, 'image' )
        `;

        res.json({ success: true, content:image_Url });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};



export const resumeReview = async (req, res) => {
    try {
        const { userId } = req.auth();
        const resume = req.file;
        const plan = req.plan;
        


        // ✅ Stop execution if free limit reached
        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "This feature is only available for premium user."
            });
        }

        if(!resume.size > 5 * 1024 * 1024){
            return res.json({
                success: false,
                message: "File size should be less than 5MB"
            });
        }

        const dataBuffer = fs.readFileSync(resume.path);
        const pdfData = await pdf(dataBuffer);
        
        const prompt = `Review my resume and suggest improvements. Here is the content: ${pdfData.text}`;


        // ✅ Use the user's actual prompt
        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        // ✅ Handle both possible response shapes
        const content =
            response.choices[0]?.message?.content ||
            response.choices[0]?.message?.content[0]?.text ||
            "";


        // ✅ Save to DB
        await sql`
            INSERT INTO creations(user_id, prompt, content, type)
            VALUES(${userId}, 'Review the uploaded resume', ${content}, 'resume-review' )
        `;

        res.json({ success: true, content});
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};