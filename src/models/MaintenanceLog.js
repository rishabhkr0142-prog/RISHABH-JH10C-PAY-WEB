import mongoose from "mongoose";

/**
 * MaintenanceLog — append-only audit trail for maintenance mode operations.
 * Records every category or product maintenance toggle with admin details,
 * action, timestamp, and reason.
 */
const MaintenanceLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      default: "",
      index: true,
    },
    adminEmail: {
      type: String,
      default: "",
    },
    targetType: {
      type: String,
      enum: ["category", "product", "bulk_product"],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      default: "",
      index: true,
    },
    targetName: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      enum: ["enable", "disable"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      maxlength: 500,
    },
    maintenanceUntil: {
      type: String,
      default: "",
      maxlength: 100,
    },
    productCount: {
      type: Number,
      default: 1,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true, collection: "maintenancelogs" }
);

MaintenanceLogSchema.index({ createdAt: -1 });

export default mongoose.models.MaintenanceLog ||
  mongoose.model("MaintenanceLog", MaintenanceLogSchema);

