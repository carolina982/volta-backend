import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: string;
  contacto: string;
  photoUrl?: string | null;
  expoPushToken?: string | null;
  resetToken?: string;
  resetTokenExp?: Date;

  comparePassword(password: string): Promise<boolean>;
}

export const isBcryptHash = (value: string) =>
  typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

/** Hashea contraseña en texto plano. Si ya es bcrypt, la deja igual. */
export async function hashPassword(plainOrHash: string): Promise<string> {
  const value = String(plainOrHash || "");
  if (!value) return value;
  if (isBcryptHash(value)) return value;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(value, salt);
}

const userSchema = new Schema<IUser>(
  {
    nombre: { type: String, required: true },
    apellido: { type: String },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    // Operadores creados solo como catálogo pueden no tener acceso al login
    password: { type: String, required: false, select: false },
    rol: {
      type: String,
      enum: ["Admin", "Operador", "Ayudante General"],
      required: true,
    },
    contacto: { type: String },
    photoUrl: { type: String, default: null },
    expoPushToken: { type: String, default: null },
    resetToken: { type: String, select: false },
    resetTokenExp: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  // Evita doble-hash si ya viene hasheada
  if (isBcryptHash(this.password)) return;
  this.password = await hashPassword(this.password);
});

userSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (!update) return;

  const plainUpdate = update as { password?: string; $set?: { password?: string } };
  const password = plainUpdate.$set?.password ?? plainUpdate.password;
  if (!password) return;

  const hash = await hashPassword(password);
  if (!plainUpdate.$set) {
    plainUpdate.$set = {};
  }
  plainUpdate.$set.password = hash;
  if (plainUpdate.password !== undefined) {
    delete plainUpdate.password;
  }
});

userSchema.methods.comparePassword = async function (password: string) {
  // Asegura tener el campo aunque password tenga select:false
  const stored: string | undefined =
    this.password ||
    (await mongoose.model<IUser>("User").findById(this._id).select("+password").then((u) => u?.password));

  if (!stored) return false;
  // Contraseña guardada en texto plano (datos viejos)
  if (!isBcryptHash(stored)) {
    return stored === password;
  }
  return bcrypt.compare(password, stored);
};

export default mongoose.model<IUser>("User", userSchema);
