const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware 
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
    res.send("data is running ")
})

app.listen(port, () => {
    console.log(`data is running on port ${port}`);
})

// mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nbenc92.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const classesCollections = client.db("snap-school").collection('classes');
        const instructorsCollections = client.db("snap-school").collection('instructors');
        const classCartCollections = client.db("snap-school").collection('classCart');
        const usersCollection = client.db("snap-school").collection("users");
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        app.get('/classes', async (req, res) => {
            const cursor = classesCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/instructors', async (req, res) => {
            const cursor = instructorsCollections.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        // users
        // verifyJWT, verifyAdmin,
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            console.log(existingUser);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        app.get('/classesCart', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await classCartCollections.find(query).toArray();
            res.send(result);
        });
        app.post("/classesCart", async (req, res) => {
            const addedClass = req.body
            const result = await classCartCollections.insertOne(addedClass)
            res.send(result)
        })
        app.post('/classes', async (req, res) => {
            const newClass = req.body
            const result = await classesCollections.insertOne(newClass);
            res.send(result);
        });
        app.get('/classes', async (req, res) => {
            let query = {};
            if (req.query.email) {
                query = { email: req.query.email };
            }
            const result = await classesCollections.find(query).toArray();
            res.send(result);
        });
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            let updateDoc;

            if (req.body.action === 'approve') {
                updateDoc = {
                    $set: {
                        status: 'approved'
                    }
                };
            } else if (req.body.action === 'deny') {
                updateDoc = {
                    $set: {
                        status: 'denied'
                    }
                };
            } else if (req.body.action === 'feedback') {
                updateDoc = {
                    $set: {
                        feedback: req.body.feedback
                    }
                };
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }

            const result = await classesCollections.findOneAndUpdate(filter, updateDoc);
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// snap-school
// YbtOVoumYK22coYC