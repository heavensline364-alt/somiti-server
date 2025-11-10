const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const app = express();

app.use(cors());
require("dotenv").config();

// ===== Middleware =====

app.use(express.json());

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

/* ===================================================
   =============== Member Schema =====================
   =================================================== */
const memberSchema = new mongoose.Schema({
  role: { type: String, enum: ["member", "agent"], required: true },
  memberId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  motherName: { type: String }, // ✅ নতুন
  mobileNumber: { type: String, required: true },
  address: { type: String },
  nidNumber: { type: String },
  fatherOrHusband: { type: String },

  // জামানতকারীর তথ্য
  guarantorName: { type: String },   // ✅ নতুন
  guarantorFather: { type: String }, // ✅ নতুন
  guarantorMother: { type: String }, // ✅ নতুন
  guarantorAddress: { type: String }, // ✅ নতুন
  guarantorNid: { type: String },     // ✅ নতুন
  guarantorMobile: { type: String },  // ✅ নতুন
  guarantor: { type: String },

  // নোমিনীর তথ্য
  nomineeName: { type: String },
  nomineeFather: { type: String },
  nomineeMobile: { type: String },
  nomineeRelation: { type: String },
  nomineeNidNumber: { type: String },

  password: { type: String },
  status: { type: String, default: "active" },
  createdAt: { type: Date, default: Date.now },

  // ছবি সংক্রান্ত তথ্য
  memberImage: { type: String },
  nomineeImage: { type: String },
  nidFront: { type: String },
  nidBack: { type: String },
  nomineeNidFront: { type: String },
  nomineeNidBack: { type: String },

  // অ্যাক্সেস লিস্ট (agent এর জন্য)
  agentAccessList: {
    type: [String],
    default: [
      "member-list",
      "all-loans",
      "fdr-calculator",
      "fdr-management",
      "dps-calculator",
      "all-dps-schemes",
      "dps-member-report"
    ],
  },
});



const Member = mongoose.model("Member", memberSchema);

/* ===================================================
   =============== Loan Schema =======================
   =================================================== */


const loanSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true }, // MongoDB relation
  memberId: { type: String, required: true }, // Member এর customId কপি করে রাখবো
name: { type: String, required: true },
  initialLoanAmount: { type: Number, required: true },
  totalLoan: { type: Number, required: true },
  dividend: { type: Number, required: true },
  dividendType: { type: String, required: true },
  installmentType: { type: String, required: true },
  installments: { type: Number, required: true },
  installmentAmount: { type: Number, required: true },
  description: { type: String },
  sendSMS: { type: Boolean, default: false },
  loanDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  collections: [
    {
      amount: { type: Number, required: true },
      description: { type: String },
      collectionDate: { type: Date, default: Date.now },
      sendSMS: { type: Boolean, default: false },
    }
  ]
});


const Loan = mongoose.model("Loan", loanSchema);


// 🔹 SMS পাঠানোর ফাংশন
async function sendSms(phone, message) {
  try {
    const url = `https://sms.mszahid.com/services/send.php?key=${process.env.SMS_API_KEY}&number=${phone}&message=${encodeURIComponent(message)}&option=2&type=sms&useRandomDevice=1&prioritize=0`;

    const res = await axios.get(url);
    console.log("SMS API Response:", res.data);

    if (res.data?.success) {
      return { success: true, response: res.data };
    } else {
      return { success: false, error: res.data?.error?.message || "Unknown error" };
    }
  } catch (err) {
    console.error("❌ SMS send error:", err.message);
    return { success: false, error: err.message };
  }
}



