//import multer from "multer";
//import path from "path";

/*const storage=multer.diskStorage({
    destination:function (req ,file, cd) {
        cd (null,"/opt/render/project/src/uploads")
    },
    filename : function(req ,file,cd){
        const ext =path.extname(file.originalname);
        cd (null, `${Date.now()}${ext}` );
    },
});*/

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";

const storage = new CloudinaryStorage({
    cloudinary,
    params:async (req , file)=>({
        folder:"units",
        alloweb_formats:["jpg","jpeg","png"],
    }),
});

export const upload=multer({storage});