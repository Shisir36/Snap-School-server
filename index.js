const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken');
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware 
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


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
        const paymentCollection = client.db('snap-school').collection('payments');
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })

            res.send({ token })
        })
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }
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

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });
        app.get("/users/instructors", async(req, res) =>{
          const query = {role: "instructor"}
          const result = await usersCollection.find(query).toArray()
          res.send(result)
        })
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
        /*******************/
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        });
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        });
        /****************/
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })
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
            // const decodedEmail = req.decoded.email;
            // if (email !== decodedEmail) {
            //   return res.status(403).send({ error: true, message: 'porviden access' })
            // }      
            const query = { email: email };
            const result = await classCartCollections.find(query).toArray();
            res.send(result);
        });
        app.post("/classesCart", async (req, res) => {
            const addedClass = req.body
            const result = await classCartCollections.insertOne(addedClass)
            res.send(result)
        })
        app.delete('/classesCart/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id : new ObjectId(id)}
            const result = await classCartCollections.deleteOne(query);
            res.send(result);
    
        })
        app.get("/myClassCart/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCartCollections.findOne(query);
            res.send(result); // Modify this line accordingly
        });
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
        app.get('/classes/enrollment', async (req, res) => {
            try {
                const classes = await classesCollections.find().sort({ totalEnrolledStudents: -1 }).toArray();
                res.json(classes);
            } catch (error) {
                res.status(500).json({ error: 'Failed to fetch classes' });
            }
        });        
        app.get('/myclasses', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            }

            const result = await classesCollections.find(query).toArray();
            res.send(result)
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

        // Payment***********
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const classItemId = payment.cartItems;

            const query = { _id: new ObjectId(classItemId) };
            const deleteResult = await classCartCollections.deleteOne(query);
            const ClassesId = payment.classItems
            const classId = new ObjectId(ClassesId);

            // Check if the class document exists and if the totalEnrolledStudents field exists
            const classDocument = await classesCollections.findOne({ _id: classId });

            if (!classDocument || classDocument.totalEnrolledStudents === undefined) {
                // Set totalEnrolledStudents to 0 if the class document is null or totalEnrolledStudents doesn't exist
                await classesCollections.updateOne(
                    { _id: classId },
                    { $set: { totalEnrolledStudents: 0 } }
                );
            }

            // Increment totalEnrolledStudents field by 1 and decrement availableSeats by 1
            const updateResult = await classesCollections.findOneAndUpdate(
                { _id: classId },
                { $inc: { availableSeats: -1, totalEnrolledStudents: 1 } },
                { returnOriginal: false }
            );

            res.send({ insertResult, deleteResult, updatedClass: updateResult });
        });

        app.get('/enrolledclasses', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            }

            const result = await paymentCollection.find(query).toArray();
            res.send(result)
        });
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
app.get("/", (req, res) => {
    res.send("data is running ")
})

app.listen(port, () => {
    console.log(`data is running on port ${port}`);
})

// snap-school
// YbtOVoumYK22coYC