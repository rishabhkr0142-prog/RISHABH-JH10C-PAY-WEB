import mongoose from "mongoose";

/**
 * Category — stores category metadata and category-level maintenance status.
 * Products belonging to a category under maintenance automatically inherit
 * the maintenance status.
 */
const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    maintenance: {
      type: Boolean,
      default: false,
      index: true,
    },
    maintenanceReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    maintenanceUntil: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    maintenanceSince: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, collection: "categories" }
);

export default mongoose.models.Category || mongoose.model("Category", CategorySchema);

