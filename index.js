require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.NAME}:${process.env.PASSWORD}@cluster0.edoaalr.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully!");

    const db = client.db("community");
    const complaintsCollection = db.collection("complaints");
    const userinfoCollection = db.collection("userinfo");
    const contributionCollection = db.collection("contribution");

    // Test route
    app.get('/', (req, res) => res.send('Server is running fine!'));

    // ------------------- Complaints Routes -------------------

    // Get single complaint
    app.get("/complaints/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).send({ success: false, message: "Invalid ID" });
        const complaint = await complaintsCollection.findOne({ _id: new ObjectId(id) });
        if (!complaint) return res.status(404).send({ success: false, message: "Complaint not found" });
        res.send(complaint);
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Get all complaints
    app.get('/complaints', async (req, res) => {
      try {
        const result = await complaintsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Error fetching complaints" });
      }
    });

    // Create complaint
    app.post('/complaints', async (req, res) => {
      try {
        const { Title, Category, Location, Description, Image, Amount, Date, AddedBy, Status } = req.body;
        if (!Title || !Category || !Location || !Description || !Amount || !Date || !Status)
          return res.status(400).send({ success: false, message: "All fields required" });

        const existing = await complaintsCollection.findOne({ Title });
        if (existing) return res.status(409).send({ success: false, message: "Issue already exists" });

        await complaintsCollection.insertOne({ Title, Category, Location, Description, Image, Amount: Number(Amount), FundCollected: 0, Date, AddedBy, Status });
        res.send({ success: true, message: "Issue added successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Contribute to a complaint
    app.patch("/complaints/contribute/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { contribution, useremail } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).send({ success: false, message: "Invalid issue ID" });
        if (!contribution || Number(contribution) <= 0) return res.status(400).send({ success: false, message: "Invalid contribution" });

        const complaint = await complaintsCollection.findOne({ _id: new ObjectId(id) });
        if (!complaint) return res.status(404).send({ success: false, message: "Issue not found" });

        // Use $inc for atomic updates
        await complaintsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: {
              FundCollected: Number(contribution),
              Amount: -Number(contribution)
            }
          }
        );

        if (useremail) {
          const user = await userinfoCollection.findOne({ useremail });
          if (user) {
            await userinfoCollection.updateOne(
              { useremail },
              { $inc: { contributed: Number(contribution) } }
            );
          } else {
            await userinfoCollection.insertOne({
              useremail,
              contributed: Number(contribution),
            });
          }
        }

        // Save contribution record
        await contributionCollection.insertOne({
          Title: complaint.Title,
          Category: complaint.Category,
          PaidAmount: Number(contribution),
          Paidby: useremail
        });

        res.send({ success: true, message: "Contribution added successfully!" });
      } catch (error) {
        console.error("Contribution error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // ------------------- User Routes -------------------

    app.post('/register', async (req, res) => {
      try {
        const { username, useremail, password, image } = req.body;
        if (!username || !useremail || !password) return res.status(400).send({ success: false, message: "All fields required" });

        const existingUser = await userinfoCollection.findOne({ useremail });
        if (existingUser) return res.status(409).send({ success: false, message: "Email already exists" });

        await userinfoCollection.insertOne({ username, useremail, password, image, contributed: 0 });
        res.send({ success: true, message: "User registered successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.post('/login', async (req, res) => {
      try {
        const { useremail, password } = req.body;
        if (!useremail || !password) return res.status(400).send({ success: false, message: "Email and password required" });

        const user = await userinfoCollection.findOne({ useremail });
        if (!user) return res.status(404).send({ success: false, message: "User not found" });
        if (user.password !== password) return res.status(401).send({ success: false, message: "Incorrect password" });

        res.send({ success: true, message: "Login successful", user });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userinfoCollection.findOne({ useremail: email }, { projection: { username: 1, useremail: 1, image: 1, contributed: 1 } });
        if (!user) return res.status(404).send({ success: false, message: "User not found" });
        res.send(user);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/userinfo", async (req, res) => {
      try {
        const users = await userinfoCollection.find().toArray();
        res.send(users);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // ------------------- Contribution Routes -------------------

    app.get("/contribution/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const contributions = await contributionCollection.find({ Paidby: email }).toArray();
        if (!contributions.length) return res.status(404).send({ success: false, message: "No contributions found" });
        res.send(contributions);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/contribution", async (req, res) => {
      try {
        const allContributions = await contributionCollection.find().toArray();
        res.send(allContributions);
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // ------------------- Start Server -------------------
    app.listen(port, () => console.log(`Server listening on port ${port}`));
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

startServer();
