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

async function run() {
  try {
    await client.connect();

    const db = client.db("community");
    const complaintsCollection = db.collection("complaints");
    const userinfoCollection = db.collection("userinfo");


    // details
    app.get("/complaints/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const complaint = await complaintsCollection.findOne(query);
      res.send(complaint);
    });



    // Get single user by email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userinfoCollection.findOne(
          { useremail: email },
          { projection: { username: 1, useremail: 1, image: 1, contributed: 1 } }
        );

        if (!user) {
          return res.status(404).send({ success: false, message: "User not found" });
        }

        res.send(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });





    // Get all complaints
    app.get('/complaints', async (req, res) => {
      try {
        const result = await complaintsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: "Error fetching complaints" });
      }
    });

    // User registration (signup)
    app.post('/register', async (req, res) => {
      try {
        const { username, useremail, password, image } = req.body;

        if (!username || !useremail || !password) {
          return res.status(400).send({ success: false, message: "All fields required" });
        }

        // check if email exists
        const existingUser = await userinfoCollection.findOne({ useremail });
        if (existingUser) {
          return res.status(409).send({ success: false, message: "Email already exists" });
        }

        // insert new user
        await userinfoCollection.insertOne({ username, useremail, password, image });
        res.send({ success: true, message: "User registered successfully" });

      } catch (err) {
        console.error("Signup error:", err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    //  User login
    app.post('/login', async (req, res) => {
      try {
        const { useremail, password } = req.body;

        if (!useremail || !password) {
          return res.status(400).send({ success: false, message: "Email and password required" });
        }

        const user = await userinfoCollection.findOne({ useremail });

        if (!user) {
          return res.status(404).send({ success: false, message: "User not found" });
        }

        if (user.password !== password) {
          return res.status(401).send({ success: false, message: "Incorrect password" });
        }

        res.send({
          success: true,
          message: "Login successful",
          user: {
            id: user._id,
            username: user.username,
            useremail: user.useremail,
            image: user.image
          }
        });

      } catch (err) {
        console.error("Login error:", err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });


    app.post('/complaints', async (req, res) => {
      try {
        const { Title, Category, Location, Description, Image, Amount, Date, AddedBy, Status } = req.body;

        if (!Title || !Category || !Location || !Description || !Amount || !Date || !Status) {
          return res.status(400).send({ success: false, message: "All fields required" });
        }

        const existingComplaint = await complaintsCollection.findOne({ Title });
        if (existingComplaint) {
          return res.status(409).send({ success: false, message: "Issue already exists" });
        }

        // insert new user
        await complaintsCollection.insertOne({ Title, Category, Location, Description, Image, Amount, Date, AddedBy, Status });
        res.send({ success: true, message: "Issue added successfully" });

      } catch (err) {
        console.error("Error:", err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // update er jonno
    app.put("/complaints/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const result = await complaintsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Issue updated successfully!" });
        } else {
          res.send({ success: false, message: "Nothing to update." });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });



    // Delete 
    app.delete("/complaints/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid issue ID" });
        }

        const result = await complaintsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Issue deleted successfully!" });
        } else {
          res.send({ success: false, message: "No issue found to delete." });
        }
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });



    // Contribute to a complaint
    app.patch("/complaints/contribute/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { contribution, useremail } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid issue ID" });
        }

        const complaint = await complaintsCollection.findOne({ _id: new ObjectId(id) });
        if (!complaint) {
          return res.status(404).send({ success: false, message: "Issue not found" });
        }

        const fundCollected = (complaint.FundCollected || 0) + Number(contribution);
        const remainingAmount = Math.max(complaint.Amount - Number(contribution), 0);

        await complaintsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { FundCollected: fundCollected, Amount: remainingAmount } }
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


        res.send({ success: true, message: "Contribution added successfully!" });
      } catch (error) {
        console.error("Contribution error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });






    // Save contribution details to a new collection named "contribution"
    app.post("/contribution", async (req, res) => {
      try {
        const { Title, Category, PaidAmount, Paidby } = req.body;

        if (!Title || !Category || !PaidAmount || !Paidby) {
          return res.status(400).send({ success: false, message: "All fields are required" });
        }

        const contributionCollection = client.db("community").collection("contribution");

        const newContribution = {
          Title,
          Category,
          PaidAmount: Number(PaidAmount),
          Paidby
        };

        await contributionCollection.insertOne(newContribution);

        res.send({ success: true, message: "Contribution record added successfully!" });
      } catch (error) {
        console.error("Error saving contribution:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });



    app.get("/contribution/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const contributionsCollection = client.db("community").collection("contribution");
        const userContributions = await contributionsCollection.find({ Paidby: email }).toArray();
        if (!userContributions || userContributions.length === 0) {
          return res.status(404).send({ success: false, message: "No contributions found" });
        }
        res.send(userContributions);
      } catch (error) {
        console.error("Error fetching contributions:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });








    // Test route
    app.get('/', (req, res) => {
      res.send('Server is running fine!');
    });

    // MongoDB ping test
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