// Login Route (no password hashing, simple check)
app.post("/api/login", async (req, res) => {
  const { mobileNumber, password } = req.body;

  try {
    // ডাটাবেজে ইউজার খোঁজা
    const user = await Member.findOne({ mobileNumber, password });

    if (!user) {
      return res.status(401).json({ message: "❌ ভুল মোবাইল নাম্বার বা পাসওয়ার্ড!" });
    }

    // Simple success response (no JWT)
    res.json({
      success: true,
      message: "✅ লগইন সফল হয়েছে!",
      user: {
        img:user.memberImage,
        _id: user.memberId,
        name: user.name,
        role: user.role,
        mobileNumber: user.mobileNumber,
        agentAccessList: user.agentAccessList
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});




/* ===================================================
   =============== Member API ========================
   =================================================== */
// POST Member Create
app.post("/api/members", async (req, res) => {
  try {
    const data = req.body;
    

    // agent হলে কিছু field remove বা ignore করতে পারো
    if (data.role === "agent") {
      data.guarantor = undefined;
      data.nomineeName = undefined;
      data.nomineeMobile = undefined;
      data.nomineeRelation = undefined;
      data.nomineeImage = undefined;
      data.nomineeNidFront = undefined;
      data.nomineeNidBack = undefined;
      data.guarantorName = undefined;
      data.guarantorFather = undefined;
      data.guarantorMother = undefined;
      data.guarantorAddress = undefined;
      data.guarantorNid = undefined;
      data.guarantorMobile = undefined;
      data.guarantor = undefined;
    }

    const member = new Member(data);
    const result = await member.save();
    res.json({ message: "Member Created", member: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server Error" });
  }
});


//  routes/members.js for create last member id create
app.get("/api/members/last", async (req, res) => {
  try {
    const lastMember = await Member.findOne().sort({ createdAt: -1 });
    res.json({ lastMemberId: lastMember ? lastMember.memberId : "0000" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// for update data
app.put("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // req.body থেকে সব ফিল্ড নিয়ে নাও
    const {
      name,
      motherName,           // ✅ নতুন
      mobileNumber,
      address,
      nidNumber,
      fatherOrHusband,
      guarantor,
      guarantorName,        // ✅ নতুন
      guarantorAddress,     // ✅ নতুন
      guarantorNid,         // ✅ নতুন
      guarantorMobile,      // ✅ নতুন
      nomineeName,
      nomineeFather,
      nomineeMobile,
      nomineeRelation,
      nomineeNidNumber,
      password,
      status,
    } = req.body;

    // Update all fields
    const updatedMember = await Member.findByIdAndUpdate(
      id,
      {
        name,
        motherName,           // ✅ নতুন
        mobileNumber,
        address,
        nidNumber,
        fatherOrHusband,
        guarantor,
        guarantorName,        // ✅ নতুন
        guarantorAddress,     // ✅ নতুন
        guarantorNid,         // ✅ নতুন
        guarantorMobile,      // ✅ নতুন
        nomineeName,
        nomineeFather,
        nomineeMobile,
        nomineeRelation,
        nomineeNidNumber,
        password,
        status,
      },
      { new: true } // updated document return করবে
    );

    if (!updatedMember) {
      return res.status(404).json({ message: "সদস্য পাওয়া যায়নি" });
    }

    res.json({ message: "সদস্য আপডেট হয়েছে", member: updatedMember });
  } catch (error) {
    console.error("Error updating member:", error);
    res.status(500).json({ message: "সার্ভার ত্রুটি!" });
  }
});




// GET All Members
app.get("/api/members", async (req, res) => {
  try {
    const members = await Member.find({ role: "member" }).sort({ createdAt: -1 });
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});
// GET All Agents OR Search by memberId/mobileNumber
app.get("/api/agent", async (req, res) => {
  try {
    const { search } = req.query;

    let query = { role: "agent" };

    // যদি search পাঠানো হয়, তাহলে filter করবো
    if (search) {
      query.$or = [
        { memberId: search },
        { mobileNumber: search },
      ];
    }

    const members = await Member.find(query).sort({ createdAt: -1 });
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// UPDATE agentAccessList by memberId
app.put("/api/agents/:memberId/access", async (req, res) => {
  try {
    const { memberId } = req.params;
    const { agentAccessList } = req.body;

    if (!agentAccessList) {
      return res.status(400).json({ message: "agentAccessList is required" });
    }

    // Update agentAccessList
    const updatedAgent = await Member.findOneAndUpdate(
      { memberId, role: "agent" },
      { agentAccessList },
      { new: true } // updated document return করবে
    );

    if (!updatedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json({
      message: "Access list updated successfully!",
      updatedAgent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET agent access by memberId
app.get("/api/agent/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const agent = await Member.findOne({ memberId, role: "agent" });

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json({ agentAccessList: agent.agentAccessList || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ Edit Agent
app.put("/api/agents-all/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedAgent = await Member.findOneAndUpdate(
      { _id: id, role: "agent" }, // role filter যোগ করা
      req.body,
      { new: true }
    );

    if (!updatedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json({ message: "Agent updated successfully", updatedAgent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Update failed", error });
  }
});


// ✅ Delete Agent
app.delete("/api/agents-all/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAgent = await Member.findOneAndDelete({
      _id: id,
      role: "agent",
    });

    if (!deletedAgent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete failed", error });
  }
});



/* ===================================================
   =============== Loan API ==========================
   =================================================== */
// POST Loan Create (Loan Form)
app.post("/api/loans", async (req, res) => {
  try {
    const {
      memberId,
      loanAmount,
      dividend,
      dividendType,
      installmentType,
      installments,
      description,
      sendSMS,
      date,
    } = req.body;

    // ✅ Member খুঁজে পাওয়া
    const member = await Member.findOne({ memberId });
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    const loanAmountNum = Number(loanAmount) || 0;
    const dividendNum = Number(dividend) || 0;
    const installmentsNum = Number(installments) || 0;

    // ✅ Total Loan হিসাব
    let totalLoan =
      dividendType === "%"
        ? loanAmountNum + (loanAmountNum * dividendNum) / 100
        : loanAmountNum + dividendNum;

    const installmentAmount = installmentsNum
      ? totalLoan / installmentsNum
      : 0;

    // ✅ Loan Date শুধু Date (BD timezone)
    const loanDate = date ? new Date(date) : new Date();
    const bdLoanDate = new Date(loanDate.toLocaleDateString("en-CA") + "T00:00:00");

    // ✅ Loan তৈরি
    const loanDoc = new Loan({
      member: member._id,
      memberId: member.memberId,
      name: member.name,
      initialLoanAmount: loanAmountNum,
      totalLoan,
      dividend: dividendNum,
      dividendType,
      installmentType,
      installments: installmentsNum,
      installmentAmount,
      description,
      sendSMS,
      loanDate: bdLoanDate, // BD date-only
      collections: [],
    });

    const result = await loanDoc.save();

    // ✅ SMS পাঠানো
    if (sendSMS && member.mobileNumber) {
      const message = `প্রিয় ${member.name}, আপনি আজ ${totalLoan} টাকা লোন গ্রহণ করেছেন। ধন্যবাদ আমাদের সেবা গ্রহণের জন্য।`;
      const smsResult = await sendSms(member.mobileNumber, message);
      console.log("✅ SMS Response:", smsResult);
    }

    res.status(201).json({
      success: true,
      message: "Loan created successfully",
      loan: result,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});




// get member by memberId
app.get("/api/members/:memberId", async (req, res) => {
  try {
    const member = await Member.findOne({ memberId: req.params.memberId });
    if (!member) return res.status(404).json({ error: "Member not found" });
    res.status(200).json(member);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch member" });
  }
});

// POST Loan Collection
app.post("/api/loans/collection", async (req, res) => {
  try {
    const { loanId, collectionAmount, description, sendSMS, date } = req.body;

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ error: "Loan not found" });

    const member = await Member.findOne({ memberId: loan.memberId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    // ✅ Update totalLoan
    loan.totalLoan = loan.totalLoan - Number(collectionAmount);
    if (loan.totalLoan < 0) loan.totalLoan = 0;

    // ✅ Collection Date শুধু Date (BD timezone)
   const clientDate = date ? new Date(date) : new Date(); // যদি date না আসে fallback
const bdDateStr = clientDate.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const bdCollectionDate = new Date(bdDateStr + "T00:00:00");


    loan.collections.push({
      amount: Number(collectionAmount),
      description,
      sendSMS,
      collectionDate: bdCollectionDate
    });

    await loan.save();

    // ✅ SMS পাঠানো
    if (sendSMS && member.mobileNumber) {
      const message = `প্রিয় ${member.name}, আপনি আজ ${collectionAmount} টাকা জমা দিয়েছেন। ধন্যবাদ আমাদের সেবা গ্রহণের জন্য।`;
      const smsResult = await sendSms(member.mobileNumber, message);
      console.log("✅ SMS Response:", smsResult);
    }

    res.json({
      message: "Collection saved and Loan updated",
      loan,
      currentDue: loan.totalLoan
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});





// GET All Loans (or filter by memberId)
app.get("/api/loans", async (req, res) => {
  try {
    const { memberId } = req.query;
    let query = {};
    if (memberId) {
      query.memberId = memberId; // এখানে String হিসেবে assign
    }

    const loans = await Loan.find(query).sort({ loanDate: -1 });
    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});
// get single loan by  id for loan receipt
app.get("/api/loans/:id", async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    res.status(200).json(loan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch loan" });
  }
});

// PATCH – partial update
app.patch("/api/loans/:id", async (req, res) => {
  try {
    const loanId = req.params.id;
    const updateData = req.body; // client থেকে আসা data

    const updatedLoan = await Loan.findByIdAndUpdate(loanId, updateData, {
      new: true, // update হওয়া data return করবে
    });

    if (!updatedLoan) return res.status(404).json({ message: "Loan not found" });

    res.json(updatedLoan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// 🔹 সকল লোন + মেম্বারের ডাটা নিয়ে আসা
app.get("/api/loans-with-members", async (req, res) => {
  try {
    // Loan এর সাথে Member populate করলাম
    const loans = await Loan.find().populate("member", "name mobileNumber memberId");

    // সব লোন থেকে data তৈরি
    const data = loans.flatMap((loan) => {
      // যদি collections না থাকে, তাও একটি default row রাখবে
      if (!loan.collections || loan.collections.length === 0) {
        return [{
          loanId: loan._id,
          memberId: loan.memberId,
          memberName: loan.member?.name,
          mobileNumber: loan.member?.mobileNumber,
          initialLoanAmount: loan.initialLoanAmount,
          totalLoan: loan.totalLoan,
          totalPaid: 0,
          due: loan.totalLoan,
          installments: loan.installments,
          installmentType: loan.installmentType,
          collectionDate: null,
          amount: 0,
        }];
      }

      // যদি collections থাকে, তাহলে প্রতিটি collection আলাদা row হবে
      return loan.collections.map((c) => {
        const totalPaid = loan.collections.reduce((sum, item) => sum + (item.amount || 0), 0);
        const due = loan.totalLoan - totalPaid;

        return {
          loanId: loan._id,
          memberId: loan.memberId,
          memberName: loan.member?.name,
          mobileNumber: loan.member?.mobileNumber,
          initialLoanAmount: loan.initialLoanAmount,
          totalLoan: loan.totalLoan,
          totalPaid,
          due,
          installments: loan.installments,
          installmentType: loan.installmentType,
          collectionDate: c.collectionDate,
          amount: c.amount,
        };
      });
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// PUT or PATCH route 
app.patch("/api/update-loan/:loanId", async (req, res) => {
  try {
    const { loanId } = req.params;
    const updateData = req.body;

    const updatedLoan = await Loan.findByIdAndUpdate(
      loanId,
      updateData,
      { new: true } // return updated document
    );

    res.json(updatedLoan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});



// Helper function: installment interval
function getIntervalDays(type) {
  switch (type) {
    case "দৈনিক": return 1;
    case "সাপ্তাহিক": return 7;
    case "পাক্ষিক": return 15;
    case "মাসিক": return 30;
    case "৬-মাসিক": return 180;
    default: return 0;
  }
}

// আজকের কিস্তি
app.get("/api/today-installments", async (req, res) => {
  try {
    // আজকের তারিখ BD timezone অনুযায়ী
    const now = new Date();
    const bdTodayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    const bdToday = new Date(bdTodayStr + "T00:00:00");

    const loans = await Loan.find().populate("member", "name mobileNumber memberId");

    const dueToday = [];

    loans.forEach((loan) => {
      const interval = getIntervalDays(loan.installmentType);
      if (!interval) return;

      // Loan date BD timezone অনুযায়ী
      const loanDateBDStr = new Date(loan.loanDate).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
      const bdLoanDate = new Date(loanDateBDStr + "T00:00:00");

      for (let i = 0; i < loan.installments; i++) {
        const instDate = new Date(bdLoanDate);
        instDate.setDate(bdLoanDate.getDate() + interval * i);

        // আজকের তারিখের সাথে compare
        if (instDate.getTime() === bdToday.getTime()) {
          dueToday.push({
            memberName: loan.member?.name,
            mobileNumber: loan.member?.mobileNumber,
            memberId: loan.memberId,
            loanId: loan._id,
            installmentAmount: Number(loan.installmentAmount).toFixed(2),
            installmentNo: i + 1,
            totalLoan: loan.totalLoan,
            date: instDate.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }),
            type: loan.installmentType,
          });
        }
      }
    });

    res.json(dueToday);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});




// সব কিস্তি (future + past) popup
app.get("/api/member-installments/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const loans = await Loan.find({ memberId }).lean();
    if (!loans.length) return res.json([]);

    let allInstallments = [];

    loans.forEach((loan) => {
      const { loanDate, installments, installmentAmount, installmentType, _id } = loan;
      const interval = getIntervalDays(installmentType);
      if (!interval) return;

      const startDate = new Date(loanDate);

      for (let i = 0; i < installments; i++) {
        const instDate = new Date(startDate);
        instDate.setDate(startDate.getDate() + interval * i);

        allInstallments.push({
          loanId: _id,
          memberId,
          installmentNo: i + 1,
          installmentAmount: Number(installmentAmount).toFixed(2),
          date: instDate.toISOString().split("T")[0],
          type: installmentType,
        });
      }
    });

    res.json(allInstallments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// utils function
function getIntervalDays(type) {
  switch (type) {
    case "দৈনিক": return 1;
    case "সাপ্তাহিক": return 7;
    case "পাক্ষিক": return 15;
    case "মাসিক": return 30;
    case "৬-মাসিক": return 180;
    default: return 0;
  }
}

// Overdue Installments API কিস্তির তারিখ মেয়াদ উত্তীর্ণ - সদস্য

app.get("/api/overdue-installments", async (req, res) => {
  try {
    const today = new Date();
    const bdToday = new Date(today.toLocaleDateString("en-CA") + "T00:00:00");

    const loans = await Loan.find().populate("member", "name mobileNumber memberId");

    const overdueList = [];

    // ✅ Date-only compare (BD)
    const isSameBDDate = (date1, date2) => {
      const d1 = new Date(date1.toLocaleDateString("en-CA") + "T00:00:00");
      const d2 = new Date(date2.toLocaleDateString("en-CA") + "T00:00:00");
      return d1.getTime() === d2.getTime();
    };

    loans.forEach((loan) => {
      const interval = getIntervalDays(loan.installmentType);
      if (!interval) return;

      const startDate = new Date(loan.loanDate);
      const bdStartDate = new Date(startDate.toLocaleDateString("en-CA") + "T00:00:00");

      for (let i = 0; i < loan.installments; i++) {
        const instDate = new Date(bdStartDate);
        instDate.setDate(bdStartDate.getDate() + interval * i);

        // শুধুমাত্র আজকের তারিখ পর্যন্ত
        if (instDate > bdToday) break;

        const isPaid = loan.collections.some(col =>
          isSameBDDate(new Date(col.collectionDate), instDate)
        );

        if (!isPaid) {
          overdueList.push({
            memberName: loan.member?.name,
            mobileNumber: loan.member?.mobileNumber,
            memberId: loan.memberId,
            loanId: loan._id,
            installmentNo: i + 1,
            installmentAmount: Number(loan.installmentAmount).toFixed(2),
            dueDate: instDate.toLocaleDateString("en-CA"),
            type: loan.installmentType,
          });
        }
      }
    });

    res.json(overdueList);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});





// 🔹 SMS পাঠানোর রাউট
// app.post("/api/send-loan-sms", async (req, res) => {
//   const { phone, message } = req.body;

//   if (!phone || !message) {
//     return res.status(400).json({ success: false, error: "Phone & message required" });
//   }

//   const result = await sendSms(phone, message);
  
//   if (result.success) {
//     res.json({ success: true, message: "SMS পাঠানো হয়েছে সফলভাবে ✅", response: result.response });
//   } else {
//     res.status(500).json({ success: false, error: "SMS পাঠানো ব্যর্থ হয়েছে!" });
//   }
// });


// 🔹 SMS পাঠানোর রাউট 
app.post("/api/send-loan-sms", async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res
      .status(400)
      .json({ success: false, error: "Phone & message required" });
  }

  const result = await sendSms(phone, message);

  if (result.success) {
    res.json({
      success: true,
      message: "SMS পাঠানো হয়েছে সফলভাবে ✅",
      response: result.response,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || "SMS পাঠানো ব্যর্থ হয়েছে!",
    });
  }
});



// 1️⃣ সব member + loan load করা, শুধু যাদের loan আছে for লোন বন্ধ করুন page
app.get("/api/close-loans", async (req, res) => {
  try {
    const members = await Member.find().lean();
    const loans = await Loan.find().lean();

    const data = members
      .map(member => {
        const memberLoans = loans.filter(loan => loan.memberId === member.memberId);

        if (memberLoans.length === 0) return null; // যদি loan না থাকে, skip

        let totalLoan = 0;
        let totalPaid = 0;

        memberLoans.forEach(loan => {
          totalLoan += loan.totalLoan;
          const paidAmount = loan.collections?.reduce((sum, c) => sum + c.amount, 0) || 0;
          totalPaid += paidAmount;
        });

        return {
          ...member,
          loans: memberLoans,
          totalLoan,
          totalPaid,
          dueAmount: totalLoan - totalPaid
        };
      })
      .filter(Boolean); // null remove করা

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// 2️⃣ Member এর loans fetch (বিস্তারিত)for লোন বন্ধ করুন page
app.get("/api/member-loans/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    const loans = await Loan.find({ memberId }).lean();
    res.json(loans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// 3️⃣ লোন বন্ধ করা (delete)for লোন বন্ধ করুন page
app.delete("/api/close-loan/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    await Loan.deleteMany({ memberId });
    res.json({ message: "Member loans closed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

//DPS scheme
const dpsSchemeSchema = new mongoose.Schema(
  {
    schemeName: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    monthlyAmount: { type: Number, required: true },
    dpsType: { type: String, enum: ["লাভ", "লাভ বিহীন"], required: true },
    interestRate: { type: Number, default: 0 },
    targetAmount: { type: Number, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const DpsScheme = mongoose.model("DpsScheme", dpsSchemeSchema);

// === Create DPS Scheme ===
app.post("/api/dps-schemes", async (req, res) => {
  try {
    let {
      schemeName,
      durationMonths,
      monthlyAmount,
      dpsType,
      interestRate,
      targetAmount,
      status,
    } = req.body;

    // যদি লাভ বিহীন হয়, interestRate জিরো করে দাও
    if (dpsType === "লাভ বিহীন") {
      interestRate = 0;
    }

    // টার্গেট টাকা পুনরায় ক্যালকুলেট
    let baseAmount = durationMonths * monthlyAmount;
    let totalAmount =
      dpsType === "লাভ" && interestRate > 0
        ? baseAmount + (baseAmount * interestRate) / 100
        : baseAmount;

    // নাম যদি frontend থেকে না আসে, server নিজেই বানাবে
    if (!schemeName) {
      const durationText =
        durationMonths >= 12
          ? `${durationMonths / 12} বছর`
          : `${durationMonths} মাস`;
      schemeName = `${durationText} স্কিম - মাসিক ${monthlyAmount} টাকা - ${dpsType} - ${interestRate}% লাভ`;
    }

    const newScheme = new DpsScheme({
      schemeName,
      durationMonths,
      monthlyAmount,
      dpsType,
      interestRate,
      targetAmount: Math.round(totalAmount),
      status,
    });

    const savedScheme = await newScheme.save();
    res.status(201).json(savedScheme);
  } catch (err) {
    console.error("Error creating DPS scheme:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get all DPS Schemes
app.get("/api/dps-schemes", async (req, res) => {
  try {
    const schemes = await DpsScheme.find().sort({ createdAt: -1 }); // নতুনগুলো আগে দেখাবে
    res.json(schemes);
  } catch (err) {
    console.error("Error fetching DPS schemes:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

//DPS setting scheme
const dpsSettingSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  startDate: { type: Date, required: true },
  memberId: { type: String, required: true }, // অথবা ObjectId, যদি members collection ref করতে চাও
  schemeId: { type: mongoose.Schema.Types.ObjectId, ref: "DpsScheme", required: true },
  durationMonths: Number,
  monthlyAmount: Number,
  interestRate: Number,
  targetAmount: Number,
  description: String,
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  
  // নতুন অংশ: collections array
  collections: [
    {
      date: { type: Date, required: true },
      collectedAmount: { type: Number, required: true },
      description: String,
      smsSent: { type: Boolean, default: false },
      balance: Number,
    }
  ]
}, { timestamps: true });



const DpsSetting = mongoose.model("DpsSetting", dpsSettingSchema);

// Create DPS setting for DPS স্কিম সেটিং করুন page
app.post("/api/dps-settings", async (req, res) => {
  try {
    const { date, startDate, memberId, schemeId, description, status } = req.body;

    // Get scheme details to autofill
    const scheme = await DpsScheme.findById(schemeId);
    if (!scheme) return res.status(404).json({ message: "Scheme not found" });

    const newSetting = new DpsSetting({
      date,
      startDate,
      memberId,
      schemeId,
      durationMonths: scheme.durationMonths,
      monthlyAmount: scheme.monthlyAmount,
      interestRate: scheme.interestRate,
      targetAmount: scheme.targetAmount,
      description,
      status,
    });

    const savedSetting = await newSetting.save();
    res.status(201).json(savedSetting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


// GET DPS settings by memberId for DPS collection page
app.get("/api/member-dps-settings/:memberId", async (req, res) => {
  try {
    // Member এর সব active DPS settings নিয়ে আসা
    const settings = await DpsSetting.find({ 
      memberId: req.params.memberId,
      status: "active"
    }).populate("schemeId"); // scheme এর পুরো object include

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// POST DPS collection and push to collections array
app.post("/api/dps-allcollections", async (req, res) => {
  try {
    const { date, memberId, schemeId, collectedAmount, description, smsSent, balance } = req.body;

    // ✅ সদস্য খুঁজে বের করা
    const member = await Member.findOne({ memberId });
    if (!member) return res.status(404).json({ message: "Member not found" });

    // ✅ নির্দিষ্ট member & scheme এর DPS setting খুঁজে বের করা
    const setting = await DpsSetting.findOne({ memberId, schemeId });
    if (!setting) return res.status(404).json({ message: "DPS setting not found" });

    // ✅ নতুন collection push করা
    setting.collections.push({
      date: new Date(date),
      collectedAmount,
      description,
      smsSent: smsSent || false,
      balance: balance || 0,
    });

    // ✅ আপডেট করা setting save করা
    const savedSetting = await setting.save();

    // ✅ SMS পাঠানো হবে কি না চেক করো
    if (smsSent && member.mobileNumber) {
      const message = `প্রিয় ${member.name}, আপনার DPS স্কীম "${setting.schemeId.schemeName}" এ ${collectedAmount} টাকা জমা হয়েছে। ধন্যবাদ আমাদের সাথে থাকার জন্য।`;

      try {
        const smsResult = await sendSms(member.mobileNumber, message);
        console.log("✅ SMS Response:", smsResult);
      } catch (smsErr) {
        console.error("❌ SMS Error:", smsErr);
      }
    }

    res.status(201).json(savedSetting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});



// GET schemes with matching dpssettings and member info for সকল DPS কালেকশন page
app.get("/api/dps-schemes-with-members", async (req, res) => {
  try {
    // 1) সকল active/available schemes নাও (চাইলে filter যোগ করতে পারো)
    const schemes = await DpsScheme.find({ status: { $ne: "inactive" } }).lean();

    // 2) প্রতিটি scheme-এর জন্য matching dpssettings নিয়ে আসবে
    const result = [];
    for (const scheme of schemes) {
      // scheme._id is ObjectId
      const settings = await DpsSetting.find({ schemeId: scheme._id, status: "active" }).lean();

      // 3) প্রতিটি setting-এর সাথে member info attach করো
      // (তুমি memberId string রেখে থাকলে members.collection এ memberId ফিল্ড দিয়ে খুঁজে নাও)
      const enrichedSettings = await Promise.all(
        settings.map(async (s) => {
          // try to find member by memberId field first (string)
          let member = null;
          if (s.memberId) {
            // members collection seems to store memberId as string (like "21123333")
            member = await Member.findOne({ memberId: s.memberId }).select("name memberId mobileNumber _id").lean();
            // If nothing found and memberId looks like ObjectId, try match by _id
            if (!member) {
              const mongoose = require("mongoose");
              if (mongoose.Types.ObjectId.isValid(s.memberId)) {
                member = await Member.findById(s.memberId).select("name memberId mobileNumber _id").lean();
              }
            }
          }

          return {
            ...s,
            member: member || null, // null হলে front-end এ handle করবে
          };
        })
      );

      result.push({
        scheme,
        settings: enrichedSettings,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Error in /api/dps-schemes-with-members:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// =====================
// 📘 DPS ব্যবস্থাপনা API
// =====================
app.get("/api/dps-management", async (req, res) => {
  try {
    // const DpsScheme = require("./models/DpsScheme");
    // const DpsSetting = require("./models/DpsSetting");

    // সব স্কিম বের করো
    const schemes = await DpsScheme.find().lean();

    // প্রতিটা স্কিম অনুযায়ী তথ্য তৈরি করো
    const result = await Promise.all(
      schemes.map(async (scheme) => {
        // এই স্কিমের অধীনে কতজন সদস্য আছে সেটা বের করো
        const settings = await DpsSetting.find({ schemeId: scheme._id }).lean();
        const totalMembers = settings.length;

        return {
          _id: scheme._id,
          schemeName: scheme.schemeName,
          startDate: scheme.createdAt,
          durationMonths: scheme.durationMonths,
          monthlyAmount: scheme.monthlyAmount,
          targetAmount: scheme.targetAmount,
          interestRate: scheme.interestRate,
          totalMembers,
          status: scheme.status || "active",
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching DPS management:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// =====================
// 📕 নির্দিষ্ট DPS স্কিম মুছে ফেলতে (DPS বন্ধ করুন) for DPS ব্যবস্থাপনা
// =====================
app.delete("/api/dps-management/:schemeId", async (req, res) => {
  try {
    // const DpsScheme = require("./models/DpsScheme");
    const { schemeId } = req.params;

    const deleted = await DpsScheme.findByIdAndDelete(schemeId);

    if (!deleted) {
      return res.status(404).json({ message: "DPS Scheme not found" });
    }

    res.json({ message: "DPS স্কিম সফলভাবে বন্ধ করা হয়েছে!" });
  } catch (err) {
    console.error("Error deleting DPS scheme:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

//আজকের কিস্তি জমা দেওয়ার date page
app.get("/api/todays-dps", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const settings = await DpsSetting.find({ status: "active" })
      .populate("schemeId")
      .lean();

    const result = [];

    for (const s of settings) {
      if (!s.startDate) continue;

      const start = new Date(s.startDate);
      start.setHours(0, 0, 0, 0);

      const monthsPassed =
        (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());

      const nextInstallmentDate = new Date(start);
      nextInstallmentDate.setMonth(start.getMonth() + monthsPassed);

      // safer date comparison
      if (
        nextInstallmentDate.getFullYear() === today.getFullYear() &&
        nextInstallmentDate.getMonth() === today.getMonth() &&
        nextInstallmentDate.getDate() === today.getDate()
      ) {
        const member = await Member.findOne({ memberId: s.memberId }).lean();
        if (!member) continue;

        result.push({
          memberName: member.name,
          memberPhone: member.phone,
          schemeName: s.schemeId.schemeName,
          monthlyAmount: s.monthlyAmount,
          startDate: s.startDate,
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


//দৈনিক DPS কালেকশন রিপোর্ট
app.get("/api/daily-dps-report", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // শুধু date check

    const settings = await DpsSetting.find({ status: "active" })
      .populate("schemeId") // DPS scheme info
      .lean();

    const result = [];

    for (const s of settings) {
      if (!s.collections || s.collections.length === 0) continue;

      // আজকের কিস্তি filter
      const todaysCollections = s.collections.filter((c) => {
        const colDate = new Date(c.date || c.createdAt);
        colDate.setHours(0, 0, 0, 0);
        return colDate.getTime() === today.getTime();
      });

      if (todaysCollections.length === 0) continue;

      // member info
      // Member collection এ id string
const member = await Member.findOne({ memberId: s.memberId }).lean();

      if (!member) continue;

      // প্রতিটি collection object map
      todaysCollections.forEach((c) => {
        result.push({
          memberName: member.name,
          memberPhone: member.mobileNumber,
          schemeName: s.schemeId.schemeName,
          collectedAmount: c.collectedAmount,
          collectionDate: c.date || c.createdAt,
        });
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// ✅ সকল DPS সদস্যের লেনদেন রিপোর্ট page
app.get("/api/dps-report", async (req, res) => {
  try {
    const dpsList = await DpsSetting.find();

    const reportData = [];

    for (const dps of dpsList) {
      const member = await Member.findOne({ memberId: dps.memberId });
      const scheme = await DpsScheme.findById(dps.schemeId);

      if (!member) continue;

      const totalInstallments = dps.collections?.length || 0;
      const totalAmount = dps.collections?.reduce(
        (sum, c) => sum + (c.collectedAmount || c.amount || 0),
        0
      );

      reportData.push({
        memberId: dps.memberId,
        memberName: member.name,
        phone: member.mobileNumber,
        schemeName: scheme ? scheme.schemeName : "N/A",
        monthlyAmount: dps.monthlyAmount,
        totalInstallments,
        totalAmount,
        collections: dps.collections || [], // ✅ এই লাইনটা গুরুত্বপূর্ণ
      });
    }

    res.json(reportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error occurred" });
  }
});





// FDR section
const fdrSchemeSchema = new mongoose.Schema({
  schemeName: { type: String, required: true },
  schemeType: { type: String, enum: ["Fixed লাভ", "মাসিক Fixed লাভ"], required: true },
  duration: { type: Number, required: true }, // months
  interestValue: { type: Number, default: 0 },
  interestType: { type: String, enum: ["%", "৳"], default: "%" },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true });

const FdrScheme = mongoose.model("FdrScheme", fdrSchemeSchema);

//FDR স্কিম তৈরি করুন page 
app.post("/api/fdr-schemes", async (req, res) => {
  try {
    const { schemeName, schemeType, duration, interestValue, interestType, startDate, status } = req.body;

    const newScheme = new FdrScheme({
      schemeName,
      schemeType,
      duration,
      interestValue,
      interestType,
      startDate: startDate ? new Date(startDate) : new Date(),
      status,
    });

    await newScheme.save();
    res.status(201).json({ message: "FDR স্কিম সফলভাবে তৈরি হয়েছে!", scheme: newScheme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "FDR স্কিম তৈরি করতে সমস্যা হয়েছে" });
  }
});


const fdrSettingSchema = new mongoose.Schema({
  memberId: String,
  schemeId: mongoose.Schema.Types.ObjectId,
  collectionDate: Date,
  effectiveDate: Date,
  duration: Number,
  interestValue: Number,
  interestType: String,
  fdrAmount: Number,
  description: String,
  status: String,
  sendSMS: Boolean,
  createdAt: { type: Date, default: Date.now },
});

const FdrSetting = mongoose.model("FdrSetting", fdrSettingSchema);
//FDR সেটিং এবং কালেকশন page er jonno get
app.get("/api/fdr-options", async (req, res) => {
  try {
    const members = await Member.find({ role: "member" });
    const schemes = await FdrScheme.find();
    res.json({ members, schemes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
//FDR সেটিং এবং কালেকশন page
app.post("/api/fdr-settings", async (req, res) => {
  try {
    const {
      memberId,
      schemeId,
      collectionDate,
      effectiveDate,
      fdrAmount,
      description,
      status,
      sendSMS,
    } = req.body;

    const scheme = await FdrScheme.findById(schemeId);
    if (!scheme) return res.status(400).json({ message: "Invalid scheme selected" });

     const member = await Member.findOne({ memberId });
    if (!member) return res.status(404).json({ message: "Member not found" });


    const newFdr = new FdrSetting({
      memberId,
      schemeId,
      collectionDate,
      effectiveDate,
      duration: scheme.duration,
      interestValue: scheme.interestValue,
      interestType: scheme.interestType,
      fdrAmount,
      description,
      status,
      sendSMS,
    });

    await newFdr.save();


     // ✅ SMS পাঠানো হবে কি না চেক করো
    if (sendSMS && member.mobileNumber) {
      const message = `প্রিয় ${member.name}, আপনি ${fdrAmount} টাকা মূল্যের একটি FDR খুলেছেন। ধন্যবাদ আমাদের সাথে থাকার জন্য।`;
      
      try {
        const smsResult = await sendSms(member.mobileNumber, message);
        console.log("✅ SMS Response:", smsResult);
      } catch (smsErr) {
        console.error("❌ SMS Error:", smsErr);
      }
    }
  

    res.json({ message: "FDR সেটিং সফলভাবে যোগ করা হয়েছে!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//সকল FDR কালেকশন page
app.get("/api/fdr-collections", async (req, res) => {
  try {
    const fdrSettings = await FdrSetting.find();

    const reportData = [];

    for (const fdr of fdrSettings) {
      const scheme = await FdrScheme.findById(fdr.schemeId);
      const member = await Member.findOne({ memberId: fdr.memberId });

      if (!scheme || !member) continue;

      reportData.push({
        fdrId: fdr._id,
        memberName: member.name,
        memberPhone: member.mobileNumber,
        schemeName: scheme.schemeName,
        schemeType: scheme.schemeType,
        duration: fdr.duration,
        interestValue: fdr.interestValue,
        interestType: fdr.interestType,
        fdrAmount: fdr.fdrAmount,
        collectionDate: fdr.collectionDate,
        effectiveDate: fdr.effectiveDate,
        status: fdr.status,
        description: fdr.description,
        sendSMS: fdr.sendSMS,
      });
    }

    // 🔹 লাস্ট এন্ট্রি আগে দেখানোর জন্য
    res.json(reportData.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error occurred" });
  }
});



// সকল FDR settings + member + scheme data fetch for FDR ব্যবস্থাপনা page
app.get("/api/fdr-management", async (req, res) => {
  try {
    const fdrSettings = await FdrSetting.find();

    const reportData = [];

    for (const fdr of fdrSettings) {
      const member = await Member.findOne({ memberId: fdr.memberId });
      const scheme = await FdrScheme.findById(fdr.schemeId);

      if (!member || !scheme) continue;

      reportData.push({
        fdrId: fdr._id,
        memberId: member.memberId,
        memberName: member.name,
        phone: member.mobileNumber,
        schemeId: scheme._id,
        schemeName: scheme.schemeName,
        schemeType: scheme.schemeType,
        fdrAmount: fdr.fdrAmount,
        interestValue: scheme.interestValue,
        interestType: scheme.interestType,
        duration: scheme.duration,
        effectiveDate: fdr.effectiveDate,
        collectionDate: fdr.collectionDate,
        status: fdr.status,
        smsSent: fdr.smsSent || false,
        description: fdr.description || "",
      });
    }

    res.json(reportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error occurred" });
  }
});

// Delete FDR for FDR ব্যবস্থাপনা page
app.delete("/api/fdr-management/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await FdrSetting.findByIdAndDelete(id);
    res.json({ message: "FDR ডিলিট করা হয়েছে।" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "ডিলিট করতে সমস্যা হয়েছে!" });
  }
});

// Update/Edit FDR for FDR ব্যবস্থাপনা page
app.put("/api/fdr-management/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    await FdrSetting.findByIdAndUpdate(id, updatedData);
    res.json({ message: "FDR আপডেট করা হয়েছে।" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "আপডেট করতে সমস্যা হয়েছে!" });
  }
});

// Withdraw amount (partial withdrawal) for FDR ব্যবস্থাপনা page
app.post("/api/fdr-management/withdraw/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const fdr = await FdrSetting.findById(id);
    if (!fdr) return res.status(404).json({ message: "FDR পাওয়া যায়নি।" });

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) return res.status(400).json({ message: "সঠিক টাকা দিন।" });

    // Withdraw
    fdr.fdrAmount -= withdrawAmount;

    if (fdr.fdrAmount < 0) fdr.fdrAmount = 0; // সম্পূর্ণ Withdraw হলে 0 হবে

    await fdr.save();

    res.json({ message: "টাকা উত্তোলন সম্পন্ন হয়েছে।", remainingAmount: fdr.fdrAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "উত্তোলন করতে সমস্যা হয়েছে!" });
  }
});


// GET /api/fdr-daily-report?date=YYYY-MM-DD for FDR কালেকশন রিপোর্ট page
// দৈনিক FDR কালেকশন রিপোর্ট
app.get("/api/fdr-daily-report", async (req, res) => {
  try {
    // ইউজার যদি ?date=2025-10-06 না পাঠায়, তাহলে আজকের তারিখ নেবে
    const today = new Date().toISOString().slice(0, 10);
    const queryDate = req.query.date || today;

    // ওই তারিখের সব FDR খোঁজা
    const fdrList = await FdrSetting.find({ collectionDate: queryDate });

    if (fdrList.length === 0) {
      return res.status(200).json({
        message: "এই তারিখে কোনো FDR কালেকশন পাওয়া যায়নি।",
        data: [],
      });
    }

    const report = [];

    for (const fdr of fdrList) {
      const member = await Member.findOne({ memberId: fdr.memberId });
      const scheme = await FdrScheme.findById(fdr.schemeId);

      if (!member || !scheme) continue;

      report.push({
        memberName: member.name,
        phone: member.mobileNumber,
        schemeName: scheme.schemeName,
        schemeType: scheme.schemeType,
        fdrAmount: fdr.fdrAmount,
        interestValue: scheme.interestValue,
        interestType: scheme.interestType,
        duration: scheme.duration,
        effectiveDate: fdr.effectiveDate,
        collectionDate: fdr.collectionDate,
        status: fdr.status,
      });
    }

    res.status(200).json({
      message: `${queryDate} তারিখের রিপোর্ট`,
      data: report,
    });
  } catch (err) {
    console.error("FDR Report Error:", err);
    res.status(500).json({ message: "রিপোর্ট আনতে সমস্যা হয়েছে!" });
  }
});


//FDR জমা এবং উত্তোলন রিপোর্ট
app.get("/api/fdr-transaction-report", async (req, res) => {
  try {
    const { type, date } = req.query;
    const filter = {};

    // Filter by type
    if (type === "deposit") filter.status = "active";
    else if (type === "withdraw") filter.status = "withdrawn";

    // Filter by date (optional)
    if (date) filter.collectionDate = date;

    const fdrList = await FdrSetting.find(filter);

    const report = [];

    for (const fdr of fdrList) {
      const member = await Member.findOne({ memberId: fdr.memberId });
      const scheme = await FdrScheme.findById(fdr.schemeId);
      if (!member || !scheme) continue;

      report.push({
        type: fdr.status === "active" ? "জমা" : "উত্তোলন",
        memberName: member.name,
        phone: member.mobileNumber,
        schemeName: scheme.schemeName,
        duration: scheme.duration,
        interestValue: scheme.interestValue,
        fdrAmount: fdr.fdrAmount,
        collectionDate: fdr.collectionDate,
        effectiveDate: fdr.effectiveDate,
        status: fdr.status,
      });
    }

    res.json({ success: true, data: report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "রিপোর্ট আনতে সমস্যা হয়েছে!" });
  }
});


//অন্যান্য আয়-ব্যয়ের খাত schem
const otherIncomeExpenseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // খাতের নাম
  totalDeposit: { type: Number, default: 0 }, // মোট জমা
  totalExpense: { type: Number, default: 0 }, // মোট খরচ
  transactions: [
    {
      type: { type: String, enum: ["deposit", "expense"], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      note: { type: String },
    },
  ],
}, { timestamps: true });

const OtherIncomeExpense = mongoose.model("OtherIncomeExpense", otherIncomeExpenseSchema);


// নতুন খাত তৈরি for অন্যান্য আয়-ব্যয়ের খাত page
app.post("/api/other-income-expense", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "খাতের নাম প্রয়োজন" });

    const existing = await OtherIncomeExpense.findOne({ name });
    if (existing) return res.status(400).json({ message: "এই খাত ইতিমধ্যেই আছে" });

    const newCategory = await OtherIncomeExpense.create({ name });
    res.json({ success: true, data: newCategory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// সব খাতের লিস্ট for অন্যান্য আয়-ব্যয়ের খাত page
app.get("/api/other-income-expense", async (req, res) => {
  try {
    const list = await OtherIncomeExpense.find().lean();
    res.json({ success: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// টাকা জমা বা খরচ যোগ করা for অন্যান্য আয়-ব্যয়ের খাত page
app.post("/api/other-income-expense/:id/transaction", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, note } = req.body;

    if (!["deposit", "expense"].includes(type)) return res.status(400).json({ message: "Invalid type" });

    const category = await OtherIncomeExpense.findById(id);
    if (!category) return res.status(404).json({ message: "খাত পাওয়া যায়নি" });

    // Transaction add
    category.transactions.push({ type, amount, note });

    // Update totals
    if (type === "deposit") category.totalDeposit += amount;
    else if (type === "expense") category.totalExpense += amount;

    await category.save();
    res.json({ success: true, data: category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


//খরচের খাত ব্যবস্থাপনা page
const expenseCategorySchema = new mongoose.Schema({
  categoryName: { type: String, required: true },
  totalExpense: { type: Number, default: 0 },
  transactions: [
    {
      amount: Number,
      date: { type: Date, default: Date.now },
      note: String,
    },
  ],
});

const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);

//খরচের খাত ব্যবস্থাপনা page
app.post("/api/expense-category", async (req, res) => {
  try {
    const { categoryName } = req.body;
    const newCategory = new ExpenseCategory({ categoryName });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ সব খাত পাওয়া
app.get("/api/expense-category", async (req, res) => {
  const data = await ExpenseCategory.find();
  res.json(data);
});

// ✅ টাকা প্রদান (নতুন লেনদেন)
app.post("/api/expense-category/:id/add-expense", async (req, res) => {
  try {
    const { amount, note } = req.body;
    const category = await ExpenseCategory.findById(req.params.id);

    const transaction = { amount, note, date: new Date() };
    category.transactions.push(transaction);
    category.totalExpense += Number(amount);

    await category.save();
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ বিস্তারিত দেখা
// app.get("/:id", async (req, res) => {
//   const category = await ExpenseCategory.findById(req.params.id);
//   res.json(category);
// });


//হিসাব শুরুর ক্যাশ টাকা segment
const initialCashSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  description: { type: String, default: "" },
});

const InitialCash = mongoose.model("InitialCash", initialCashSchema);

// ✅ হিসাব শুরুর ক্যাশ টাকা যোগ করা বা আপডেট করা
app.post("/api/initial-cash", async (req, res) => {
  try {
    const { amount, description } = req.body;
    let cash = await InitialCash.findOne();

    if (cash) {
      // Update existing
      cash.amount = amount;
      cash.description = description;
      cash.date = new Date();
      await cash.save();
      return res.json(cash);
    } else {
      // Create new
      const newCash = new InitialCash({ amount, description });
      await newCash.save();
      res.status(201).json(newCash);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ হিসাব শুরুর ক্যাশ টাকা পাওয়া
app.get("/api/initial-cash", async (req, res) => {
  try {
    const cash = await InitialCash.findOne();
    res.json(cash);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ দৈনিক কালেকশন রিপোর্ট API with date range filter
app.get("/api/daily-collection", async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    let startOfDay, endOfDay;

    if (startDate && endDate) {
      // user defined date range
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);

      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
    } else {
      // default: আজকের date
      const today = new Date();
      startOfDay = new Date(today.setHours(0, 0, 0, 0));
      endOfDay = new Date(today.setHours(23, 59, 59, 999));
    }

    // DPS collection
    const dpsData = await DpsSetting.aggregate([
      { $unwind: "$collections" },
      {
        $match: {
          "collections.date": { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $project: {
          _id: 1,
          memberId: 1,
          schemeId: 1,
          collectedAmount: "$collections.collectedAmount",
          description: "$collections.description",
          date: "$collections.date",
          type: { $literal: "DPS" },
        },
      },
    ]);

    // FDR collection
    const fdrData = await FdrSetting.find({
      collectionDate: { $gte: startOfDay, $lte: endOfDay },
    }).select("memberId schemeId fdrAmount description collectionDate").lean();

    const fdrFormatted = fdrData.map((fdr) => ({
      _id: fdr._id,
      memberId: fdr.memberId,
      schemeId: fdr.schemeId,
      collectedAmount: fdr.fdrAmount,
      description: fdr.description,
      date: fdr.collectionDate,
      type: "FDR",
    }));

    // Loan collection
    const loanData = await Loan.aggregate([
      { $unwind: "$collections" },
      {
        $match: {
          "collections.collectionDate": { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $project: {
          _id: 1,
          memberId: 1,
          name: 1,
          collectedAmount: "$collections.amount",
          description: "$collections.description",
          date: "$collections.collectionDate",
          type: { $literal: "Loan" },
        },
      },
    ]);

    const allCollections = [...dpsData, ...fdrFormatted, ...loanData];

    // তারিখ অনুযায়ী sort
    allCollections.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(allCollections);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});



//দৈনিক লেনদেন রিপোর্ট page
app.get("/api/daily-transaction-report", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // মোট লোন কালেকশন (collections array থেকে)
const totalLoanCollection = await Loan.aggregate([
  { $unwind: "$collections" }, // collections array ফাটিয়ে আলাদা document বানাবে
  {
    $match: {
      "collections.collectionDate": { $gte: todayStart, $lte: todayEnd },
    },
  },
  { $group: { _id: null, total: { $sum: "$collections.amount" } } },
]);

// মোট লোন প্রদান (initialLoanAmount বা অন্য যেটা ডিফল্ট দেওয়া হয়)
const totalLoanDisbursed = await Loan.aggregate([
  {
    $match: {
      loanDate: { $gte: todayStart, $lte: todayEnd },
    },
  },
  { $group: { _id: null, total: { $sum: "$initialLoanAmount" } } },
]);



    // মোট এফ.ডি.আর কালেকশন
    const totalFDRCollection = await FdrScheme.aggregate([
      {
        $match: {
          type: "deposit", // তোমার ডাটাতে যদি অন্য নাম থাকে যেমন "open" সেটাও দিতে পারো
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // মোট এফ.ডি.আর উত্তোলন
    const totalFDRWithdraw = await FdrScheme.aggregate([
      {
        $match: {
          type: "withdraw", // যদি withdrawal ফিল্ড থাকে
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // মোট এফ.ডি.আর লাভ উত্তোলন
    const totalFDRProfitWithdraw = await FdrSetting.aggregate([
      {
        $match: {
          type: "profitWithdraw",
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // মোট ডি.পি.এস কালেকশন
   const totalDPSCollectionAgg = await DpsSetting.aggregate([
  { $unwind: "$collections" }, // collections array খুলে দিবে
  { $match: { "collections.date": { $gte: todayStart, $lte: todayEnd } } }, // আজকের collection
  { $group: { _id: null, total: { $sum: "$collections.collectedAmount" } } }, // sum
]);
const totalDPSCollection = totalDPSCollectionAgg[0]?.total || 0;

// যদি DPS-এর উত্তোলন থাকত, এবং collections array এ type="withdraw" থাকে
// এখন যদি আলাদা collection/withdraw তবে:
const totalDPSWithdrawAgg = await DpsSetting.aggregate([
  { $unwind: "$collections" },
  { $match: { "collections.type": "withdraw", "collections.date": { $gte: todayStart, $lte: todayEnd } } },
  { $group: { _id: null, total: { $sum: "$collections.amount" } } },
]);

    // মোট ক্যাশ হতে ব্যাংকে জমা
    const totalCashToBank = await InitialCash.aggregate([
      {
        $match: {
          type: "bankDeposit",
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // অন্যান্য আয়/ব্যয়
    const otherIncome = await OtherIncomeExpense.aggregate([
      {
        $match: {
          type: "income",
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const otherExpense = await OtherIncomeExpense.aggregate([
      {
        $match: {
          type: "expense",
          date: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ফাইনাল রেসপন্স
    res.json({
      totalLoanCollection: totalLoanCollection[0]?.total || 0,
      totalLoanDisbursed: totalLoanDisbursed[0]?.total || 0,
      totalFDRCollection: totalFDRCollection[0]?.total || 0,
      totalFDRWithdraw: totalFDRWithdraw[0]?.total || 0,
      totalFDRProfitWithdraw: totalFDRProfitWithdraw[0]?.total || 0,
      totalDPSCollection: totalDPSCollection[0]?.total || 0,
      totalDPSWithdraw: totalDPSWithdrawAgg[0]?.total || 0,
      totalCashToBank: totalCashToBank[0]?.total || 0,
      otherIncome: otherIncome[0]?.total || 0,
      otherExpense: otherExpense[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// সমস্ত member balance report
app.get("/api/members-balance-report", async (req, res) => {
  try {
    const members = await Member.find();

    const report = await Promise.all(
      members.map(async (member) => {
        const memberId = member.memberId;

        // Loan collection থেকে এই member এর সব loans
        const loans = await Loan.find({ memberId });

        // Loan balance & collection calculate
        let totalLoanGiven = 0;
        let totalLoanCollection = 0;
        loans.forEach((loan) => {
          totalLoanGiven += loan.initialLoanAmount || 0;
          loan.collections.forEach((c) => {
            totalLoanCollection += c.amount || 0;
          });
        });

        // DPS
        const dpsSettings = await DpsSetting.find({ memberId });
        let totalDPSDeposit = 0;
        let totalDPSBalance = 0;
        dpsSettings.forEach((dps) => {
          dps.collections.forEach((c) => {
            totalDPSDeposit += c.collectedAmount || 0;
            totalDPSBalance += c.balance || 0;
          });
        });

        // FDR
        const fdrSettings = await FdrSetting.find({ memberId });
        let totalFDRDeposit = 0;
        fdrSettings.forEach((fdr) => {
          totalFDRDeposit += fdr.fdrAmount || 0;
        });

        return {
          memberId,
          name: member.name,
          mobile: member.mobileNumber || "-",
          address: member.address || "-",
          totalLoanGiven,
          totalLoanCollection,
          totalDPSDeposit,
          totalDPSBalance,
          totalFDRDeposit,
          loans,
          dpsSettings,
          fdrSettings,
        };
      })
    );

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//কিস্তি কালেকশন এর ওপর ভিত্তি করে লভ্যাংশ রিপোর্ট
app.get("/api/installment-profit-report", async (req, res) => {
  try {
    const loans = await Loan.find({});
    const members = await Member.find({}); // সমস্ত member fetch

    let report = [];
    let totalProfit = 0;
    let totalPrincipal = 0;

    for (let loan of loans) {
      // member info fetch
      const member = members.find(m => m.memberId === loan.memberId);

      for (let collection of loan.collections) {
        const collectionDate = new Date(collection.collectionDate);
        const interest = loan.totalLoan * (loan.dividend / 100);
        const principalReceived = collection.amount - interest;

        totalProfit += interest;
        totalPrincipal += principalReceived;

        report.push({
          date: collectionDate,
          type: "লোন কিস্তি",
          memberName: loan.name,
          mobileNumber: member?.mobileNumber || "-", // mobile number যোগ
          amount: collection.amount,
          loanInterest: interest,
          principalReceived: principalReceived,
          totalProfit: interest,
          description: collection.description || "-",
        });
      }
    }

    res.json({ report, totalProfit, totalPrincipal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//show all data in সদস্যের লেনদেন রিপোর্ট
// ✅ সব সদস্যের লেনদেন রিপোর্ট 

app.post("/api/member-transaction-report", async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "তারিখ প্রদান করুন!" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // =========================
    // 🔹 সব সদস্যদের ডেটা একবারে নিয়ে আসা
    // =========================
    const allMembers = await Member.find({}, "memberId name mobileNumber _id");

    // map বানানো — both _id এবং memberId দিয়ে
    const memberMap = {};
    allMembers.forEach((m) => {
      memberMap[String(m._id)] = {
        name: m.name,
        mobileNumber: m.mobileNumber,
        code: m.memberId,
      };
      memberMap[m.memberId] = {
        name: m.name,
        mobileNumber: m.mobileNumber,
        code: m.memberId,
      };
    });

    // helper function for safety
    const getMemberInfo = (id) => memberMap[String(id)] || memberMap[id] || {};

    // =========================
    // ✅ Loan Transactions
    // =========================
    const loans = await Loan.find({});
    const loanTransactions = loans.flatMap((loan) =>
      (loan.collections || [])
        .filter((c) => {
          const colDate = new Date(c.collectionDate || c.createdAt);
          return colDate >= start && colDate <= end;
        })
        .map((c) => {
          const memberInfo = getMemberInfo(loan.member || loan.memberId);
          return {
            type: "Loan",
            memberName: memberInfo.name || "N/A",
            memberCode: memberInfo.code || loan.memberId || "N/A",
            mobile: memberInfo.mobileNumber || "-",
            amount: c.amount,
            date: c.collectionDate || c.createdAt,
          };
        })
    );

    // =========================
    // ✅ DPS Transactions
    // =========================
    const dpsSettings = await DpsSetting.find({});
    const dpsTransactions = dpsSettings.flatMap((dps) =>
      (dps.collections || [])
        .filter((c) => {
          const colDate = new Date(c.date);
          return colDate >= start && colDate <= end;
        })
        .map((c) => {
          const memberInfo = getMemberInfo(dps.memberId);
          return {
            type: "DPS",
            memberName: memberInfo.name || "N/A",
            memberCode: memberInfo.code || dps.memberId || "N/A",
            mobile: memberInfo.mobileNumber || "-",
            amount: c.collectedAmount,
            date: c.date,
          };
        })
    );

    // =========================
    // ✅ FDR Transactions
    // =========================
    const fdrSettings = await FdrSetting.find({});
    const fdrTransactions = fdrSettings
      .filter((fdr) => {
        const colDate = new Date(fdr.collectionDate || fdr.createdAt);
        return colDate >= start && colDate <= end;
      })
      .map((fdr) => {
        const memberInfo = getMemberInfo(fdr.memberId);
        return {
          type: "FDR",
          memberName: memberInfo.name || "N/A",
          memberCode: memberInfo.code || fdr.memberId || "N/A",
          mobile: memberInfo.mobileNumber || "-",
          amount: fdr.fdrAmount,
          date: fdr.collectionDate || fdr.createdAt,
        };
      });

    // =========================
    // Merge all transactions
    // =========================
    const transactions = [...loanTransactions, ...dpsTransactions, ...fdrTransactions];
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      startDate,
      endDate,
      total: transactions.length,
      transactions,
    });
  } catch (error) {
    console.error("Transaction report error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});






// 🔹 Webhook (optional for get SMS reply)
app.post("/webhook/sms", async (req, res) => {
  console.log("📨 Webhook Received:", req.body);
  res.status(200).json({ message: "Webhook Received" });
});



// ✅ Logo Schema
const logoSchema = new mongoose.Schema({
  title: String,
  logoUrl: String,
  orgName: String, // নতুন ফিল্ড
  address: String, // নতুন ফিল্ড
  date: String, // নতুন ফিল্ড
  mobileNumber: String, // নতুন ফিল্ড
});

const Logo = mongoose.model("Logo", logoSchema);

// ✅ POST API (save logo info)
app.post("/api/logo", async (req, res) => {
  try {
    const { title, logoUrl, orgName, address, date, mobileNumber } = req.body;
    const newLogo = new Logo({ title, logoUrl, orgName, address, date, mobileNumber });
    await newLogo.save();
    res.status(200).json({ message: "✅ Logo saved successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "❌ Failed to save logo" });
  }
});

// get latest logo
app.get("/api/logo-get", async (req, res) => {
  try {
    const logos = await Logo.find().sort({ _id: -1 }).limit(1); // latest logo
    res.status(200).json(logos[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch logo" });
  }
});




/* ===================================================
   =============== Test Route ========================
   =================================================== */
app.get("/", (req, res) => {
  res.send("Somiti Backend Running ✅");
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
