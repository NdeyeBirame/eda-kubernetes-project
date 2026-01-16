const { Kafka } = require("kafkajs");
const { Pool } = require("pg");

const kafka = new Kafka({ 
  brokers: [process.env.KAFKA_BROKER],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: "students-group" });
const pool = new Pool();

// Fonction pour attendre que PostgreSQL soit prêt
async function waitForPostgres() {
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query("SELECT 1");
      console.log("✅ PostgreSQL is ready");
      return;
    } catch (err) {
      console.log(`⏳ Waiting for PostgreSQL... (${retries} retries left)`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  throw new Error("PostgreSQL not available after retries");
}

// Fonction pour attendre que Kafka soit prêt
async function waitForKafka() {
  let retries = 10;
  while (retries > 0) {
    try {
      await consumer.connect();
      console.log("✅ Kafka consumer connected");
      return;
    } catch (err) {
      console.log(`⏳ Waiting for Kafka... (${retries} retries left)`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  throw new Error("Kafka not available after retries");
}

(async () => {
  try {
    // Attendre PostgreSQL
    await waitForPostgres();

    // Créer la table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS students(
        id SERIAL PRIMARY KEY,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        numero TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Table 'students' ready");

    // Attendre Kafka
    await waitForKafka();

    // S'abonner au topic
    await consumer.subscribe({ topic: "students", fromBeginning: true });
    console.log("✅ Subscribed to topic 'students'");

    // Traiter les messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const studentData = JSON.parse(message.value.toString());
          
          await pool.query(
            "INSERT INTO students(nom, prenom, numero, email) VALUES($1, $2, $3, $4)",
            [studentData.nom, studentData.prenom, studentData.numero, studentData.email]
          );
          
          console.log("💾 Student saved to DB:", studentData);
        } catch (err) {
          console.error("❌ Error processing message:", err.message);
        }
      }
    });

    console.log("🎧 Integration service listening for messages...");

  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, closing connections...");
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
});