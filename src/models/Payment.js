import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    customer: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    agent: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    order: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Order', 
      required: true 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    paymentMethod: { 
      type: String, 
      enum: ['paystack', 'flutterwave'], 
      required: true 
    },
    reference: { 
      type: String, 
      unique: true, 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'success', 'failed'], 
      default: 'pending' 
    },

    // ✅ Added Fields
    companyShare: { 
      type: Number, 
      default: 0 
    },
    agentShare: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
