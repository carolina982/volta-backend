import mongoose, { Document, Schema } from "mongoose";

/** Inventario de entrega: registro manual (texto libre) + firma digital. Histórico, no se sobrescribe. */
export interface IInventarioUnidad {
  contenido: string;
  firmaUrl: string;
  operadorId?: mongoose.Types.ObjectId | null;
  operadorNombre: string;
  creadoPorId?: mongoose.Types.ObjectId | null;
  creadoPorNombre: string;
  fecha: Date;
}

export interface IUnit extends Document {
    nombre:string;
    placas:string;
    modelo:string;
    capacidad:string;
    estado:"Disponible" | "Mantenimiento" | "Ocupado";
    tipoRemolque?:"Lowboy" |"Caja Seca" |"";
    placaRemolque?:string;
    imagenUrl:string;

    inventarios?: IInventarioUnidad[];
}

const InventarioSchema = new Schema<IInventarioUnidad>(
  {
    contenido: { type: String, default: "" },
    firmaUrl: { type: String, default: "" },
    operadorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    operadorNombre: { type: String, default: "" },
    creadoPorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    creadoPorNombre: { type: String, default: "" },
    fecha: { type: Date, default: Date.now },
  },
  { _id: true }
);

const uniSchema =new Schema<IUnit> ({
    nombre:{type:String , required:true},
    placas:{type:String , required:true},
    modelo:{type:String,  required:true},
    capacidad:{type:String , required:true},
    estado:{type:String , enum:["Disponible" , "Mantenimiento" , "Ocupado"]},
    tipoRemolque:{type:String, enum:["Lowboy","Caja Seca",""],default:""},
    placaRemolque:{type:String,default:""},
    imagenUrl:{type:String,default:""},
    inventarios:{ type: [InventarioSchema], default: [] },
},
{timestamps:true}
);
uniSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});




export default  mongoose.model<IUnit> ("Unit" , uniSchema);