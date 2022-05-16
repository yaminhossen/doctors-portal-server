const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { get } = require('express/lib/response');
const app = express()
const port = process.env.PORT || 5000;

// midleware

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5m7ob.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookinCollection = client.db('doctors_portal').collection('bookings');
        const userCollection = client.db('doctors_portal').collection('users');

        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })
        // app.get('/cooking', async (req, res) => {
        //     const query = {};
        //     const cursor = bookinCollection.find(query);
        //     const services = await cursor.toArray();
        //     res.send(services);
        // })

        app.get('/available', async (req, res) => {
            const date = req.query.date || "May 14, 2022";
            // step 1: get all services
            const services = await serviceCollection.find().toArray();

            // Step 2: get the booking of that day
            const query = { date: date };
            const bookings = await bookinCollection.find(query).toArray();

            // Step 3: for each service 
            services.forEach(service => {
                // find the booking for that  services
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // select slots for service Booking
                const bookedSlots = serviceBookings.map(book => book.slot);
                // select those slot that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                // set available to slots to make it easier
                service.slots = available;
            })

            res.send(services);
        })

        /**
         * API naming convention
         * app.get('/booking') // get all booking in this convention or more than one
         * app.get('/booking/:id') // get a specific booking
         * app.post('/booking') // add a new booking
         * app.put('/booking') // upsert  (if exist then update) == (else insert)
         * app.patch('/booking/:id') //update a specific booking
         * app.delete('/booking/:id') // delete specific one
         * */


        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
                const query = { patient: patient };
                const bookings = await bookinCollection.find(query).toArray();
                return res.send(bookings);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }

        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookinCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookinCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

    }
    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello From doctors!')
})

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})