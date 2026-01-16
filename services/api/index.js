const express = require("express");
const { Kafka } = require("kafkajs");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const kafka = new Kafka({ 
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer();
const pool = new Pool();

let producerReady = false;

// Connexion au producer Kafka avec retry
(async () => {
  try {
    await producer.connect();
    producerReady = true;
    console.log("✅ Kafka producer connected");
  } catch (err) {
    console.error("❌ Failed to connect to Kafka:", err.message);
    process.exit(1);
  }
})();

// Health check endpoint
app.get("/health", (req, res) => {
  if (producerReady) {
    res.json({ status: "ok", kafka: "connected" });
  } else {
    res.status(503).json({ status: "not ready", kafka: "disconnected" });
  }
});

// Endpoint pour ajouter un étudiant (via Kafka)
app.post("/students", async (req, res) => {
  try {
    if (!producerReady) {
      return res.status(503).json({ error: "Kafka not ready" });
    }

    const { nom, prenom, numero, email } = req.body;
    
    if (!nom || !prenom || !numero || !email) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    await producer.send({
      topic: "students",
      messages: [{ value: JSON.stringify(req.body) }]
    });

    console.log("📤 Student sent to Kafka:", req.body);
    res.json({ status: "sent to kafka", data: req.body });
  } catch (err) {
    console.error("❌ Error sending to Kafka:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint pour récupérer tous les étudiants (depuis PostgreSQL)
app.get("/students", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students ORDER BY id DESC");
    console.log(`📊 Retrieved ${result.rows.length} students from DB`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching students:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, closing connections...");
  await producer.disconnect();
  await pool.end();
  process.exit(0);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 API server ready on port ${PORT}`);
});